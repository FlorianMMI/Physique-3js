import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Ciel bleu

// Créer une plateforme circulaire plus grande
const platformRadius = 40;
const platformGeometry = new THREE.CylinderGeometry(platformRadius, platformRadius, 2, 32);
const platformMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4a4a4a,
    roughness: 0.7,
    metalness: 0.3
});
const platform = new THREE.Mesh(platformGeometry, platformMaterial);
platform.position.y = -1;
scene.add(platform);

// Bordure de la plateforme
const edgeGeometry = new THREE.TorusGeometry(platformRadius, 0.3, 16, 100);
const edgeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.5
});
const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
edge.rotation.x = Math.PI / 2;
edge.position.y = 0;
scene.add(edge);




// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Camera setup
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 40);
camera.lookAt(0, 0, 0);

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 10;
controls.maxDistance = 200;
controls.target.set(0, 0, 0);
controls.update();

// Camera follow configuration: offset is in local car space (x, y, z)
const cameraFollow = {
    // put camera behind the car: negative Z in local car space
    offset: new THREE.Vector3(0, 2.5, -6), // behind and above the car
    lerp: 0.12, // smoothing for camera position
    targetLerp: 0.15, // smoothing for controls target
    enabled: true
};


// === Système de particules dynamique ===
const particles = [];

// --- Multiplayer networking avec interpolation améliorée ---
const players = new Map(); // id -> { mesh, targetPos, targetRot, velocity, lives, isDead, color }
let localId = null;
let carModelTemplate = null; // GLTF scene template to clone for remote players
let socket = null;
let gameState = {
    isGameActive: false, // Commence inactif, attend que l'host lance
    winnerId: null,
    playerCount: 0,
    isHost: false, // Si ce client est l'hôte
    canPlay: false // Si ce client peut jouer (pas juste spectateur)
};

// Fonction pour obtenir un spawn aléatoire sur la plateforme
function getRandomSpawnPosition() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (platformRadius - 5); // 5 unités de marge
    return {
        x: Math.cos(angle) * distance,
        y: 0.2,
        z: Math.sin(angle) * distance,
        rotY: Math.random() * Math.PI * 2
    };
}

try {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // connect to same host on port 3000 by default
    const wsUrl = `${proto}://${window.location.hostname}:${window.location.port || 3000}`;
    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
        console.log('WS connected to', wsUrl);
    });
    socket.addEventListener('message', (ev) => {
        try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'welcome') {
                localId = msg.id;
                gameState.isHost = msg.isHost;
                gameState.canPlay = msg.canPlay;
                gameState.isGameActive = msg.gameActive;
                console.log('Assigned id', localId, '| Host:', gameState.isHost, '| Can play:', gameState.canPlay);
                
                // Afficher UI de contrôle si hôte
                if (gameState.isHost) {
                    showHostControls();
                }
                
                // Si le jeu n'est pas actif et qu'on ne peut pas jouer, mode spectateur
                if (!gameState.canPlay) {
                    enterSpectatorMode();
                    const spectatorMsg = document.getElementById('spectator-message');
                    if (spectatorMsg) {
                        spectatorMsg.innerHTML = '👀 MODE SPECTATEUR 👀<br><span style="font-size: 16px;">Partie en cours, vous rejoindrez la prochaine</span>';
                    }
                }
            } else if (msg.type === 'disconnect') {
                if (players.has(msg.id)) {
                    const p = players.get(msg.id);
                    scene.remove(p.mesh);
                    players.delete(msg.id);
                }
            } else if (msg.type === 'state') {
                // update or create remote player
                const id = msg.sender;
                if (id === localId) return;
                let p = players.get(id);
                if (!p) {
                    // Générer une couleur aléatoire pour ce joueur
                    const playerColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
                    
                    let mesh;
                    if (carModelTemplate) {
                        // clone the template for the remote player
                        mesh = carModelTemplate.clone(true);
                        mesh.traverse((c) => { 
                            if (c.isMesh) {
                                c.castShadow = false;
                                // S'assurer que les matériaux sont bien clonés et colorés
                                if (c.material) {
                                    c.material = c.material.clone();
                                    // Appliquer la couleur aléatoire
                                    c.material.color = playerColor.clone();
                                }
                            }
                        });
                        mesh.scale.set(0.8, 0.8, 0.8);
                        mesh.position.set(msg.x, msg.y, msg.z);
                        mesh.rotation.y = msg.rotY || Math.PI;
                        scene.add(mesh);
                        console.log('Created remote player car with model for id', id, 'color:', playerColor.getHexString());
                    } else {
                        // Placeholder temporaire (sera remplacé quand le modèle charge)
                        mesh = new THREE.Mesh(
                            new THREE.BoxGeometry(1.6, 0.8, 3.2), 
                            new THREE.MeshStandardMaterial({ 
                                color: playerColor,
                                roughness: 0.7,
                                metalness: 0.3
                            })
                        );
                        mesh.position.set(msg.x, msg.y, msg.z);
                        mesh.rotation.y = msg.rotY || Math.PI;
                        scene.add(mesh);
                        console.log('Created remote player placeholder (model not loaded yet) for id', id);
                    }
                    players.set(id, { 
                        mesh,
                        targetPos: new THREE.Vector3(msg.x, msg.y, msg.z),
                        targetRot: msg.rotY || 0,
                        velocity: new THREE.Vector3(msg.vx || 0, 0, msg.vz || 0),
                        lives: msg.lives || 3,
                        isDead: false,
                        isPlaceholder: !carModelTemplate,
                        color: playerColor
                    });
                } else {
                    // update target position et rotation pour interpolation fluide
                    p.targetPos.set(msg.x, msg.y, msg.z);
                    p.targetRot = msg.rotY || p.targetRot;
                    if (msg.vx !== undefined && msg.vz !== undefined) {
                        p.velocity.set(msg.vx, 0, msg.vz);
                    }
                    if (msg.lives !== undefined) {
                        p.lives = msg.lives;
                        p.isDead = msg.lives <= 0;
                    }
                }
            } else if (msg.type === 'collision_push') {
                // Recevoir une poussée de collision
                if (msg.target === localId && car.mesh && !car.isDead) {
                    const pushForce = new THREE.Vector3(msg.forceX || 0, msg.forceY || 0, msg.forceZ || 0);
                    car.mesh.position.add(pushForce);
                    car.speed *= 0.5; // Réduire vitesse de celui qui est frappé
                    flashCollisionEffect();
                }
            } else if (msg.type === 'you_are_host') {
                // Devenir le nouvel hôte
                gameState.isHost = true;
                console.log('You are now the host!');
                showHostControls();
            } else if (msg.type === 'game_restart') {
                // Redémarrer le jeu
                handleGameRestart(msg);
            } else if (msg.type === 'game_over') {
                // Quelqu'un a gagné
                handleGameOver(msg);
            }
        } catch (e) {
            console.warn('WS message parse error', e);
        }
    });

    // helper to send state - augmenté avec vélocité et vies
    function sendState() {
        if (socket.readyState === WebSocket.OPEN && car.mesh) {
            const pos = car.mesh.position;
            const rotY = car.mesh.rotation.y;
            // Calculer vélocité approximative basée sur la vitesse de la voiture
            const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(car.mesh.quaternion);
            const vx = forwardVec.x * car.speed * 0.1;
            const vz = forwardVec.z * car.speed * 0.1;
            const obj = { 
                type: 'state', 
                x: pos.x, 
                y: pos.y, 
                z: pos.z, 
                rotY,
                vx,
                vz,
                lives: car.lives
            };
            socket.send(JSON.stringify(obj));
        }
    }
    // Augmenter fréquence à 20Hz pour moins de lag
    setInterval(sendState, 50);
} catch (e) {
    console.warn('Multiplayer disabled:', e);
}

// Fonction pour notifier que le joueur est tombé
function notifyFall() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
            type: 'player_fell'
        }));
    }
}

// Fonction pour notifier changement de vies
function notifyLivesChange(lives) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
            type: 'lives_update',
            lives: lives
        }));
    }
}

// Gérer redémarrage du jeu
function handleGameRestart(msg) {
    console.log('Game restarting!');
    gameState.isGameActive = true;
    gameState.winnerId = null;
    gameState.canPlay = true; // Tout le monde peut jouer maintenant
    
    // Réinitialiser le joueur local
    car.lives = 3;
    car.isDead = false;
    const spawn = getRandomSpawnPosition();
    if (car.mesh) {
        car.mesh.position.set(spawn.x, spawn.y, spawn.z);
        car.mesh.rotation.y = spawn.rotY;
        car.speed = 0;
    }
    
    // Réinitialiser les joueurs distants
    players.forEach((player) => {
        player.lives = 3;
        player.isDead = false;
    });
    
    // Réactiver le suivi de caméra
    cameraFollow.enabled = true;
    
    // Supprimer tous les messages UI
    const existingMsg = document.getElementById('game-message');
    if (existingMsg) existingMsg.remove();
    
    const spectatorMsg = document.getElementById('spectator-message');
    if (spectatorMsg) spectatorMsg.remove();
    
    // Mettre à jour contrôles hôte
    updateHostControls();
}

// Gérer game over
function handleGameOver(msg) {
    console.log('Game Over! Winner:', msg.winnerId);
    gameState.isGameActive = false;
    gameState.winnerId = msg.winnerId;
    
    if (msg.winnerId === null) {
        showDrawMessage();
    } else if (msg.winnerId === localId) {
        showVictoryMessage();
    } else {
        showDefeatMessage(msg.winnerId);
    }
    
    // Mettre à jour les contrôles de l'hôte pour permettre de relancer
    updateHostControls();
}

// -----------------------------
// Système de vent (documenté)
// -----------------------------
// On modélise un champ de vent 2D (x,z) qui varie dans le temps.
// Le vent est composé de :
// - une oscillation douce (sinusoïdale) pour simuler une brise régulière,
// - des rafales aléatoires (gusts) qui apparaissent rarement et modifient
//   temporairement la composante horizontale du vent.
//
// Le vent est appliqué aux particules de deux façons :
// 1) une impulsion initiale lors de l'émission (pour donner un départ cohérent),
// 2) un forçage continu pendant l'intégration (ajouté à la vitesse à chaque frame),
//    proportionnel au pas de temps `dt` pour garder le comportement indépendant
//    de la fréquence d'images.

// Vecteur courant du vent (en unités de vitesse)
let wind = new THREE.Vector3(0.2, 0, 0);
// Horloge interne du vent (pour l'oscillation)
let windTime = 0;
// Paramètres réglables du vent (exposés ici pour les ajustements)
const windParams = {
    // multiplicateur global de la force du vent
    strength: 1.0,
    // probabilité par frame d'une rafale soudaine (0..1)
    gustChance: 0.01,
    // amplitude maximale additionnelle d'une rafale
    gustMax: 1.2,
    // combien rapidement le vent influence la vitesse des particules
    response: 1.0
};
let prevTime = performance.now();

/**
 * Met à jour le champ de vent en fonction du temps.
 * dt : temps écoulé (s) depuis la dernière frame — utilisé pour avancer l'horloge.
 */
function updateWind(dt) {
    // avance le compteur temporel
    windTime += dt;

    // composantes de base (oscillations lentes et différentes sur x et z)
    const baseX = Math.sin(windTime * 0.25) * 0.4; // oscillation lente en X
    const baseZ = Math.cos(windTime * 0.15) * 0.25; // oscillation encore plus lente en Z

    // rafale aléatoire : rarement on ajoute une composante supplémentaire
    const gust = (Math.random() < windParams.gustChance)
        ? (Math.random() * windParams.gustMax) * (Math.random() > 0.5 ? 1 : -1)
        : 0;

    // met à jour le vecteur vent en multipliant par le multiplicateur global
    wind.set(baseX + gust, 0, baseZ).multiplyScalar(windParams.strength);
}
const maps = [];
let textureLoader = new THREE.TextureLoader();
for (let i =0; i < 91 ; i++){
    maps.push(textureLoader.load('sprite/smoke/' + String(i).padStart(4, '0' ) + '.png' ))
}

const sparkTexture = textureLoader.load('sprite/spark1 (1).png');


const baseMaterial = new THREE.SpriteMaterial({  
    map: sparkTexture,
    transparent : true,
    alphaTest: 0.001,
    color : 0xd3d3d3, // grey clair
    blending : THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    opacity: 1.0
});

// Brake particle base material (red, additive glow)
const brakeBaseMaterial = new THREE.SpriteMaterial({
    map: sparkTexture,
    color: 0xff0000,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
});

// Boost particle material (orange glow)
const boostBaseMaterial = new THREE.SpriteMaterial({
    map: sparkTexture,
    color: 0xff8c00, // dark orange
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
});

// Skid/trail material (black)
const skidBaseMaterial = new THREE.SpriteMaterial({
    map: sparkTexture,
    color: 0x000000,
    transparent: true,
    opacity: 0.9,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false
});


// const material = new THREE.PointsMaterial({
//     size: 10.0,
//     map: sparkTexture,
//     transparent: true,
//     alphaTest: 0.0001,
//     sizeAttenuation: true,
//     vertexColors: false,
//     color: 0xd3d3d3, // grey clair
//     depthWrite: false,
//     depthTest: false,
//     opacity: 0.7,
//     blending: THREE.NormalBlending
// });



const particleGroup = new THREE.Group();
scene.add(particleGroup);

// ---- Car model + simple controller ----
const car = {
    mesh: null,
    speed: 0,
    // increase max speed so the car can go faster
    maxSpeed: 190,
    accel: 20,
    // base values kept for temporary boost calculations
    baseMaxSpeed: 190,
    baseAccel: 20,
    // boost configuration (Shift)
    boostMultiplier: 2.0, // multiplies accel when boosting
    boostMaxMultiplier: 1.5, // multiplies maxSpeed when boosting
    // boost energy (0..1)
    boostEnergy: 1.0,
    boostMaxEnergy: 1.0,
    energyDrainRate: 0.8, // energy units per second drained while boosting
    energyRegenRate: 0.35, // energy units per second regenerated when regen active
    energyRegenDelay: 1.0, // seconds of idle before regen starts
    energyRegenTimer: 0.0, // internal timer
    // skid/drift configuration (Space)
    skidStrength: 0.12, // lateral slide strength
    skidYawMultiplier: 1.8, // extra yaw while skidding
    skidMinSpeed: 2.0, // minimum speed to trigger effective skid
    // reduce turning speed so it turns slightly less sharply
    turnSpeed: Math.PI * 0.6, // rad/s (was Math.PI)
    moving: false,
    // Système de vies
    lives: 3,
    maxLives: 3,
    isDead: false,
    // Collision properties
    collisionRadius: 1.2, // rayon de collision
    collisionCooldown: 0, // temps avant prochaine collision possible
    collisionCooldownTime: 0.5 // secondes (réduit pour plus de réactivité)
};

const loader = new GLTFLoader();
// placeholder while loading
const carPlaceholder = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.6, 2),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
carPlaceholder.position.set(0, 0.3, 0);
scene.add(carPlaceholder);
// rotate placeholder 180deg so the car faces the opposite direction
carPlaceholder.rotation.y += Math.PI;

loader.load('sprite/Mazda RX-7.glb', (gltf) => {
    console.log('Car GLB loaded', gltf);
    // keep the loaded scene as a template (do not add the template itself to the scene)
    carModelTemplate = gltf.scene;

    // create the local car by cloning the template so we can reuse the template for remotes
    car.mesh = carModelTemplate.clone(true);
    
    // Couleur aléatoire pour le joueur local
    const localColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
    car.mesh.traverse((c) => { 
        if (c.isMesh && c.material) {
            c.material = c.material.clone();
            c.material.color = localColor.clone();
        }
    });
    
    // scale/position the local clone
    car.mesh.scale.set(0.8, 0.8, 0.8);
    
    // Spawn aléatoire sur la plateforme
    const spawn = getRandomSpawnPosition();
    car.mesh.position.set(spawn.x, spawn.y, spawn.z);
    car.mesh.rotation.y = spawn.rotY;
    
    scene.add(car.mesh);
    console.log('Local car color:', localColor.getHexString());
    // hide placeholder
    carPlaceholder.visible = false;
    
    // Remplacer les placeholders des joueurs distants par le vrai modèle
    players.forEach((player, id) => {
        if (player.isPlaceholder && player.mesh) {
            console.log('Replacing placeholder with car model for player', id);
            const oldPos = player.mesh.position.clone();
            const oldRot = player.mesh.rotation.y;
            
            // Supprimer le placeholder
            scene.remove(player.mesh);
            
            // Créer nouveau mesh avec le modèle
            const newMesh = carModelTemplate.clone(true);
            newMesh.traverse((c) => { 
                if (c.isMesh) {
                    c.castShadow = false;
                    if (c.material) {
                        c.material = c.material.clone();
                        // Appliquer la couleur du joueur
                        c.material.color = player.color.clone();
                    }
                }
            });
            newMesh.scale.set(0.8, 0.8, 0.8);
            newMesh.position.copy(oldPos);
            newMesh.rotation.y = oldRot;
            scene.add(newMesh);
            
            // Mettre à jour le joueur
            player.mesh = newMesh;
            player.isPlaceholder = false;
        }
    });
}, undefined, (err) => {
    console.error('GLTF load error', err);
});

// add a simple light so the placeholder/model is visible
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
hemi.position.set(0, 20, 0);
scene.add(hemi);

// Lumière directionnelle pour mieux voir les modèles
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(10, 30, 10);
dirLight.castShadow = false;
scene.add(dirLight);

// Lumière ambiante supplémentaire
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Input handling (ZQSD + WASD)
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

/** Emit smoke at a world position */
// emitSmokeAt is disabled — replace with no-op to stop smoke emission
function emitSmokeAt(worldPos) {
    // intentionally empty
}


// Options exposées au GUI
const options = {
    emissionRate: 0, // disable global ambient smoke by default
    particleLifeMin: 1.0,
    particleLifeMax: 15.0,
    particleSizeMin: 12,
    particleSizeMax: 20,
    smokeFadeExponent: 3,
    windStrength: windParams.strength,
    windGustChance: windParams.gustChance,
    windGustMax: windParams.gustMax,
    windResponse: windParams.response,
    blending: 'Normal'
    ,
    // montée / comportement vertical
    // increase default buoyancy so particles rise
    buoyancy: 12.0,       // accélération ascendante (units / s^2)
    // reduce vertical drag so upward motion isn't immediately killed
    verticalDrag: 0.25    // coefficient de traînée vertical (smaller = less drag)
    ,
    // initial vertical velocity range (tweak if particles stay on ground)
    initialVyMin: 2.0,
    initialVyMax: 4.0,
    debug: true,
    debugArrowCount: 30
};

// Debug visuals: group of arrows showing particle velocities
const debugGroup = new THREE.Group();
scene.add(debugGroup);
const debugArrows = [];

// Rich HUD panel
const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
        <div class="title">Physique 3JS</div>
        <div class="row"><div>Vies</div><div id="hud-lives" style="color: #ff3333; font-weight: bold;">❤️ ❤️ ❤️</div></div>
        <div class="row"><div>particles</div><div id="hud-particles">0</div></div>
        <div class="row"><div>avg Vy</div><div id="hud-vy">0.00</div></div>
        <div class="row"><div>Boost</div><div id="hud-boost"><div class="gauge"><div class="gauge-fill" id="hud-boost-fill"></div></div></div></div>
    <!-- GUI removed -->
`;
document.body.appendChild(hud);

const hudParticles = hud.querySelector('#hud-particles');
const hudVy = hud.querySelector('#hud-vy');
const hudBoostFill = hud.querySelector('#hud-boost-fill');
const hudLives = hud.querySelector('#hud-lives');

// Mise à jour du GUI pour les sprites
// GUI removed: no runtime import of lil-gui and no GUI controls

// GUI removed: no HUD toggle behaviour

// === Système de collision entre voitures (SANS perte de vie) ===
// A touche B -> B prend le recul, pas A
function checkCollisions(dt) {
    if (!car.mesh || car.isDead) return;
    
    // Décrémenter cooldown
    if (car.collisionCooldown > 0) {
        car.collisionCooldown -= dt;
    }
    
    // Vérifier collision avec chaque joueur distant
    players.forEach((player, id) => {
        if (!player.mesh || player.isDead) return;
        
        // Zone de collision agrandie
        const collisionDistance = (car.collisionRadius + car.collisionRadius) * 1.3;
        
        // Calculer distance entre voitures
        const dist = car.mesh.position.distanceTo(player.mesh.position);
        
        // Si collision détectée et cooldown expiré
        if (dist < collisionDistance && car.collisionCooldown <= 0) {
            // Calculer vecteur de collision (de A vers B)
            const collisionVector = new THREE.Vector3()
                .subVectors(player.mesh.position, car.mesh.position)
                .normalize();
            
            // Calculer vitesses
            const carVel = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(car.mesh.quaternion)
                .multiplyScalar(car.speed * 0.1);
            
            // Calculer force d'impact basée sur la vitesse de A
            const impactForce = Math.abs(car.speed) * 0.035; // AUGMENTÉ pour plus de recul
            
            // Physique de rebond - SEULEMENT le joueur distant recule
            const restitution = 1.2; // AUGMENTÉ
            const separationForce = 2.5; // AUGMENTÉ
            
            // Envoyer notification de collision au serveur avec force
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                    type: 'collision_push',
                    target: id,
                    forceX: collisionVector.x * (impactForce * restitution + separationForce),
                    forceY: 0,
                    forceZ: collisionVector.z * (impactForce * restitution + separationForce)
                }));
            }
            
            // Réduire légèrement la vitesse de A (l'attaquant)
            car.speed *= 0.85;
            
            // Particules d'explosion à l'impact
            const impactPoint = new THREE.Vector3()
                .addVectors(car.mesh.position, player.mesh.position)
                .multiplyScalar(0.5);
            emitCollisionExplosion(impactPoint);
            
            // Activer cooldown
            car.collisionCooldown = car.collisionCooldownTime;
        }
    });
}

// Vérifier si la voiture est tombée de la plateforme
function checkFallOffPlatform() {
    if (!car.mesh || car.isDead) return;
    
    const distFromCenter = Math.sqrt(
        car.mesh.position.x * car.mesh.position.x + 
        car.mesh.position.z * car.mesh.position.z
    );
    
    // Si tombé en dessous de la plateforme ou hors de la plateforme
    if (car.mesh.position.y < -5 || distFromCenter > platformRadius) {
        console.log('Tombé de la plateforme! Vies restantes:', car.lives - 1);
        
        // Perdre une vie
        car.lives = Math.max(0, car.lives - 1);
        notifyLivesChange(car.lives);
        
        if (car.lives > 0) {
            // Respawn sur la plateforme
            const spawn = getRandomSpawnPosition();
            car.mesh.position.set(spawn.x, spawn.y, spawn.z);
            car.mesh.rotation.y = spawn.rotY;
            car.speed = 0;
            
            // Effet visuel
            flashCollisionEffect();
        } else {
            // Plus de vies - mode spectateur
            car.isDead = true;
            enterSpectatorMode();
            notifyFall();
        }
    }
}

// Effet visuel de flash rouge lors d'une collision (DÉSACTIVÉ - trop agressif)
function flashCollisionEffect() {
    // Désactivé - effet trop agressif visuellement
    // Les particules d'explosion suffisent
}

// Particules d'explosion lors de collision
function emitCollisionExplosion(worldPos, count = 20) {
    for (let i = 0; i < count; i++) {
        const mat = new THREE.SpriteMaterial({
            map: sparkTexture,
            color: new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.5), // orange/jaune
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false
        });
        const s = new THREE.Sprite(mat);

        s.position.set(
            worldPos.x + (Math.random() - 0.5) * 0.3,
            worldPos.y + Math.random() * 0.5,
            worldPos.z + (Math.random() - 0.5) * 0.3
        );

        const size = 0.2 + Math.random() * 0.3;
        s.scale.set(size, size, 1);

        // Vélocité explosive dans toutes les directions
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        const particle = {
            sprite: s,
            velocity: new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 2 + 1,
                Math.sin(angle) * speed
            ),
            age: 0,
            life: 0.5 + Math.random() * 0.3,
            initialSize: size,
            isExplosion: true,
            material: mat
        };

        particleGroup.add(s);
        particles.push(particle);
    }
}

// Mode spectateur (vue aérienne)
function enterSpectatorMode() {
    console.log('Entering spectator mode...');
    cameraFollow.enabled = false;
    
    // Placer caméra en vue aérienne
    camera.position.set(0, 50, 0);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Afficher message
    const spectatorDiv = document.createElement('div');
    spectatorDiv.id = 'spectator-message';
    spectatorDiv.style.position = 'fixed';
    spectatorDiv.style.top = '20px';
    spectatorDiv.style.left = '50%';
    spectatorDiv.style.transform = 'translateX(-50%)';
    spectatorDiv.style.padding = '20px 40px';
    spectatorDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    spectatorDiv.style.color = '#ffffff';
    spectatorDiv.style.fontSize = '24px';
    spectatorDiv.style.fontWeight = 'bold';
    spectatorDiv.style.borderRadius = '10px';
    spectatorDiv.style.border = '2px solid #ffffff';
    spectatorDiv.style.zIndex = '10000';
    spectatorDiv.style.textAlign = 'center';
    spectatorDiv.innerHTML = '☠️ MODE SPECTATEUR ☠️<br><span style="font-size: 16px;">En attente de la fin du round...</span>';
    document.body.appendChild(spectatorDiv);
}

// Afficher message de victoire
function showVictoryMessage() {
    const victoryDiv = document.createElement('div');
    victoryDiv.id = 'game-message';
    victoryDiv.style.position = 'fixed';
    victoryDiv.style.top = '50%';
    victoryDiv.style.left = '50%';
    victoryDiv.style.transform = 'translate(-50%, -50%)';
    victoryDiv.style.padding = '40px 60px';
    victoryDiv.style.backgroundColor = 'rgba(0, 200, 0, 0.9)';
    victoryDiv.style.color = '#ffffff';
    victoryDiv.style.fontSize = '48px';
    victoryDiv.style.fontWeight = 'bold';
    victoryDiv.style.borderRadius = '10px';
    victoryDiv.style.border = '3px solid #ffffff';
    victoryDiv.style.zIndex = '10001';
    victoryDiv.style.textAlign = 'center';
    victoryDiv.innerHTML = '🏆 VICTOIRE! 🏆<br><span style="font-size: 24px;">Rechargez la page pour rejouer (F5)</span>';
    document.body.appendChild(victoryDiv);
}

// Afficher message de défaite
function showDefeatMessage(winnerId) {
    const defeatDiv = document.createElement('div');
    defeatDiv.id = 'game-message';
    defeatDiv.style.position = 'fixed';
    defeatDiv.style.top = '50%';
    defeatDiv.style.left = '50%';
    defeatDiv.style.transform = 'translate(-50%, -50%)';
    defeatDiv.style.padding = '40px 60px';
    defeatDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.9)';
    defeatDiv.style.color = '#ffffff';
    defeatDiv.style.fontSize = '48px';
    defeatDiv.style.fontWeight = 'bold';
    defeatDiv.style.borderRadius = '10px';
    defeatDiv.style.border = '3px solid #ffffff';
    defeatDiv.style.zIndex = '10001';
    defeatDiv.style.textAlign = 'center';
    defeatDiv.innerHTML = `DÉFAITE<br><span style="font-size: 24px;">Joueur ${winnerId} a gagné!<br>Rechargez la page pour rejouer (F5)</span>`;
    document.body.appendChild(defeatDiv);
}

// Afficher message d'égalité
function showDrawMessage() {
    const drawDiv = document.createElement('div');
    drawDiv.id = 'game-message';
    drawDiv.style.position = 'fixed';
    drawDiv.style.top = '50%';
    drawDiv.style.left = '50%';
    drawDiv.style.transform = 'translate(-50%, -50%)';
    drawDiv.style.padding = '40px 60px';
    drawDiv.style.backgroundColor = 'rgba(100, 100, 100, 0.9)';
    drawDiv.style.color = '#ffffff';
    drawDiv.style.fontSize = '48px';
    drawDiv.style.fontWeight = 'bold';
    drawDiv.style.borderRadius = '10px';
    drawDiv.style.border = '3px solid #ffffff';
    drawDiv.style.zIndex = '10001';
    drawDiv.style.textAlign = 'center';
    drawDiv.innerHTML = `ÉGALITÉ!<br><span style="font-size: 24px;">Tous les joueurs sont tombés!<br>${gameState.isHost ? 'Cliquez sur "Nouvelle Partie" en bas' : 'L\'hôte peut relancer'}</span>`;
    document.body.appendChild(drawDiv);
}

// Afficher contrôles de l'hôte
function showHostControls() {
    const controls = document.createElement('div');
    controls.id = 'host-controls';
    controls.style.position = 'fixed';
    controls.style.bottom = '20px';
    controls.style.left = '50%';
    controls.style.transform = 'translateX(-50%)';
    controls.style.padding = '15px 30px';
    controls.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    controls.style.color = '#ffffff';
    controls.style.fontSize = '18px';
    controls.style.fontWeight = 'bold';
    controls.style.borderRadius = '10px';
    controls.style.border = '2px solid #00ff00';
    controls.style.zIndex = '10000';
    controls.style.textAlign = 'center';
    
    if (!gameState.isGameActive) {
        controls.innerHTML = `
            🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
            <button id="start-game-btn" style="margin-top: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; background: #00ff00; border: none; border-radius: 5px; font-weight: bold;">
                🚀 DÉMARRER LA PARTIE
            </button>
        `;
    } else {
        controls.innerHTML = `
            🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
            <span style="font-size: 14px;">Partie en cours...</span>
        `;
    }
    
    document.body.appendChild(controls);
    
    // Event listener pour le bouton
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'start_game' }));
            }
        });
    }
}

// Mettre à jour les contrôles de l'hôte
function updateHostControls() {
    const controls = document.getElementById('host-controls');
    if (controls && gameState.isHost) {
        if (!gameState.isGameActive) {
            controls.innerHTML = `
                🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
                <button id="start-game-btn" style="margin-top: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; background: #00ff00; border: none; border-radius: 5px; font-weight: bold;">
                    🔄 NOUVELLE PARTIE
                </button>
            `;
            const startBtn = document.getElementById('start-game-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'start_game' }));
                    }
                });
            }
        } else {
            controls.innerHTML = `
                🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
                <span style="font-size: 14px;">Partie en cours...</span>
            `;
        }
    }
}

// Mise à jour de l'affichage des vies
function updateLivesDisplay() {
    if (hudLives) {
        const hearts = '❤️ '.repeat(Math.max(0, car.lives));
        const emptyHearts = '🖤 '.repeat(Math.max(0, car.maxLives - car.lives));
        hudLives.innerHTML = hearts + emptyHearts;
    }
}

function emitParticle() {
    // Créer un nouveau sprite pour cette particule
    const spriteMaterial = baseMaterial.clone();
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Position initiale (légèrement au-dessus du sol pour monter)
    sprite.position.set(
        (Math.random() - 0.5) * 0.5,
        0.5 + Math.random() * 0.6,
        (Math.random() - 0.5) * 0.5
    );
    
    // Taille initiale du sprite (width, height)
    const initialSize = options.particleSizeMin + Math.random() * (options.particleSizeMax - options.particleSizeMin);
    sprite.scale.set(initialSize, initialSize, 1);
    
    // Vitesse initiale : forte composante verticale pour que la particule monte
    const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        options.initialVyMin + Math.random() * (options.initialVyMax - options.initialVyMin), // initial Vy range
        (Math.random() - 0.5) * 0.15
    );
    // Appliquer aussi une impulsion du vent horizontal (ne touche pas Y)
    const windImpulse = wind.clone();
    windImpulse.y = 0;
    velocity.addScaledVector(windImpulse, 0.6);
    
    // Durée de vie
    const life = options.particleLifeMin + Math.random() * (options.particleLifeMax - options.particleLifeMin);
    
    // Objet particule avec toutes ses propriétés
    const particle = {
        sprite: sprite,           // référence au sprite THREE.js
        velocity: velocity,       // vitesse actuelle
        age: 0,                   // âge en secondes
        life: life,               // durée de vie totale
        initialSize: initialSize, // taille initiale pour le scaling
        currentFrame: 0,
        material: spriteMaterial  // référence au matériau pour modifier alpha
    };
    
    // Ajouter le sprite à la scène et la particule à la liste
    particleGroup.add(sprite);
    particles.push(particle);
}

/** Emit short-lived red brake particles at a world position (small sparks) */
function emitBrakeParticlesAt(worldPos, count = 6) {
    for (let i = 0; i < count; i++) {
        const mat = brakeBaseMaterial.clone();
        const s = new THREE.Sprite(mat);

        // jitter around the provided world position (small area near the light)
        s.position.set(
            worldPos.x + (Math.random() - 0.5) * 0.12,
            worldPos.y + (Math.random() - 0.5) * 0.06,
            worldPos.z + (Math.random() - 0.5) * 0.12
        );

        // small initial size
        const size = 0.12 + Math.random() * 0.08;
        s.scale.set(size, size, 1);

        // simple particle object
        const particle = {
            sprite: s,
            velocity: new THREE.Vector3((Math.random()-0.5)*0.04, Math.random()*0.02, (Math.random()-0.5)*0.04),
            age: 0,
            life: 0.25 + Math.random() * 0.15,
            initialSize: size,
            isBrake: true,
            material: mat
        };

        particleGroup.add(s);
        particles.push(particle);
    }
}

/** Emit boost particles (orange) at a world position */
function emitBoostParticlesAt(worldPos, count = 8) {
    for (let i = 0; i < count; i++) {
        const mat = boostBaseMaterial.clone();
        const s = new THREE.Sprite(mat);

        s.position.set(
            worldPos.x + (Math.random() - 0.5) * 0.18,
            worldPos.y + (Math.random() - 0.5) * 0.08,
            worldPos.z + (Math.random() - 0.5) * 0.18
        );

        const size = 0.16 + Math.random() * 0.12;
        s.scale.set(size, size, 1);

        const particle = {
            sprite: s,
            velocity: new THREE.Vector3((Math.random()-0.5)*0.06, Math.random()*0.03, (Math.random()-0.5)*0.06),
            age: 0,
            life: 0.35 + Math.random() * 0.2,
            initialSize: size,
            isBoost: true,
            material: mat
        };

        particleGroup.add(s);
        particles.push(particle);
    }
}

/** Emit skid (black) particles at a world position */
function emitSkidParticlesAt(worldPos, count = 1) {
    for (let i = 0; i < count; i++) {
        const mat = skidBaseMaterial.clone();
        const s = new THREE.Sprite(mat);

        s.position.set(
            worldPos.x + (Math.random() - 0.5) * 0.06,
            worldPos.y + (Math.random() - 0.5) * 0.02,
            worldPos.z + (Math.random() - 0.5) * 0.06
        );

        const size = 0.18 + Math.random() * 0.06;
        s.scale.set(size, size * 0.5, 1);

        const particle = {
            sprite: s,
            velocity: new THREE.Vector3(0, 0, 0), // mostly static on ground
            age: 0,
            life: 0.8 + Math.random() * 0.8,
            initialSize: size,
            isSkid: true,
            material: mat
        };

        particleGroup.add(s);
        particles.push(particle);
    }
}

// La fonction updateGeometry n'est plus nécessaire avec les sprites
// car chaque sprite gère sa propre géométrie

function animate() {
    requestAnimationFrame(animate);
    
    // Calcul du pas de temps
    const now = performance.now();
    const dt = Math.max(0, (now - prevTime) / 1000);
    prevTime = now;

    // Mettre à jour le champ de vent
    updateWind(dt);

    // Interpolation fluide des joueurs distants
    players.forEach((player, id) => {
        if (player.mesh && player.targetPos) {
            // Interpolation de position avec prédiction basée sur vélocité
            const predictedPos = player.targetPos.clone()
                .add(player.velocity.clone().multiplyScalar(dt * 2)); // prédiction 2 frames ahead
            
            // Lerp vers position prédite pour mouvement plus fluide
            player.mesh.position.lerp(predictedPos, 0.3);
            
            // Interpolation de rotation
            const currentRot = player.mesh.rotation.y;
            let rotDiff = player.targetRot - currentRot;
            
            // Gérer le wrap-around de l'angle (éviter rotation longue)
            if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            
            player.mesh.rotation.y += rotDiff * 0.25; // lerp rotation
        }
    });

    // Vérifier collisions entre voitures
    checkCollisions(dt);
    
    // Vérifier si tombé de la plateforme
    checkFallOffPlatform();
    
    // Mettre à jour affichage des vies
    updateLivesDisplay();

    // --- car kinematics & input (seulement si vivant ET jeu actif ET peut jouer) ---
    if (car.mesh && !car.isDead && gameState.isGameActive && gameState.canPlay) {
        // forward/back
        let forward = 0;
        if (keys['s'] ) forward += 5;
        if (keys['z']|| keys['w']) forward -= 5;

        // turn left/right
        let turn = 0;
        if (keys['q'] || keys['a']) turn += 1;
        if (keys['d']) turn -= 1;

            // boost state (Shift)
            const boosting = !!keys['shift'];
            // energy logic: drain while boosting, regen after delay when not boosting
            if (boosting && car.boostEnergy > 0) {
                car.boostEnergy = Math.max(0, car.boostEnergy - car.energyDrainRate * dt);
                car.energyRegenTimer = 0.0; // reset regen timer while using
            } else {
                // increase the regen timer; when it exceeds the delay, start regen
                car.energyRegenTimer += dt;
                if (car.energyRegenTimer >= car.energyRegenDelay) {
                    car.boostEnergy = Math.min(car.boostMaxEnergy, car.boostEnergy + car.energyRegenRate * dt);
                }
            }

            // compute effective accel/max based on energy availability
            const boostAvailable = boosting && car.boostEnergy > 0;
            const effectiveAccel = car.baseAccel * (boostAvailable ? car.boostMultiplier : 1);
            const effectiveMaxSpeed = car.baseMaxSpeed * (boostAvailable ? car.boostMaxMultiplier : 1);

        // accelerate/brake (use effective values when boosting)
        if (forward !== 0) {
            car.speed += forward * effectiveAccel * dt;
        } else {
            // natural slowdown
            car.speed *= Math.max(0, 1 - 4 * dt);
        }
        car.speed = Math.max(-effectiveMaxSpeed, Math.min(effectiveMaxSpeed, car.speed));

        // emit boost particles while Shift held
            if (boostAvailable) {
            const leftBoostLocal = new THREE.Vector3(-0.5, 0.06, -0.90);
            const rightBoostLocal = new THREE.Vector3(0.5, 0.06, -0.90);
            const leftBoostWorld = leftBoostLocal.applyMatrix4(car.mesh.matrixWorld);
            const rightBoostWorld = rightBoostLocal.applyMatrix4(car.mesh.matrixWorld);
            emitBoostParticlesAt(leftBoostWorld, 4);
            emitBoostParticlesAt(rightBoostWorld, 4);
        }

        // apply turn proportional to speed sign
        const sign = Math.sign(car.speed || 1);
        // Space = skid: increase turning radius -> reduce responsiveness but apply lateral slip and extra yaw
        const skidding = !!(keys[' '] || keys['space'] || keys['spacebar']);
        const turnFactor = skidding ? 1.25 : 1.0; // smaller factor => larger turning radius
        // base rotation
        let deltaYaw = turn * car.turnSpeed * dt * (Math.abs(car.speed) / car.maxSpeed) * turnFactor;
        // if skidding and turning, apply extra yaw and lateral slide
        if (skidding && Math.abs(turn) > 0.01 && Math.abs(car.speed) > car.skidMinSpeed) {
            // extra yaw to make car rotate more while sliding
            deltaYaw *= car.skidYawMultiplier;
            // compute lateral slide direction (perpendicular to forward)
            const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(car.mesh.quaternion).normalize();
            const lateralDir = new THREE.Vector3().copy(forwardDir).applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2 * Math.sign(turn));
            // add lateral velocity proportional to skidStrength and current speed
            const slideVel = lateralDir.multiplyScalar(car.skidStrength * (Math.abs(car.speed) / car.maxSpeed) * Math.abs(turn));
            car.mesh.position.add(slideVel.multiplyScalar(dt * 6.0)); // amplified for visible effect
            // stronger skid particles when actively turning
            const skidLeftLocal = new THREE.Vector3(-0.28, 0.02, -1.05);
            const skidRightLocal = new THREE.Vector3(0.28, 0.02, -1.05);
            const skidLeftWorld = skidLeftLocal.applyMatrix4(car.mesh.matrixWorld);
            const skidRightWorld = skidRightLocal.applyMatrix4(car.mesh.matrixWorld);
            // emit more skid particles when actively drifting
            emitSkidParticlesAt(skidLeftWorld, 2);
            emitSkidParticlesAt(skidRightWorld, 2);
        }
        car.mesh.rotation.y += deltaYaw;

        // move forward along local Z (negative Z is forward in many model conventions)
        const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(car.mesh.quaternion).multiplyScalar(car.speed * dt * 0.1);
        car.mesh.position.add(forwardVec);

        // if moving forward emit smoke at rear
        if (Math.abs(car.speed) > 0.1) {
            // rear position in local space (tweak as needed)
            const rearLocal = new THREE.Vector3(0, 0.1, 1.2);
            const rearWorld = rearLocal.applyMatrix4(car.mesh.matrixWorld);
            emitSmokeAt(rearWorld);
        }
        // emit brake particles at rear lights when braking (S pressed)
        if (keys['s']) {
            // rear light offsets in local space (left and right) - lowered to taillight height
            const leftRearLocal = new THREE.Vector3(-0.28, 0.08, -1.05);
            const rightRearLocal = new THREE.Vector3(0.28, 0.08, -1.05);
            const leftRearWorld = leftRearLocal.applyMatrix4(car.mesh.matrixWorld);
            const rightRearWorld = rightRearLocal.applyMatrix4(car.mesh.matrixWorld);
            emitBrakeParticlesAt(leftRearWorld, 6);
            emitBrakeParticlesAt(rightRearWorld, 6);
        }
        // if skidding (space), emit skid particles on the ground at rear
        if (skidding) {
            const skidLeftLocal = new THREE.Vector3(-0.28, 0.02, -1.05);
            const skidRightLocal = new THREE.Vector3(0.28, 0.02, -1.05);
            const skidLeftWorld = skidLeftLocal.applyMatrix4(car.mesh.matrixWorld);
            const skidRightWorld = skidRightLocal.applyMatrix4(car.mesh.matrixWorld);
            emitSkidParticlesAt(skidLeftWorld, 1);
            emitSkidParticlesAt(skidRightWorld, 1);
        }
    }

    // Camera follow: position the camera relative to the car (or placeholder if model not loaded)
    // Seulement si vivant et caméra follow activée
    if (cameraFollow.enabled && !car.isDead) {
        const ref = car.mesh || carPlaceholder;
        // get world position & orientation of reference
        const worldPos = new THREE.Vector3();
        ref.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        ref.getWorldQuaternion(worldQuat);

        // compute desired camera position in world space
        const localOffset = cameraFollow.offset.clone();
        const desiredPos = worldPos.clone().add(localOffset.applyQuaternion(worldQuat));

        // smooth camera movement
        camera.position.lerp(desiredPos, cameraFollow.lerp);

        // smooth controls target towards the car's world position
        controls.target.lerp(worldPos, cameraFollow.targetLerp);
    }

    // Émission de particules (utilise options.emissionRate du GUI)
    const emissionCount = Math.floor(options.emissionRate * dt);
    for (let i = 0; i < emissionCount; i++) {
        emitParticle();
    }

    // Mise à jour des particules
    let sumVy = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        
        // Vieillissement
        particle.age += dt;
        const lifeRatio = particle.age / particle.life;
        
        // Si la particule est morte, la supprimer
        if (lifeRatio >= 1.0) {
            particleGroup.remove(particle.sprite);
            particle.sprite.material.dispose(); // libérer la mémoire du matériau
            particles.splice(i, 1);
            continue;
        }
        
        // Gérer les différents types de particules
            if (particle.isBrake) {
                // simple brake particle behavior: small velocity, fade out and shrink
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 1 - (particle.age / particle.life));
                const sizeRatio = 1 - 0.8 * lifeRatio; // shrink faster
                const currentSize = particle.initialSize * sizeRatio;
                particle.sprite.scale.set(currentSize, currentSize, 1);
                continue; // skip smoke behaviours
            }

            if (particle.isExplosion) {
                // Particules d'explosion: mouvement balistique avec gravité
                particle.velocity.y -= 9.8 * dt; // gravité
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 1 - (particle.age / particle.life));
                const sizeRatio = 1 - 0.6 * lifeRatio;
                const currentSize = particle.initialSize * sizeRatio;
                particle.sprite.scale.set(currentSize, currentSize, 1);
                continue;
            }

            if (particle.isBoost) {
                // boost particle behavior
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 1 - (particle.age / particle.life));
                const sizeRatio = 1 - 0.7 * lifeRatio;
                const currentSize = particle.initialSize * sizeRatio;
                particle.sprite.scale.set(currentSize, currentSize, 1);
                continue;
            }

            if (particle.isSkid) {
                // skid particle behavior
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 0.9 - (particle.age / particle.life));
                const sizeRatio = 1 - 0.4 * lifeRatio;
                const currentSize = particle.initialSize * sizeRatio;
                particle.sprite.scale.set(currentSize, currentSize * 0.5, 1);
                continue;
            }

            // Particules de fumée normales
            // Application du vent
            particle.velocity.addScaledVector(wind, dt * windParams.response);

            // Bruit horizontal subtil
            particle.velocity.x += (Math.random() - 0.5) * 0.002;
            particle.velocity.z += (Math.random() - 0.5) * 0.002;
        
            // Appliquer poussée ascendante (buoyancy) et traînée verticale
            // On ajoute d'abord la poussée (accélération) proportionnelle à dt
            particle.velocity.y += options.buoyancy * dt;
            // Puis on applique une traînée exponentielle indépendante du frame rate
            const verticalDragFactor = Math.exp(-options.verticalDrag * dt);
            particle.velocity.y *= verticalDragFactor;

            // Intégration de la position pour fumée
            particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
        
            // Calcul de l'alpha avec courbe non-linéaire pour effet fumé
            const alpha = Math.pow(1 - lifeRatio, options.smokeFadeExponent);
            particle.material.opacity = alpha * 0.7; // 0.7 = opacité de base
            // Mettre à jour la map du sprite en fonction de l'âge (animation de fumée)
            if (maps.length > 0) {
                const frameIndex = Math.floor(lifeRatio * (maps.length - 1));
                if (frameIndex !== particle.currentFrame) {
                    particle.currentFrame = frameIndex;
                    particle.material.map = maps[frameIndex];
                    particle.material.needsUpdate = true;
                }
            }
        
            // Réduction progressive de la taille (effet de dispersion)
            const sizeRatio = 1 - 0.3 * lifeRatio; // rétrécit de 30% sur la durée de vie
            const currentSize = particle.initialSize * sizeRatio;
            particle.sprite.scale.set(currentSize, currentSize, 1);
        
            // Rotation subtile pour plus de réalisme (optionnel)
            particle.sprite.material.rotation += dt * 0.1 * (Math.random() - 0.5);
            // accumulate vertical speed for HUD
            sumVy += particle.velocity.y;
    }

    // Debug HUD and arrows
    
    // Update HUD boost gauge
    if (hudBoostFill) {
        const v = Math.max(0, Math.min(1, car.boostEnergy / car.boostMaxEnergy));
        hudBoostFill.style.transform = `scaleX(${v})`;
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();


// Responsive resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

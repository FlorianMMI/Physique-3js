import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


// === Modal pour demander le pseudo ===
let playerName = null;
let playerColor = null;

function showNameModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'name-modal';
        modal.innerHTML = `
            <div class="name-modal-content">
                <h2>🏎️ BATTLE ROYALE 3D</h2>
                <p>Entrez votre pseudo</p>
                <input type="text" id="player-name-input" maxlength="15" placeholder="Votre pseudo...">
                <button id="join-btn" class="host-btn primary">REJOINDRE</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        const input = document.getElementById('player-name-input');
        const btn = document.getElementById('join-btn');
        
        input.focus();
        
        const submit = () => {
            const name = input.value.trim();
            if (name.length > 0) {
                playerName = name;
                modal.remove();
                resolve(name);
            } else {
                input.style.borderColor = '#ff0000';
                setTimeout(() => { input.style.borderColor = ''; }, 500);
            }
        };
        
        btn.addEventListener('click', submit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });
    });
}

// Générer couleur persistante basée sur un seed (le pseudo)
function generateColorFromSeed(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360) / 360;
    return new THREE.Color().setHSL(hue, 0.8, 0.5);
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Ciel bleu

// Créer une plateforme circulaire
const platformRadius = 40; // Taille réduite pour plus de challenge
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
const players = new Map(); // id -> { mesh, targetPos, targetRot, velocity, lives, isDead, color, name, nameSprite }
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

// Powerups sur la map
const powerups = [];
const powerupTypes = [
    { type: 'speed', color: 0x00ffff, icon: '⚡' },
    { type: 'shield', color: 0xffff00, icon: '🛡️' },
    { type: 'jump', color: 0xff00ff, icon: '🚀' }
];

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

// Créer un sprite de nom au-dessus d'une voiture
function createNameSprite(name, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Fond semi-transparent
    context.fillStyle = `rgba(0, 0, 0, 0.7)`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texte
    context.font = 'bold 32px Arial';
    context.fillStyle = `#${color.getHexString()}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(4, 1, 1);
    
    return sprite;
}

// Se connecter d'abord, puis demander le pseudo
function initWebSocket() {
try {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    
    // Fix: Don't add port in production, use the current origin
    let wsUrl;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Development: connect to local server on port 3001
        wsUrl = `${proto}://localhost:3001`;
    } else {
        // Production: use same host without specifying port
        // Render will handle the port automatically (443 for wss)
        wsUrl = `${proto}://${window.location.hostname}`;
    }
    
    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', async () => {
        console.log('WS connected to', wsUrl);
        
        // Demander le pseudo maintenant
        const name = await showNameModal();
        playerName = name;
        playerColor = generateColorFromSeed(name);
        console.log('Player name:', name, 'Color:', playerColor.getHexString());
        
        // Mettre à jour la couleur de la voiture si elle est déjà chargée
        if (car.mesh) {
            car.mesh.traverse((c) => { 
                if (c.isMesh && c.material) {
                    c.material.color = playerColor.clone();
                }
            });
            
            // Ne pas créer le sprite de nom pour le joueur local
            // (on ne veut pas voir son propre pseudo)
        }
        
        // Envoyer immédiatement le pseudo et la couleur
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'player_info',
                name: playerName,
                color: playerColor.getHex()
            }));
        }
    });
    socket.addEventListener('message', (ev) => {
        try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'welcome') {
                localId = msg.id;
                gameState.isHost = msg.isHost;
                gameState.canPlay = msg.canPlay;
                gameState.isGameActive = msg.gameActive;
                console.log('Assigned id', localId, '| Host:', gameState.isHost, '| Can play:', gameState.canPlay, '| Game active:', gameState.isGameActive);
                
                // Si on peut jouer et que le jeu n'est pas actif, on peut quand même se déplacer (lobby)
                // Le jeu démarre vraiment quand l'hôte clique sur "DÉMARRER"
                if (gameState.canPlay && !gameState.isGameActive) {
                    console.log('Lobby mode - you can move around');
                }
                
                // Afficher UI de contrôle si hôte
                if (gameState.isHost) {
                    showHostControls();
                    // Générer les powerups initiaux
                    setTimeout(() => initializePowerups(), 1000);
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
            } else if (msg.type === 'player_info') {
                // Recevoir les infos d'un joueur (nom, couleur)
                const id = msg.sender;
                if (id === localId) return;
                
                const remoteColor = new THREE.Color(msg.color);
                const remoteName = msg.name;
                
                console.log(`Player ${id} info: ${remoteName}, color: ${remoteColor.getHexString()}`);
                
                // Si le joueur existe déjà, mettre à jour ses infos
                if (players.has(id)) {
                    const p = players.get(id);
                    p.color = remoteColor;
                    p.name = remoteName;
                    
                    // Mettre à jour la couleur de la voiture
                    if (p.mesh) {
                        p.mesh.traverse((c) => {
                            if (c.isMesh && c.material) {
                                c.material.color = remoteColor.clone();
                            }
                        });
                    }
                    
                    // Créer/Mettre à jour le sprite de nom
                    if (p.nameSprite) {
                        scene.remove(p.nameSprite);
                    }
                    p.nameSprite = createNameSprite(remoteName, remoteColor);
                    p.nameSprite.position.copy(p.mesh.position);
                    p.nameSprite.position.y += 2;
                    scene.add(p.nameSprite);
                }
            } else if (msg.type === 'state') {
                // update or create remote player
                const id = msg.sender;
                if (id === localId) return;
                let p = players.get(id);
                if (!p) {
                    // Utiliser couleur par défaut en attendant player_info
                    const playerColor = new THREE.Color(0xcccccc);
                    
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
                if (msg.target === localId && car.mesh && !car.isDead && !car.isInvulnerable) {
                    const pushForce = new THREE.Vector3(msg.forceX || 0, msg.forceY || 0, msg.forceZ || 0);
                    // Utiliser knockbackVelocity pour un mouvement fluide
                    car.knockbackVelocity.add(pushForce);
                    car.speed *= 0.5; // Réduire vitesse de celui qui est frappé
                    flashCollisionEffect();
                }
            } else if (msg.type === 'you_are_host') {
                // Devenir le nouvel hôte
                gameState.isHost = true;
                console.log('You are now the host!');
                showHostControls();
                // Générer les powerups initiaux
                initializePowerups();
            } else if (msg.type === 'powerup_spawn') {
                // Recevoir un nouveau powerup du serveur
                spawnPowerupAt(msg.powerupType, msg.x, msg.y, msg.z, msg.powerupId);
            } else if (msg.type === 'powerup_collect') {
                // Un autre joueur a collecté un powerup
                const powerupIndex = powerups.findIndex(p => p.id === msg.powerupId);
                if (powerupIndex !== -1) {
                    const powerup = powerups[powerupIndex];
                    scene.remove(powerup.mesh);
                    scene.remove(powerup.sprite);
                    powerups.splice(powerupIndex, 1);
                }
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
} // Fin de initWebSocket

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
    collisionCooldownTime: 0.5, // secondes (réduit pour plus de réactivité)
    // Invulnérabilité au spawn
    isInvulnerable: true, // Invulnérable au départ
    invulnerabilityDuration: 3.0, // 3 secondes d'invulnérabilité
    invulnerabilityTimer: 3.0,
    hasMovedOnce: false, // Pour détecter le premier mouvement
    // Jump
    isJumping: false,
    jumpVelocity: 0,
    jumpForce: 15,
    gravity: -30,
    // Powerups actifs
    activePowerups: [],
    // Knockback
    knockbackVelocity: new THREE.Vector3(0, 0, 0),
    nameSprite: null // Sprite du nom du joueur
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
    
    // Utiliser la couleur générée depuis le pseudo (ou couleur par défaut si pas encore définie)
    const currentPlayerColor = playerColor || new THREE.Color(0xff0000);
    car.mesh.traverse((c) => { 
        if (c.isMesh && c.material) {
            c.material = c.material.clone();
            c.material.color = currentPlayerColor.clone();
        }
    });
    
    // scale/position the local clone
    car.mesh.scale.set(0.8, 0.8, 0.8);
    
    // Spawn aléatoire sur la plateforme
    const spawn = getRandomSpawnPosition();
    car.mesh.position.set(spawn.x, spawn.y, spawn.z);
    car.mesh.rotation.y = spawn.rotY;
    
    scene.add(car.mesh);
    console.log('Local car color:', currentPlayerColor.getHexString(), 'Name:', playerName);
    
    // Ne pas créer le sprite de nom pour le joueur local (on ne veut pas voir son propre pseudo)
    // car.nameSprite reste null pour le joueur local
    
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

// === Système de Powerups ===
// Fonction pour générer un powerup (appelée par l'hôte ou quand on reçoit des données du serveur)
function spawnPowerupAt(typeStr, x, y, z, id) {
    const typeInfo = powerupTypes.find(t => t.type === typeStr);
    if (!typeInfo) return;
    
    // Créer le mesh du powerup (cube qui tourne)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
        color: typeInfo.color,
        emissive: typeInfo.color,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    
    // Créer sprite d'icône au-dessus
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(typeInfo.icon, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.5, 1.5, 1);
    sprite.position.set(x, y + 1.5, z);
    scene.add(sprite);
    
    powerups.push({
        id: id,
        type: typeStr,
        mesh: mesh,
        sprite: sprite,
        collected: false,
        rotation: 0
    });
}

// Fonction pour générer un nouveau powerup (seulement l'hôte)
function generateNewPowerup() {
    if (!gameState.isHost) return;
    
    const typeStr = powerupTypes[Math.floor(Math.random() * powerupTypes.length)].type;
    const pos = getRandomSpawnPosition();
    const powerupId = Date.now() + Math.random();
    
    // Notifier le serveur
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'powerup_spawn',
            powerupId: powerupId,
            powerupType: typeStr,
            x: pos.x,
            y: 1,
            z: pos.z
        }));
    }
    
    // Créer localement aussi
    spawnPowerupAt(typeStr, pos.x, 1, pos.z, powerupId);
}

// L'hôte génère les powerups initiaux après connexion
function initializePowerups() {
    if (!gameState.isHost) return;
    
    for (let i = 0; i < 5; i++) {
        setTimeout(() => generateNewPowerup(), i * 200);
    }
}

// Respawn périodique des powerups (seulement l'hôte)
setInterval(() => {
    if (gameState.isHost && powerups.length < 8) {
        generateNewPowerup();
    }
}, 10000);

function checkPowerupCollection() {
    if (!car.mesh || car.isDead) return;
    
    powerups.forEach((powerup, index) => {
        if (powerup.collected) return;
        
        const dist = car.mesh.position.distanceTo(powerup.mesh.position);
        if (dist < 2) {
            // Collecter le powerup
            powerup.collected = true;
            
            // Notifier le serveur de la collecte
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'powerup_collect',
                    powerupId: powerup.id
                }));
            }
            
            // Supprimer localement
            scene.remove(powerup.mesh);
            scene.remove(powerup.sprite);
            powerups.splice(index, 1);
            
            // Appliquer l'effet
            applyPowerup(powerup.type);
            
            // Notification
            showPowerupNotification(powerup.type);
        }
    });
}

function applyPowerup(type) {
    const duration = 5000; // 5 secondes
    
    switch(type) {
        case 'speed':
            car.baseMaxSpeed = 250;
            car.baseAccel = 30;
            car.activePowerups.push({ type: 'speed', endTime: Date.now() + duration });
            setTimeout(() => {
                car.baseMaxSpeed = 190;
                car.baseAccel = 20;
                car.activePowerups = car.activePowerups.filter(p => p.type !== 'speed');
            }, duration);
            break;
            
        case 'shield':
            car.isInvulnerable = true;
            car.activePowerups.push({ type: 'shield', endTime: Date.now() + duration });
            setTimeout(() => {
                if (!car.hasMovedOnce) return; // Garder l'invulnérabilité spawn
                car.isInvulnerable = false;
                car.activePowerups = car.activePowerups.filter(p => p.type !== 'shield');
            }, duration);
            break;
            
        case 'jump':
            // Jump boost temporaire
            const oldJumpForce = car.jumpForce;
            car.jumpForce = 25;
            car.activePowerups.push({ type: 'jump', endTime: Date.now() + duration });
            setTimeout(() => {
                car.jumpForce = oldJumpForce;
                car.activePowerups = car.activePowerups.filter(p => p.type !== 'jump');
            }, duration);
            break;
    }
}

function showPowerupNotification(type) {
    const typeInfo = powerupTypes.find(t => t.type === type);
    const notification = document.createElement('div');
    notification.className = 'powerup-notification';
    notification.innerHTML = `
        <div style="font-size: 48px;">${typeInfo.icon}</div>
        <div style="font-size: 20px; font-weight: bold;">POWERUP!</div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

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

// Rich HUD panel - Amélioré
const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
        <div class="title">🏎️ BATTLE ROYALE</div>
        <div class="row">
            <div>Vies</div>
            <div id="hud-lives" style="color: #ff3333; font-weight: bold; font-size: 18px;">❤️ ❤️ ❤️</div>
        </div>
        <div class="row">
            <div>Boost</div>
            <div id="hud-boost" style="flex: 1;">
                <div class="gauge">
                    <div class="gauge-fill" id="hud-boost-fill"></div>
                </div>
            </div>
        </div>
        <div class="row" style="opacity: 0.6; font-size: 12px;">
            <div>Particules</div>
            <div id="hud-particles">0</div>
        </div>
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
    if (!car.mesh || car.isDead || car.isInvulnerable) return;
    
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
            const impactForce = Math.abs(car.speed) * 0.05; // Augmenté
            
            // Physique de rebond améliorée
            const restitution = 1.5;
            const separationForce = 3.0;
            
            const pushForce = collisionVector.clone()
                .multiplyScalar(impactForce * restitution + separationForce);
            
            // Envoyer notification de collision au serveur avec force
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                    type: 'collision_push',
                    target: id,
                    forceX: pushForce.x,
                    forceY: 0,
                    forceZ: pushForce.z
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
        
        // Afficher notification de perte de vie
        showLifeLostNotification();
        
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
    
    // Afficher message amélioré
    const spectatorDiv = document.createElement('div');
    spectatorDiv.id = 'spectator-message';
    spectatorDiv.className = 'spectator-banner';
    spectatorDiv.innerHTML = `
        <div class="spectator-icon">👻</div>
        <div class="spectator-text">MODE SPECTATEUR</div>
        <div class="spectator-subtext">En attente de la fin du round...</div>
    `;
    document.body.appendChild(spectatorDiv);
}

// Afficher message de victoire
function showVictoryMessage() {
    const victoryDiv = document.createElement('div');
    victoryDiv.id = 'game-message';
    victoryDiv.className = 'game-message victory';
    victoryDiv.innerHTML = `
        <div class="game-message-icon">🏆</div>
        <div class="game-message-title">VICTOIRE!</div>
        <div class="game-message-subtitle">${gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
    `;
    document.body.appendChild(victoryDiv);
    
    // Animation d'apparition
    setTimeout(() => {
        victoryDiv.classList.add('show');
    }, 10);
}

// Afficher message de défaite
function showDefeatMessage(winnerId) {
    const defeatDiv = document.createElement('div');
    defeatDiv.id = 'game-message';
    defeatDiv.className = 'game-message defeat';
    defeatDiv.innerHTML = `
        <div class="game-message-icon">💀</div>
        <div class="game-message-title">DÉFAITE</div>
        <div class="game-message-subtitle">Joueur ${winnerId} a gagné!</div>
        <div class="game-message-info">${gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
    `;
    document.body.appendChild(defeatDiv);
    
    // Animation d'apparition
    setTimeout(() => {
        defeatDiv.classList.add('show');
    }, 10);
}

// Afficher message d'égalité
function showDrawMessage() {
    const drawDiv = document.createElement('div');
    drawDiv.id = 'game-message';
    drawDiv.className = 'game-message draw';
    drawDiv.innerHTML = `
        <div class="game-message-icon">🤝</div>
        <div class="game-message-title">ÉGALITÉ!</div>
        <div class="game-message-subtitle">Tous les joueurs sont tombés!</div>
        <div class="game-message-info">${gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
    `;
    document.body.appendChild(drawDiv);
    
    // Animation d'apparition
    setTimeout(() => {
        drawDiv.classList.add('show');
    }, 10);
}

// Afficher contrôles de l'hôte
function showHostControls() {
    const controls = document.createElement('div');
    controls.id = 'host-controls';
    controls.style.position = 'fixed';
    controls.style.top = '20px';
    controls.style.left = '10%';
    controls.style.transform = 'translateX(-50%)';
    controls.style.padding = '15px 30px';
    controls.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    controls.style.color = '#ffffff';
    controls.style.fontSize = '18px';
    controls.style.fontWeight = 'bold';
    controls.style.borderRadius = '12px';
    controls.style.border = '3px solid #00ff00';
    controls.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.3)';
    controls.style.zIndex = '10000';
    controls.style.textAlign = 'center';
    
    if (!gameState.isGameActive) {
        controls.innerHTML = `
            🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
            <button id="start-game-btn" class="host-btn primary">
                🚀 DÉMARRER LA PARTIE
            </button>
        `;
    } else {
        controls.innerHTML = `
            🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
            <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: center;">
                <button id="reset-game-btn" class="host-btn warning">
                    🔄 RÉINITIALISER
                </button>
            </div>
        `;
    }
    
    document.body.appendChild(controls);
    
    // Event listener pour le bouton de démarrage
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'start_game' }));
            }
        });
    }
    
    // Event listener pour le bouton de réinitialisation
    const resetBtn = document.getElementById('reset-game-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                // Demander confirmation
                if (confirm('Êtes-vous sûr de vouloir réinitialiser la partie ?')) {
                    // Marquer localement la partie comme inactive et réinitialiser l'état
                    gameState.isGameActive = false;
                    gameState.winnerId = null;
                    gameState.canPlay = true;

                    // Réinitialiser le joueur local
                    car.lives = car.maxLives;
                    car.isDead = false;
                    car.speed = 0;
                    const spawn = getRandomSpawnPosition();
                    if (car.mesh) {
                        car.mesh.position.set(spawn.x, spawn.y, spawn.z);
                        car.mesh.rotation.y = spawn.rotY;
                    }

                    // Réinitialiser les joueurs distants
                    players.forEach((p) => {
                        p.lives = 3;
                        p.isDead = false;
                    });

                    // Réactiver le suivi de caméra et nettoyer l'UI locale
                    cameraFollow.enabled = true;
                    const existingMsg = document.getElementById('game-message');
                    if (existingMsg) existingMsg.remove();
                    const spectatorMsg = document.getElementById('spectator-message');
                    if (spectatorMsg) spectatorMsg.remove();

                    // Notifier le serveur pour réinitialiser la partie (si possible)
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'start_game' }));
                    }

                    // Mettre à jour l'affichage local
                    updateLivesDisplay();
                    updateHostControls();
                }
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
                <button id="start-game-btn" class="host-btn primary">
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
                <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: center;">
                    <button id="reset-game-btn" class="host-btn warning">
                        🔄 RÉINITIALISER
                    </button>
                </div>
            `;
            const resetBtn = document.getElementById('reset-game-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        if (confirm('Êtes-vous sûr de vouloir réinitialiser la partie ?')) {
                            socket.send(JSON.stringify({ type: 'start_game' }));
                        }
                    }
                });
            }
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

// Afficher notification de perte de vie
function showLifeLostNotification() {
    const notification = document.createElement('div');
    notification.className = 'life-lost-notification';
    notification.innerHTML = `
        <div class="notification-icon">💔</div>
        <div class="notification-text">VIE PERDUE!</div>
        <div class="notification-subtext">${car.lives} ${car.lives > 1 ? 'vies restantes' : 'vie restante'}</div>
    `;
    document.body.appendChild(notification);
    
    // Animer l'apparition
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Supprimer après animation
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 2000);
    
    // Effet de secousse de caméra
    shakeCameraEffect();
}

// Effet de secousse de caméra
function shakeCameraEffect() {
    const originalPos = camera.position.clone();
    const shakeIntensity = 0.5;
    const shakeDuration = 500; // ms
    const startTime = performance.now();
    
    function shake() {
        const elapsed = performance.now() - startTime;
        if (elapsed < shakeDuration) {
            const progress = elapsed / shakeDuration;
            const intensity = shakeIntensity * (1 - progress); // Diminue avec le temps
            camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity;
            camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity;
            camera.position.z = originalPos.z + (Math.random() - 0.5) * intensity;
            requestAnimationFrame(shake);
        } else {
            camera.position.copy(originalPos);
        }
    }
    shake();
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
    
    // Vérifier collecte de powerups
    checkPowerupCollection();
    
    // Animer les powerups (rotation)
    powerups.forEach(powerup => {
        if (!powerup.collected) {
            powerup.rotation += dt * 2;
            powerup.mesh.rotation.y = powerup.rotation;
            powerup.mesh.position.y = 1 + Math.sin(powerup.rotation * 2) * 0.3;
            powerup.sprite.position.y = powerup.mesh.position.y + 1.5;
        }
    });
    
    // Mettre à jour affichage des vies
    updateLivesDisplay();
    
    // Gérer invulnérabilité au spawn
    if (car.isInvulnerable && car.hasMovedOnce && car.invulnerabilityTimer > 0) {
        car.invulnerabilityTimer -= dt;
        if (car.invulnerabilityTimer <= 0) {
            car.isInvulnerable = false;
        }
        
        // Effet visuel clignotant
        if (car.mesh) {
            car.mesh.traverse((c) => {
                if (c.isMesh && c.material) {
                    c.material.opacity = 0.3 + Math.sin(Date.now() * 0.01) * 0.3;
                    c.material.transparent = true;
                }
            });
        }
    } else if (car.mesh && !car.isInvulnerable) {
        // Remettre opacité normale
        car.mesh.traverse((c) => {
            if (c.isMesh && c.material) {
                c.material.opacity = 1.0;
                c.material.transparent = false;
            }
        });
    }
    
    // Mettre à jour positions des noms des joueurs distants seulement
    // (pas de sprite de nom pour le joueur local)
    players.forEach(player => {
        if (player.nameSprite && player.mesh) {
            player.nameSprite.position.copy(player.mesh.position);
            player.nameSprite.position.y += 2;
        }
    });

    // --- car kinematics & input (seulement si vivant ET peut jouer) ---
    // On peut bouger même en lobby (isGameActive=false) tant qu'on peut jouer (canPlay=true)
    if (car.mesh && !car.isDead && gameState.canPlay) {
        // forward/back
        let forward = 0;
        if (keys['s'] ) forward += 5;
        if (keys['z']|| keys['w']) forward -= 5;

        // turn left/right
        let turn = 0;
        if (keys['q'] || keys['a']) turn += 1;
        if (keys['d']) turn -= 1;
        
        // Détecter le premier mouvement pour désactiver l'invulnérabilité
        if ((forward !== 0 || turn !== 0) && !car.hasMovedOnce) {
            car.hasMovedOnce = true;
            console.log('First movement detected, starting invulnerability timer');
        }
        
        // Jump avec F
        if (keys['f'] && !car.isJumping && car.mesh.position.y <= 0.3) {
            car.isJumping = true;
            car.jumpVelocity = car.jumpForce;
        }

            // boost state (Shift)
            const boosting = !!keys['shift'];
            
            // Skidding state (Space)
            const skidding = !car.isJumping && (keys[' '] || keys['space']) && Math.abs(car.speed) > car.skidMinSpeed;
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
        let deltaYaw = turn * car.turnSpeed * dt * (Math.abs(car.speed) / car.maxSpeed);
        
        // Augmenter l'angle de rotation pendant le drift
        if (skidding) {
            deltaYaw *= car.skidYawMultiplier; // Multiplier l'angle quand on drift
        }
        
        car.mesh.rotation.y += deltaYaw;

        // Physique du jump
        if (car.isJumping) {
            car.jumpVelocity += car.gravity * dt;
            car.mesh.position.y += car.jumpVelocity * dt;
            
            // Atterrissage
            if (car.mesh.position.y <= 0.2) {
                car.mesh.position.y = 0.2;
                car.isJumping = false;
                car.jumpVelocity = 0;
            }
        }
        
        // Appliquer le knockback s'il existe
        if (car.knockbackVelocity.length() > 0.01) {
            car.mesh.position.add(car.knockbackVelocity.clone().multiplyScalar(dt));
            // Friction pour ralentir le knockback
            car.knockbackVelocity.multiplyScalar(0.92);
            
            // Arrêter si trop lent
            if (car.knockbackVelocity.length() < 0.1) {
                car.knockbackVelocity.set(0, 0, 0);
            }
        }

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

// Initialiser la connexion WebSocket et démarrer l'animation
initWebSocket();
animate();


// Responsive resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

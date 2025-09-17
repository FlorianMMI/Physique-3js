import * as THREE from 'three'
import * as CANNON from './cannon-es.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// === Initialisation générale ===

// Renderer
const canvas = document.querySelector(".webgl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0e0e0);

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight);
camera.position.set(0, 5, 20);
camera.lookAt(0, 0, 0);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;




// === Physique (Cannon.js) ===

let solver = new CANNON.GSSolver();
solver.iterations = 50;
solver.tolerance = 0.000001;


const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
    solver: new CANNON.SplitSolver(solver),
});



// === Objets principaux ===

// Axes helper
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// === Cylindres en pyramide ===
const cylinderBodies = [];
const cylinderMeshes = [];
const cylRadius = 1;
const cylHeight = 2;
const cylMass = 5;

// Positions pour la pyramide (3 en bas, 2 au milieu, 1 au sommet)
const positions = [
    // base (y=1)
    [-2.2, 1, 0],
    [0, 1, 0],
    [2.2, 1, 0],
    // milieu (y=3)
    [-1.1, 3, 0],
    [1.1, 3, 0],
    // sommet (y=5)
    [0, 5, 0],
];

for (let i = 0; i < positions.length; i++) {
    // Cannon.js body
    const body = new CANNON.Body({
        mass: cylMass,
        shape: new CANNON.Cylinder(cylRadius, cylRadius, cylHeight, 32),
        position: new CANNON.Vec3(...positions[i]),
    });
    // Aligner l'axe du cylindre verticalement (Cannon.js cylindre par défaut sur X)
    body.quaternion.setFromEuler(0, 0, 0);
    world.addBody(body);
    cylinderBodies.push(body);

    // Three.js mesh
    const geometry = new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, 32);
    const material = new THREE.MeshNormalMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    cylinderMeshes.push(mesh);
}

// === Boule lancée à la souris ===
const ballRadius = 0.7;
const ballMass = 5;
let ballBody, ballMesh;

canvas.addEventListener('pointerdown', (event) => {
    // Calculer la direction depuis la caméra vers le point cliqué
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Direction du lancer (depuis la caméra)
    const direction = raycaster.ray.direction.clone().normalize();

    // Créer la boule à la position de la caméra
    if (ballBody) {
        world.removeBody(ballBody);
        scene.remove(ballMesh);
    }
    ballBody = new CANNON.Body({
        mass: ballMass,
        shape: new CANNON.Sphere(ballRadius),
        position: new CANNON.Vec3(camera.position.x, camera.position.y, camera.position.z)
    });
    world.addBody(ballBody);

    // Appliquer une impulsion dans la direction du clic
    const force = direction.multiplyScalar(40);
    ballBody.velocity.set(force.x, force.y, force.z);

    // Mesh Three.js
    const geometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    ballMesh = new THREE.Mesh(geometry, material);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    scene.add(ballMesh);
});

let ballMaterial = new CANNON.Material('ballMaterial');
let cylinderMaterial = new CANNON.Material('cylinderMaterial');

let ballcontactMaterial = new CANNON.ContactMaterial(
    ballMaterial,
    cylinderMaterial,
    { friction: 0.5, restitution: 0.9 }
);
world.addContactMaterial(ballcontactMaterial);

// Synchroniser la boule dans l'animation
function syncBall() {
    if (ballBody && ballMesh) {
        ballMesh.position.copy(ballBody.position);
        ballMesh.quaternion.copy(ballBody.quaternion);
    }
}

// Ajouter à la boucle d'animation



// === Lumière ===
let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
light.position.set(-50, 50, 50);
light.target.position.set(0, 0, 0);
scene.add(light);
scene.add(light.target);

light.castShadow = true;
light.shadow.bias = -0.001;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.camera.near = 50;
light.shadow.camera.far = 150;
light.shadow.camera.left = 100;
light.shadow.camera.right = -100;
light.shadow.camera.top = 100;
light.shadow.camera.bottom = -100;

// === Sol ===

// Ground physics body
const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Plane Three.js mesh
const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xcbcbcb })
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
plane.castShadow = true;
scene.add(plane);

// Grid helper
const gridHelper = new THREE.GridHelper(100, 40, 0x000000, 0x000000);
gridHelper.material.opacity = 0.2;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// === Événements ===

// Resize 
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
});


// ==== Mur Invisible ====
// Murs invisibles sur les 4 côtés du plan
const wallData = [
    // Front
    { pos: [0, 1, 50], rot: [0, 0, 0] },
    // Back
    { pos: [0, 1, -50], rot: [0, Math.PI, 0] },
    // Left
    { pos: [-50, 1, 0], rot: [0, -Math.PI / 2, 0] },
    // Right
    { pos: [50, 1, 0], rot: [0, Math.PI / 2, 0] },
];

wallData.forEach(({ pos, rot }) => {
    const wallBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 150, 2)),
        position: new CANNON.Vec3(...pos),
    });
    wallBody.quaternion.setFromEuler(...rot);
    world.addBody(wallBody);
});

// === Boucle d'animation ===
function animate() {
    requestAnimationFrame(animate);

    // Utiliser plusieurs sous-étapes pour plus de précision
    world.fixedStep();

    // Sync Three.js mesh with Cannon.js body
    cylinderMeshes.forEach((mesh, i) => {
        mesh.position.copy(cylinderBodies[i].position);
        mesh.quaternion.copy(cylinderBodies[i].quaternion);
    });

    syncBall();
    renderer.render(scene, camera);
}
animate();

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
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});

// === Objets principaux ===

// Axes helper
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// Box physics body
const BoxBody = new CANNON.Body({
    mass: 80,
    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
    position: new CANNON.Vec3(0, 10, 0)
});
world.addBody(BoxBody);

// Box Three.js mesh
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshNormalMaterial();
const boxMesh = new THREE.Mesh(geometry, material);
scene.add(boxMesh);

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

function randbetween(min, max) {
    return Math.random() * (max - min) + min;
}

// Impulsion sur la sphère avec la touche "Up"
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        console.log("Space pressed");
        BoxBody.velocity.x += randbetween(-5, 5);
        BoxBody.velocity.y += randbetween(5, 15);
        BoxBody.velocity.z += randbetween(-5, 5);
    }
});



// ==== Mur Invisible ====
// 


// 

// Murs invisibles sur les 4 côtés du plan, avec visualisation en rouge

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
    // Cannon.js wall
    const wallBody = new CANNON.Body({
        mass :0,
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

    world.step(1 / 60);

    // Sync Three.js mesh with Cannon.js body
    boxMesh.position.copy(BoxBody.position);
    boxMesh.quaternion.copy(BoxBody.quaternion);

    renderer.render(scene, camera);
}
animate();

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
scene.fog = new THREE.Fog(0xe0e0e0, 20, 100);

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

// Sphere physics body
const radius = 1;
const sphereBody = new CANNON.Body({
    mass: 80,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(0, 10, 0)
});
world.addBody(sphereBody);

// Sphere Three.js mesh
const geometry = new THREE.SphereGeometry(radius);
const material = new THREE.MeshNormalMaterial();
const sphereMesh = new THREE.Mesh(geometry, material);
scene.add(sphereMesh);

// === Lumière ===
let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
light.position.set(-50, 50, 50);
light.target.position.set(0, 0, 0);
scene.add(light);
scene.add(light.target);

const dlHelper = new THREE.DirectionalLightHelper(light);
scene.add(dlHelper);

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

const camHelper = new THREE.CameraHelper(light.shadow.camera);
scene.add(camHelper);

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
    new THREE.MeshPhongMaterial({ color: 0xcbcbcb })
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
plane.castShadow = false;
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
        sphereBody.velocity.x += randbetween(-5, 5);
        sphereBody.velocity.y += randbetween(5, 15);
        sphereBody.velocity.z += randbetween(-5, 5);
    }
});





// === Boucle d'animation ===
function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);

    // Sync Three.js mesh with Cannon.js body
    sphereMesh.position.copy(sphereBody.position);
    sphereMesh.quaternion.copy(sphereBody.quaternion);

    renderer.render(scene, camera);
}
animate();

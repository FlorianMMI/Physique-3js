// exo2.js — Three.js exercise: deformable cube (BufferGeometry) + plane
// - per-vertex physics (velocities), gravity, simple spring to rest shape
// - spacebar applies an upward random impulse to the cube (per-vertex)
// - vertices bounce on invisible walls and the floor

window.addEventListener('load', init);

function init() {
  // Scene / camera / renderer
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xececec);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(40, 40, 60);
  camera.lookAt(0, 10, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lights
  const amb = new THREE.AmbientLight(0x666666);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  // Plane (horizontal)
  const planeGeo = new THREE.PlaneGeometry(200, 200);
  planeGeo.rotateX(-Math.PI / 2);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8, metalness: 0.1 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.position.y = 0;
  scene.add(plane);

  // Deformable cube using BufferGeometry (8 vertices + indices)
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -5, 5, -5,
     5, 5, -5,
     5,15, -5,
    -5,15, -5,
    -5, 5,  5,
     5, 5,  5,
     5,15,  5,
    -5,15,  5,
  ]);
  const indices = [
    2,1,0, 0,3,2,
    0,4,7, 7,3,0,
    0,1,5, 5,4,0,
    1,2,6, 6,5,1,
    2,3,7, 7,6,2,
    4,5,6, 6,7,4
  ];
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0x156289, roughness: 0.6, metalness: 0.2 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // per-vertex physics state
  const posAttr = geometry.getAttribute('position');
  const basePositions = new Float32Array(posAttr.array.length);
  basePositions.set(posAttr.array); // rest shape

  const vertexCount = posAttr.count;
  const vx = new Float32Array(vertexCount);
  const vy = new Float32Array(vertexCount);
  const vz = new Float32Array(vertexCount);

  // physics params
  const gravity = 30.0; // units/s^2 (felt by vertices)
  const dt = 1 / 60;
  const damping = 0.98;
  const springK = 10.0; // spring strength to return to rest shape
  const restitution = 0.6; // bounce on floor/walls

  // world bounds (in local coordinates since mesh is at origin)
  const minX = -50, maxX = 50, minZ = -50, maxZ = 50, floorY = 0;

  // animation loop
  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const elapsed = (now - last) / 1000;
    // clamp large dt
    const step = Math.min(elapsed, 0.033);
    updateVertices(step);
  geometry.computeVertexNormals();
  posAttr.needsUpdate = true;

    renderer.render(scene, camera);
    last = now;
  }
  requestAnimationFrame((t) => { last = t; animate(t); });

// visible red walls to match physics bounds
const wallMargin = 50; // same margin used in the physics
const minX_ext = minX - wallMargin;
const maxX_ext = maxX + wallMargin;
const minZ_ext = minZ - wallMargin;
const maxZ_ext = maxZ + wallMargin;

const wallHeight = 60;
const wallThickness = 1;
const wallMat = new THREE.MeshStandardMaterial({
	color: 0xff0000,
	transparent: true,
	opacity: 0.6,
	side: THREE.DoubleSide
});

// left wall (minX_ext)
const leftGeo = new THREE.BoxGeometry(wallThickness, wallHeight, maxZ_ext - minZ_ext);
const leftWall = new THREE.Mesh(leftGeo, wallMat);
leftWall.position.set(minX_ext - wallThickness / 2, wallHeight / 2, (minZ_ext + maxZ_ext) / 2);
scene.add(leftWall);

// right wall (maxX_ext)
const rightGeo = new THREE.BoxGeometry(wallThickness, wallHeight, maxZ_ext - minZ_ext);
const rightWall = new THREE.Mesh(rightGeo, wallMat);
rightWall.position.set(maxX_ext + wallThickness / 2, wallHeight / 2, (minZ_ext + maxZ_ext) / 2);
scene.add(rightWall);

// back wall (minZ_ext)
const backGeo = new THREE.BoxGeometry(maxX_ext - minX_ext, wallHeight, wallThickness);
const backWall = new THREE.Mesh(backGeo, wallMat);
backWall.position.set((minX_ext + maxX_ext) / 2, wallHeight / 2, minZ_ext - wallThickness / 2);
scene.add(backWall);

// front wall (maxZ_ext)
const frontGeo = new THREE.BoxGeometry(maxX_ext - minX_ext, wallHeight, wallThickness);
const frontWall = new THREE.Mesh(frontGeo, wallMat);
frontWall.position.set((minX_ext + maxX_ext) / 2, wallHeight / 2, maxZ_ext + wallThickness / 2);
scene.add(frontWall);

// update vertices (physics) — uses the same extents as the visible walls
function updateVertices(dtSec) {
	const arr = posAttr.array;
	for (let i = 0; i < vertexCount; i++) {
		const idx = i * 3;
		// spring force towards base position
		const rx = basePositions[idx] - arr[idx];
		const ry = basePositions[idx + 1] - arr[idx + 1];
		const rz = basePositions[idx + 2] - arr[idx + 2];
		// apply spring acceleration
		vx[i] += springK * rx * dtSec;
		vy[i] += springK * ry * dtSec;
		vz[i] += springK * rz * dtSec;

		// gravity (downwards)
		vy[i] -= gravity * dtSec;

		// integrate
		arr[idx] += vx[i] * dtSec;
		arr[idx + 1] += vy[i] * dtSec;
		arr[idx + 2] += vz[i] * dtSec;

		// simple damping
		vx[i] *= damping;
		vy[i] *= damping;
		vz[i] *= damping;

		// collision with floor
		if (arr[idx + 1] < floorY) {
			arr[idx + 1] = floorY;
			vy[i] = -vy[i] * restitution;
		}

		// collision with X walls using extended bounds
		if (arr[idx] < minX_ext) {
			arr[idx] = minX_ext;
			vx[i] = -vx[i] * restitution;
		} else if (arr[idx] > maxX_ext) {
			arr[idx] = maxX_ext;
			vx[i] = -vx[i] * restitution;
		}
		// collision with Z walls using extended bounds
		if (arr[idx + 2] < minZ_ext) {
			arr[idx + 2] = minZ_ext;
			vz[i] = -vz[i] * restitution;
		} else if (arr[idx + 2] > maxZ_ext) {
			arr[idx + 2] = maxZ_ext;
			vz[i] = -vz[i] * restitution;
		}
	}
}

  // Spacebar: apply random upward impulse to vertices
window.addEventListener('keydown', (e) => {
	if (e.code === 'Space') {
		for (let i = 0; i < vertexCount; i++) {
			// add upward velocity and a little random horizontal kick
			// Valeur augmentée pour dépasser le cube
			vy[i] += 200 + Math.random() * 40;
			vx[i] += (Math.random() - 0.5) * 120;
			vz[i] += (Math.random() - 0.5) * 20;
		}
	}
});
  

  // responsiveness
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
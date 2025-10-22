import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * CameraManager - Manages camera, controls, and camera follow logic
 */
export class CameraManager {
    constructor(renderer) {
        this.camera = new THREE.PerspectiveCamera(
            60, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 20, 40);
        this.camera.lookAt(0, 0, 0);

        // OrbitControls setup
        this.controls = new OrbitControls(this.camera, renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 200;
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        // Camera follow configuration
        this.followConfig = {
            offset: new THREE.Vector3(0, 2.5, -6), // Behind and above the car
            lerp: 0.12, // Smoothing for camera position
            targetLerp: 0.15, // Smoothing for controls target
            enabled: true
        };

        // Handle window resize
        window.addEventListener('resize', () => this._onResize());
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Update camera to follow a target mesh
     */
    follow(targetMesh) {
        if (!this.followConfig.enabled || !targetMesh) return;

        // Get world position & orientation of target
        const worldPos = new THREE.Vector3();
        targetMesh.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        targetMesh.getWorldQuaternion(worldQuat);

        // Compute desired camera position in world space
        const localOffset = this.followConfig.offset.clone();
        const desiredPos = worldPos.clone().add(localOffset.applyQuaternion(worldQuat));

        // Smooth camera movement
        this.camera.position.lerp(desiredPos, this.followConfig.lerp);

        // Smooth controls target towards the target's world position
        this.controls.target.lerp(worldPos, this.followConfig.targetLerp);
    }

    /**
     * Set camera to spectator mode (aerial view)
     */
    enterSpectatorMode() {
        this.followConfig.enabled = false;
        this.camera.position.set(0, 50, 0);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /**
     * Enable camera follow
     */
    enableFollow() {
        this.followConfig.enabled = true;
    }

    /**
     * Shake camera effect (e.g., on collision)
     */
    shake(intensity = 0.5, duration = 500) {
        const originalPos = this.camera.position.clone();
        const startTime = performance.now();
        
        const shakeLoop = () => {
            const elapsed = performance.now() - startTime;
            if (elapsed < duration) {
                const progress = elapsed / duration;
                const currentIntensity = intensity * (1 - progress);
                this.camera.position.x = originalPos.x + (Math.random() - 0.5) * currentIntensity;
                this.camera.position.y = originalPos.y + (Math.random() - 0.5) * currentIntensity;
                this.camera.position.z = originalPos.z + (Math.random() - 0.5) * currentIntensity;
                requestAnimationFrame(shakeLoop);
            } else {
                this.camera.position.copy(originalPos);
            }
        };
        shakeLoop();
    }

    update() {
        this.controls.update();
    }

    getCamera() {
        return this.camera;
    }

    getControls() {
        return this.controls;
    }
}

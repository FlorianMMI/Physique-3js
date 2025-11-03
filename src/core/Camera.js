import * as THREE from 'three';

/**
 * CameraManager - Manages camera, controls, and camera follow logic
 */
export class CameraManager {
    constructor(renderer) {
        this.camera = new THREE.PerspectiveCamera(
            75, // Increased base FOV from 60 to 75
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 20, 40);

        // Camera follow configuration
        this.followConfig = {
            offset: new THREE.Vector3(0, 2.0, 6), // Behind and above the car (lowered from 3.0)
            lookAheadDistance: 8, // How far ahead to look
            lerp: 0.12, // Smoothing for camera position
            enabled: true
        };
        
        // Target to look at (smoothly interpolated)
        this.lookAtTarget = new THREE.Vector3(0, 0, 0);

        // Dynamic camera settings based on speed
        this.dynamicConfig = {
            baseFov: 75, // Default FOV (increased from 60)
            maxFov: 95, // Maximum FOV at high speed (increased from 75)
            fovLerpSpeed: 0.1, // How quickly FOV changes
            baseDistance: 3, // Base distance from car (reduced from 6)
            minDistance: 2.5, // Minimum distance at high speed (reduced from 3.5)
            distanceLerpSpeed: 0.04, // How quickly distance changes
            speedThreshold: 150 // Speed at which max FOV/min distance is reached
        };
        
        this.currentFov = this.dynamicConfig.baseFov;
        this.currentDistance = this.dynamicConfig.baseDistance;

        // Camera roll and tilt configuration
        this.rollConfig = {
            maxRollAngle: 0.15, // Maximum roll angle in radians (~8.6 degrees)
            rollLerpSpeed: 0.12, // How quickly roll changes
            tiltIntensity: 0.3, // Impact tilt intensity
            tiltDecay: 0.92 // How quickly tilt decays
        };
        
        this.currentRoll = 0; // Current roll angle
        this.targetRoll = 0; // Target roll angle
        this.tiltOffset = new THREE.Vector3(0, 0, 0); // Current tilt offset from impacts
        this.lastAngularVelocity = 0; // For detecting turning

        // Handle window resize
        window.addEventListener('resize', () => this._onResize());
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Update camera to follow a target mesh
     * @param {THREE.Mesh} targetMesh - The mesh to follow
     * @param {number} speed - Current speed of the target (for dynamic camera)
     * @param {number} angularVelocity - Current angular velocity (for roll effect)
     */
    follow(targetMesh, speed = 0, angularVelocity = 0) {
        if (!this.followConfig.enabled || !targetMesh) return;

        // Calculate dynamic FOV based on speed
        const speedRatio = Math.min(Math.abs(speed) / this.dynamicConfig.speedThreshold, 1);
        const targetFov = THREE.MathUtils.lerp(
            this.dynamicConfig.baseFov,
            this.dynamicConfig.maxFov,
            speedRatio
        );
        
        // Smoothly interpolate FOV
        this.currentFov = THREE.MathUtils.lerp(
            this.currentFov,
            targetFov,
            this.dynamicConfig.fovLerpSpeed
        );
        
        // Update camera FOV
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();

        // Calculate dynamic distance based on speed
        const targetDistance = THREE.MathUtils.lerp(
            this.dynamicConfig.baseDistance,
            this.dynamicConfig.minDistance,
            speedRatio
        );
        
        // Smoothly interpolate distance
        this.currentDistance = THREE.MathUtils.lerp(
            this.currentDistance,
            targetDistance,
            this.dynamicConfig.distanceLerpSpeed
        );

        // Calculate roll based on angular velocity (turning) AND track roll
        // Clamp angular velocity to ensure it's within -1 to 1
        const clampedAngularVelocity = THREE.MathUtils.clamp(angularVelocity, -1, 1);
        const turningRoll = -clampedAngularVelocity * this.rollConfig.maxRollAngle;
        
        // Get track roll from car's rotation (if car has track roll applied)
        const carRoll = targetMesh.rotation.z || 0;
        
        // Combine turning roll and track roll
        this.targetRoll = turningRoll + carRoll * 0.5; // Use 50% of car's track roll for subtler effect
        
        this.currentRoll = THREE.MathUtils.lerp(
            this.currentRoll,
            this.targetRoll,
            this.rollConfig.rollLerpSpeed
        );
        
        // Clamp current roll to max angle to prevent extreme rolls
        const maxTotalRoll = this.rollConfig.maxRollAngle * 1.5; // Allow slightly more roll when combined
        this.currentRoll = THREE.MathUtils.clamp(
            this.currentRoll,
            -maxTotalRoll,
            maxTotalRoll
        );

        // Apply tilt decay
        this.tiltOffset.multiplyScalar(this.rollConfig.tiltDecay);

        // Get world position & orientation of target
        const worldPos = new THREE.Vector3();
        targetMesh.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        targetMesh.getWorldQuaternion(worldQuat);

        // Compute desired camera position with dynamic distance
        const localOffset = new THREE.Vector3(
            this.followConfig.offset.x,
            this.followConfig.offset.y,
            -this.currentDistance // Use dynamic distance
        );
        const desiredPos = worldPos.clone().add(localOffset.applyQuaternion(worldQuat));

        // Add tilt offset
        desiredPos.add(this.tiltOffset);

        // Smooth camera movement
        this.camera.position.lerp(desiredPos, this.followConfig.lerp);

        // Calculate look-ahead target (point in front of the car)
        const forwardDir = new THREE.Vector3(0, 0, 1); // Forward in local space
        forwardDir.applyQuaternion(worldQuat); // Transform to world space
        const lookAheadTarget = worldPos.clone().add(
            forwardDir.multiplyScalar(this.followConfig.lookAheadDistance)
        );
        
        // Smooth look-at target
        this.lookAtTarget.lerp(lookAheadTarget, this.followConfig.lerp);
        
        // Make camera look at target
        this.camera.lookAt(this.lookAtTarget);
        
        // Apply roll after lookAt (which resets rotation)
        this.camera.rotateZ(this.currentRoll);
        
        this.lastAngularVelocity = angularVelocity;
    }

    /**
     * Set camera to spectator mode (aerial view)
     */
    enterSpectatorMode() {
        this.followConfig.enabled = false;
        this.camera.position.set(0, 50, 0);
        this.camera.lookAt(0, 0, 0);
        this.lookAtTarget.set(0, 0, 0);
        this.currentRoll = 0;
    }

    /**
     * Enable camera follow
     */
    enableFollow() {
        this.followConfig.enabled = true;
    }

    /**
     * Apply a tilt effect on impact/collision
     * @param {THREE.Vector3} impactDirection - Direction of the impact (normalized)
     * @param {number} intensity - Intensity of the impact (0-1)
     */
    applyImpactTilt(impactDirection, intensity = 1.0) {
        // Apply tilt in the direction of impact
        const tiltAmount = this.rollConfig.tiltIntensity * intensity;
        this.tiltOffset.x += impactDirection.x * tiltAmount;
        this.tiltOffset.y += impactDirection.y * tiltAmount * 0.5; // Less vertical movement
        this.tiltOffset.z += impactDirection.z * tiltAmount;
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
        // No longer need to call controls.update() since we removed OrbitControls
        // Roll is now applied directly in the follow() method
    }

    getCamera() {
        return this.camera;
    }

    getControls() {
        // Return null since we removed OrbitControls
        return null;
    }
}

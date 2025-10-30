import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Car - Manages individual car state, physics, controls, and model
 */
export class Car {
    constructor(scene, isLocal = false) {
        this.scene = scene;
        this.isLocal = isLocal;
        
        // Mesh and model
        this.mesh = null;
        this.placeholder = null;
        
        // Physics properties
        this.speed = 0;
        this.maxSpeed = 250; // Increased from 190
        this.accel = 20;
        this.baseMaxSpeed = 250; // Increased from 190
        this.baseAccel = 20;
        this.turnSpeed = Math.PI * 0.5; // Slightly increased from 0.45 for better turning
        this.turnSpeedPenalty = 0.998; // Speed multiplier when turning (99.8% - much less harsh)
        
        // Track following properties
        this.trackPitch = 0; // Current pitch from track slope
        this.trackRoll = 0; // Current roll from track banking
        this.pitchLerpSpeed = 0.15; // How quickly pitch follows track (increased for smoother)
        this.rollLerpSpeed = 0.15; // How quickly roll follows track (increased for smoother)
        this.altitudeLerpSpeed = 0.2; // How quickly altitude follows track
        
        // Boost configuration
        this.boostMultiplier = 2.0;
        this.boostMaxMultiplier = 1.5;
        this.boostEnergy = 1.0;
        this.boostMaxEnergy = 1.0;
        this.energyDrainRate = 0.8;
        this.energyRegenRate = 0.35;
        this.energyRegenDelay = 1.0;
        this.energyRegenTimer = 0.0;
        
        // Skid/drift configuration
        this.skidStrength = 0.12;
        this.skidYawMultiplier = 1.8;
        this.skidMinSpeed = 2.0;
        
        // Lives system
        this.lives = 3;
        this.maxLives = 3;
        this.isDead = false;
        
        // Collision properties
        this.collisionRadius = 1.2;
        this.collisionCooldown = 0;
        this.collisionCooldownTime = 0.5;
        
        // Lap tracking
        this.currentLap = 0;
        this.checkpointsCleared = new Set(); // Track which checkpoints have been passed
        this.lastPosition = new THREE.Vector3(); // For checkpoint crossing detection
        this.totalCheckpoints = 4; // Should match track's numCheckpoints
        
        // For remote players - interpolation
        this.targetPos = new THREE.Vector3();
        this.targetRot = 0;
        this.velocity = new THREE.Vector3();
        
        // Angular velocity for camera effects
        this.angularVelocity = 0;
        
        // Color
        this.color = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
        
        // Input state (for local player)
        this.keys = {};
        if (isLocal) {
            this._setupInput();
        }
    }

    _setupInput() {
        window.addEventListener('keydown', (e) => { 
            this.keys[e.key.toLowerCase()] = true; 
        });
        window.addEventListener('keyup', (e) => { 
            this.keys[e.key.toLowerCase()] = false; 
        });
    }

    /**
     * Load car model from GLTF
     */
    async loadModel(modelPath = 'sprite/Mazda RX-7.glb') {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            // Create placeholder while loading
            if (this.isLocal) {
                this.placeholder = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 0.6, 2),
                    new THREE.MeshStandardMaterial({ color: 0xff0000 })
                );
                this.placeholder.position.set(0, 0.3, 0);
                this.placeholder.rotation.y = Math.PI;
                this.scene.add(this.placeholder);
            }
            
            loader.load(
                modelPath,
                (gltf) => {
                    this.mesh = gltf.scene.clone(true);
                    
                    // Apply color to all meshes
                    this.mesh.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material = child.material.clone();
                            child.material.color = this.color.clone();
                        }
                    });
                    
                    this.mesh.scale.set(0.8, 0.8, 0.8);
                    this.scene.add(this.mesh);
                    
                    // Hide placeholder
                    if (this.placeholder) {
                        this.placeholder.visible = false;
                    }
                    
                    resolve(gltf.scene);
                },
                undefined,
                (error) => {
                    console.error('Failed to load car model:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Set spawn position
     */
    spawn(x, y, z, rotY) {
        if (this.mesh) {
            this.mesh.position.set(x, y, z);
            this.mesh.rotation.y = rotY;
            this.lastPosition.set(x, y, z);
        } else if (this.placeholder) {
            this.placeholder.position.set(x, y, z);
            this.placeholder.rotation.y = rotY;
            this.lastPosition.set(x, y, z);
        }
        this.speed = 0;
        this.lives = this.maxLives;
        this.isDead = false;
        this.resetLapProgress();
    }

    /**
     * Update car physics and controls (for local player)
     */
    updatePhysics(dt, canMove = true) {
        if (!this.mesh || this.isDead || !canMove) return;

        // Update collision cooldown
        if (this.collisionCooldown > 0) {
            this.collisionCooldown -= dt;
        }

        // Input processing
        let forward = 0;
        if (this.keys['s']) forward += 8; // Increased from 5 for stronger braking
        if (this.keys['z'] || this.keys['w']) forward -= 5;

        let turn = 0;
        if (this.keys['q'] || this.keys['a']) turn += 1;
        if (this.keys['d']) turn -= 1;

        // Boost logic
        const boosting = !!this.keys['shift'];
        if (boosting && this.boostEnergy > 0) {
            this.boostEnergy = Math.max(0, this.boostEnergy - this.energyDrainRate * dt);
            this.energyRegenTimer = 0.0;
        } else {
            this.energyRegenTimer += dt;
            if (this.energyRegenTimer >= this.energyRegenDelay) {
                this.boostEnergy = Math.min(
                    this.boostMaxEnergy, 
                    this.boostEnergy + this.energyRegenRate * dt
                );
            }
        }

        // Effective stats based on boost
        const boostAvailable = boosting && this.boostEnergy > 0;
        const effectiveAccel = this.baseAccel * (boostAvailable ? this.boostMultiplier : 1);
        const effectiveMaxSpeed = this.baseMaxSpeed * (boostAvailable ? this.boostMaxMultiplier : 1);

        // Acceleration
        if (forward !== 0) {
            this.speed += forward * effectiveAccel * dt;
        } else {
            // Much lower natural deceleration for better throttle management
            // Old: 4 * dt (loses ~98% speed per second)
            // New: 0.5 * dt (loses ~39% speed per second)
            this.speed *= Math.max(0, 1 - 0.5 * dt);
        }
        this.speed = Math.max(-effectiveMaxSpeed, Math.min(effectiveMaxSpeed, this.speed));

        // Turning
        const sign = Math.sign(this.speed || 1);
        const skidding = !!(this.keys[' '] || this.keys['space']);
        const turnFactor = skidding ? 1.25 : 1.0;
        
        // Speed-dependent turning: faster = wider turn radius (less turning)
        // At low speeds (0-50): full turning ability
        // At high speeds (200+): reduced turning (~40% of normal)
        const speedRatio = Math.abs(this.speed) / this.maxSpeed;
        const speedTurnMultiplier = 1.0 - (speedRatio * 0.6); // Reduces to 40% at max speed
        
        let deltaYaw = turn * this.turnSpeed * dt * 
                       (Math.abs(this.speed) / this.maxSpeed) * 
                       turnFactor * 
                       speedTurnMultiplier; // Apply speed-dependent reduction
        
        // Apply speed penalty when turning (much lighter now)
        if (Math.abs(turn) > 0.01 && Math.abs(this.speed) > 5) {
            if (skidding) {
                // Drifting causes more speed loss than regular turning
                // Regular turn: 0.2% loss, Drift: 1.5% loss
                this.speed *= 0.985;
            } else {
                this.speed *= this.turnSpeedPenalty;
            }
        }
        
        // Skid mechanics
        if (skidding && Math.abs(turn) > 0.01 && Math.abs(this.speed) > this.skidMinSpeed) {
            deltaYaw *= this.skidYawMultiplier;
            
            // Lateral slide
            const forwardDir = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(this.mesh.quaternion)
                .normalize();
            const lateralDir = new THREE.Vector3()
                .copy(forwardDir)
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 * Math.sign(turn));
            const slideVel = lateralDir.multiplyScalar(
                this.skidStrength * (Math.abs(this.speed) / this.maxSpeed) * Math.abs(turn)
            );
            this.mesh.position.add(slideVel.multiplyScalar(dt * 6.0));
        }
        
        this.mesh.rotation.y += deltaYaw;
        
        // Track angular velocity for camera effects (normalized to -1 to 1)
        // Only set if there's actual turning happening
        if (Math.abs(turn) > 0.01 && dt > 0) {
            const rawAngularVelocity = deltaYaw / (this.turnSpeed * dt);
            this.angularVelocity = THREE.MathUtils.clamp(rawAngularVelocity, -1, 1);
        } else {
            // Reset angular velocity when not turning
            this.angularVelocity = 0;
        }

        // Move forward
        const forwardVec = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(this.mesh.quaternion)
            .multiplyScalar(this.speed * dt * 0.1);
        this.mesh.position.add(forwardVec);

        return {
            forward,
            turn,
            boosting: boostAvailable,
            skidding
        };
    }

    /**
     * Update car to follow track surface (altitude and tilt)
     * @param {Track} track - The track object to follow
     */
    followTrackSurface(track) {
        if (!this.mesh || !track) return;

        // Get track surface information at car's position
        const surfaceInfo = track.getTrackSurfaceAt(this.mesh.position);
        
        // Update car's Y position to match track altitude (with offset for car height)
        const carHeightOffset = 0.3; // Adjust based on your car model
        const targetY = surfaceInfo.altitude + carHeightOffset;
        
        // Smoothly lerp altitude to avoid jumping
        this.mesh.position.y = THREE.MathUtils.lerp(
            this.mesh.position.y, 
            targetY, 
            this.altitudeLerpSpeed
        );
        
        // Smoothly interpolate pitch and roll
        this.trackPitch = THREE.MathUtils.lerp(this.trackPitch, surfaceInfo.pitch, this.pitchLerpSpeed);
        this.trackRoll = THREE.MathUtils.lerp(this.trackRoll, surfaceInfo.roll, this.rollLerpSpeed);
        
        // Apply pitch (rotation around X axis - going up/down slopes)
        this.mesh.rotation.x = this.trackPitch;
        
        // Apply roll (rotation around Z axis - banking on turns)
        // We need to apply this after the yaw rotation
        const yaw = this.mesh.rotation.y;
        this.mesh.rotation.set(this.trackPitch, yaw, this.trackRoll, 'YXZ');
    }

    /**
     * Interpolate remote player position
     */
    interpolate(dt) {
        if (!this.mesh || !this.targetPos) return;

        // Predict position based on velocity
        const predictedPos = this.targetPos.clone()
            .add(this.velocity.clone().multiplyScalar(dt * 2));
        
        // Lerp towards predicted position
        this.mesh.position.lerp(predictedPos, 0.3);
        
        // Interpolate rotation (handle wrap-around)
        const currentRot = this.mesh.rotation.y;
        let rotDiff = this.targetRot - currentRot;
        
        if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        
        this.mesh.rotation.y += rotDiff * 0.25;
    }

    /**
     * Update target position/rotation for interpolation
     */
    setTarget(x, y, z, rotY, vx, vz) {
        this.targetPos.set(x, y, z);
        this.targetRot = rotY;
        if (vx !== undefined && vz !== undefined) {
            this.velocity.set(vx, 0, vz);
        }
    }

    /**
     * Get rear world position (for particle effects)
     */
    getRearPosition() {
        if (!this.mesh) return null;
        const rearLocal = new THREE.Vector3(0, 0.1, 1.2);
        return rearLocal.applyMatrix4(this.mesh.matrixWorld);
    }

    /**
     * Get brake light positions
     */
    getBrakeLightPositions() {
        if (!this.mesh) return null;
        const leftLocal = new THREE.Vector3(-0.28, 0.08, -1.05);
        const rightLocal = new THREE.Vector3(0.28, 0.08, -1.05);
        return {
            left: leftLocal.applyMatrix4(this.mesh.matrixWorld),
            right: rightLocal.applyMatrix4(this.mesh.matrixWorld)
        };
    }

    /**
     * Get boost positions
     */
    getBoostPositions() {
        if (!this.mesh) return null;
        const leftLocal = new THREE.Vector3(-0.5, 0.06, -0.90);
        const rightLocal = new THREE.Vector3(0.5, 0.06, -0.90);
        return {
            left: leftLocal.applyMatrix4(this.mesh.matrixWorld),
            right: rightLocal.applyMatrix4(this.mesh.matrixWorld)
        };
    }

    /**
     * Get skid positions
     */
    getSkidPositions() {
        if (!this.mesh) return null;
        // Increased horizontal spacing to match tire positions
        const leftLocal = new THREE.Vector3(-0.55, 0.02, -1.05);
        const rightLocal = new THREE.Vector3(0.55, 0.02, -1.05);
        return {
            left: leftLocal.applyMatrix4(this.mesh.matrixWorld),
            right: rightLocal.applyMatrix4(this.mesh.matrixWorld)
        };
    }

    /**
     * Lose a life
     */
    loseLife() {
        this.lives = Math.max(0, this.lives - 1);
        if (this.lives <= 0) {
            this.isDead = true;
        }
        return this.lives;
    }

    /**
     * Pass through a checkpoint
     */
    passCheckpoint(checkpointId) {
        this.checkpointsCleared.add(checkpointId);
    }

    /**
     * Check if all checkpoints have been cleared
     */
    allCheckpointsCleared() {
        return this.checkpointsCleared.size >= this.totalCheckpoints;
    }

    /**
     * Complete a lap
     */
    completeLap() {
        if (this.allCheckpointsCleared()) {
            this.currentLap++;
            this.checkpointsCleared.clear();
            console.log(`Lap ${this.currentLap} completed!`);
            return true;
        }
        return false;
    }

    /**
     * Reset lap progress
     */
    resetLapProgress() {
        this.currentLap = 0;
        this.checkpointsCleared.clear();
    }

    /**
     * Remove car from scene
     */
    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
        if (this.placeholder) {
            this.scene.remove(this.placeholder);
        }
    }

    /**
     * Get active mesh (model or placeholder)
     */
    getActiveMesh() {
        return this.mesh || this.placeholder;
    }
}

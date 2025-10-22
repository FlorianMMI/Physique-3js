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
        this.maxSpeed = 190;
        this.accel = 20;
        this.baseMaxSpeed = 190;
        this.baseAccel = 20;
        this.turnSpeed = Math.PI * 0.6; // rad/s
        
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
        
        // For remote players - interpolation
        this.targetPos = new THREE.Vector3();
        this.targetRot = 0;
        this.velocity = new THREE.Vector3();
        
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
        } else if (this.placeholder) {
            this.placeholder.position.set(x, y, z);
            this.placeholder.rotation.y = rotY;
        }
        this.speed = 0;
        this.lives = this.maxLives;
        this.isDead = false;
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
        if (this.keys['s']) forward += 5;
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
            this.speed *= Math.max(0, 1 - 4 * dt);
        }
        this.speed = Math.max(-effectiveMaxSpeed, Math.min(effectiveMaxSpeed, this.speed));

        // Turning
        const sign = Math.sign(this.speed || 1);
        const skidding = !!(this.keys[' '] || this.keys['space']);
        const turnFactor = skidding ? 1.25 : 1.0;
        
        let deltaYaw = turn * this.turnSpeed * dt * 
                       (Math.abs(this.speed) / this.maxSpeed) * turnFactor;
        
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
        const leftLocal = new THREE.Vector3(-0.28, 0.02, -1.05);
        const rightLocal = new THREE.Vector3(0.28, 0.02, -1.05);
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

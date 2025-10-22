import * as THREE from 'three';
import { SceneManager } from './core/Scene.js';
import { RendererManager } from './core/Renderer.js';
import { CameraManager } from './core/Camera.js';
import { Car } from './game/Car.js';
import { GameState } from './game/GameState.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { NetworkClient } from './network/NetworkClient.js';
import { UIManager } from './ui/UIManager.js';

/**
 * Game - Main game coordinator
 */
export class Game {
    constructor() {
        // Core systems
        this.sceneManager = new SceneManager();
        this.renderer = new RendererManager();
        this.camera = new CameraManager(this.renderer.getRenderer());
        
        // Game state
        this.gameState = new GameState();
        this.gameState.platformRadius = this.sceneManager.getPlatformRadius();
        
        // Systems
        this.particles = new ParticleSystem(this.sceneManager.getScene());
        this.network = new NetworkClient(this.gameState);
        this.ui = new UIManager(this.gameState);
        
        // Players
        this.localCar = null;
        this.remotePlayers = new Map();
        this.carModelTemplate = null;
        
        // Timing
        this.prevTime = performance.now();
        
        this._setupNetworkHandlers();
    }

    /**
     * Initialize and start the game
     */
    async init() {
        // Create local car
        this.localCar = new Car(this.sceneManager.getScene(), true);
        
        // Load car model
        try {
            const template = await this.localCar.loadModel();
            this.carModelTemplate = template;
            
            // Spawn local car
            const spawn = this.gameState.getRandomSpawnPosition();
            this.localCar.spawn(spawn.x, spawn.y, spawn.z, spawn.rotY);
            
            console.log('Car model loaded');
        } catch (err) {
            console.error('Failed to load car model:', err);
        }
        
        // Connect to multiplayer
        try {
            await this.network.connect();
            this.network.startStateUpdates(this.localCar);
        } catch (err) {
            console.warn('Running in offline mode');
        }
        
        // Start game loop
        this.animate();
    }

    /**
     * Setup network message handlers
     */
    _setupNetworkHandlers() {
        // Handle welcome message (already handled in NetworkClient)
        this.network.on('welcome', (msg) => {
            if (this.gameState.isHost) {
                this.ui.showHostControls(
                    () => this._onStartGame(),
                    () => this._onResetGame()
                );
            }
            
            if (!this.gameState.canPlay) {
                this.camera.enterSpectatorMode();
                this.ui.showSpectatorMode('Partie en cours, vous rejoindrez la prochaine');
            }
        });
        
        // Handle player state updates
        this.network.on('state', (msg) => this._handlePlayerState(msg));
        
        // Handle disconnections
        this.network.on('disconnect', (msg) => this._handleDisconnect(msg));
        
        // Handle collision push
        this.network.on('collision_push', (msg) => this._handleCollisionPush(msg));
        
        // Handle host transfer
        this.network.on('you_are_host', () => {
            this.gameState.setHost(true);
            console.log('You are now the host!');
            this.ui.showHostControls(
                () => this._onStartGame(),
                () => this._onResetGame()
            );
        });
        
        // Handle game restart
        this.network.on('game_restart', (msg) => this._handleGameRestart(msg));
        
        // Handle game over
        this.network.on('game_over', (msg) => this._handleGameOver(msg));
    }

    /**
     * Handle remote player state update
     */
    _handlePlayerState(msg) {
        const id = msg.sender;
        if (id === this.gameState.localId) return;
        
        let player = this.remotePlayers.get(id);
        
        if (!player) {
            // Create new remote player
            player = new Car(this.sceneManager.getScene(), false);
            
            if (this.carModelTemplate) {
                player.mesh = this.carModelTemplate.clone(true);
                player.mesh.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color = player.color.clone();
                    }
                });
                player.mesh.scale.set(0.8, 0.8, 0.8);
                this.sceneManager.add(player.mesh);
            } else {
                // Placeholder
                player.mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1.6, 0.8, 3.2),
                    new THREE.MeshStandardMaterial({ color: player.color })
                );
                this.sceneManager.add(player.mesh);
            }
            
            player.setTarget(msg.x, msg.y, msg.z, msg.rotY, msg.vx, msg.vz);
            this.remotePlayers.set(id, player);
            
            console.log('Created remote player:', id);
        } else {
            // Update existing player
            player.setTarget(msg.x, msg.y, msg.z, msg.rotY, msg.vx, msg.vz);
            if (msg.lives !== undefined) {
                player.lives = msg.lives;
                player.isDead = msg.lives <= 0;
            }
        }
    }

    /**
     * Handle player disconnect
     */
    _handleDisconnect(msg) {
        const player = this.remotePlayers.get(msg.id);
        if (player) {
            player.destroy();
            this.remotePlayers.delete(msg.id);
        }
    }

    /**
     * Handle collision push from server
     */
    _handleCollisionPush(msg) {
        if (msg.target === this.gameState.localId && this.localCar.mesh && !this.localCar.isDead) {
            const pushForce = new THREE.Vector3(msg.forceX || 0, msg.forceY || 0, msg.forceZ || 0);
            this.localCar.mesh.position.add(pushForce);
            this.localCar.speed *= 0.5;
        }
    }

    /**
     * Handle game restart
     */
    _handleGameRestart(msg) {
        console.log('Game restarting!');
        this.gameState.reset();
        this.gameState.setCanPlay(true);
        
        // Reset local car
        const spawn = this.gameState.getRandomSpawnPosition();
        this.localCar.spawn(spawn.x, spawn.y, spawn.z, spawn.rotY);
        
        // Reset remote players
        this.remotePlayers.forEach((player) => {
            player.lives = 3;
            player.isDead = false;
        });
        
        // Re-enable camera follow
        this.camera.enableFollow();
        
        // Clear UI
        this.ui.clearMessages();
        this.ui.updateHostControls(
            () => this._onStartGame(),
            () => this._onResetGame()
        );
    }

    /**
     * Handle game over
     */
    _handleGameOver(msg) {
        console.log('Game Over! Winner:', msg.winnerId);
        this.gameState.setWinner(msg.winnerId);
        
        if (msg.winnerId === null) {
            this.ui.showDraw();
        } else if (msg.winnerId === this.gameState.localId) {
            this.ui.showVictory();
        } else {
            this.ui.showDefeat(msg.winnerId);
        }
        
        this.ui.updateHostControls(
            () => this._onStartGame(),
            () => this._onResetGame()
        );
    }

    /**
     * Start game button handler
     */
    _onStartGame() {
        this.network.startGame();
    }

    /**
     * Reset game button handler
     */
    _onResetGame() {
        if (confirm('Êtes-vous sûr de vouloir réinitialiser la partie ?')) {
            this.network.startGame();
        }
    }

    /**
     * Check collisions between local car and remote players
     */
    _checkCollisions(dt) {
        if (!this.localCar.mesh || this.localCar.isDead) return;
        
        if (this.localCar.collisionCooldown > 0) {
            this.localCar.collisionCooldown -= dt;
        }
        
        this.remotePlayers.forEach((player, id) => {
            if (!player.mesh || player.isDead) return;
            
            const collisionDistance = (this.localCar.collisionRadius + player.collisionRadius) * 1.3;
            const dist = this.localCar.mesh.position.distanceTo(player.mesh.position);
            
            if (dist < collisionDistance && this.localCar.collisionCooldown <= 0) {
                // Collision detected
                const collisionVector = new THREE.Vector3()
                    .subVectors(player.mesh.position, this.localCar.mesh.position)
                    .normalize();
                
                const impactForce = Math.abs(this.localCar.speed) * 0.035;
                const restitution = 1.2;
                const separationForce = 2.5;
                
                // Send collision to server
                this.network.sendCollisionPush(
                    id,
                    collisionVector.x * (impactForce * restitution + separationForce),
                    0,
                    collisionVector.z * (impactForce * restitution + separationForce)
                );
                
                // Reduce local car speed
                this.localCar.speed *= 0.85;
                
                // Emit explosion particles
                const impactPoint = new THREE.Vector3()
                    .addVectors(this.localCar.mesh.position, player.mesh.position)
                    .multiplyScalar(0.5);
                this.particles.emitExplosion(impactPoint);
                
                this.localCar.collisionCooldown = this.localCar.collisionCooldownTime;
            }
        });
    }

    /**
     * Check if car fell off platform
     */
    _checkFallOff() {
        if (!this.localCar.mesh || this.localCar.isDead) return;
        
        const pos = this.localCar.mesh.position;
        if (this.gameState.isOutOfBounds(pos.x, pos.y, pos.z)) {
            console.log('Fell off platform! Lives remaining:', this.localCar.lives - 1);
            
            this.localCar.loseLife();
            this.network.notifyLivesChange(this.localCar.lives);
            this.ui.showLifeLost(this.localCar.lives);
            this.camera.shake();
            
            if (this.localCar.lives > 0) {
                // Respawn
                const spawn = this.gameState.getRandomSpawnPosition();
                this.localCar.spawn(spawn.x, spawn.y, spawn.z, spawn.rotY);
            } else {
                // Dead - enter spectator mode
                this.localCar.isDead = true;
                this.camera.enterSpectatorMode();
                this.ui.showSpectatorMode();
                this.network.notifyFall();
            }
        }
    }

    /**
     * Emit particles based on car actions
     */
    _emitCarParticles(actions) {
        if (!actions || !this.localCar.mesh) return;
        
        // Brake particles
        if (actions.forward > 0) { // S key
            const lights = this.localCar.getBrakeLightPositions();
            if (lights) {
                this.particles.emitBrake(lights.left, 6);
                this.particles.emitBrake(lights.right, 6);
            }
        }
        
        // Boost particles
        if (actions.boosting) {
            const boosts = this.localCar.getBoostPositions();
            if (boosts) {
                this.particles.emitBoost(boosts.left, 4);
                this.particles.emitBoost(boosts.right, 4);
            }
        }
        
        // Skid particles
        if (actions.skidding) {
            const skids = this.localCar.getSkidPositions();
            if (skids) {
                this.particles.emitSkid(skids.left, actions.turn !== 0 ? 2 : 1);
                this.particles.emitSkid(skids.right, actions.turn !== 0 ? 2 : 1);
            }
        }
    }

    /**
     * Main game loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const now = performance.now();
        const dt = Math.max(0, (now - this.prevTime) / 1000);
        this.prevTime = now;
        
        // Update remote players (interpolation)
        this.remotePlayers.forEach((player) => {
            player.interpolate(dt);
        });
        
        // Check collisions
        this._checkCollisions(dt);
        
        // Check if fell off platform
        this._checkFallOff();
        
        // Update local car physics
        const canMove = !this.localCar.isDead && 
                       this.gameState.isGameActive && 
                       this.gameState.canPlay;
        const actions = this.localCar.updatePhysics(dt, canMove);
        
        // Emit particles based on car actions
        if (canMove) {
            this._emitCarParticles(actions);
        }
        
        // Update particles
        this.particles.update(dt);
        
        // Update camera
        if (!this.localCar.isDead) {
            this.camera.follow(this.localCar.getActiveMesh());
        }
        this.camera.update();
        
        // Update UI
        this.ui.updateLives(this.localCar.lives, this.localCar.maxLives);
        this.ui.updateBoost(this.localCar.boostEnergy, this.localCar.boostMaxEnergy);
        this.ui.updateParticleCount(this.particles.getParticleCount());
        
        // Render
        this.renderer.render(this.sceneManager.getScene(), this.camera.getCamera());
    }
}

import * as THREE from 'three';

/**
 * ParticleSystem - Manages all particle effects in the game
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.particleGroup = new THREE.Group();
        this.scene.add(this.particleGroup);
        
        // Load textures
        this.textureLoader = new THREE.TextureLoader();
        this.smokeMaps = [];
        this.sparkTexture = null;
        
        // Wind system
        this.wind = new THREE.Vector3(0.2, 0, 0);
        this.windTime = 0;
        this.windParams = {
            strength: 1.0,
            gustChance: 0.01,
            gustMax: 1.2,
            response: 1.0
        };
        
        // Particle options
        this.options = {
            emissionRate: 0,
            particleLifeMin: 1.0,
            particleLifeMax: 15.0,
            particleSizeMin: 12,
            particleSizeMax: 20,
            smokeFadeExponent: 3,
            buoyancy: 12.0,
            verticalDrag: 0.25,
            initialVyMin: 2.0,
            initialVyMax: 4.0
        };
        
        this._loadTextures();
    }

    async _loadTextures() {
        // Load smoke animation frames
        for (let i = 0; i < 91; i++) {
            const map = this.textureLoader.load(
                'sprite/smoke/' + String(i).padStart(4, '0') + '.png'
            );
            this.smokeMaps.push(map);
        }
        
        // Load spark texture
        this.sparkTexture = this.textureLoader.load('sprite/spark1 (1).png');
    }

    /**
     * Update wind simulation
     */
    updateWind(dt) {
        this.windTime += dt;
        
        const baseX = Math.sin(this.windTime * 0.25) * 0.4;
        const baseZ = Math.cos(this.windTime * 0.15) * 0.25;
        
        const gust = (Math.random() < this.windParams.gustChance)
            ? (Math.random() * this.windParams.gustMax) * (Math.random() > 0.5 ? 1 : -1)
            : 0;
        
        this.wind.set(baseX + gust, 0, baseZ).multiplyScalar(this.windParams.strength);
    }

    /**
     * Emit smoke particles
     */
    emitSmoke(worldPos, count = 1) {
        if (!this.sparkTexture) return;
        
        for (let i = 0; i < count; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.sparkTexture,
                transparent: true,
                alphaTest: 0.001,
                color: 0xd3d3d3,
                blending: THREE.NormalBlending,
                depthTest: false,
                depthWrite: false,
                opacity: 1.0
            });
            
            const sprite = new THREE.Sprite(material);
            
            sprite.position.set(
                worldPos.x + (Math.random() - 0.5) * 0.5,
                worldPos.y + 0.5 + Math.random() * 0.6,
                worldPos.z + (Math.random() - 0.5) * 0.5
            );
            
            const initialSize = this.options.particleSizeMin + 
                Math.random() * (this.options.particleSizeMax - this.options.particleSizeMin);
            sprite.scale.set(initialSize, initialSize, 1);
            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.15,
                this.options.initialVyMin + Math.random() * 
                    (this.options.initialVyMax - this.options.initialVyMin),
                (Math.random() - 0.5) * 0.15
            );
            
            const windImpulse = this.wind.clone();
            windImpulse.y = 0;
            velocity.addScaledVector(windImpulse, 0.6);
            
            const life = this.options.particleLifeMin + 
                Math.random() * (this.options.particleLifeMax - this.options.particleLifeMin);
            
            const particle = {
                sprite,
                velocity,
                age: 0,
                life,
                initialSize,
                currentFrame: 0,
                material,
                type: 'smoke'
            };
            
            this.particleGroup.add(sprite);
            this.particles.push(particle);
        }
    }

    /**
     * Emit brake particles (red sparks)
     */
    emitBrake(worldPos, count = 6) {
        if (!this.sparkTexture) return;
        
        for (let i = 0; i < count; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.sparkTexture,
                color: 0xff0000,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.position.set(
                worldPos.x + (Math.random() - 0.5) * 0.12,
                worldPos.y + (Math.random() - 0.5) * 0.06,
                worldPos.z + (Math.random() - 0.5) * 0.12
            );
            
            const size = 0.12 + Math.random() * 0.08;
            sprite.scale.set(size, size, 1);
            
            const particle = {
                sprite,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.04,
                    Math.random() * 0.02,
                    (Math.random() - 0.5) * 0.04
                ),
                age: 0,
                life: 0.25 + Math.random() * 0.15,
                initialSize: size,
                material,
                type: 'brake'
            };
            
            this.particleGroup.add(sprite);
            this.particles.push(particle);
        }
    }

    /**
     * Emit boost particles (orange)
     */
    emitBoost(worldPos, count = 8) {
        if (!this.sparkTexture) return;
        
        for (let i = 0; i < count; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.sparkTexture,
                color: 0xff8c00,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.position.set(
                worldPos.x + (Math.random() - 0.5) * 0.18,
                worldPos.y + (Math.random() - 0.5) * 0.08,
                worldPos.z + (Math.random() - 0.5) * 0.18
            );
            
            const size = 0.16 + Math.random() * 0.12;
            sprite.scale.set(size, size, 1);
            
            const particle = {
                sprite,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.06,
                    Math.random() * 0.03,
                    (Math.random() - 0.5) * 0.06
                ),
                age: 0,
                life: 0.35 + Math.random() * 0.2,
                initialSize: size,
                material,
                type: 'boost'
            };
            
            this.particleGroup.add(sprite);
            this.particles.push(particle);
        }
    }

    /**
     * Emit skid particles (black trails)
     */
    emitSkid(worldPos, count = 1) {
        if (!this.sparkTexture) return;
        
        for (let i = 0; i < count; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.sparkTexture,
                color: 0x000000,
                transparent: true,
                opacity: 0.9,
                blending: THREE.NormalBlending,
                depthTest: false,
                depthWrite: false
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.position.set(
                worldPos.x + (Math.random() - 0.5) * 0.06,
                worldPos.y + (Math.random() - 0.5) * 0.02,
                worldPos.z + (Math.random() - 0.5) * 0.06
            );
            
            const size = 0.18 + Math.random() * 0.06;
            sprite.scale.set(size, size * 0.5, 1);
            
            const particle = {
                sprite,
                velocity: new THREE.Vector3(0, 0, 0),
                age: 0,
                life: 0.8 + Math.random() * 0.8,
                initialSize: size,
                material,
                type: 'skid'
            };
            
            this.particleGroup.add(sprite);
            this.particles.push(particle);
        }
    }

    /**
     * Emit explosion particles (collision effect)
     */
    emitExplosion(worldPos, count = 20) {
        if (!this.sparkTexture) return;
        
        for (let i = 0; i < count; i++) {
            const material = new THREE.SpriteMaterial({
                map: this.sparkTexture,
                color: new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.5),
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.position.set(
                worldPos.x + (Math.random() - 0.5) * 0.3,
                worldPos.y + Math.random() * 0.5,
                worldPos.z + (Math.random() - 0.5) * 0.3
            );
            
            const size = 0.2 + Math.random() * 0.3;
            sprite.scale.set(size, size, 1);
            
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            
            const particle = {
                sprite,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    Math.random() * 2 + 1,
                    Math.sin(angle) * speed
                ),
                age: 0,
                life: 0.5 + Math.random() * 0.3,
                initialSize: size,
                material,
                type: 'explosion'
            };
            
            this.particleGroup.add(sprite);
            this.particles.push(particle);
        }
    }

    /**
     * Update all particles
     */
    update(dt) {
        this.updateWind(dt);
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.age += dt;
            const lifeRatio = particle.age / particle.life;
            
            // Remove dead particles
            if (lifeRatio >= 1.0) {
                this.particleGroup.remove(particle.sprite);
                particle.sprite.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            
            // Update based on type
            this._updateParticleByType(particle, dt, lifeRatio);
        }
    }

    _updateParticleByType(particle, dt, lifeRatio) {
        switch (particle.type) {
            case 'brake':
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 1 - lifeRatio);
                const brakeSizeRatio = 1 - 0.8 * lifeRatio;
                particle.sprite.scale.set(
                    particle.initialSize * brakeSizeRatio,
                    particle.initialSize * brakeSizeRatio,
                    1
                );
                break;
                
            case 'explosion':
                particle.velocity.y -= 9.8 * dt;
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 1 - lifeRatio);
                const expSizeRatio = 1 - 0.6 * lifeRatio;
                particle.sprite.scale.set(
                    particle.initialSize * expSizeRatio,
                    particle.initialSize * expSizeRatio,
                    1
                );
                break;
                
            case 'boost':
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 1 - lifeRatio);
                const boostSizeRatio = 1 - 0.7 * lifeRatio;
                particle.sprite.scale.set(
                    particle.initialSize * boostSizeRatio,
                    particle.initialSize * boostSizeRatio,
                    1
                );
                break;
                
            case 'skid':
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.material.opacity = Math.max(0, 0.9 - lifeRatio);
                const skidSizeRatio = 1 - 0.4 * lifeRatio;
                particle.sprite.scale.set(
                    particle.initialSize * skidSizeRatio,
                    particle.initialSize * skidSizeRatio * 0.5,
                    1
                );
                break;
                
            case 'smoke':
            default:
                // Apply wind
                particle.velocity.addScaledVector(this.wind, dt * this.windParams.response);
                
                // Horizontal noise
                particle.velocity.x += (Math.random() - 0.5) * 0.002;
                particle.velocity.z += (Math.random() - 0.5) * 0.002;
                
                // Buoyancy and vertical drag
                particle.velocity.y += this.options.buoyancy * dt;
                particle.velocity.y *= Math.exp(-this.options.verticalDrag * dt);
                
                // Update position
                particle.sprite.position.add(particle.velocity.clone().multiplyScalar(dt));
                
                // Fade out
                const alpha = Math.pow(1 - lifeRatio, this.options.smokeFadeExponent);
                particle.material.opacity = alpha * 0.7;
                
                // Animate smoke frames
                if (this.smokeMaps.length > 0) {
                    const frameIndex = Math.floor(lifeRatio * (this.smokeMaps.length - 1));
                    if (frameIndex !== particle.currentFrame) {
                        particle.currentFrame = frameIndex;
                        particle.material.map = this.smokeMaps[frameIndex];
                        particle.material.needsUpdate = true;
                    }
                }
                
                // Size change
                const smokeSizeRatio = 1 - 0.3 * lifeRatio;
                particle.sprite.scale.set(
                    particle.initialSize * smokeSizeRatio,
                    particle.initialSize * smokeSizeRatio,
                    1
                );
                
                // Subtle rotation
                particle.sprite.material.rotation += dt * 0.1 * (Math.random() - 0.5);
                break;
        }
    }

    getParticleCount() {
        return this.particles.length;
    }
}

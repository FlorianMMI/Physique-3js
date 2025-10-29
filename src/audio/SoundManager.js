import * as THREE from 'three';

/**
 * SoundManager - Handles game audio including engine sounds
 */
export class SoundManager {
    constructor() {
        this.listener = null;
        this.engineSound = null;
        this.revvingSound = null;
        this.boostSound = null;
        this.skidSound = null;
        this.impact1Sound = null;
        this.impact2Sound = null;
        this.currentMusicSound = null;
        this.initialized = false;
        
        // Audio settings
        this.basePitch = 1.0;
        this.maxPitch = 1.8;
        this.minPitch = 0.8;
        this.pitchSensitivity = 0.3; // How much speed affects pitch
        
        // Lower pitch range for deeper, more realistic revving sound
        this.revvingBasePitch = 0.4;  // Much lower base pitch
        this.revvingMaxPitch = 1.2;   // Lower max pitch (was 2.0)
        
        // Skid sound timing (actual sound is between 0.06 and 0.5 seconds)
        this.skidStartOffset = 0.06;
        this.skidDuration = 0.44; // 0.5 - 0.06
        
        // Impact cooldown to prevent sound spam
        this.impactCooldown = 0;
        this.impactCooldownTime = 0.3; // seconds
        
        // Background music
        this.musicTracks = [
            'sounds/music/BORN TO RACE - PXRKX.mp3',
            'sounds/music/GROUP B - ANGXL.mp3',
            'sounds/music/MARLBORO CLUB - PXRKX.mp3',
            'sounds/music/RACING - PXRKX.mp3',
            'sounds/music/Rally House - valtis.mp3',
            'sounds/music/SUBXRU CLXB - Subaru Playa.mp3'
        ];
        this.musicBuffers = new Map();
        this.playedTracks = [];
        this.currentTrackIndex = -1;
        this.onTrackChange = null; // Callback for UI updates
        
        // State tracking
        this.isSkidding = false;
        this.isBoosting = false;
    }

    /**
     * Initialize audio system with a camera for spatial audio
     */
    async init(camera) {
        try {
            // Create audio listener
            this.listener = new THREE.AudioListener();
            camera.add(this.listener);

            // Create audio loader
            const loader = new THREE.AudioLoader();

            // Load engine sound (constant loop)
            this.engineSound = new THREE.Audio(this.listener);
            const engineBuffer = await this._loadAudio(loader, 'sounds/engine.wav');
            this.engineSound.setBuffer(engineBuffer);
            this.engineSound.setLoop(true);
            this.engineSound.setVolume(0.4);

            // Load revving sound (acceleration)
            this.revvingSound = new THREE.Audio(this.listener);
            const revvingBuffer = await this._loadAudio(loader, 'sounds/revving.ogg');
            this.revvingSound.setBuffer(revvingBuffer);
            this.revvingSound.setLoop(true);
            this.revvingSound.setVolume(0);
            this.revvingSound.setPlaybackRate(this.revvingBasePitch); // Start with lower pitch

            // Load boost sound
            this.boostSound = new THREE.Audio(this.listener);
            const boostBuffer = await this._loadAudio(loader, 'sounds/boost.wav');
            this.boostSound.setBuffer(boostBuffer);
            this.boostSound.setLoop(true);
            this.boostSound.setVolume(0);

            // Load skid sound (loop only the useful part)
            this.skidSound = new THREE.Audio(this.listener);
            const skidBuffer = await this._loadAudio(loader, 'sounds/skid.wav');
            this.skidSound.setBuffer(skidBuffer);
            this.skidSound.setLoop(true);
            this.skidSound.setVolume(0);

            // Load impact sounds (one-shot sounds)
            this.impact1Sound = new THREE.Audio(this.listener);
            const impact1Buffer = await this._loadAudio(loader, 'sounds/impact1.flac');
            this.impact1Sound.setBuffer(impact1Buffer);
            this.impact1Sound.setLoop(false);
            this.impact1Sound.setVolume(0.6);

            this.impact2Sound = new THREE.Audio(this.listener);
            const impact2Buffer = await this._loadAudio(loader, 'sounds/impact2.mp3');
            this.impact2Sound.setBuffer(impact2Buffer);
            this.impact2Sound.setLoop(false);
            this.impact2Sound.setVolume(0.6);

            // Load all music tracks
            console.log('Loading music tracks...');
            for (const trackPath of this.musicTracks) {
                try {
                    const buffer = await this._loadAudio(loader, trackPath);
                    this.musicBuffers.set(trackPath, buffer);
                    console.log(`Loaded: ${this._getTrackName(trackPath)}`);
                } catch (err) {
                    console.error(`Failed to load music: ${trackPath}`, err);
                }
            }

            this.initialized = true;
            console.log('Sound system initialized');
        } catch (error) {
            console.error('Failed to initialize sound system:', error);
        }
    }

    /**
     * Helper to load audio file
     */
    _loadAudio(loader, url) {
        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (buffer) => resolve(buffer),
                undefined,
                (error) => reject(error)
            );
        });
    }

    /**
     * Extract track name from file path
     */
    _getTrackName(trackPath) {
        const fileName = trackPath.split('/').pop();
        return fileName.replace('.mp3', '').replace('.ogg', '').replace('.wav', '');
    }

    /**
     * Play next random music track (avoiding repeats until all played)
     */
    _playNextTrack() {
        if (!this.initialized || this.musicBuffers.size === 0) return;

        // If we've played all tracks, reset the list
        if (this.playedTracks.length >= this.musicTracks.length) {
            this.playedTracks = [];
        }

        // Find tracks that haven't been played yet
        const availableTracks = this.musicTracks.filter(
            track => !this.playedTracks.includes(track)
        );

        if (availableTracks.length === 0) return;

        // Pick a random track from available ones
        const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        this.playedTracks.push(randomTrack);

        // Stop current music if playing
        if (this.currentMusicSound && this.currentMusicSound.isPlaying) {
            this.currentMusicSound.stop();
        }

        // Create new audio instance
        this.currentMusicSound = new THREE.Audio(this.listener);
        const buffer = this.musicBuffers.get(randomTrack);
        if (buffer) {
            this.currentMusicSound.setBuffer(buffer);
            this.currentMusicSound.setLoop(false);
            this.currentMusicSound.setVolume(0.20); // Keep it quiet so it doesn't drown out SFX
            
            // Play and set up ended listener
            this.currentMusicSound.play();
            
            // Set up ended listener on the source for next track
            if (this.currentMusicSound.source) {
                this.currentMusicSound.source.onended = () => {
                    console.log('Track ended, playing next...');
                    this._playNextTrack();
                };
            }

            // Notify UI about track change
            const trackName = this._getTrackName(randomTrack);
            console.log(`Now playing: ${trackName}`);
            if (this.onTrackChange) {
                this.onTrackChange(trackName);
            }
        }
    }

    /**
     * Start background music
     */
    startMusic() {
        if (!this.initialized) return;
        this._playNextTrack();
    }

    /**
     * Stop background music
     */
    stopMusic() {
        if (this.currentMusicSound && this.currentMusicSound.isPlaying) {
            this.currentMusicSound.stop();
        }
    }

    /**
     * Set callback for track changes
     */
    setTrackChangeCallback(callback) {
        this.onTrackChange = callback;
    }

    /**
     * Start playing engine sounds
     */
    start() {
        if (!this.initialized) return;

        if (this.engineSound && !this.engineSound.isPlaying) {
            this.engineSound.play();
        }
        if (this.revvingSound && !this.revvingSound.isPlaying) {
            this.revvingSound.play();
        }
        if (this.boostSound && !this.boostSound.isPlaying) {
            this.boostSound.play();
        }
        if (this.skidSound && !this.skidSound.isPlaying) {
            this.skidSound.play();
        }
        
        // Start background music when game starts
        this.startMusic();
    }

    /**
     * Update sound based on car state
     * @param {number} speed - Current car speed
     * @param {number} maxSpeed - Maximum car speed
     * @param {boolean} isAccelerating - Whether the car is accelerating
     * @param {boolean} isBoosting - Whether boost is active
     * @param {boolean} isSkidding - Whether the car is skidding/drifting
     * @param {number} dt - Delta time for cooldown updates
     */
    update(speed, maxSpeed, isAccelerating, isBoosting = false, isSkidding = false, dt = 0) {
        if (!this.initialized) return;

        // Update impact cooldown
        if (this.impactCooldown > 0) {
            this.impactCooldown -= dt;
        }

        // Calculate speed ratio (0 to 1)
        const speedRatio = Math.min(Math.abs(speed) / maxSpeed, 1);

        // Update engine sound pitch based on speed
        if (this.engineSound && this.engineSound.isPlaying) {
            const enginePitch = this.minPitch + (speedRatio * this.pitchSensitivity);
            this.engineSound.setPlaybackRate(Math.min(enginePitch, this.maxPitch));
        }

        // Update revving sound based on acceleration
        if (this.revvingSound && this.revvingSound.isPlaying) {
            if (isAccelerating && speedRatio > 0.1) {
                // Fade in and pitch up when accelerating
                const targetVolume = 0.3 * speedRatio;
                const currentVolume = this.revvingSound.getVolume();
                const newVolume = currentVolume + (targetVolume - currentVolume) * 0.1;
                this.revvingSound.setVolume(newVolume);

                // Pitch increases with speed during acceleration
                const revPitch = this.revvingBasePitch + (speedRatio * (this.revvingMaxPitch - this.revvingBasePitch));
                this.revvingSound.setPlaybackRate(revPitch);
            } else {
                // Fade out when not accelerating
                const currentVolume = this.revvingSound.getVolume();
                const newVolume = currentVolume * 0.9;
                this.revvingSound.setVolume(newVolume);
            }
        }

        // Update boost sound
        if (this.boostSound && this.boostSound.isPlaying) {
            if (isBoosting && speedRatio > 0.1) {
                // Fade in when boosting
                const targetVolume = 0.5;
                const currentVolume = this.boostSound.getVolume();
                const newVolume = currentVolume + (targetVolume - currentVolume) * 0.15;
                this.boostSound.setVolume(newVolume);
                
                // Slightly vary pitch with speed for effect
                const boostPitch = 0.9 + (speedRatio * 0.3);
                this.boostSound.setPlaybackRate(boostPitch);
            } else {
                // Fade out when not boosting
                const currentVolume = this.boostSound.getVolume();
                const newVolume = currentVolume * 0.85;
                this.boostSound.setVolume(newVolume);
            }
        }

        // Update skid sound
        if (this.skidSound && this.skidSound.isPlaying) {
            if (isSkidding && speedRatio > 0.15) {
                // Fade in when skidding at sufficient speed (increased volume)
                const targetVolume = 0.65 * Math.min(speedRatio * 1.5, 1.0);
                const currentVolume = this.skidSound.getVolume();
                const newVolume = currentVolume + (targetVolume - currentVolume) * 0.2;
                this.skidSound.setVolume(newVolume);
                
                // Pitch varies with speed
                const skidPitch = 0.8 + (speedRatio * 0.4);
                this.skidSound.setPlaybackRate(skidPitch);
                
                // Track offset to loop only the useful part (0.06 to 0.5 seconds)
                if (!this.isSkidding) {
                    // Just started skidding, seek to the start of useful audio
                    this.skidSound.offset = this.skidStartOffset;
                    this.isSkidding = true;
                }
            } else {
                // Fade out when not skidding
                const currentVolume = this.skidSound.getVolume();
                const newVolume = currentVolume * 0.88;
                this.skidSound.setVolume(newVolume);
                
                if (this.isSkidding && currentVolume < 0.01) {
                    this.isSkidding = false;
                }
            }
        }

        // Track boost state
        this.isBoosting = isBoosting;
    }

    /**
     * Play a random impact sound when colliding
     * @param {number} intensity - Collision intensity (0-1) to affect volume/pitch
     */
    playImpact(intensity = 1.0) {
        if (!this.initialized) return;
        
        // Check cooldown to prevent sound spam
        if (this.impactCooldown > 0) return;
        
        // Choose random impact sound
        const impactSound = Math.random() < 0.5 ? this.impact1Sound : this.impact2Sound;
        
        if (impactSound) {
            // Stop if already playing to allow restart
            if (impactSound.isPlaying) {
                impactSound.stop();
            }
            
            // Adjust volume based on intensity
            const volume = 0.4 + (intensity * 0.4); // 0.4 to 0.8 range
            impactSound.setVolume(volume);
            
            // Slightly vary pitch for variety
            const pitch = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
            impactSound.setPlaybackRate(pitch);
            
            impactSound.play();
            
            // Reset cooldown
            this.impactCooldown = this.impactCooldownTime;
        }
    }

    /**
     * Stop all sounds
     */
    stop() {
        if (this.engineSound && this.engineSound.isPlaying) {
            this.engineSound.stop();
        }
        if (this.revvingSound && this.revvingSound.isPlaying) {
            this.revvingSound.stop();
        }
        if (this.boostSound && this.boostSound.isPlaying) {
            this.boostSound.stop();
        }
        if (this.skidSound && this.skidSound.isPlaying) {
            this.skidSound.stop();
        }
        // Don't stop music when game stops, keep it playing
    }

    /**
     * Pause all sounds
     */
    pause() {
        if (this.engineSound && this.engineSound.isPlaying) {
            this.engineSound.pause();
        }
        if (this.revvingSound && this.revvingSound.isPlaying) {
            this.revvingSound.pause();
        }
        if (this.boostSound && this.boostSound.isPlaying) {
            this.boostSound.pause();
        }
        if (this.skidSound && this.skidSound.isPlaying) {
            this.skidSound.pause();
        }
    }

    /**
     * Resume all sounds
     */
    resume() {
        if (this.engineSound && this.engineSound.source) {
            this.engineSound.play();
        }
        if (this.revvingSound && this.revvingSound.source) {
            this.revvingSound.play();
        }
        if (this.boostSound && this.boostSound.source) {
            this.boostSound.play();
        }
        if (this.skidSound && this.skidSound.source) {
            this.skidSound.play();
        }
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        if (this.listener) {
            this.listener.setMasterVolume(volume);
        }
    }

    /**
     * Clean up audio resources
     */
    dispose() {
        this.stop();
        if (this.engineSound) {
            this.engineSound.disconnect();
        }
        if (this.revvingSound) {
            this.revvingSound.disconnect();
        }
        if (this.boostSound) {
            this.boostSound.disconnect();
        }
        if (this.skidSound) {
            this.skidSound.disconnect();
        }
    }
}

/**
 * NetworkClient - Manages WebSocket connection and multiplayer communication
 */
export class NetworkClient {
    constructor(gameState) {
        this.socket = null;
        this.gameState = gameState;
        this.messageHandlers = new Map();
        this.updateInterval = null;
    }

    /**
     * Connect to WebSocket server
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
                
                let wsUrl;
                if (window.location.hostname === 'localhost') {
                    wsUrl = `${proto}://localhost:3000`;
                } else {
                    wsUrl = `${proto}://${window.location.hostname}`;
                }
                
                this.socket = new WebSocket(wsUrl);
                
                this.socket.addEventListener('open', () => {
                    console.log('WS connected to', wsUrl);
                    resolve();
                });
                
                this.socket.addEventListener('message', (ev) => {
                    this._handleMessage(ev);
                });
                
                this.socket.addEventListener('error', (err) => {
                    console.error('WebSocket error:', err);
                    reject(err);
                });
                
                this.socket.addEventListener('close', () => {
                    console.log('WebSocket closed');
                    if (this.updateInterval) {
                        clearInterval(this.updateInterval);
                    }
                });
            } catch (e) {
                console.warn('Multiplayer disabled:', e);
                reject(e);
            }
        });
    }

    /**
     * Register a message handler for a specific message type
     */
    on(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
    }

    /**
     * Handle incoming WebSocket messages
     */
    _handleMessage(ev) {
        try {
            const msg = JSON.parse(ev.data);
            
            // Special handling for welcome message
            if (msg.type === 'welcome') {
                this.gameState.setLocalId(msg.id);
                this.gameState.setHost(msg.isHost);
                this.gameState.setCanPlay(msg.canPlay);
                this.gameState.setGameActive(msg.gameActive);
                console.log('Assigned id', msg.id, '| Host:', msg.isHost, '| Can play:', msg.canPlay);
            }
            
            // Call registered handler if exists
            const handler = this.messageHandlers.get(msg.type);
            if (handler) {
                handler(msg);
            }
        } catch (e) {
            console.warn('WS message parse error', e);
        }
    }

    /**
     * Send state update to server
     */
    sendState(car) {
        if (this.socket?.readyState === WebSocket.OPEN && car.mesh) {
            const pos = car.mesh.position;
            const rotY = car.mesh.rotation.y;
            
            // Calculate velocity
            const forwardVec = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(car.mesh.quaternion);
            const vx = forwardVec.x * car.speed * 0.1;
            const vz = forwardVec.z * car.speed * 0.1;
            
            // Get segment data for overlapping track support
            const segmentData = car.getSegmentData();
            
            const obj = {
                type: 'state',
                x: pos.x,
                y: pos.y,
                z: pos.z,
                rotY,
                vx,
                vz,
                lives: car.lives,
                lap: car.currentLap,
                segmentId: segmentData.segmentId,
                segmentT: segmentData.segmentT
            };
            
            this.socket.send(JSON.stringify(obj));
        }
    }

    /**
     * Start periodic state updates (20Hz)
     */
    startStateUpdates(car) {
        this.updateInterval = setInterval(() => {
            this.sendState(car);
        }, 50); // 20Hz
    }

    /**
     * Send message to server
     */
    send(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    /**
     * Send message to server (alias for consistency)
     */
    sendMessage(message) {
        this.send(message);
    }

    /**
     * Notify server of player fall
     */
    notifyFall() {
        this.send({ type: 'player_fell' });
    }

    /**
     * Notify server of lives change
     */
    notifyLivesChange(lives) {
        this.send({
            type: 'lives_update',
            lives: lives
        });
    }

    /**
     * Send collision push to another player
     */
    sendCollisionPush(targetId, forceX, forceY, forceZ) {
        this.send({
            type: 'collision_push',
            target: targetId,
            forceX,
            forceY,
            forceZ
        });
    }

    /**
     * Request game start (host only)
     */
    startGame() {
        this.send({ type: 'start_game' });
    }

    /**
     * Close connection
     */
    disconnect() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.socket) {
            this.socket.close();
        }
    }
}

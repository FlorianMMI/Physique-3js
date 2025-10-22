/**
 * GameState - Manages game state and rules
 */
export class GameState {
    constructor() {
        this.isGameActive = false;
        this.winnerId = null;
        this.playerCount = 0;
        this.isHost = false;
        this.canPlay = false;
        this.localId = null;
        this.platformRadius = 40;
    }

    setLocalId(id) {
        this.localId = id;
    }

    setHost(isHost) {
        this.isHost = isHost;
    }

    setCanPlay(canPlay) {
        this.canPlay = canPlay;
    }

    setGameActive(active) {
        this.isGameActive = active;
    }

    setWinner(winnerId) {
        this.winnerId = winnerId;
        this.isGameActive = false;
    }

    setPlayerCount(count) {
        this.playerCount = count;
    }

    /**
     * Generate random spawn position on platform
     */
    getRandomSpawnPosition() {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (this.platformRadius - 5);
        return {
            x: Math.cos(angle) * distance,
            y: 0.2,
            z: Math.sin(angle) * distance,
            rotY: Math.random() * Math.PI * 2
        };
    }

    /**
     * Check if position is outside platform bounds
     */
    isOutOfBounds(x, y, z) {
        const distFromCenter = Math.sqrt(x * x + z * z);
        return y < -5 || distFromCenter > this.platformRadius;
    }

    /**
     * Reset game state for new round
     */
    reset() {
        this.isGameActive = true;
        this.winnerId = null;
    }
}

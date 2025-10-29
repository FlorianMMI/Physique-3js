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
        
        // Track reference (will be set by Game)
        this.track = null;
    }

    setTrack(track) {
        this.track = track;
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
     * Get spawn position at track start
     * Uses track's getStartPosition with slight offsets for multiple players
     */
    getRandomSpawnPosition() {
        if (!this.track) {
            // Fallback if track not set yet
            return {
                x: 0,
                y: 0.2,
                z: 0,
                rotY: 0
            };
        }
        
        // Get start position with a small random lateral offset
        const lateralOffset = (Math.random() - 0.5) * 4; // Random offset within track width
        const longitudinalOffset = Math.random() * -3; // Slight stagger behind start line
        
        return this.track.getStartPositionOffset(lateralOffset, longitudinalOffset);
    }

    /**
     * Check if position is outside platform bounds
     * Temporarily disabled for racetrack implementation
     */
    isOutOfBounds(x, y, z) {
        // TODO: Implement track boundary checking later
        // For now, only check if car has fallen far below
        return y < -5;
    }

    /**
     * Reset game state for new round
     */
    reset() {
        this.isGameActive = true;
        this.winnerId = null;
    }
}

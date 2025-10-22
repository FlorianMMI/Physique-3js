/**
 * UIManager - Manages all UI elements (HUD, notifications, messages)
 */
export class UIManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.hud = null;
        this.hudElements = {};
        this._createHUD();
    }

    _createHUD() {
        this.hud = document.createElement('div');
        this.hud.className = 'hud';
        this.hud.innerHTML = `
            <div class="title">🏎️ BATTLE ROYALE</div>
            <div class="row">
                <div>Vies</div>
                <div id="hud-lives" style="color: #ff3333; font-weight: bold; font-size: 18px;">❤️ ❤️ ❤️</div>
            </div>
            <div class="row">
                <div>Boost</div>
                <div id="hud-boost" style="flex: 1;">
                    <div class="gauge">
                        <div class="gauge-fill" id="hud-boost-fill"></div>
                    </div>
                </div>
            </div>
            <div class="row" style="opacity: 0.6; font-size: 12px;">
                <div>Particules</div>
                <div id="hud-particles">0</div>
            </div>
        `;
        document.body.appendChild(this.hud);

        // Cache HUD elements
        this.hudElements.lives = document.getElementById('hud-lives');
        this.hudElements.boostFill = document.getElementById('hud-boost-fill');
        this.hudElements.particles = document.getElementById('hud-particles');
    }

    /**
     * Update lives display
     */
    updateLives(current, max) {
        if (this.hudElements.lives) {
            const hearts = '❤️ '.repeat(Math.max(0, current));
            const emptyHearts = '🖤 '.repeat(Math.max(0, max - current));
            this.hudElements.lives.innerHTML = hearts + emptyHearts;
        }
    }

    /**
     * Update boost gauge
     */
    updateBoost(energy, maxEnergy) {
        if (this.hudElements.boostFill) {
            const ratio = Math.max(0, Math.min(1, energy / maxEnergy));
            this.hudElements.boostFill.style.transform = `scaleX(${ratio})`;
        }
    }

    /**
     * Update particle count
     */
    updateParticleCount(count) {
        if (this.hudElements.particles) {
            this.hudElements.particles.textContent = count;
        }
    }

    /**
     * Show life lost notification
     */
    showLifeLost(livesRemaining) {
        const notification = document.createElement('div');
        notification.className = 'life-lost-notification';
        notification.innerHTML = `
            <div class="notification-icon">💔</div>
            <div class="notification-text">VIE PERDUE!</div>
            <div class="notification-subtext">${livesRemaining} ${livesRemaining > 1 ? 'vies restantes' : 'vie restante'}</div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 2000);
    }

    /**
     * Show spectator mode message
     */
    showSpectatorMode(message = 'En attente de la fin du round...') {
        const spectatorDiv = document.createElement('div');
        spectatorDiv.id = 'spectator-message';
        spectatorDiv.className = 'spectator-banner';
        spectatorDiv.innerHTML = `
            <div class="spectator-icon">👻</div>
            <div class="spectator-text">MODE SPECTATEUR</div>
            <div class="spectator-subtext">${message}</div>
        `;
        document.body.appendChild(spectatorDiv);
    }

    /**
     * Show victory message
     */
    showVictory() {
        this._removeGameMessage();
        
        const victoryDiv = document.createElement('div');
        victoryDiv.id = 'game-message';
        victoryDiv.className = 'game-message victory';
        victoryDiv.innerHTML = `
            <div class="game-message-icon">🏆</div>
            <div class="game-message-title">VICTOIRE!</div>
            <div class="game-message-subtitle">${this.gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
        `;
        document.body.appendChild(victoryDiv);
        
        setTimeout(() => victoryDiv.classList.add('show'), 10);
    }

    /**
     * Show defeat message
     */
    showDefeat(winnerId) {
        this._removeGameMessage();
        
        const defeatDiv = document.createElement('div');
        defeatDiv.id = 'game-message';
        defeatDiv.className = 'game-message defeat';
        defeatDiv.innerHTML = `
            <div class="game-message-icon">💀</div>
            <div class="game-message-title">DÉFAITE</div>
            <div class="game-message-subtitle">Joueur ${winnerId} a gagné!</div>
            <div class="game-message-info">${this.gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
        `;
        document.body.appendChild(defeatDiv);
        
        setTimeout(() => defeatDiv.classList.add('show'), 10);
    }

    /**
     * Show draw message
     */
    showDraw() {
        this._removeGameMessage();
        
        const drawDiv = document.createElement('div');
        drawDiv.id = 'game-message';
        drawDiv.className = 'game-message draw';
        drawDiv.innerHTML = `
            <div class="game-message-icon">🤝</div>
            <div class="game-message-title">ÉGALITÉ!</div>
            <div class="game-message-subtitle">Tous les joueurs sont tombés!</div>
            <div class="game-message-info">${this.gameState.isHost ? 'Cliquez sur "Nouvelle Partie" pour rejouer' : 'L\'hôte peut lancer une nouvelle partie'}</div>
        `;
        document.body.appendChild(drawDiv);
        
        setTimeout(() => drawDiv.classList.add('show'), 10);
    }

    /**
     * Show host controls
     */
    showHostControls(onStartGame, onResetGame) {
        let controls = document.getElementById('host-controls');
        
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'host-controls';
            controls.style.position = 'fixed';
            controls.style.top = '20px';
            controls.style.left = '10%';
            controls.style.transform = 'translateX(-50%)';
            controls.style.padding = '15px 30px';
            controls.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            controls.style.color = '#ffffff';
            controls.style.fontSize = '18px';
            controls.style.fontWeight = 'bold';
            controls.style.borderRadius = '12px';
            controls.style.border = '3px solid #00ff00';
            controls.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.3)';
            controls.style.zIndex = '10000';
            controls.style.textAlign = 'center';
            document.body.appendChild(controls);
        }
        
        if (!this.gameState.isGameActive) {
            controls.innerHTML = `
                🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
                <button id="start-game-btn" class="host-btn primary">
                    🚀 DÉMARRER LA PARTIE
                </button>
            `;
            
            const startBtn = document.getElementById('start-game-btn');
            if (startBtn && onStartGame) {
                startBtn.addEventListener('click', onStartGame);
            }
        } else {
            controls.innerHTML = `
                🎮 <span style="color: #00ff00;">VOUS ÊTES L'HÔTE</span><br>
                <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: center;">
                    <button id="reset-game-btn" class="host-btn warning">
                        🔄 RÉINITIALISER
                    </button>
                </div>
            `;
            
            const resetBtn = document.getElementById('reset-game-btn');
            if (resetBtn && onResetGame) {
                resetBtn.addEventListener('click', onResetGame);
            }
        }
    }

    /**
     * Update host controls based on game state
     */
    updateHostControls(onStartGame, onResetGame) {
        if (this.gameState.isHost) {
            this.showHostControls(onStartGame, onResetGame);
        }
    }

    /**
     * Remove game over message
     */
    _removeGameMessage() {
        const existing = document.getElementById('game-message');
        if (existing) existing.remove();
    }

    /**
     * Remove spectator message
     */
    removeSpectatorMessage() {
        const spectatorMsg = document.getElementById('spectator-message');
        if (spectatorMsg) spectatorMsg.remove();
    }

    /**
     * Remove all messages
     */
    clearMessages() {
        this._removeGameMessage();
        this.removeSpectatorMessage();
    }
}

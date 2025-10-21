const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from current directory
app.use(express.static(path.resolve(__dirname)));

let nextClientId = 1;
// Stocker l'état des joueurs côté serveur pour validation
const playerStates = new Map(); // id -> { x, y, z, rotY, vx, vz, lives, lastUpdate, isDead, canPlay }

// État du jeu
let gameActive = false; // Commence inactif
let roundInProgress = false;
let hostId = null; // ID du premier joueur (l'hôte)

wss.on('connection', (ws) => {
  const id = nextClientId++;
  ws.clientId = id;
  console.log('Client connected', id);

  // Le premier joueur devient l'hôte
  if (hostId === null) {
    hostId = id;
    console.log('Player', id, 'is now the host');
  }

  // Si le jeu est actif, le nouveau joueur ne peut que regarder
  const canPlay = !gameActive && !roundInProgress;

  // Initialiser état du joueur avec spawn aléatoire
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * 20;
  playerStates.set(id, {
    x: Math.cos(angle) * distance,
    y: 0.2,
    z: Math.sin(angle) * distance,
    rotY: Math.random() * Math.PI * 2,
    vx: 0,
    vz: 0,
    lives: 3,
    isDead: false,
    canPlay: canPlay,
    lastUpdate: Date.now()
  });

  // send back assigned id avec statut
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    id,
    isHost: id === hostId,
    canPlay: canPlay,
    gameActive: gameActive
  }));

  ws.on('message', (msg) => {
    // expect JSON messages and broadcast to others
    try {
      const data = JSON.parse(msg);
      // attach sender id
      data.sender = id;

      // Mettre à jour état du joueur
      if (data.type === 'state') {
        const state = playerStates.get(id);
        if (state) {
          state.x = data.x;
          state.y = data.y;
          state.z = data.z;
          state.rotY = data.rotY;
          state.vx = data.vx || 0;
          state.vz = data.vz || 0;
          state.lives = data.lives !== undefined ? data.lives : state.lives;
          state.lastUpdate = Date.now();
        }
      }

      // Gérer mise à jour des vies
      if (data.type === 'lives_update') {
        const state = playerStates.get(id);
        if (state) {
          state.lives = data.lives;
          state.isDead = data.lives <= 0;
          console.log(`Player ${id} lives updated: ${data.lives}`);
          
          // Vérifier si quelqu'un a gagné
          checkWinCondition();
        }
      }

      // Gérer chute de joueur
      if (data.type === 'player_fell') {
        const state = playerStates.get(id);
        if (state) {
          state.isDead = true;
          console.log(`Player ${id} fell off the platform`);
          
          // Vérifier si quelqu'un a gagné
          checkWinCondition();
        }
      }

      // Gérer collision avec poussée (A pousse B)
      if (data.type === 'collision_push' && data.target) {
        // Relayer la poussée au joueur ciblé
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && client.clientId === data.target) {
            client.send(JSON.stringify({ 
              type: 'collision_push',
              target: data.target,
              forceX: data.forceX,
              forceY: data.forceY,
              forceZ: data.forceZ,
              from: id
            }));
          }
        });
      }

      // Gérer démarrage de partie (seulement l'hôte peut démarrer)
      if (data.type === 'start_game' && id === hostId) {
        console.log('Host is starting the game...');
        startNewGame();
      }

      // Broadcast à tous les autres clients
      const out = JSON.stringify(data);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(out);
        }
      });
    } catch (e) {
      console.warn('Invalid message from', id, e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected', id);
    
    // Si l'hôte se déconnecte, choisir un nouvel hôte AVANT de supprimer
    if (id === hostId) {
      const remainingPlayers = Array.from(playerStates.keys()).filter(pid => pid !== id);
      if (remainingPlayers.length > 0) {
        hostId = remainingPlayers[0];
        console.log('New host:', hostId);
        // Notifier le nouvel hôte
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && client.clientId === hostId) {
            client.send(JSON.stringify({ type: 'you_are_host' }));
          }
        });
      } else {
        hostId = null;
        console.log('No players left, host is null');
      }
    }
    
    // Supprimer l'état du joueur
    playerStates.delete(id);
    
    // notify others
    const out = JSON.stringify({ type: 'disconnect', id });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(out);
    });
    
    // Vérifier si quelqu'un a gagné (si un joueur se déconnecte)
    if (roundInProgress) {
      checkWinCondition();
    }
  });
});

// Vérifier condition de victoire
function checkWinCondition() {
  if (!roundInProgress) return;
  
  // Compter seulement les joueurs qui peuvent jouer (pas les spectateurs)
  const playablePlayers = [];
  const alivePlayers = [];
  
  playerStates.forEach((state, id) => {
    if (state.canPlay) {
      playablePlayers.push(id);
      if (!state.isDead && state.lives > 0) {
        alivePlayers.push(id);
      }
    }
  });
  
  console.log(`Alive players: ${alivePlayers.length}/${playablePlayers.length} (total players: ${playerStates.size})`);
  
  // Si un seul joueur reste en vie (et qu'il y a au moins 2 joueurs qui jouent)
  if (alivePlayers.length === 1 && playablePlayers.length >= 2) {
    const winnerId = alivePlayers[0];
    console.log(`Player ${winnerId} wins! Waiting for host to restart...`);
    roundInProgress = false;
    gameActive = false;
    
    // Notifier tous les clients (PAS de redémarrage automatique)
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ 
          type: 'game_over',
          winnerId: winnerId,
          autoRestart: false
        }));
      }
    });
  }
  // Si tous les joueurs sont morts (égalité)
  else if (alivePlayers.length === 0 && playablePlayers.length >= 2) {
    console.log('Draw! All players died. Waiting for host to restart...');
    roundInProgress = false;
    gameActive = false;
    
    // Notifier tous les clients (PAS de redémarrage automatique)
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ 
          type: 'game_over',
          winnerId: null,
          autoRestart: false
        }));
      }
    });
  }
}

// Démarrer une nouvelle partie (appelé par l'hôte)
function startNewGame() {
  console.log('Starting new game... Host ID:', hostId);
  gameActive = true;
  roundInProgress = true;
  
  // Compter combien de joueurs étaient en mode spectateur
  let spectatorsIncluded = 0;
  
  // Réinitialiser TOUS les joueurs et les rendre jouables
  playerStates.forEach((state, id) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 20;
    state.x = Math.cos(angle) * distance;
    state.y = 0.2;
    state.z = Math.sin(angle) * distance;
    state.rotY = Math.random() * Math.PI * 2;
    state.lives = 3;
    state.isDead = false;
    
    // IMPORTANT: Inclure tous les joueurs, même les spectateurs
    if (!state.canPlay) {
      spectatorsIncluded++;
      console.log(`Including spectator player ${id} in the game`);
    }
    state.canPlay = true; // Tout le monde peut jouer maintenant
  });
  
  console.log(`Game started with ${playerStates.size} players (${spectatorsIncluded} were spectators)`);
  
  // Notifier tous les clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ 
        type: 'game_restart',
        playerCount: playerStates.size
      }));
    }
  });
}

// Nettoyage périodique des états de joueurs inactifs
setInterval(() => {
  const now = Date.now();
  playerStates.forEach((state, id) => {
    if (now - state.lastUpdate > 30000) { // 30 secondes d'inactivité
      console.log('Removing inactive player state:', id);
      playerStates.delete(id);
    }
  });
}, 60000); // Vérifier chaque minute

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Players can connect at http://localhost:${PORT}`);
});

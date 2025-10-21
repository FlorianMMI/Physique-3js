# Améliorations du système multijoueur

## 🚀 Améliorations WebSocket

### Avant
- Fréquence de mise à jour : 10Hz (100ms)
- Interpolation simple avec lerp de 0.6
- Pas de prédiction de mouvement
- Lag visible sur les voitures distantes

### Après
- **Fréquence augmentée à 20Hz (50ms)** - Deux fois plus rapide
- **Interpolation avec prédiction de vélocité** - Les positions futures sont prédites
- **Transmission de la vélocité (vx, vz)** - Permet prédiction côté client
- **Gestion intelligente de la rotation** - Évite les rotations longues (wrap-around)
- **Interpolation plus fluide** (lerp 0.3 pour position, 0.25 pour rotation)

## 💥 Système de collision

### Physique de collision
- **Détection par distance** - Rayon de collision de 1.2 unités par voiture
- **Physique de rebond élastique** - Coefficient de restitution de 0.7
- **Force de séparation** - Les voitures se repoussent lors de l'impact
- **Réduction de vitesse** - La vitesse est divisée par 2 lors de l'impact
- **Cooldown de collision** - 1 seconde entre chaque collision possible

### Effets visuels
- **Flash rouge d'écran** - Indication visuelle immédiate
- **Particules d'explosion** - 20 particules oranges/jaunes au point d'impact
- **Physique balistique** - Les particules d'explosion subissent la gravité

## ❤️ Système de vies

### Mécanique de jeu
- **3 vies par défaut** - Chaque joueur commence avec 3 cœurs
- **-1 vie par collision** - Chaque impact retire une vie
- **Affichage HUD** - ❤️❤️❤️ / 🖤🖤🖤 en temps réel
- **Game Over** - Écran de fin quand vies = 0
- **Synchronisation réseau** - Les vies sont transmises via WebSocket

### Validation serveur
- **État côté serveur** - Le serveur garde trace des vies de chaque joueur
- **Validation des collisions** - Le serveur valide et notifie les collisions
- **Nettoyage automatique** - Suppression des états inactifs après 30s

## 🎮 Commandes

- **ZQSD / WASD** - Déplacements
- **Shift** - Boost (consomme énergie)
- **Espace** - Drift/Skid

## 📊 Améliorations techniques

### Optimisations réseau
```javascript
// Envoi 20 fois par seconde au lieu de 10
setInterval(sendState, 50); // 50ms = 20Hz

// Données transmises enrichies
{
    type: 'state',
    x, y, z,      // Position
    rotY,         // Rotation
    vx, vz,       // Vélocité pour prédiction
    lives         // Vies restantes
}
```

### Interpolation prédictive
```javascript
// Prédiction 2 frames en avance
const predictedPos = targetPos.clone()
    .add(velocity.clone().multiplyScalar(dt * 2));
player.mesh.position.lerp(predictedPos, 0.3);
```

### Détection de collision optimisée
```javascript
// Distance euclidienne simple
const dist = car.mesh.position.distanceTo(player.mesh.position);
if (dist < collisionRadius * 2 && collisionCooldown <= 0) {
    // Collision détectée!
}
```

## 🎨 Types de particules

1. **Fumée** - Particules de base avec animation
2. **Frein** - Particules rouges aux feux arrière
3. **Boost** - Particules oranges lors du boost
4. **Skid** - Traces noires au sol lors du drift
5. **Explosion** - Particules de collision (NOUVEAU!)

## 🔧 Configuration

### Paramètres de collision ajustables
```javascript
car.collisionRadius = 1.2;        // Rayon de détection
car.collisionCooldownTime = 1.0;  // Temps entre collisions
const restitution = 0.7;          // Élasticité du rebond
const separationForce = 1.5;      // Force de séparation
```

### Paramètres de vies
```javascript
car.lives = 3;         // Vies actuelles
car.maxLives = 3;      // Maximum de vies
```

## 🚀 Pour tester

1. Lancer le serveur : `node server.js`
2. Ouvrir deux navigateurs sur `http://localhost:3000`
3. Conduire les voitures l'une vers l'autre
4. Observer le rebond et la perte de vie!

## 📈 Résultats

- ✅ **Mouvement 2x plus fluide** grâce à la fréquence augmentée
- ✅ **Prédiction élimine le lag visuel** des joueurs distants
- ✅ **Collisions réalistes** avec physique de rebond
- ✅ **Gameplay compétitif** avec système de vies
- ✅ **Validation serveur** empêche la triche

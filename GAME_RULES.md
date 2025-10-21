# 🎮 Règles du Jeu - Battle Royale de Voitures

## 🎯 Objectif
Soyez le dernier joueur survivant sur la plateforme !

## 🏟️ Arène
- **Plateforme circulaire** de 40 unités de rayon
- **Bordure rouge lumineuse** indiquant les limites
- **Pas de grille au sol** pour une vue claire
- **Ciel bleu** pour un environnement agréable

## 🚗 Spawn & Respawn
- **Spawn initial** : Position aléatoire sur la plateforme
- **Rotation aléatoire** : Chaque voiture démarre dans une direction différente
- **Respawn après chute** : Position aléatoire si il reste des vies

## ❤️ Système de Vies
- **3 vies** par joueur au début
- **Perte de vie** : Seulement en tombant de la plateforme
- **Affichage HUD** : ❤️❤️❤️ en temps réel
- **0 vie** : Mode spectateur (vue aérienne)

## 💥 Système de Collision
### Mécanique
- **A percute B** → **B recule**, pas A !
- **Zone de collision agrandie** : Rayon x1.3 pour plus de réactivité
- **Recul modéré** : Force réduite pour un gameplay équilibré
- **Cooldown** : 0.5 secondes entre chaque collision

### Effets
- ⚡ **Particules d'explosion** au point d'impact
- 📉 **Réduction de vitesse** pour les deux joueurs
- 🔴 **Flash rouge d'écran** pour feedback visuel
- 🎨 **Pas de perte de vie** lors des collisions

## 🕹️ Contrôles
- **Z/W** : Avancer
- **S** : Reculer
- **Q/A** : Tourner à gauche
- **D** : Tourner à droite
- **Shift** : Boost (consomme énergie)
- **Espace** : Drift/Dérapage

## 🏆 Conditions de Victoire

### Victoire
- **1 seul survivant** quand il y a 2+ joueurs
- Le gagnant voit : "🏆 VICTOIRE! 🏆"
- Les autres voient : "DÉFAITE - Joueur X a gagné!"

### Égalité
- **Tous les joueurs tombent** simultanément
- Message : "ÉGALITÉ!"

### Fin de Round
- ⏸️ **Pas de redémarrage automatique**
- 🔄 **Recharger la page (F5)** pour rejouer
- 🎥 **Mode spectateur** pour les joueurs éliminés

## 👁️ Mode Spectateur
Quand un joueur n'a plus de vies :
- 📹 **Caméra aérienne** (vue du dessus à 50 unités)
- 🚫 **Contrôles désactivés**
- 💀 **Message** : "☠️ MODE SPECTATEUR ☠️"
- 👀 **Observer** les joueurs restants

## 🎨 Effets Visuels
- 💨 **Particules de fumée** (désactivées par défaut)
- 🔥 **Particules de boost** (orange)
- 🔴 **Particules de frein** (rouges aux feux arrière)
- ⚫ **Traces de dérapage** (noires au sol)
- 💥 **Explosion de collision** (particules orange/jaunes)

## 🌐 Multijoueur
- **WebSocket** temps réel (20Hz / 50ms)
- **Interpolation prédictive** pour mouvements fluides
- **Validation serveur** pour éviter la triche
- **Synchronisation des vies** entre tous les clients

## 📊 Paramètres Techniques

### Collision
```javascript
collisionRadius: 1.2      // Rayon de base
collisionZone: 1.3x       // Multiplicateur de zone
restitution: 0.6          // Élasticité
separationForce: 1.2      // Force de séparation
cooldown: 0.5s            // Temps entre collisions
```

### Plateforme
```javascript
platformRadius: 40        // Rayon de l'arène
fallThreshold: -5         // Hauteur de chute mortelle
respawnHeight: 0.2        // Hauteur de spawn
```

### Vitesse
```javascript
maxSpeed: 190
acceleration: 20
boostMultiplier: 2.0x
boostMaxMultiplier: 1.5x
```

## 🎮 Stratégies de Jeu

### Offensive
- 🏎️ **Foncer** sur les adversaires pour les pousser
- ⚡ **Utiliser le boost** pour plus d'impact
- 🎯 **Viser le bord** de la plateforme

### Défensive
- 🛡️ **Rester au centre** de la plateforme
- 🔄 **Éviter** les collisions frontales
- 💨 **Drift** pour esquiver rapidement

### Équilibre
- ⚖️ **Contrôler sa vitesse** près des bords
- 👀 **Surveiller** les autres joueurs
- 🎪 **Utiliser l'arène** à son avantage

## 🚀 Pour Commencer
1. Lancer le serveur : `node server.js`
2. Ouvrir le navigateur : `http://localhost:3000`
3. Inviter des amis sur la même URL
4. Survivez et gagnez !

## 🐛 Notes Techniques
- Les **voitures bleues** sont des placeholders temporaires si le modèle 3D n'est pas chargé
- Le modèle se charge automatiquement et remplace le placeholder
- Tous les joueurs voient le même modèle Mazda RX-7
- La synchronisation est gérée côté serveur pour éviter les désaccords

---

**Bon jeu et que le meilleur gagne ! 🏁**

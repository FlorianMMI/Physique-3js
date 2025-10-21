# Documentation de la classe Mass

Ce document explique la classe `Mass` définie dans `mass.js`. Il décrit l'API, le comportement physique implémenté, les constantes globales attendues et des exemples d'utilisation.

## Résumé

`Mass` est une petite classe représentant une masse ponctuelle 2D. Elle gère sa propre position et vélocité, applique une gravité simple, un amortissement, une limitation de vitesse et des collisions simples avec les bords du canevas p5.js.

Fichier source : `mass.js`

## API

- constructor(x, y)
  - Crée une instance de `Mass` avec position initiale `(x, y)`.
  - Initialise `this.position` en utilisant `createVector(x,y)`.
  - Initialise `this.velocity` à une vitesse aléatoire : `createVector(random(-20,20), random(20))`.

- updatePosition()
  - Mise à jour de l'état physique de la masse :
    - Ajoute `gravity` à `velocity.y`.
    - Applique `velocity.mult(damping)` pour l'amortissement.
    - Limite la vitesse via `velocity.limit(maxVel)`.
    - Met à jour la position : `position += velocity * deltaT`.
    - Gère les collisions avec les quatre bords du canevas (`x` dans `[0,width]`, `y` dans `[0,height]`) :
      - Remet la position sur le bord si nécessaire.
      - Annule la composante normale de la vélocité (par ex. `velocity.x = 0` lors d'une collision sur le bord gauche/droite).
      - Multiplie la composante tangentielle par `friction` (réduction de la vitesse après contact avec le bord).

- display()
  - Dessine la masse sous la forme d'un cercle noir de diamètre 10 centré en `this.position`.

## Constantes globales utilisées

La classe `Mass` s'appuie sur plusieurs constantes globales définies dans le sketch (par exemple dans `q1.js`) :

- `deltaT` (nombre) : pas de temps pour la mise à jour position += velocity * deltaT.
- `gravity` (nombre) : accélération gravitationnelle ajoutée à la composante y de la vitesse à chaque update.
- `damping` (nombre entre 0 et 1) : facteur multiplicatif appliqué à la vitesse pour modéliser l'amortissement.
- `friction` (nombre, petit) : coefficient utilisé pour atténuer la composante tangentielle de la vitesse lors d'un impact avec un bord.
- `maxVel` (nombre) : vitesse maximale (utilisée par `velocity.limit(maxVel)`).

Ces constantes sont définies dans `q1.js` (ou dans le sketch appelant). Elles doivent être visibles dans le scope global pour que `Mass` fonctionne sans modification.

## Comportement physique et limites

- Intégration : implémentation d'une intégration explicite simple (Euler explicite) pour la position : position += velocity * deltaT.
- Collisions : très simples et fixes aux bords. Lors d'une collision, la composante perpendiculaire de la vitesse est mise à zéro, la composante parallèle est réduite par `friction`.
- Pas de forces latérales complexes : la seule force intégrée est la gravité verticale.
- Non-conservation d'énergie : l'amortissement et la friction dissipent l'énergie.

## Exemple d'utilisation

Voici un exemple minimal (repris et étendu depuis `q1.js`) :

```javascript
// constantes globales attendues par Mass
const deltaT = 0.1;
const gravity = 1;
const damping = 0.99;
const friction = 0.005;
const maxVel = 150;

let masses = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  masses.push(new Mass(width/2, 50));
}

function draw() {
  background(220);
  for (let m of masses) {
    m.updatePosition();
    m.display();
  }
}

function mousePressed() {
  masses.push(new Mass(mouseX, mouseY));
}
```

## Tests et vérification

- Vérifiez visuellement : lancer le sketch et observer si les masses tombent sous l'effet de la gravité, rebondissent/faiblissent lorsqu'elles touchent les bords.
- Modifier `gravity` pour voir l'effet direct (augmenter pour une chute plus rapide).
- Modifier `damping` proche de 1 pour faible résistance, proche de 0 pour une décroissance rapide de la vitesse.
- Si la vitesse devient trop importante, ajuster `maxVel`.

---

Fichier source : `mass.js` (dans ce dépôt). Pour toute amélioration demandée (ex. refactor pour inje ction de paramètres, connexions par ressorts), je peux proposer et appliquer un patch.

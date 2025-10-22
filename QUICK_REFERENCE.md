# Quick Reference - Refactored Codebase

## 📂 File Locations

| What | Where |
|------|-------|
| Scene setup | `src/core/Scene.js` |
| Rendering | `src/core/Renderer.js` |
| Camera | `src/core/Camera.js` |
| Car logic | `src/game/Car.js` |
| Game rules | `src/game/GameState.js` |
| Particles | `src/particles/ParticleSystem.js` |
| Networking | `src/network/NetworkClient.js` |
| UI/HUD | `src/ui/UIManager.js` |
| Coordinator | `src/Game.js` |
| Entry point | `src/main.js` |

---

## 🎯 Common Tasks

### Change car speed
```javascript
// src/game/Car.js
this.maxSpeed = 250; // Line ~27
```

### Add new particle effect
```javascript
// src/particles/ParticleSystem.js
emitMyEffect(worldPos, count) {
    // Create particles
}
```

### Modify HUD
```javascript
// src/ui/UIManager.js
// Edit _createHUD() method
```

### Add network message
```javascript
// src/Game.js - _setupNetworkHandlers()
this.network.on('my_message', (msg) => {
    // Handle message
});
```

### Change platform size
```javascript
// src/core/Scene.js
this.platformRadius = 50; // Line ~13
```

---

## 🔌 Import Statements

### In Game.js
```javascript
import { SceneManager } from './core/Scene.js';
import { RendererManager } from './core/Renderer.js';
import { CameraManager } from './core/Camera.js';
import { Car } from './game/Car.js';
import { GameState } from './game/GameState.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { NetworkClient } from './network/NetworkClient.js';
import { UIManager } from './ui/UIManager.js';
```

### Creating new modules
```javascript
// Export
export class MyClass { }

// Import
import { MyClass } from './path/MyClass.js';
```

---

## 🎮 Key APIs

### Car
```javascript
car.loadModel()                    // Load 3D model
car.spawn(x, y, z, rotY)          // Set position
car.updatePhysics(dt)             // Update physics
car.loseLife()                     // Decrease lives
car.getRearPosition()              // Get rear position
```

### ParticleSystem
```javascript
particles.emitSmoke(pos, count)
particles.emitBrake(pos, count)
particles.emitBoost(pos, count)
particles.emitSkid(pos, count)
particles.emitExplosion(pos, count)
particles.update(dt)
```

### NetworkClient
```javascript
network.connect()                  // Connect to server
network.on(type, handler)          // Register handler
network.send(message)              // Send message
network.sendState(car)             // Send car state
network.notifyFall()               // Notify fall
```

### UIManager
```javascript
ui.updateLives(current, max)
ui.updateBoost(energy, maxEnergy)
ui.showVictory()
ui.showDefeat(winnerId)
ui.showLifeLost(remaining)
ui.showSpectatorMode()
```

### CameraManager
```javascript
camera.follow(targetMesh)          // Follow target
camera.enterSpectatorMode()        // Aerial view
camera.shake(intensity, duration)  // Screen shake
```

### GameState
```javascript
gameState.getRandomSpawnPosition() // Random spawn
gameState.isOutOfBounds(x, y, z)  // Check bounds
gameState.reset()                  // Reset game
```

---

## 🔄 Lifecycle

### Initialization
```
main.js
  → new Game()
    → new SceneManager()
    → new RendererManager()
    → new CameraManager()
    → new GameState()
    → new ParticleSystem()
    → new NetworkClient()
    → new UIManager()
    → new Car(isLocal: true)
  → game.init()
    → car.loadModel()
    → network.connect()
    → animate()
```

### Game Loop
```
animate()
  → remotePlayers.forEach(p => p.interpolate(dt))
  → _checkCollisions(dt)
  → _checkFallOff()
  → localCar.updatePhysics(dt)
  → particles.update(dt)
  → camera.follow(car.mesh)
  → ui.updateLives()
  → ui.updateBoost()
  → renderer.render(scene, camera)
```

---

## 📊 Module Responsibilities

| Module | Manages |
|--------|---------|
| **SceneManager** | Three.js scene, platform, lights |
| **RendererManager** | WebGL renderer, window resize |
| **CameraManager** | Camera, controls, follow system |
| **Car** | Physics, controls, model, lives |
| **GameState** | Game rules, state, spawns, bounds |
| **ParticleSystem** | All visual effects, wind |
| **NetworkClient** | WebSocket, multiplayer sync |
| **UIManager** | HUD, notifications, messages |
| **Game** | Coordination, game loop, events |

---

## 🐛 Debugging

### Check Console
```javascript
console.log('Scene:', this.sceneManager.getScene());
console.log('Car:', this.localCar);
console.log('Particles:', this.particles.getParticleCount());
console.log('Network:', this.network.socket?.readyState);
```

### Common Issues

**Car not moving?**
→ Check `canMove` in `Game.js` (line ~380)

**Particles not appearing?**
→ Check textures loaded in `ParticleSystem.js`

**Network not connecting?**
→ Check server running on port 3000

**UI not updating?**
→ Check `UIManager` element IDs match HTML

---

## 🎨 Extending

### Add Power-Up
1. Create `src/game/PowerUp.js`
2. Import in `Game.js`
3. Add to game loop
4. Add UI in `UIManager.js`

### Add New Car Type
1. Extend Car class
2. Override properties/methods
3. Use in Game.js

### Add New Particle
1. Add `emitX()` in `ParticleSystem.js`
2. Add update case in `_updateParticleByType()`
3. Call from Game.js

---

## 📝 Code Style

### Naming
- Classes: `PascalCase`
- Methods: `camelCase`
- Files: `PascalCase.js`
- Private methods: `_prefixUnderscore()`

### Structure
```javascript
class MyClass {
    constructor() {
        // Properties
    }
    
    // Public methods
    publicMethod() { }
    
    // Private methods
    _privateMethod() { }
}
```

---

## 🚀 Performance Tips

- Particle count affects FPS (monitor in HUD)
- Network updates at 20Hz (configurable)
- Use object pooling for particles (future)
- Profile with browser DevTools

---

## 📚 Documentation Files

- `README_NEW_STRUCTURE.md` - Overview
- `REFACTORING.md` - Detailed architecture
- `MIGRATION_GUIDE.md` - How to use
- `ARCHITECTURE.md` - Visual diagrams
- `QUICK_REFERENCE.md` - This file

---

## ⌨️ VS Code Tips

**Find in files:** `Ctrl+Shift+F`
**Go to definition:** `F12`
**Find all references:** `Shift+F12`
**Rename symbol:** `F2`
**Format document:** `Shift+Alt+F`

---

## 🎯 Testing Checklist

- [ ] npm start
- [ ] Game loads
- [ ] Car appears
- [ ] Controls work
- [ ] Multiplayer works
- [ ] No console errors

---

**Happy coding! 🎮✨**

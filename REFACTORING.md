# Physique-3js - Refactored Structure

## 📁 Project Structure

The project has been refactored into a modular architecture for better maintainability and scalability.

```
Physique-3js/
├── src/                          # Source code (modular)
│   ├── core/                     # Core Three.js systems
│   │   ├── Scene.js             # Scene management & environment
│   │   ├── Renderer.js          # WebGL renderer setup
│   │   └── Camera.js            # Camera & controls management
│   │
│   ├── game/                     # Game logic
│   │   ├── Car.js               # Car physics & controls
│   │   └── GameState.js         # Game state & rules
│   │
│   ├── particles/                # Visual effects
│   │   └── ParticleSystem.js    # All particle effects
│   │
│   ├── network/                  # Multiplayer
│   │   └── NetworkClient.js     # WebSocket client
│   │
│   ├── ui/                       # User interface
│   │   └── UIManager.js         # HUD & notifications
│   │
│   ├── Game.js                   # Main game coordinator
│   └── main.js                   # Entry point
│
├── sprite/                       # Assets (3D models, textures)
│   ├── Mazda RX-7.glb           # Car 3D model
│   ├── smoke/                    # Smoke animation frames
│   └── spark1 (1).png           # Particle texture
│
├── index.html                    # HTML entry
├── styles.css                    # Styling
├── server.js                     # Node.js WebSocket server
└── package.json                  # Dependencies

# Legacy files (kept for reference)
├── Voiture.js                    # Original monolithic file
├── mass.js                       # 2D physics demo
└── Tp4exo2.js                    # Three.js exercise
```

---

## 🏗️ Architecture Overview

### **Core Systems** (`src/core/`)

#### `Scene.js` - SceneManager
- Manages Three.js scene
- Creates platform and environment
- Handles lighting setup
- Provides scene manipulation methods

#### `Renderer.js` - RendererManager
- WebGL renderer configuration
- Window resize handling
- Render loop execution

#### `Camera.js` - CameraManager
- Perspective camera setup
- OrbitControls integration
- Camera follow system (smooth tracking)
- Spectator mode (aerial view)
- Camera shake effects

---

### **Game Logic** (`src/game/`)

#### `Car.js` - Car Class
**Responsibilities:**
- Car physics simulation (speed, acceleration, turning)
- Boost system (energy management)
- Drift/skid mechanics
- Collision properties
- Lives system
- 3D model loading (GLTF)
- Input handling (keyboard controls)
- Position interpolation (for remote players)

**Key Methods:**
- `loadModel()` - Load car 3D model
- `spawn()` - Set initial position
- `updatePhysics(dt)` - Update car physics
- `interpolate(dt)` - Smooth remote player movement
- `getRearPosition()`, `getBrakeLightPositions()`, etc. - Get positions for particle effects

#### `GameState.js` - GameState Class
**Responsibilities:**
- Track game state (active, winner, player count)
- Host/client role management
- Spawn position generation
- Bounds checking
- Game rules enforcement

---

### **Visual Effects** (`src/particles/`)

#### `ParticleSystem.js` - ParticleSystem Class
**Responsibilities:**
- Manage all particle effects
- Wind simulation system
- Texture loading (smoke frames, sparks)

**Particle Types:**
- **Smoke** - Car exhaust (animated, wind-affected)
- **Brake** - Red sparks from brake lights
- **Boost** - Orange glow from exhaust
- **Skid** - Black marks on ground
- **Explosion** - Collision impact particles

---

### **Multiplayer** (`src/network/`)

#### `NetworkClient.js` - NetworkClient Class
**Responsibilities:**
- WebSocket connection management
- Message handling (event-driven)
- State synchronization (20Hz updates)
- Server communication

**Key Features:**
- Event handlers for different message types
- Automatic reconnection handling
- State update intervals
- Network message serialization

---

### **User Interface** (`src/ui/`)

#### `UIManager.js` - UIManager Class
**Responsibilities:**
- HUD (lives, boost, particle count)
- Notifications (life lost, victory, defeat)
- Host controls (start/reset buttons)
- Game over messages
- Spectator mode UI

**UI Elements:**
- Lives display (hearts)
- Boost energy gauge
- Victory/defeat/draw messages
- Host control panel
- Life loss notifications

---

### **Main Coordinator** (`src/`)

#### `Game.js` - Game Class
**Main orchestrator that:**
- Initializes all subsystems
- Manages game loop
- Coordinates between modules
- Handles game events
- Processes collisions
- Manages local and remote players

**Lifecycle:**
1. Initialize core systems (scene, renderer, camera)
2. Create game state and subsystems
3. Load car model
4. Connect to multiplayer server
5. Start animation loop
6. Update all systems each frame

#### `main.js` - Entry Point
- Creates Game instance
- Starts initialization

---

## 🎮 How It Works

### **Initialization Flow**
```
main.js
  └─> Game.init()
       ├─> SceneManager (create environment)
       ├─> RendererManager (setup WebGL)
       ├─> CameraManager (setup camera & controls)
       ├─> ParticleSystem (load textures)
       ├─> NetworkClient (connect to server)
       ├─> UIManager (create HUD)
       ├─> Car.loadModel() (load 3D model)
       └─> animate() (start game loop)
```

### **Game Loop (60 FPS)**
```
animate()
  ├─> Update remote players (interpolation)
  ├─> Check collisions
  ├─> Check fall off platform
  ├─> Update local car physics
  ├─> Emit particles (brake, boost, skid)
  ├─> Update particle system
  ├─> Update camera (follow car)
  ├─> Update UI (lives, boost, particles)
  └─> Render scene
```

### **Network Flow**
```
Local Client                Server               Remote Clients
     │                        │                        │
     ├──── Connect ──────────>│                        │
     │<───── Welcome ─────────┤                        │
     │   (id, isHost, canPlay)│                        │
     │                        │                        │
     ├──── State Update ─────>│──── Broadcast ───────>│
     │   (20Hz: pos, rot,     │   (to other players)  │
     │    velocity, lives)    │                        │
     │                        │                        │
     │<──── Remote State ─────┤<───── State ──────────┤
     │   (interpolate)        │                        │
     │                        │                        │
     ├──── Collision ────────>│──── Push ────────────>│
     │                        │   (target player)      │
     │                        │                        │
     ├──── Fall/Death ───────>│──── Check Win ───────>│
     │                        │   (broadcast result)   │
```

---

## 🚀 Running the Refactored Version

### **Development**
```bash
# Install dependencies
npm install

# Start server
npm start

# Open browser
http://localhost:3000
```

### **Deployment**
See `DEPLOY_VERCEL.md` for production deployment instructions.

---

## 🔧 Extending the Game

### **Adding a New Particle Effect**

1. **Add method in `ParticleSystem.js`:**
```javascript
emitMyEffect(worldPos, count = 10) {
    // Create particles with custom properties
    for (let i = 0; i < count; i++) {
        // ... particle creation
        const particle = {
            sprite,
            velocity,
            age: 0,
            life: 1.0,
            type: 'myeffect'
        };
        this.particles.push(particle);
    }
}
```

2. **Add update logic in `_updateParticleByType()`:**
```javascript
case 'myeffect':
    // Custom update logic
    break;
```

3. **Call from Game.js:**
```javascript
this.particles.emitMyEffect(position, 20);
```

### **Adding a New Network Message**

1. **Register handler in `Game._setupNetworkHandlers()`:**
```javascript
this.network.on('my_message', (msg) => {
    // Handle message
});
```

2. **Send from client:**
```javascript
this.network.send({ type: 'my_message', data: value });
```

3. **Handle on server (`server.js`):**
```javascript
if (data.type === 'my_message') {
    // Process and broadcast
}
```

### **Adding a New UI Element**

1. **Add method in `UIManager.js`:**
```javascript
showMyNotification(text) {
    const div = document.createElement('div');
    div.className = 'my-notification';
    div.textContent = text;
    document.body.appendChild(div);
}
```

2. **Add CSS in `styles.css`**

3. **Call from `Game.js`:**
```javascript
this.ui.showMyNotification('Hello!');
```

---

## 📝 Benefits of Refactoring

### ✅ **Maintainability**
- Each file has a single, clear responsibility
- Easy to locate and fix bugs
- Changes are isolated to specific modules

### ✅ **Scalability**
- New features can be added without touching existing code
- Modules can be extended or replaced independently
- Clear interfaces between systems

### ✅ **Testability**
- Each module can be tested in isolation
- Mock dependencies easily
- Unit tests are straightforward to write

### ✅ **Readability**
- Code is organized logically
- Clear naming conventions
- Self-documenting structure

### ✅ **Reusability**
- Modules can be reused in other projects
- ParticleSystem, NetworkClient, etc. are generic
- Easy to extract and package

---

## 🔄 Migration from Old Version

The original `Voiture.js` (1545 lines) has been split into:
- **Scene.js** (78 lines) - Environment setup
- **Renderer.js** (33 lines) - Rendering
- **Camera.js** (115 lines) - Camera management
- **Car.js** (335 lines) - Car logic
- **GameState.js** (55 lines) - Game rules
- **ParticleSystem.js** (415 lines) - All particles
- **NetworkClient.js** (140 lines) - Networking
- **UIManager.js** (255 lines) - UI
- **Game.js** (365 lines) - Coordination
- **main.js** (6 lines) - Entry point

**Total: ~1800 lines** (organized across 10 files)

---

## 🎯 Next Steps

1. **Add Unit Tests** - Test individual modules
2. **Add TypeScript** - Type safety and better IDE support
3. **Add Build System** - Webpack/Vite for bundling
4. **Add More Features** - Power-ups, different arenas, etc.
5. **Optimize Performance** - Object pooling for particles, etc.

---

## 📚 Documentation

- `GAME_RULES.md` - Game rules and mechanics
- `IMPROVEMENTS.md` - Technical improvements log
- `UI_IMPROVEMENTS.md` - UI/UX enhancements
- `DEPLOY_VERCEL.md` - Deployment guide
- `MASS.md` - 2D physics documentation

---

**Enjoy building on this clean architecture! 🚗💨**

# Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Window                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      index.html                            │  │
│  │              loads → src/main.js                           │  │
│  └───────────────────────────────┬───────────────────────────┘  │
│                                  │                               │
│  ┌───────────────────────────────▼───────────────────────────┐  │
│  │                        Game.js                             │  │
│  │              (Main Coordinator)                            │  │
│  │                                                            │  │
│  │  Orchestrates all subsystems:                             │  │
│  │  • Manages game loop (60 FPS)                             │  │
│  │  • Coordinates modules                                     │  │
│  │  • Handles events                                          │  │
│  │  • Processes collisions                                    │  │
│  └─┬────────┬────────┬────────┬────────┬────────┬───────────┘  │
│    │        │        │        │        │        │               │
│    │        │        │        │        │        │               │
│    ▼        ▼        ▼        ▼        ▼        ▼               │
│  ┌────┐  ┌────┐  ┌─────┐  ┌──────┐ ┌─────┐  ┌────┐            │
│  │Core│  │Game│  │Part-│  │Net-  │ │UI   │  │Rem-│            │
│  │    │  │    │  │icles│  │work  │ │Mgr  │  │ote │            │
│  └────┘  └────┘  └─────┘  └──────┘ └─────┘  └────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### 1. Core Systems (Foundation)

```
┌──────────────────────────────────────────────────┐
│              Core Systems                        │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │
│  │ SceneManager│  │ RendererMgr  │  │ Camera │ │
│  │             │  │              │  │Manager │ │
│  │ • Platform  │  │ • WebGL      │  │        │ │
│  │ • Lighting  │  │ • Resize     │  │ • View │ │
│  │ • Environ.  │  │ • Render     │  │ • Follow│ │
│  └─────────────┘  └──────────────┘  └────────┘ │
│                                                  │
│  Scene.js         Renderer.js       Camera.js   │
└──────────────────────────────────────────────────┘
```

### 2. Game Logic

```
┌──────────────────────────────────────────────────┐
│              Game Logic                          │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────┐  ┌────────────────────┐    │
│  │      Car        │  │    GameState       │    │
│  │                 │  │                    │    │
│  │ • Physics       │  │ • Rules            │    │
│  │ • Controls      │  │ • State tracking   │    │
│  │ • Boost         │  │ • Spawn positions  │    │
│  │ • Lives         │  │ • Bounds checking  │    │
│  │ • Collisions    │  │ • Win conditions   │    │
│  │ • Model         │  │ • Host/Client      │    │
│  └─────────────────┘  └────────────────────┘    │
│                                                  │
│  Car.js               GameState.js               │
└──────────────────────────────────────────────────┘
```

### 3. Subsystems

```
┌──────────────────────────────────────────────────┐
│             Subsystems                           │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌───────────┐  ┌──────────┐ │
│  │ ParticleSys  │  │ Network   │  │ UIManager│ │
│  │              │  │ Client    │  │          │ │
│  │ • Smoke      │  │           │  │ • HUD    │ │
│  │ • Brake      │  │ • WebSock │  │ • Notif. │ │
│  │ • Boost      │  │ • Events  │  │ • Messages│ │
│  │ • Skid       │  │ • State   │  │ • Host UI│ │
│  │ • Explosion  │  │ • Sync    │  │          │ │
│  │ • Wind       │  │           │  │          │ │
│  └──────────────┘  └───────────┘  └──────────┘ │
│                                                  │
│  ParticleSystem.js NetworkClient.js UIManager.js│
└──────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Game Loop (Every Frame)

```
   ┌─────────────────────────────────────────────┐
   │         animate() - 60 FPS                  │
   └─────────────────┬───────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌────────┐  ┌─────────┐  ┌─────────┐
   │ Update │  │ Update  │  │ Check   │
   │ Remote │  │ Local   │  │Collisns │
   │ Players│  │ Car     │  │         │
   └────┬───┘  └────┬────┘  └────┬────┘
        │           │            │
        └───────────┼────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │ Update │  │ Emit   │  │ Update │
   │Particls│  │Particls│  │ Camera │
   └────┬───┘  └────┬───┘  └────┬───┘
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Update UI     │
            │ • Lives       │
            │ • Boost       │
            │ • Particles   │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │    RENDER     │
            │  scene+camera │
            └───────────────┘
```

---

## Network Flow

```
Local Client                    Server                  Remote Clients
     │                           │                           │
     │──── Connect ─────────────>│                           │
     │                           │                           │
     │<──── Welcome ─────────────┤                           │
     │  {id, isHost, canPlay}    │                           │
     │                           │                           │
     ├──── State (20Hz) ────────>│                           │
     │  {pos, rot, vel, lives}   │                           │
     │                           ├──── Broadcast ──────────>│
     │                           │  {sender, state}          │
     │                           │                           │
     │<──── Remote State ────────┤<──── State ──────────────┤
     │  (interpolate)            │                           │
     │                           │                           │
     ├──── Collision ───────────>│                           │
     │  {target, force}          ├──── Push ───────────────>│
     │                           │  {target, force}          │
     │                           │                           │
     ├──── Fall/Death ──────────>│                           │
     │                           ├──── Check Win ──────────>│
     │                           │  (broadcast winner)       │
     │                           │                           │
     │<──── Game Over ───────────┤<──── Game Over ──────────┤
     │  {winnerId}               │  {winnerId}               │
```

---

## Module Dependencies

```
                   main.js
                      │
                      ▼
                   Game.js
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    SceneManager  GameState   NetworkClient
         │            │            │
         │            │            │
         ▼            ▼            ▼
    Renderer     Car.js      UIManager
         │            │
         │            │
         ▼            ▼
    CameraManager ParticleSystem
```

**Key Points:**
- **No circular dependencies** ✅
- **Clear hierarchy** ✅
- **Loose coupling** ✅
- **High cohesion** ✅

---

## Component Interaction

### Example: Player Collision

```
1. Game Loop
   └─> Game._checkCollisions(dt)
       │
       ├─> Calculate distance between cars
       │
       ├─> Detect collision
       │   │
       │   ├─> NetworkClient.sendCollisionPush(id, force)
       │   │   └─> Send to server
       │   │
       │   ├─> ParticleSystem.emitExplosion(position)
       │   │   └─> Create 20 explosion particles
       │   │
       │   └─> Car.collisionCooldown = 0.5
       │
       └─> Continue loop
```

### Example: Falling Off Platform

```
1. Game Loop
   └─> Game._checkFallOff()
       │
       ├─> GameState.isOutOfBounds(x, y, z)
       │   └─> returns true
       │
       ├─> Car.loseLife()
       │   └─> lives--
       │
       ├─> NetworkClient.notifyLivesChange(lives)
       │   └─> Send to server
       │
       ├─> UIManager.showLifeLost(lives)
       │   └─> Display notification
       │
       ├─> CameraManager.shake()
       │   └─> Screen shake effect
       │
       └─> if (lives > 0)
           │   └─> Car.spawn(randomPos)
           └─> else
               ├─> Car.isDead = true
               ├─> CameraManager.enterSpectatorMode()
               └─> UIManager.showSpectatorMode()
```

---

## Class Diagrams

### Car Class

```
┌─────────────────────────────────┐
│           Car                   │
├─────────────────────────────────┤
│ Properties:                     │
│ • mesh: THREE.Mesh             │
│ • speed: number                │
│ • lives: number                │
│ • boostEnergy: number          │
│ • isDead: boolean              │
│ • keys: object                 │
├─────────────────────────────────┤
│ Methods:                        │
│ + loadModel(): Promise         │
│ + spawn(x, y, z, rot)          │
│ + updatePhysics(dt)            │
│ + interpolate(dt)              │
│ + loseLife(): number           │
│ + getRearPosition()            │
│ + getBrakeLightPositions()     │
│ + getBoostPositions()          │
│ + getSkidPositions()           │
│ + destroy()                     │
└─────────────────────────────────┘
```

### NetworkClient Class

```
┌─────────────────────────────────┐
│       NetworkClient             │
├─────────────────────────────────┤
│ Properties:                     │
│ • socket: WebSocket            │
│ • gameState: GameState         │
│ • messageHandlers: Map         │
├─────────────────────────────────┤
│ Methods:                        │
│ + connect(): Promise           │
│ + on(type, handler)            │
│ + send(message)                │
│ + sendState(car)               │
│ + startStateUpdates(car)       │
│ + notifyFall()                 │
│ + notifyLivesChange(lives)     │
│ + sendCollisionPush(...)       │
│ + startGame()                   │
│ + disconnect()                  │
└─────────────────────────────────┘
```

---

## File Size Comparison

```
Old Structure:
┌────────────────────────────────┐
│ Voiture.js                     │  1545 lines
└────────────────────────────────┘

New Structure:
┌────────────────────────────────┐
│ Scene.js                       │    78 lines
│ Renderer.js                    │    33 lines
│ Camera.js                      │   115 lines
│ Car.js                         │   335 lines
│ GameState.js                   │    55 lines
│ ParticleSystem.js              │   415 lines
│ NetworkClient.js               │   140 lines
│ UIManager.js                   │   255 lines
│ Game.js                        │   365 lines
│ main.js                        │     6 lines
└────────────────────────────────┘  ~1800 lines total

Benefits:
✅ Largest file: 415 lines (vs 1545)
✅ Average file: ~180 lines
✅ Easy to navigate
✅ Clear organization
```

---

## Complexity Metrics

### Before (Monolithic)
- **Cyclomatic Complexity:** HIGH
- **Coupling:** TIGHT
- **Cohesion:** LOW
- **Maintainability Index:** LOW

### After (Modular)
- **Cyclomatic Complexity:** LOW
- **Coupling:** LOOSE
- **Cohesion:** HIGH
- **Maintainability Index:** HIGH

---

## Summary

The refactored architecture provides:

✅ **Clear separation of concerns**
✅ **Easy to understand and navigate**
✅ **Simple to test and debug**
✅ **Straightforward to extend**
✅ **Professional code organization**

Each module has a **single, well-defined responsibility**, making the codebase **maintainable** and **scalable**.

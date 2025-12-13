# Phaser.js Game Foundation - AI Agent Village Monitor

Complete Phaser.js game framework for the AI Agent Village Monitor project.

## Table of Contents

- [Architecture](#architecture)
- [Scenes](#scenes)
- [Systems](#systems)
- [Assets](#assets)
- [Sprites](#sprites)
- [Tilemaps](#tilemaps)
- [React Integration](#react-integration)
- [Usage Examples](#usage-examples)

## Architecture

The game is structured into modular, reusable systems:

```
game/
├── scenes/           # Phaser scenes
│   ├── BootScene.ts
│   ├── PreloadScene.ts
│   ├── VillageScene.ts
│   └── HouseScene.ts
├── systems/          # Core game systems
│   ├── CameraController.ts
│   └── InputHandler.ts
├── assets/           # Asset loading
│   ├── manifest.json
│   └── AssetLoader.ts
├── sprites/          # Sprite management
│   ├── SpriteManager.ts
│   └── AnimationManager.ts
├── tiles/            # Tilemap management
│   ├── TilesetLoader.ts
│   └── TilemapRenderer.ts
└── GameProvider.tsx  # React integration
```

## Scenes

### BootScene

**Purpose:** Minimal initialization and transition to PreloadScene

**Responsibilities:**
- Initialize game state registry
- Set up initial configurations
- Transition to PreloadScene

```typescript
// Automatically transitions to PreloadScene
```

### PreloadScene

**Purpose:** Load all game assets with progress display

**Features:**
- Loading progress bar with percentage
- Asset manifest loading
- Animation and tile registration
- Error handling with fallbacks

**Transitions to:** VillageScene (default) or MenuScene

### VillageScene

**Purpose:** World map view of the village

**Features:**
- Render village tilemap
- Display house buildings
- Show agents moving around
- Click to enter houses
- Camera controls and input handling

**Example:**
```typescript
// Click a house to enter
scene.start('HouseScene', { houseId: 'house_python' });
```

### HouseScene

**Purpose:** Building interior view

**Features:**
- Render interior layout with rooms
- Display agents in rooms
- Room interaction and navigation
- Exit back to village

**Example:**
```typescript
// Initialize with house data
init(data: { houseId: string }) {
  this.houseId = data.houseId;
}
```

## Systems

### CameraController

Advanced camera control system with smooth transitions.

**Features:**
- Zoom: 0.5x to 2x with smooth lerp
- Pan: Click-drag and edge scrolling
- World bounds constraint
- Agent following mode
- Smooth transitions

**API:**
```typescript
const controller = new CameraController(scene, {
  minZoom: 0.5,
  maxZoom: 2.0,
  worldBounds: new Phaser.Geom.Rectangle(0, 0, 1600, 1200),
  followLerp: 0.1,
  panSpeed: 1.0,
  edgeScrollMargin: 50,
});

// Set zoom
controller.setZoom(1.5, 300); // 1.5x zoom over 300ms

// Pan to position
controller.panTo(800, 600, 500); // Pan to (800, 600) over 500ms

// Follow an agent
controller.follow(agentSprite, 0.1);

// Stop following
controller.stopFollow();

// Update in scene loop
update(delta: number) {
  controller.update(delta);
}
```

### InputHandler

Unified input management for keyboard, mouse, and touch.

**Features:**
- Keyboard: WASD/Arrow keys for movement, +/- for zoom
- Mouse: Click to interact, drag to pan (via CameraController)
- Touch: Pinch to zoom, swipe to pan
- Event emitter for game actions

**Events:**
- `move` - Camera movement from keyboard
- `select` - Click/tap at world position
- `contextMenu` - Right-click for actions
- `zoom` - Zoom level changed

**API:**
```typescript
const input = new InputHandler(scene, cameraController, {
  keyboardEnabled: true,
  mouseEnabled: true,
  touchEnabled: true,
  keyboardPanSpeed: 5,
});

// Listen to events
input.on('select', (data) => {
  console.log('Selected:', data.x, data.y);
});

input.on('zoom', (zoom) => {
  console.log('Zoom changed:', zoom);
});

// Update in scene loop
update(delta: number) {
  input.update(delta);
}
```

## Assets

### AssetLoader

Dynamic asset loading with manifest support.

**Features:**
- Load from manifest.json
- Progress tracking
- Error handling with fallbacks
- Lazy loading support

**Manifest Format:**
```json
{
  "version": "1.0.0",
  "spritesheets": {
    "agents": {
      "path": "/assets/agents.png",
      "frameWidth": 32,
      "frameHeight": 32
    }
  },
  "tilemaps": {
    "village": {
      "path": "/assets/tilemaps/village.json"
    }
  }
}
```

**API:**
```typescript
const loader = new AssetLoader(scene);

// Load all assets
await loader
  .onProgress((progress) => {
    console.log(`Loading: ${progress.key} (${progress.progress * 100}%)`);
  })
  .onComplete(() => {
    console.log('All assets loaded!');
  })
  .onError((key, error) => {
    console.error(`Failed to load ${key}:`, error);
  })
  .loadAll();

// Load specific asset
await loader.loadAsset('spritesheet', 'agents');
```

## Sprites

### SpriteManager

Sprite lifecycle and texture management.

**Features:**
- Load sprite sheets and texture atlases
- Create sprite instances
- Sprite pooling for performance
- Runtime sprite generation (PixelLab integration hook)

**API:**
```typescript
const manager = new SpriteManager(scene);

// Load spritesheet
manager.loadSpriteSheet({
  key: 'agents',
  path: '/assets/agents.png',
  frameWidth: 32,
  frameHeight: 32,
});

// Create sprite
const sprite = manager.createSprite(100, 100, {
  key: 'agents',
  frame: 0,
  animations: ['idle_down', 'walk_down'],
});

// Create agent with animations
const agent = manager.createAgentSprite(200, 200, 'default');

// Use sprite pooling (performance)
const pooledSprite = manager.getSprite(300, 300, { key: 'agents' });
manager.releaseSprite(pooledSprite); // Return to pool

// Generate runtime sprite (PixelLab hook)
await manager.generateRuntimeSprite('custom', 'A blue robot', 32, 32);
```

### AnimationManager

Animation definition and playback.

**Features:**
- 4-direction movement (up, down, left, right)
- Idle, walk, run animations
- Work and sleep animations
- Emote animations

**API:**
```typescript
const animManager = manager.getAnimationManager();

// Create agent animations
animManager.createAgentAnimations('agents', 'default');

// Play animation
animManager.playAnimation(sprite, 'default_walk_down');

// Play based on velocity
animManager.playDirectionalAnimation(sprite, 'default_walk', vx, vy);

// Custom animation
animManager.createAnimation({
  key: 'custom_anim',
  frames: [0, 1, 2, 3],
  frameRate: 10,
  repeat: -1,
}, 'texture_key');
```

## Tilemaps

### TilesetLoader

Load and parse Tiled JSON tilemaps.

**Features:**
- Parse Tiled JSON format
- Multiple tileset support
- Collision data extraction
- Auto-tiling with 4-bit masking

**API:**
```typescript
const loader = new TilesetLoader(scene);

// Load tilemap
await loader.loadTilemap('village', '/assets/tilemaps/village.json');

// Create tilemap
const tilemap = loader.createTilemap('village');

// Add tileset
const tileset = loader.addTileset(tilemap, {
  name: 'rpg_tiles',
  imageKey: 'rpg_tiles',
  tileWidth: 32,
  tileHeight: 32,
});

// Create layer
const layer = loader.createLayer(tilemap, 'ground', tileset);

// Set collision
loader.setCollisionByProperty(layer, { collides: true });

// Auto-tiling
const autoTileMap = new Map([[15, 100], [7, 101]]); // 4-bit mask to tile index
loader.applyAutoTiling(layer, 50, autoTileMap);
```

### TilemapRenderer

Render tilemaps with layer ordering and culling.

**Features:**
- Multi-layer rendering
- Automatic depth sorting (ground, walls, decorations, above)
- Culling for performance
- Parallax scrolling support

**API:**
```typescript
const renderer = new TilemapRenderer(scene);

// Render complete tilemap
const tilemap = renderer.renderTilemap(
  'village',
  [
    { name: 'rpg_tiles', imageKey: 'rpg_tiles' },
    { name: 'decorations', imageKey: 'decorations' },
  ],
  [
    { name: 'ground', depth: 0 },
    { name: 'walls', depth: 20 },
    { name: 'decorations', depth: 30 },
  ],
  {
    cullPadding: 1,
    enableCollision: true,
  }
);

// Control layers
renderer.setLayerVisible('ground', true);
renderer.setLayerAlpha('decorations', 0.8);

// Coordinate conversion
const tile = renderer.worldToTile('ground', 400, 300);
const world = renderer.tileToWorld('ground', 10, 10);

// Get tile at position
const tile = renderer.getTileAtWorldXY('walls', mouseX, mouseY);
```

## React Integration

### GameProvider

React context provider for Phaser game instance.

**Features:**
- Manages Phaser.Game lifecycle
- Provides game and container refs
- Handles cleanup on unmount

**API:**
```tsx
import { GameProvider, GameCanvas } from './game';
import { gameConfig } from './game/config.example';

function App() {
  return (
    <GameProvider config={gameConfig}>
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <GameCanvas />
        <GameOverlay
          worldWidth={1600}
          worldHeight={1200}
          cameraX={800}
          cameraY={600}
          cameraZoom={1.0}
        />
      </div>
    </GameProvider>
  );
}
```

### UI Components

**GameOverlay** - HUD, minimap, and agent inspector
**Minimap** - Scaled world view with navigation
**AgentInspector** - Agent details and actions

```tsx
import { GameOverlay } from '@/components/game';

<GameOverlay
  worldWidth={1600}
  worldHeight={1200}
  cameraX={camera.x}
  cameraY={camera.y}
  cameraZoom={camera.zoom}
  selectedAgent={{
    id: 'agent_1',
    name: 'Python Worker',
    state: 'working',
    metrics: {
      tasks_completed: 42,
      uptime: 3600,
      cpu_usage: 0.75,
    },
    events: [
      { timestamp: Date.now() - 60000, message: 'Started new task' },
      { timestamp: Date.now() - 30000, message: 'Completed task' },
    ],
  }}
  onMinimapClick={(x, y) => cameraController.panTo(x, y, 500)}
  onAgentAction={(action) => console.log('Action:', action)}
/>
```

## Usage Examples

### Complete Scene Example

```typescript
import Phaser from 'phaser';
import { CameraController, InputHandler } from './game/systems';
import { SpriteManager } from './game/sprites';
import { TilemapRenderer } from './game/tiles';

export class GameScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private inputHandler!: InputHandler;
  private spriteManager!: SpriteManager;
  private tilemapRenderer!: TilemapRenderer;
  private agents: Map<string, Phaser.GameObjects.Sprite> = new Map();

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const worldWidth = 1600;
    const worldHeight = 1200;

    // Initialize systems
    this.cameraController = new CameraController(this, {
      minZoom: 0.5,
      maxZoom: 2.0,
      worldBounds: new Phaser.Geom.Rectangle(0, 0, worldWidth, worldHeight),
    });

    this.inputHandler = new InputHandler(this, this.cameraController);
    this.spriteManager = new SpriteManager(this);
    this.tilemapRenderer = new TilemapRenderer(this);

    // Render tilemap
    this.tilemapRenderer.renderTilemap(
      'village',
      [{ name: 'rpg_tiles', imageKey: 'rpg_tiles' }],
      [
        { name: 'ground', depth: 0 },
        { name: 'walls', depth: 20, visible: true },
      ],
      { enableCollision: true }
    );

    // Create agents
    const agent = this.spriteManager.createAgentSprite(400, 300);
    this.agents.set('agent_1', agent);

    // Handle input
    this.inputHandler.on('select', (data) => {
      console.log('Selected position:', data.x, data.y);
    });

    // Set camera
    this.cameraController.panTo(worldWidth / 2, worldHeight / 2, 0);
  }

  update(time: number, delta: number) {
    this.inputHandler.update(delta);
    this.cameraController.update(delta);
  }

  shutdown() {
    this.agents.clear();
    this.spriteManager.destroy();
    this.tilemapRenderer.destroy();
    this.cameraController.destroy();
    this.inputHandler.destroy();
  }
}
```

### React + Phaser Integration

```tsx
import React, { useState, useEffect } from 'react';
import { GameProvider, GameCanvas } from './game';
import { GameOverlay } from './components/game';
import { gameConfig } from './game/config.example';

export function GameApp() {
  const [cameraState, setCameraState] = useState({
    x: 800,
    y: 600,
    zoom: 1.0,
  });

  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    // Listen to game events
    const handleCameraUpdate = (data) => {
      setCameraState({ x: data.x, y: data.y, zoom: data.zoom });
    };

    eventBus.on('cameraSettled', handleCameraUpdate);

    return () => {
      eventBus.off('cameraSettled', handleCameraUpdate);
    };
  }, []);

  return (
    <GameProvider config={gameConfig}>
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <GameCanvas />
        <GameOverlay
          worldWidth={1600}
          worldHeight={1200}
          cameraX={cameraState.x}
          cameraY={cameraState.y}
          cameraZoom={cameraState.zoom}
          selectedAgent={selectedAgent}
          onMinimapClick={(x, y) => {
            // Send event to Phaser to pan camera
            eventBus.emit('navigateTo', { x, y });
          }}
        />
      </div>
    </GameProvider>
  );
}
```

## Best Practices

### Performance

1. **Use Sprite Pooling** - Reuse sprites instead of creating/destroying
2. **Enable Culling** - Only render visible tiles
3. **Batch Sprites** - Group similar sprites together
4. **Limit Physics** - Only enable physics where needed

### Code Organization

1. **Separate Concerns** - Keep game logic in scenes, systems in separate files
2. **Use Events** - Communicate between systems via event emitter
3. **Type Safety** - Use TypeScript interfaces for all configs
4. **Cleanup** - Always destroy systems in shutdown()

### Asset Management

1. **Use Manifest** - Centralize asset definitions
2. **Lazy Load** - Load heavy assets only when needed
3. **Error Handling** - Provide fallbacks for missing assets
4. **Compression** - Use compressed textures for production

## Next Steps

- [ ] Integrate actual tilemap JSON files
- [ ] Connect to backend agent data
- [ ] Implement PixelLab sprite generation
- [ ] Add pathfinding for agents
- [ ] Create more complex animations
- [ ] Add sound effects and music
- [ ] Implement save/load system
- [ ] Add multiplayer support

## License

Part of the AI Agent Village Monitor project.

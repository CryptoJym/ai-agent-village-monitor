# Game Systems Documentation

This directory contains core game systems for the AI Agent Village Monitor RPG.

## Systems Overview

### PortalSystem

Manages doors, portals, and player interactions for scene transitions.

**Features:**
- Door detection and proximity checking
- Player interaction prompts
- Door animations (open/close)
- Portal activation and data management
- Keyboard interaction support
- Locked door support

**Usage Example:**

```typescript
import { PortalSystem } from './systems';

// Initialize in your scene
const portalSystem = new PortalSystem(this, {
  defaultInteractionRadius: 50,
  interactionKey: 'E',
  autoCloseDelay: 2000
});

// Register a portal
portalSystem.registerPortal({
  id: 'house-entrance',
  position: { x: 400, y: 300 },
  targetScene: 'HouseScene',
  targetPosition: { x: 100, y: 100 },
  doorType: 'building-entrance',
  metadata: {
    houseId: 'house_1',
    houseName: 'Main House'
  }
});

// Listen for portal activation
portalSystem.on('portalActivated', (data) => {
  console.log('Portal activated:', data);
  // Handle scene transition
});

// Update in your scene's update loop
update(time: number, delta: number) {
  portalSystem.update(playerX, playerY);
}

// Cleanup
shutdown() {
  portalSystem.destroy();
}
```

**Portal Types:**
- `building-entrance` - Main entrance to buildings (brown, large)
- `room-door` - Interior room doors (lighter brown, smaller)
- `exit` - Exit portals (green)

**Key Methods:**
- `registerPortal(portal)` - Add a new portal
- `unregisterPortal(portalId)` - Remove a portal
- `update(playerX, playerY)` - Check proximity and update state
- `activatePortal(portal)` - Trigger portal transition
- `setPortalEnabled(portalId, enabled)` - Enable/disable portal
- `getPortal(portalId)` - Get portal by ID
- `getAllPortals()` - Get all portals
- `getPortalsByType(doorType)` - Filter portals by type
- `isNearPortal()` - Check if player is near any portal
- `triggerPortal(portalId)` - Manually trigger portal by ID

**Events:**
- `portalRegistered` - Portal added to system
- `portalUnregistered` - Portal removed from system
- `portalActivated` - Portal triggered, includes transition data
- `portalLocked` - Attempted to activate locked portal
- `portalUpdated` - Portal properties changed
- `promptShown` - Interaction prompt displayed
- `promptHidden` - Interaction prompt hidden
- `doorOpened` - Door animation started
- `doorClosed` - Door animation completed

---

### SceneTransitionManager

Handles scene transitions with various visual effects and state persistence.

**Features:**
- Multiple transition effects (fade, slide, iris, none)
- Scene state persistence (camera position, zoom)
- Loading screen support
- Back navigation
- Smooth animations
- Transition history management

**Usage Example:**

```typescript
import {
  SceneTransitionManager,
  createFadeTransition,
  createSlideTransition,
  createIrisTransition
} from './systems';

// Initialize (can be shared across scenes or per-scene)
const transitionManager = new SceneTransitionManager();

// Transition with fade effect
await transitionManager.transitionTo(
  this, // current scene
  'HouseScene', // target scene
  createFadeTransition(500, 0x000000), // fade to black, 500ms
  {
    spawnPosition: { x: 100, y: 100 },
    customData: { houseId: 'house_1' }
  }
);

// Transition with slide effect
await transitionManager.transitionTo(
  this,
  'VillageScene',
  createSlideTransition('left', 500),
  { spawnPosition: { x: 400, y: 300 } }
);

// Transition with iris wipe
await transitionManager.transitionTo(
  this,
  'BattleScene',
  createIrisTransition(800)
);

// Instant transition (no effect)
await transitionManager.transitionTo(
  this,
  'MenuScene',
  createInstantTransition()
);

// Handle transition in (in target scene's create method)
create(data) {
  transitionManager.transitionIn(this, createFadeTransition(500));

  // Use transition data
  if (data.spawnPosition) {
    this.player.setPosition(data.spawnPosition.x, data.spawnPosition.y);
  }
}

// Navigate back to previous scene
await transitionManager.goBack(this, createFadeTransition(500));

// Create loading screen for async operations
const loadingScreen = transitionManager.createLoadingScreen(this, 'Loading...');
// ... perform async operations ...
transitionManager.removeLoadingScreen(loadingScreen);
```

**Transition Effects:**
- `fade` - Fade to color (configurable)
- `slide` - Slide camera in direction (left, right, up, down)
- `iris` - Circular iris wipe in/out
- `none` - Instant transition (no effect)

**Helper Functions:**
- `createFadeTransition(duration, color)` - Quick fade setup
- `createSlideTransition(direction, duration)` - Quick slide setup
- `createIrisTransition(duration)` - Quick iris setup
- `createInstantTransition()` - No transition effect

**Key Methods:**
- `transitionTo(scene, targetScene, options, data)` - Transition to new scene
- `transitionIn(scene, options)` - Execute transition-in effect
- `saveSceneState(scene)` - Save current scene state
- `restoreSceneState(scene, state)` - Restore previous scene state
- `goBack(scene, options)` - Navigate to previous scene
- `createLoadingScreen(scene, message)` - Show loading overlay
- `removeLoadingScreen(loadingScreen)` - Hide loading overlay
- `getPreviousState()` - Get previous scene state
- `getHistory()` - Get scene history
- `clearHistory()` - Clear scene history
- `isTransitioning()` - Check if transition in progress
- `cleanup()` - Clean up active transitions
- `destroy()` - Full cleanup

**Scene State:**
```typescript
interface SceneState {
  sceneKey: string;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  playerPosition?: { x: number; y: number };
  visitedRooms?: Set<string>;
  customData?: Record<string, any>;
  timestamp: number;
}
```

---

### Integration Example

Complete example showing PortalSystem + SceneTransitionManager:

```typescript
import {
  PortalSystem,
  SceneTransitionManager,
  createFadeTransition
} from './systems';

export class VillageScene extends Phaser.Scene {
  private portalSystem!: PortalSystem;
  private transitionManager!: SceneTransitionManager;

  create() {
    // Initialize systems
    this.transitionManager = new SceneTransitionManager();
    this.portalSystem = new PortalSystem(this, {
      defaultInteractionRadius: 60,
      interactionKey: 'E'
    });

    // Register portals
    this.portalSystem.registerPortal({
      id: 'house-entrance',
      position: { x: 400, y: 400 },
      targetScene: 'HouseInteriorScene',
      targetPosition: { x: 100, y: 500 },
      doorType: 'building-entrance',
      metadata: { houseId: 'house_1' }
    });

    // Handle portal activation
    this.portalSystem.on('portalActivated', async (data) => {
      await this.transitionManager.transitionTo(
        this,
        data.targetScene,
        createFadeTransition(500, 0x000000),
        {
          spawnPosition: data.targetPosition,
          fromScene: this.scene.key,
          ...data.metadata
        }
      );
    });

    // Handle locked portals
    this.portalSystem.on('portalLocked', (portal) => {
      this.showMessage(`Locked! Need: ${portal.requiresKey}`);
    });
  }

  update(time: number, delta: number) {
    // Update portal system with player position
    this.portalSystem.update(this.player.x, this.player.y);
  }

  shutdown() {
    this.portalSystem.destroy();
    // Don't destroy transitionManager if shared
  }
}
```

---

### CameraController

Advanced camera control system with smooth panning, zooming, and drag interactions.

**Features:**
- Smooth pan and zoom
- Drag to pan
- Mouse wheel zoom
- Target following
- World bounds constraints
- Elastic boundaries

See `CameraController.ts` for full documentation.

---

### InputHandler

Unified input management for keyboard, mouse, and touch.

**Features:**
- WASD/Arrow key controls
- Mouse click and drag
- Touch pinch-to-zoom
- Right-click context menu
- Event emission for game actions

See `InputHandler.ts` for full documentation.

---

## Testing

All systems include comprehensive test coverage:

- `__tests__/PortalSystem.test.ts` - Portal system tests
- `__tests__/SceneTransition.test.ts` - Transition manager tests
- `__tests__/scenes.test.ts` - Scene integration tests

Run tests:
```bash
npm test
```

---

## Examples

See `examples/PortalIntegrationExample.ts` for a complete working example demonstrating:
- Portal registration
- Scene transitions
- State persistence
- Player spawn positioning
- Locked doors
- Back navigation

---

## Best Practices

1. **Portal System:**
   - Always call `portalSystem.update()` in your scene's update loop
   - Clean up with `portalSystem.destroy()` in scene shutdown
   - Use metadata field to pass custom data through portals
   - Set appropriate interaction radius for different door types
   - Listen to `portalLocked` event to show player feedback

2. **Scene Transitions:**
   - Save state before transitions for back navigation
   - Use appropriate transition effects for context (fade for long distances, slide for rooms)
   - Include spawn position in transition data
   - Handle transition-in effects in target scene's create method
   - Show loading screens for async operations
   - Don't create new SceneTransitionManager per scene if you need history

3. **Performance:**
   - Unregister unused portals
   - Limit portal count per scene (20-30 max)
   - Use instant transitions for frequent scene changes
   - Clean up transition manager history periodically

4. **Accessibility:**
   - Provide clear visual feedback for portal proximity
   - Make interaction keys configurable
   - Include audio cues for portal interactions
   - Show appropriate messages for locked portals

---

## Future Enhancements

Potential improvements:
- Animated sprite support for doors
- Sound effects integration
- Portal unlock/lock animations
- Conditional portal visibility
- Multi-step portal sequences
- Custom shader transitions
- Particle effects for portals
- Portal cooldowns
- Portal network visualization

---

## API Reference

For complete API documentation, see:
- `PortalSystem.ts` - Full portal system implementation
- `SceneTransition.ts` - Full transition manager implementation
- Type definitions in `index.ts`

---

## Support

For issues or questions:
1. Check the examples directory
2. Review test files for usage patterns
3. See inline code documentation
4. File an issue with reproduction steps

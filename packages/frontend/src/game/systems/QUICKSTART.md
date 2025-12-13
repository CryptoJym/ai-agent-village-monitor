# Portal & Scene Transition Quick Start Guide

Get up and running with the door/portal system in 5 minutes.

## Step 1: Import the Systems

```typescript
import {
  PortalSystem,
  SceneTransitionManager,
  createFadeTransition
} from '../systems';
```

## Step 2: Initialize in Your Scene

```typescript
export class VillageScene extends Phaser.Scene {
  private portalSystem!: PortalSystem;
  private transitionManager!: SceneTransitionManager;

  create() {
    // Initialize transition manager (can be shared across scenes)
    this.transitionManager = new SceneTransitionManager();

    // Initialize portal system
    this.portalSystem = new PortalSystem(this, {
      defaultInteractionRadius: 60,
      interactionKey: 'E'
    });

    // ... rest of scene setup
  }
}
```

## Step 3: Register Portals

```typescript
create() {
  // ... initialization from Step 2

  // Add a building entrance
  this.portalSystem.registerPortal({
    id: 'house-main-door',
    position: { x: 400, y: 300 },
    targetScene: 'HouseInteriorScene',
    targetPosition: { x: 100, y: 100 },
    doorType: 'building-entrance'
  });

  // Add a locked door
  this.portalSystem.registerPortal({
    id: 'secret-room',
    position: { x: 800, y: 300 },
    targetScene: 'SecretRoomScene',
    targetPosition: { x: 50, y: 50 },
    doorType: 'room-door',
    requiresKey: 'golden_key'
  });

  // Add an exit portal
  this.portalSystem.registerPortal({
    id: 'exit-to-world',
    position: { x: 100, y: 100 },
    targetScene: 'WorldMapScene',
    targetPosition: { x: 400, y: 300 },
    doorType: 'exit'
  });
}
```

## Step 4: Handle Portal Activation

```typescript
create() {
  // ... previous setup

  // Listen for portal activation
  this.portalSystem.on('portalActivated', async (data) => {
    // Perform scene transition
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
    this.showMessage(`This door is locked! You need: ${portal.requiresKey}`);
  });
}
```

## Step 5: Update Portal System

```typescript
update(time: number, delta: number) {
  // Update portal system with player position every frame
  this.portalSystem.update(this.player.x, this.player.y);
}
```

## Step 6: Handle Cleanup

```typescript
shutdown() {
  // Clean up portal system
  if (this.portalSystem) {
    this.portalSystem.destroy();
  }

  // Note: Don't destroy transitionManager if shared across scenes
}
```

## Complete Example

```typescript
import Phaser from 'phaser';
import {
  PortalSystem,
  SceneTransitionManager,
  createFadeTransition
} from '../systems';

export class MyGameScene extends Phaser.Scene {
  private portalSystem!: PortalSystem;
  private transitionManager!: SceneTransitionManager;
  private player!: Phaser.GameObjects.Sprite;

  constructor() {
    super({ key: 'MyGameScene' });
  }

  create() {
    // Initialize systems
    this.transitionManager = new SceneTransitionManager();
    this.portalSystem = new PortalSystem(this, {
      defaultInteractionRadius: 60,
      interactionKey: 'E'
    });

    // Create player (example)
    this.player = this.add.sprite(400, 300, 'player');

    // Register portals
    this.portalSystem.registerPortal({
      id: 'house-door',
      position: { x: 400, y: 400 },
      targetScene: 'HouseScene',
      targetPosition: { x: 100, y: 500 },
      doorType: 'building-entrance'
    });

    // Handle portal activation
    this.portalSystem.on('portalActivated', async (data) => {
      await this.transitionManager.transitionTo(
        this,
        data.targetScene,
        createFadeTransition(500, 0x000000),
        {
          spawnPosition: data.targetPosition,
          fromScene: this.scene.key
        }
      );
    });
  }

  update(time: number, delta: number) {
    // Update portal proximity
    this.portalSystem.update(this.player.x, this.player.y);
  }

  shutdown() {
    this.portalSystem.destroy();
  }
}
```

## Handling the Target Scene

In your target scene, handle incoming transition data:

```typescript
export class HouseScene extends Phaser.Scene {
  private transitionManager!: SceneTransitionManager;

  create(data?: any) {
    // Initialize transition manager
    this.transitionManager = new SceneTransitionManager();

    // Handle incoming transition
    if (data?.spawnPosition) {
      this.player.setPosition(
        data.spawnPosition.x,
        data.spawnPosition.y
      );
    }

    // Transition in effect
    this.transitionManager.transitionIn(
      this,
      createFadeTransition(500, 0x000000)
    );

    // Set up exit portal to return
    this.portalSystem.registerPortal({
      id: 'exit-door',
      position: { x: 100, y: 100 },
      targetScene: data?.fromScene || 'MyGameScene',
      targetPosition: { x: 400, y: 350 }, // Just outside the entrance
      doorType: 'exit'
    });
  }
}
```

## Different Transition Effects

### Fade (Black)
```typescript
createFadeTransition(500, 0x000000)
```

### Fade (White)
```typescript
createFadeTransition(500, 0xffffff)
```

### Slide Left
```typescript
createSlideTransition('left', 500)
```

### Slide Right
```typescript
createSlideTransition('right', 500)
```

### Iris Wipe
```typescript
createIrisTransition(800)
```

### Instant (No Effect)
```typescript
createInstantTransition()
```

## Common Patterns

### Passing Custom Data

```typescript
this.portalSystem.registerPortal({
  id: 'shop-door',
  position: { x: 600, y: 400 },
  targetScene: 'ShopScene',
  targetPosition: { x: 100, y: 100 },
  doorType: 'building-entrance',
  metadata: {
    shopId: 'general-store',
    shopkeeper: 'Bob',
    discountPercent: 10
  }
});

// Access in target scene:
create(data?: any) {
  console.log(data.shopId); // 'general-store'
  console.log(data.shopkeeper); // 'Bob'
  console.log(data.discountPercent); // 10
}
```

### Unlocking Doors

```typescript
// Check if player has key
if (this.player.inventory.has('golden_key')) {
  // Unlock the door
  const portal = this.portalSystem.getPortal('secret-room');
  if (portal) {
    portal.requiresKey = undefined; // Remove key requirement
    this.portalSystem.updatePortal('secret-room', { requiresKey: undefined });
  }
}
```

### Disabling Portals

```typescript
// Disable portal (e.g., during cutscene)
this.portalSystem.setPortalEnabled('house-door', false);

// Re-enable later
this.portalSystem.setPortalEnabled('house-door', true);
```

### Back Navigation

```typescript
// Go back to previous scene
await this.transitionManager.goBack(
  this,
  createFadeTransition(500, 0x000000)
);
```

### Loading Screens

```typescript
// Show loading screen
const loadingScreen = this.transitionManager.createLoadingScreen(
  this,
  'Loading interior...'
);

// Load assets or perform async operations
await this.loadHouseAssets();

// Remove loading screen
this.transitionManager.removeLoadingScreen(loadingScreen);
```

## Tips & Best Practices

1. **Always call `portalSystem.update()` in your update loop**
2. **Clean up with `portalSystem.destroy()` in shutdown**
3. **Use meaningful portal IDs** for debugging
4. **Set appropriate interaction radius** for each door type
5. **Handle locked portals** with clear player feedback
6. **Use metadata** to pass custom data between scenes
7. **Choose transition effects** that match the context
8. **Test on different devices** to ensure smooth transitions

## Troubleshooting

### Portal not activating
- Check that you're calling `portalSystem.update()` in the update loop
- Verify the player is within the interaction radius
- Ensure the portal is enabled
- Check console for any errors

### Prompt not showing
- Verify keyboard input is available (`scene.input.keyboard`)
- Check that the interaction key is correctly configured
- Ensure the player is close enough to the portal

### Scene transition not working
- Verify the target scene is registered in your game config
- Check that scene key names match exactly
- Ensure transitionTo is being awaited properly
- Look for errors in console

## Next Steps

- See `README.md` for full API documentation
- Check `examples/PortalIntegrationExample.ts` for a complete working example
- Review the inline code documentation in `PortalSystem.ts` and `SceneTransition.ts`

## Need Help?

1. Check the full README.md
2. Look at the integration example
3. Review the test files for usage patterns
4. File an issue with a reproduction case

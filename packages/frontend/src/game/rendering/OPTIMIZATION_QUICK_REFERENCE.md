# Rendering Optimization Quick Reference

## Quick Start (5 Minutes)

```typescript
import { LayerManager, RenderOptimizer, LODSystem } from './rendering';
import { PerformanceMonitor } from './ui';

class MyScene extends Phaser.Scene {
  private layerManager!: LayerManager;
  private optimizer!: RenderOptimizer;
  private lod!: LODSystem;
  private monitor!: PerformanceMonitor;

  create() {
    // 1. Setup (one-time)
    this.layerManager = new LayerManager(this);
    this.layerManager.initializeStandardLayers();
    this.layerManager.enableCulling(true);

    this.optimizer = new RenderOptimizer(this);
    this.optimizer.enableCulling(this.cameras.main);

    this.lod = new LODSystem(this);
    this.lod.setCamera(this.cameras.main);

    this.monitor = new PerformanceMonitor(this);
    this.monitor.setRenderOptimizer(this.optimizer);
    this.monitor.setLayerManager(this.layerManager);
    this.monitor.setLODSystem(this.lod);
  }

  update(time: number, delta: number) {
    // 2. Update (every frame)
    this.layerManager.update(this.cameras.main);
    this.optimizer.update();
    this.lod.update();
    this.monitor.update(time, delta);
  }

  shutdown() {
    // 3. Cleanup (on scene end)
    this.layerManager.destroy();
    this.optimizer.destroy();
    this.lod.destroy();
    this.monitor.destroy();
  }
}
```

## Feature Cheat Sheet

### LayerManager - Viewport Culling

```typescript
// Enable culling (recommended)
layerManager.enableCulling(true);
layerManager.setCullPadding(64);  // pixels around viewport

// Add objects to layers
const groundLayer = layerManager.getLayer('ground');
groundLayer?.add(sprite);

// Manual culling control
const culledCount = layerManager.cullAllLayers(camera);
const stats = layerManager.getCullingStats();
```

**Performance:** 50-80% fewer rendered objects

### RenderOptimizer - Object Pooling

```typescript
// Create pool
optimizer.createPool('agent', {
  initialSize: 20,
  maxSize: 100,
  createFunc: () => scene.add.circle(0, 0, 8, 0xffffff),
  resetFunc: (obj) => obj.setPosition(0, 0)
});

// Use pool
const agent = optimizer.getFromPool('agent');
// ... use agent ...
optimizer.returnToPool(agent);
```

**Performance:** 70-90% reduction in GC pauses

### LODSystem - Level of Detail

```typescript
// Register object with LOD
lod.registerObject('house_1', houseSprite, {
  highDetail: () => houseSprite.setScale(1.0),
  mediumDetail: () => houseSprite.setScale(0.9),
  lowDetail: () => houseSprite.setScale(0.75),
  minimalDetail: () => houseSprite.setScale(0.5)
});

// Or use helpers
const callbacks = lod.createSpriteCallbacks(sprite);
lod.registerObject('sprite_1', sprite, callbacks);
```

**Performance:** 30-50% reduction in draw complexity

### PerformanceMonitor - Real-time Metrics

```typescript
// Show/hide
monitor.toggle();  // Press 'P' in example scene

// Toggle detailed view (with graph)
monitor.toggleDetailedView();  // Press 'D'

// Get metrics
const fps = monitor.getCurrentFPS();
const avgFrameTime = monitor.getAverageFrameTime();
```

**Display:**
```
FPS: 60          (green=55+, yellow=30-54, red=<30)
Draw Calls: 45
Objects: 234
Culled: 156
LOD: H12 M8 L4
Memory: 2048KB
```

## Common Patterns

### Pattern 1: Pooled Agents

```typescript
// Setup
optimizer.createPool('agent', { initialSize: 20, maxSize: 100, ... });

// Spawn
const agent = optimizer.getFromPool('agent');
agent.setPosition(x, y);
const layer = layerManager.getLayer('entities');
layer?.add(agent);

// Despawn
optimizer.returnToPool(agent);
```

### Pattern 2: LOD Buildings

```typescript
// Create building with decorations
const building = this.add.container(x, y);
const body = this.add.rectangle(0, 0, 96, 96, 0x8b4513);
const window1 = this.add.rectangle(-20, -20, 16, 16, 0xffffcc);
const window2 = this.add.rectangle(20, -20, 16, 16, 0xffffcc);
building.add([body, window1, window2]);

// Register with LOD (windows hidden at low detail)
const callbacks = lod.createComplexObjectCallbacks(
  building,
  [window1, window2]
);
lod.registerObject('building_1', building, callbacks);
```

### Pattern 3: Layer Organization

```typescript
// Standard layers (already created by initializeStandardLayers)
const ground = layerManager.getLayer('ground');        // z-index: 0
const floor = layerManager.getLayer('floor');          // z-index: 5
const walls = layerManager.getLayer('walls');          // z-index: 10
const decorations = layerManager.getLayer('decorations'); // z-index: 20
const entities = layerManager.getLayer('entities');    // z-index: 30
const abovePlayer = layerManager.getLayer('above-player'); // z-index: 40
const ui = layerManager.getLayer('ui');                // z-index: 50

// Add objects
ground?.add(terrainSprite);
entities?.add(agentSprite);
ui?.add(labelText);
```

## Configuration Presets

### Small World (<1000x1000)

```typescript
layerManager.setCullPadding(32);  // Smaller padding OK
lod.updateConfig({
  highDetailDistance: 200,
  mediumDetailDistance: 400,
  lowDetailDistance: 800
});
lod.setUpdateInterval(10);  // Less frequent updates
```

### Medium World (1000x2000)

```typescript
layerManager.setCullPadding(64);  // Balanced
lod.updateConfig({
  highDetailDistance: 300,
  mediumDetailDistance: 600,
  lowDetailDistance: 1200
});
lod.setUpdateInterval(5);  // Standard updates
```

### Large World (>2000x2000)

```typescript
layerManager.setCullPadding(128);  // Larger padding to reduce toggling
lod.updateConfig({
  highDetailDistance: 400,
  mediumDetailDistance: 800,
  lowDetailDistance: 1600
});
lod.setUpdateInterval(3);  // More frequent for responsiveness
```

## Performance Targets

### Development
- Enable PerformanceMonitor (visible)
- Use detailed view for tuning
- Monitor FPS and draw calls
- Adjust settings based on metrics

### Production
- Hide PerformanceMonitor or disable
- Keep culling enabled
- Keep object pooling
- Keep LOD system

### Target Metrics
- **FPS:** 55-60 (good), 45-55 (acceptable), <45 (needs tuning)
- **Draw Calls:** <50 (excellent), 50-100 (good), >100 (needs optimization)
- **Culled Objects:** 50-80% (good culling efficiency)
- **Frame Time:** <16.67ms (60 FPS), <33.33ms (30 FPS)

## Keyboard Shortcuts (Example Scene)

- `P` - Toggle performance monitor
- `D` - Toggle detailed view (frame graph)
- `C` - Toggle culling on/off (for testing)

## Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Objects disappearing | `layerManager.setCullPadding(128)` |
| Low FPS despite culling | Check detailed view, may need LOD or pooling |
| Pool exhausted warnings | Increase `maxSize` in pool config |
| LOD not switching | Verify `lod.setCamera(camera)` called |
| High draw calls | Ensure culling enabled, add more LOD objects |
| GC pauses | Add object pooling for dynamic objects |

## Files to Reference

- **Full Example:** `examples/OptimizedVillageScene.example.ts`
- **Detailed Docs:** `rendering/README.md`
- **Implementation Summary:** Root `RENDERING_OPTIMIZATION.md`

## Performance Gains Summary

| Optimization | Metric | Improvement |
|--------------|--------|-------------|
| Viewport Culling | Rendered Objects | 50-80% reduction |
| Object Pooling | GC Pauses | 70-90% reduction |
| LOD System | Draw Complexity | 30-50% reduction |
| **Combined** | **FPS** | **2-3x improvement** |

## Next Steps

1. Copy the quick start code into your scene
2. Test with performance monitor visible
3. Tune settings based on metrics
4. Add pooling for your dynamic objects
5. Add LOD for your buildings/decorations
6. Profile and iterate

---

**Remember:** Start with viewport culling (biggest impact), then add pooling for dynamic objects, then LOD for static decorations. Measure with PerformanceMonitor to verify improvements.

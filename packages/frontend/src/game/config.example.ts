import Phaser from 'phaser';
import { BootScene, PreloadScene, VillageScene, HouseScene } from './scenes';

/**
 * Example Phaser game configuration
 *
 * This configuration can be used to initialize the game with the GameProvider:
 *
 * ```tsx
 * import { GameProvider, GameCanvas } from './game';
 * import { gameConfig } from './game/config.example';
 *
 * function App() {
 *   return (
 *     <GameProvider config={gameConfig}>
 *       <GameCanvas style={{ width: '100%', height: '100vh' }} />
 *     </GameProvider>
 *   );
 * }
 * ```
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#1a1a1a',
  input: {
    gamepad: true,
    activePointers: 2,
  },
  scene: [BootScene, PreloadScene, VillageScene, HouseScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};

/**
 * Example usage of game systems within a scene
 *
 * ```typescript
 * import { CameraController, InputHandler } from './game/systems';
 * import { SpriteManager } from './game/sprites';
 * import { TilemapRenderer } from './game/tiles';
 *
 * class MyScene extends Phaser.Scene {
 *   private cameraController!: CameraController;
 *   private inputHandler!: InputHandler;
 *   private spriteManager!: SpriteManager;
 *   private tilemapRenderer!: TilemapRenderer;
 *
 *   create() {
 *     // Initialize camera controller
 *     this.cameraController = new CameraController(this, {
 *       minZoom: 0.5,
 *       maxZoom: 2.0,
 *       worldBounds: new Phaser.Geom.Rectangle(0, 0, 1600, 1200),
 *     });
 *
 *     // Initialize input handler
 *     this.inputHandler = new InputHandler(this, this.cameraController);
 *
 *     // Initialize sprite manager
 *     this.spriteManager = new SpriteManager(this);
 *
 *     // Initialize tilemap renderer
 *     this.tilemapRenderer = new TilemapRenderer(this);
 *
 *     // Render a tilemap
 *     this.tilemapRenderer.renderTilemap(
 *       'village',
 *       [{ name: 'rpg_tiles', imageKey: 'rpg_tiles' }],
 *       [
 *         { name: 'ground', depth: 0 },
 *         { name: 'walls', depth: 20 },
 *       ]
 *     );
 *
 *     // Create an agent sprite
 *     const agent = this.spriteManager.createAgentSprite(400, 300);
 *
 *     // Listen to input events
 *     this.inputHandler.on('select', (data) => {
 *       console.log('Clicked at:', data.x, data.y);
 *     });
 *   }
 *
 *   update(time: number, delta: number) {
 *     this.inputHandler.update(delta);
 *   }
 * }
 * ```
 */

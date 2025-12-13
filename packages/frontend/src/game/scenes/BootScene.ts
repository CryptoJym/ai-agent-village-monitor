import Phaser from 'phaser';

/**
 * BootScene - Initialization and minimal asset loading for loading screen
 *
 * Responsibilities:
 * - Initialize game state
 * - Load minimal assets needed for the loading screen
 * - Set up initial configurations
 * - Transition to PreloadScene
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load minimal assets for loading screen
    // For now, we'll use Phaser's built-in graphics for the loading bar
    console.log('[BootScene] Initializing game...');
  }

  create() {
    console.log('[BootScene] Boot complete, starting preload...');

    // Initialize any global game state here
    if (!this.registry.has('gameState')) {
      this.registry.set('gameState', {
        initialized: true,
        version: '1.0.0',
      });
    }

    // Transition to PreloadScene
    this.scene.start('PreloadScene');
  }
}

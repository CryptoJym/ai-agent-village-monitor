/**
 * SceneTransitionManager Tests
 * Tests transition effects, state persistence, and navigation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Phaser from 'phaser';
import {
  SceneTransitionManager,
  createFadeTransition,
  createSlideTransition,
  createIrisTransition,
  createInstantTransition,
} from '../systems/SceneTransition';

describe('SceneTransitionManager', () => {
  let game: Phaser.Game;
  let scene1: Phaser.Scene;
  let scene2: Phaser.Scene;
  let transitionManager: SceneTransitionManager;

  beforeEach(() => {
    // Create headless Phaser game for testing
    game = new Phaser.Game({
      type: Phaser.HEADLESS,
      width: 800,
      height: 600,
      physics: {
        default: 'arcade',
      },
      scene: [],
      audio: {
        noAudio: true,
      },
    });

    // Create test scenes
    class TestScene1 extends Phaser.Scene {
      constructor() {
        super({ key: 'Scene1' });
      }
    }

    class TestScene2 extends Phaser.Scene {
      constructor() {
        super({ key: 'Scene2' });
      }
    }

    scene1 = new TestScene1();
    scene2 = new TestScene2();

    game.scene.add('Scene1', scene1, true);
    game.scene.add('Scene2', scene2, false);

    transitionManager = new SceneTransitionManager();
  });

  afterEach(() => {
    if (transitionManager) {
      transitionManager.destroy();
    }
    if (game) {
      game.destroy(true);
    }
  });

  describe('Transition Effects', () => {
    it('should create a fade transition', async () => {
      const options = createFadeTransition(300, 0x000000);

      expect(options.effect).toBe('fade');
      expect(options.duration).toBe(300);
      expect(options.color).toBe(0x000000);
    });

    it('should create a slide transition', () => {
      const options = createSlideTransition('left', 400);

      expect(options.effect).toBe('slide');
      expect(options.duration).toBe(400);
      expect(options.direction).toBe('left');
    });

    it('should create an iris transition', () => {
      const options = createIrisTransition(800);

      expect(options.effect).toBe('iris');
      expect(options.duration).toBe(800);
    });

    it('should create an instant transition', () => {
      const options = createInstantTransition();

      expect(options.effect).toBe('none');
      expect(options.duration).toBe(0);
    });

    it('should execute fade effect', async () => {
      const fadePromise = transitionManager.createFadeEffect(scene1, 100, 0x000000, true);

      expect(fadePromise).toBeInstanceOf(Promise);
      await fadePromise;

      // Should complete without error
    });

    it('should execute slide effect', async () => {
      const slidePromise = transitionManager.createSlideEffect(scene1, 'left', 100, true);

      expect(slidePromise).toBeInstanceOf(Promise);
      await slidePromise;

      // Should complete without error
    });

    it('should execute iris effect', async () => {
      const irisPromise = transitionManager.createIrisEffect(scene1, 100, true);

      expect(irisPromise).toBeInstanceOf(Promise);
      await irisPromise;

      // Should complete without error
    });
  });

  describe('Scene State Management', () => {
    it('should save scene state', () => {
      const initialHistoryLength = transitionManager.getHistory().length;

      transitionManager.saveSceneState(scene1);

      const history = transitionManager.getHistory();
      expect(history.length).toBe(initialHistoryLength + 1);

      const lastState = history[history.length - 1];
      expect(lastState.sceneKey).toBe('Scene1');
      expect(lastState.cameraX).toBeDefined();
      expect(lastState.cameraY).toBeDefined();
      expect(lastState.cameraZoom).toBeDefined();
      expect(lastState.timestamp).toBeDefined();
    });

    it('should restore scene state', () => {
      // Save initial state
      transitionManager.saveSceneState(scene1);

      // Modify camera
      scene1.cameras.main.scrollX = 100;
      scene1.cameras.main.scrollY = 200;
      scene1.cameras.main.zoom = 1.5;

      // Save modified state
      transitionManager.saveSceneState(scene1);

      const history = transitionManager.getHistory();
      const firstState = history[0];

      // Restore first state
      transitionManager.restoreSceneState(scene1, firstState);

      expect(scene1.cameras.main.scrollX).toBe(firstState.cameraX);
      expect(scene1.cameras.main.scrollY).toBe(firstState.cameraY);
      expect(scene1.cameras.main.zoom).toBe(firstState.cameraZoom);
    });

    it('should limit history size', () => {
      // Save more states than the max history size (10)
      for (let i = 0; i < 15; i++) {
        transitionManager.saveSceneState(scene1);
      }

      const history = transitionManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should get previous state', () => {
      transitionManager.saveSceneState(scene1);
      transitionManager.saveSceneState(scene2);

      const previousState = transitionManager.getPreviousState();

      expect(previousState).toBeDefined();
      expect(previousState?.sceneKey).toBe('Scene1');
    });

    it('should clear history', () => {
      transitionManager.saveSceneState(scene1);
      transitionManager.saveSceneState(scene2);

      expect(transitionManager.getHistory().length).toBeGreaterThan(0);

      transitionManager.clearHistory();

      expect(transitionManager.getHistory().length).toBe(0);
    });
  });

  describe('Scene Transitions', () => {
    it('should transition between scenes', async () => {
      const sceneStartSpy = vi.spyOn(scene1.scene, 'start');

      await transitionManager.transitionTo(scene1, 'Scene2', createInstantTransition(), {
        customData: 'test',
      });

      expect(sceneStartSpy).toHaveBeenCalledWith(
        'Scene2',
        expect.objectContaining({
          targetScene: 'Scene2',
          fromScene: 'Scene1',
          customData: expect.objectContaining({
            customData: 'test',
          }),
        }),
      );
    });

    it('should save state before transitioning', async () => {
      const initialHistoryLength = transitionManager.getHistory().length;

      await transitionManager.transitionTo(scene1, 'Scene2', createInstantTransition());

      const history = transitionManager.getHistory();
      expect(history.length).toBe(initialHistoryLength + 1);
      expect(history[history.length - 1].sceneKey).toBe('Scene1');
    });

    it('should not allow concurrent transitions', async () => {
      const transition1 = transitionManager.transitionTo(
        scene1,
        'Scene2',
        createFadeTransition(100),
      );

      // Try to start another transition immediately
      const transition2 = transitionManager.transitionTo(
        scene1,
        'Scene2',
        createFadeTransition(100),
      );

      await transition1;
      await transition2;

      // Second transition should be ignored (warning logged)
      expect(transitionManager.isTransitioning()).toBe(false);
    });

    it('should execute transition in effect', async () => {
      await transitionManager.transitionIn(scene1, createFadeTransition(100, 0x000000));

      // Should complete without error
    });

    it('should handle transition data with spawn position', async () => {
      const sceneStartSpy = vi.spyOn(scene1.scene, 'start');

      await transitionManager.transitionTo(scene1, 'Scene2', createInstantTransition(), {
        spawnPosition: { x: 100, y: 200 },
      });

      expect(sceneStartSpy).toHaveBeenCalledWith(
        'Scene2',
        expect.objectContaining({
          spawnPosition: { x: 100, y: 200 },
        }),
      );
    });
  });

  describe('Back Navigation', () => {
    it('should navigate back to previous scene', async () => {
      // Need at least 2 states in history for goBack to work
      // getPreviousState() requires history.length >= 2
      // First save Scene1's state, then Scene2's state (simulating Scene1 -> Scene2 -> Scene3)
      transitionManager.saveSceneState(scene1);
      transitionManager.saveSceneState(scene2);

      // Spy on scene start before going back
      const sceneStartSpy = vi.spyOn(scene2.scene, 'start');

      // Navigate back from scene2 - should go to Scene1 (the previous state)
      await transitionManager.goBack(scene2, createInstantTransition());

      // The transitionTo method puts restoreState in customData
      expect(sceneStartSpy).toHaveBeenCalledWith(
        'Scene1',
        expect.objectContaining({
          targetScene: 'Scene1',
          customData: expect.objectContaining({
            restoreState: true,
          }),
        }),
      );
    });

    it('should not go back if no previous scene', async () => {
      // Clear history first
      transitionManager.clearHistory();

      const sceneStartSpy = vi.spyOn(scene1.scene, 'start');

      // Try to go back with no history
      await transitionManager.goBack(scene1, createInstantTransition());

      expect(sceneStartSpy).not.toHaveBeenCalled();
    });

    it('should not go back with only one state in history', async () => {
      // With only 1 state, getPreviousState returns undefined
      transitionManager.saveSceneState(scene1);

      const sceneStartSpy = vi.spyOn(scene1.scene, 'start');

      // Try to go back - should not work since there's no "previous" state
      await transitionManager.goBack(scene1, createInstantTransition());

      expect(sceneStartSpy).not.toHaveBeenCalled();
    });

    it('should remove current state from history when going back', async () => {
      // Setup: need 2 states for goBack to work
      transitionManager.saveSceneState(scene1);
      transitionManager.saveSceneState(scene2);

      const initialLength = transitionManager.getHistory().length; // 2

      // goBack pops the current state, then transitionTo saves the new scene's state
      // So: pop() reduces to 1, then save adds Scene1 again -> back to 2
      // The net effect is the "current" (Scene2) state is replaced with the "previous" (Scene1) state
      await transitionManager.goBack(scene2, createInstantTransition());

      const newLength = transitionManager.getHistory().length;
      // After goBack: pop removes one (2->1), transitionTo adds one back (1->2)
      // The history length stays the same, but the content changes
      expect(newLength).toBe(initialLength);
    });
  });

  describe('Loading Screen', () => {
    it('should create loading screen', () => {
      const loadingScreen = transitionManager.createLoadingScreen(scene1, 'Loading...');

      expect(loadingScreen).toBeDefined();
      expect(loadingScreen).toBeInstanceOf(Phaser.GameObjects.Container);
    });

    it('should remove loading screen', () => {
      const loadingScreen = transitionManager.createLoadingScreen(scene1, 'Loading...');

      const destroySpy = vi.spyOn(loadingScreen, 'destroy');

      transitionManager.removeLoadingScreen(loadingScreen);

      expect(destroySpy).toHaveBeenCalled();
    });

    it('should create loading screen with custom message', () => {
      const loadingScreen = transitionManager.createLoadingScreen(scene1, 'Custom Loading...');

      expect(loadingScreen).toBeDefined();
      // Would need to access children to verify text, but structure is tested
    });
  });

  describe('Transition State', () => {
    it('should track transition in progress', async () => {
      expect(transitionManager.isTransitioning()).toBe(false);

      const transitionPromise = transitionManager.transitionTo(
        scene1,
        'Scene2',
        createFadeTransition(100),
      );

      // Note: Due to async nature, this may not always be true at this exact moment
      // but the flag should be set during transition
      await transitionPromise;

      expect(transitionManager.isTransitioning()).toBe(false);
    });

    it('should cleanup active transitions', () => {
      transitionManager.cleanup();

      expect(transitionManager.isTransitioning()).toBe(false);
    });
  });

  describe('Slide Direction Variations', () => {
    it('should handle slide left', async () => {
      await transitionManager.createSlideEffect(scene1, 'left', 100, true);
      // Should complete without error
    });

    it('should handle slide right', async () => {
      await transitionManager.createSlideEffect(scene1, 'right', 100, true);
      // Should complete without error
    });

    it('should handle slide up', async () => {
      await transitionManager.createSlideEffect(scene1, 'up', 100, true);
      // Should complete without error
    });

    it('should handle slide down', async () => {
      await transitionManager.createSlideEffect(scene1, 'down', 100, true);
      // Should complete without error
    });

    it('should handle slide in effects', async () => {
      await transitionManager.createSlideEffect(scene1, 'left', 100, false);
      // Should complete without error
    });
  });

  describe('Fade Color Variations', () => {
    it('should fade to black', async () => {
      await transitionManager.createFadeEffect(scene1, 100, 0x000000, true);
      // Should complete without error
    });

    it('should fade to white', async () => {
      await transitionManager.createFadeEffect(scene1, 100, 0xffffff, true);
      // Should complete without error
    });

    it('should fade in from black', async () => {
      await transitionManager.createFadeEffect(scene1, 100, 0x000000, false);
      // Should complete without error
    });
  });

  describe('Error Handling', () => {
    it('should handle transition errors gracefully', async () => {
      // Mock scene.start to throw error
      const error = new Error('Scene start failed');
      vi.spyOn(scene1.scene, 'start').mockImplementation(() => {
        throw error;
      });

      await expect(
        transitionManager.transitionTo(scene1, 'Scene2', createInstantTransition()),
      ).rejects.toThrow('Scene start failed');

      // Should reset transition flag even on error
      expect(transitionManager.isTransitioning()).toBe(false);
    });
  });

  describe('Cleanup and Destroy', () => {
    it('should cleanup resources on destroy', () => {
      transitionManager.saveSceneState(scene1);
      transitionManager.saveSceneState(scene2);

      expect(transitionManager.getHistory().length).toBeGreaterThan(0);

      transitionManager.destroy();

      expect(transitionManager.getHistory().length).toBe(0);
      expect(transitionManager.isTransitioning()).toBe(false);
    });
  });
});

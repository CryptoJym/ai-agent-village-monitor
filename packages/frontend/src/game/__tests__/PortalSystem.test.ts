/**
 * PortalSystem Tests
 * Tests door detection, proximity checking, portal activation, and animations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Phaser from 'phaser';
import { PortalSystem, Portal } from '../systems/PortalSystem';

// Helper to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PortalSystem', () => {
  let game: Phaser.Game;
  let scene: Phaser.Scene;
  let portalSystem: PortalSystem;

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

    // Create a test scene
    class TestScene extends Phaser.Scene {
      constructor() {
        super({ key: 'TestScene' });
      }
    }

    scene = new TestScene();
    game.scene.add('TestScene', scene, true);

    // Initialize portal system
    portalSystem = new PortalSystem(scene, {
      defaultInteractionRadius: 50,
      interactionKey: 'E',
    });
  });

  afterEach(() => {
    if (portalSystem) {
      portalSystem.destroy();
    }
    if (game) {
      game.destroy(true);
    }
  });

  describe('Portal Registration', () => {
    it('should register a portal successfully', () => {
      const portal: Portal = {
        id: 'test-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
      };

      portalSystem.registerPortal(portal);

      const registered = portalSystem.getPortal('test-portal');
      expect(registered).toBeDefined();
      expect(registered?.id).toBe('test-portal');
      expect(registered?.enabled).toBe(true);
    });

    it('should emit portalRegistered event', () => {
      const handler = vi.fn();
      portalSystem.on('portalRegistered', handler);

      const portal: Portal = {
        id: 'test-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'room-door',
      };

      portalSystem.registerPortal(portal);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-portal',
          doorType: 'room-door',
        })
      );
    });

    it('should unregister a portal', () => {
      const portal: Portal = {
        id: 'test-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'exit',
      };

      portalSystem.registerPortal(portal);
      expect(portalSystem.getPortal('test-portal')).toBeDefined();

      portalSystem.unregisterPortal('test-portal');
      expect(portalSystem.getPortal('test-portal')).toBeUndefined();
    });

    it('should use default interaction radius if not provided', () => {
      const portal: Portal = {
        id: 'test-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
      };

      portalSystem.registerPortal(portal);

      const registered = portalSystem.getPortal('test-portal');
      expect(registered?.interactionRadius).toBe(50);
    });

    it('should use custom interaction radius if provided', () => {
      const portal: Portal = {
        id: 'test-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
        interactionRadius: 75,
      };

      portalSystem.registerPortal(portal);

      const registered = portalSystem.getPortal('test-portal');
      expect(registered?.interactionRadius).toBe(75);
    });
  });

  describe('Proximity Detection', () => {
    beforeEach(() => {
      portalSystem.registerPortal({
        id: 'portal-1',
        position: { x: 100, y: 100 },
        targetScene: 'Scene1',
        targetPosition: { x: 0, y: 0 },
        doorType: 'building-entrance',
        interactionRadius: 50,
      });

      portalSystem.registerPortal({
        id: 'portal-2',
        position: { x: 300, y: 100 },
        targetScene: 'Scene2',
        targetPosition: { x: 0, y: 0 },
        doorType: 'room-door',
        interactionRadius: 30,
      });
    });

    it('should detect when player is near a portal', () => {
      const nearbyPortal = portalSystem.checkProximity(110, 110);
      expect(nearbyPortal).not.toBeNull();
      expect(nearbyPortal?.id).toBe('portal-1');
    });

    it('should not detect portal when player is too far', () => {
      const nearbyPortal = portalSystem.checkProximity(500, 500);
      expect(nearbyPortal).toBeNull();
    });

    it('should detect the nearest portal when multiple are in range', () => {
      // Position player equidistant but closer to portal-2
      const nearbyPortal = portalSystem.checkProximity(290, 100);
      expect(nearbyPortal?.id).toBe('portal-2');
    });

    it('should not detect disabled portals', () => {
      portalSystem.setPortalEnabled('portal-1', false);

      const nearbyPortal = portalSystem.checkProximity(110, 110);
      expect(nearbyPortal).toBeNull();
    });

    it('should update nearby portal state during update cycle', () => {
      expect(portalSystem.isNearPortal()).toBe(false);

      portalSystem.update(110, 110);
      expect(portalSystem.isNearPortal()).toBe(true);

      portalSystem.update(500, 500);
      expect(portalSystem.isNearPortal()).toBe(false);
    });
  });

  describe('Portal Activation', () => {
    it('should activate an enabled portal', () => {
      const handler = vi.fn();
      portalSystem.on('portalActivated', handler);

      const portal: Portal = {
        id: 'test-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
        metadata: { testData: 'value' },
      };

      portalSystem.registerPortal(portal);
      // Use the registered portal which has enabled: true set by registerPortal
      const registeredPortal = portalSystem.getPortal('test-portal')!;
      portalSystem.activatePortal(registeredPortal);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          targetScene: 'TestScene',
          targetPosition: { x: 50, y: 50 },
          metadata: { testData: 'value' },
        })
      );
    });

    it('should not activate a locked portal', () => {
      const activatedHandler = vi.fn();
      const lockedHandler = vi.fn();
      portalSystem.on('portalActivated', activatedHandler);
      portalSystem.on('portalLocked', lockedHandler);

      const portal: Portal = {
        id: 'locked-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
        requiresKey: 'golden_key',
      };

      portalSystem.registerPortal(portal);
      portalSystem.activatePortal(portal);

      expect(activatedHandler).not.toHaveBeenCalled();
      expect(lockedHandler).toHaveBeenCalledWith(portal);
    });

    it('should not activate a disabled portal', () => {
      const handler = vi.fn();
      portalSystem.on('portalActivated', handler);

      const portal: Portal = {
        id: 'disabled-portal',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
        enabled: false,
      };

      portalSystem.registerPortal(portal);
      portalSystem.activatePortal(portal);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should trigger portal by ID', () => {
      const handler = vi.fn();
      portalSystem.on('portalActivated', handler);

      portalSystem.registerPortal({
        id: 'trigger-test',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'exit',
      });

      portalSystem.triggerPortal('trigger-test');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          targetScene: 'TestScene',
        })
      );
    });
  });

  describe('Portal Updates', () => {
    it('should update portal properties', () => {
      const handler = vi.fn();
      portalSystem.on('portalUpdated', handler);

      portalSystem.registerPortal({
        id: 'update-test',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
      });

      portalSystem.updatePortal('update-test', {
        targetScene: 'NewScene',
        position: { x: 200, y: 200 },
      });

      const updated = portalSystem.getPortal('update-test');
      expect(updated?.targetScene).toBe('NewScene');
      expect(updated?.position).toEqual({ x: 200, y: 200 });
      expect(handler).toHaveBeenCalled();
    });

    it('should enable and disable portals', () => {
      portalSystem.registerPortal({
        id: 'toggle-test',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'room-door',
      });

      portalSystem.setPortalEnabled('toggle-test', false);
      expect(portalSystem.getPortal('toggle-test')?.enabled).toBe(false);

      portalSystem.setPortalEnabled('toggle-test', true);
      expect(portalSystem.getPortal('toggle-test')?.enabled).toBe(true);
    });
  });

  describe('Portal Queries', () => {
    beforeEach(() => {
      portalSystem.registerPortal({
        id: 'entrance-1',
        position: { x: 100, y: 100 },
        targetScene: 'Scene1',
        targetPosition: { x: 0, y: 0 },
        doorType: 'building-entrance',
      });

      portalSystem.registerPortal({
        id: 'entrance-2',
        position: { x: 200, y: 100 },
        targetScene: 'Scene2',
        targetPosition: { x: 0, y: 0 },
        doorType: 'building-entrance',
      });

      portalSystem.registerPortal({
        id: 'room-door-1',
        position: { x: 300, y: 100 },
        targetScene: 'Scene3',
        targetPosition: { x: 0, y: 0 },
        doorType: 'room-door',
      });

      portalSystem.registerPortal({
        id: 'exit-1',
        position: { x: 400, y: 100 },
        targetScene: 'Scene4',
        targetPosition: { x: 0, y: 0 },
        doorType: 'exit',
      });
    });

    it('should get all portals', () => {
      const allPortals = portalSystem.getAllPortals();
      expect(allPortals).toHaveLength(4);
    });

    it('should get portals by type', () => {
      const entrances = portalSystem.getPortalsByType('building-entrance');
      expect(entrances).toHaveLength(2);
      expect(entrances.every((p) => p.doorType === 'building-entrance')).toBe(true);

      const roomDoors = portalSystem.getPortalsByType('room-door');
      expect(roomDoors).toHaveLength(1);

      const exits = portalSystem.getPortalsByType('exit');
      expect(exits).toHaveLength(1);
    });

    it('should get nearby portal', () => {
      portalSystem.update(110, 110);
      const nearby = portalSystem.getNearbyPortal();
      expect(nearby).not.toBeNull();
      expect(nearby?.id).toBe('entrance-1');
    });
  });

  describe('Door Animations', () => {
    it('should emit door opened event when player approaches', async () => {
      const handler = vi.fn();
      portalSystem.on('doorOpened', handler);

      portalSystem.registerPortal({
        id: 'animated-door',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
      });

      // Move player near portal
      portalSystem.update(110, 110);

      await wait(50);
      expect(handler).toHaveBeenCalledWith('animated-door');
    });

    it('should emit door closed event when player leaves', async () => {
      const handler = vi.fn();
      portalSystem.on('doorClosed', handler);

      portalSystem.registerPortal({
        id: 'animated-door',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
      });

      // Move player near portal
      portalSystem.update(110, 110);
      await wait(50);

      // Move player away
      portalSystem.update(500, 500);
      await wait(50);

      expect(handler).toHaveBeenCalledWith('animated-door');
    });
  });

  describe('Cleanup', () => {
    it('should clean up all resources on destroy', () => {
      portalSystem.registerPortal({
        id: 'cleanup-test',
        position: { x: 100, y: 100 },
        targetScene: 'TestScene',
        targetPosition: { x: 50, y: 50 },
        doorType: 'building-entrance',
      });

      expect(portalSystem.getAllPortals()).toHaveLength(1);

      portalSystem.destroy();

      expect(portalSystem.getAllPortals()).toHaveLength(0);
    });

    it('should remove all event listeners on destroy', () => {
      const handler = vi.fn();
      portalSystem.on('portalActivated', handler);

      portalSystem.destroy();

      // Try to emit event after destroy
      portalSystem.emit('portalActivated', {});

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

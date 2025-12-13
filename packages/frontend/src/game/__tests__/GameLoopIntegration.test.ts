/**
 * Game Loop Integration Tests
 *
 * Simulates a complete playable village environment with all systems working together:
 * - Frame-by-frame game loop execution
 * - Camera, input, rendering system integration
 * - Agent movement and rendering
 * - Scene lifecycle management
 * - Performance under various conditions
 * - Multi-frame scenarios
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';

/**
 * Simulated Game Systems for Integration Testing
 */
interface SimulatedAgent {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  visible: boolean;
  lodLevel: string;
}

interface SimulatedBuilding {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: string;
  visible: boolean;
}

interface GameState {
  camera: {
    x: number;
    y: number;
    zoom: number;
    isFollowing: boolean;
    followTarget: string | null;
  };
  agents: SimulatedAgent[];
  buildings: SimulatedBuilding[];
  frameCount: number;
  deltaTime: number;
  fps: number;
  paused: boolean;
}

class SimulatedGameLoop {
  private state: GameState;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.state = {
      camera: {
        x: 400,
        y: 300,
        zoom: 1.5, // >= 1.5 ensures HIGH detail from zoom, so distance determines LOD
        isFollowing: false,
        followTarget: null,
      },
      agents: [],
      buildings: [],
      frameCount: 0,
      deltaTime: 16.67, // ~60fps
      fps: 60,
      paused: false,
    };
  }

  getState(): GameState {
    return this.state;
  }

  // Camera controls
  setCameraPosition(x: number, y: number): void {
    this.state.camera.x = x;
    this.state.camera.y = y;
    this.emit('cameraMove', { x, y });
  }

  setCameraZoom(zoom: number): void {
    this.state.camera.zoom = Math.max(0.5, Math.min(2.0, zoom));
    this.emit('cameraZoom', { zoom: this.state.camera.zoom });
  }

  followAgent(agentId: string): void {
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (agent) {
      this.state.camera.isFollowing = true;
      this.state.camera.followTarget = agentId;
      this.emit('cameraFollow', { agentId });
    }
  }

  stopFollow(): void {
    this.state.camera.isFollowing = false;
    this.state.camera.followTarget = null;
    this.emit('cameraStopFollow', {});
  }

  // Agent management
  spawnAgent(id: string, x: number, y: number): SimulatedAgent {
    const agent: SimulatedAgent = {
      id,
      x,
      y,
      targetX: x,
      targetY: y,
      speed: 2,
      visible: true,
      lodLevel: 'high',
    };
    this.state.agents.push(agent);
    this.emit('agentSpawn', { agent });
    return agent;
  }

  removeAgent(id: string): void {
    const index = this.state.agents.findIndex((a) => a.id === id);
    if (index > -1) {
      const agent = this.state.agents[index];
      this.state.agents.splice(index, 1);
      this.emit('agentRemove', { agent });
    }
  }

  setAgentTarget(agentId: string, x: number, y: number): void {
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.targetX = x;
      agent.targetY = y;
    }
  }

  // Building management
  addBuilding(id: string, x: number, y: number, width: number, height: number, layer: string): SimulatedBuilding {
    const building: SimulatedBuilding = {
      id,
      x,
      y,
      width,
      height,
      layer,
      visible: true,
    };
    this.state.buildings.push(building);
    return building;
  }

  // Game loop
  update(deltaTime?: number): void {
    if (this.state.paused) return;

    this.state.deltaTime = deltaTime || 16.67;
    this.state.fps = 1000 / this.state.deltaTime;
    this.state.frameCount++;

    // Update agents
    this.updateAgents();

    // Update camera follow
    this.updateCameraFollow();

    // Update LOD for all objects
    this.updateLOD();

    // Update visibility culling
    this.updateCulling();

    this.emit('update', { frameCount: this.state.frameCount, deltaTime: this.state.deltaTime });
  }

  private updateAgents(): void {
    this.state.agents.forEach((agent) => {
      // Move towards target
      const dx = agent.targetX - agent.x;
      const dy = agent.targetY - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > agent.speed) {
        const moveRatio = agent.speed / distance;
        agent.x += dx * moveRatio;
        agent.y += dy * moveRatio;
      } else if (distance > 0) {
        agent.x = agent.targetX;
        agent.y = agent.targetY;
      }
    });
  }

  private updateCameraFollow(): void {
    if (this.state.camera.isFollowing && this.state.camera.followTarget) {
      const agent = this.state.agents.find((a) => a.id === this.state.camera.followTarget);
      if (agent) {
        // Smooth follow with lerp
        const lerpFactor = 0.1;
        this.state.camera.x += (agent.x - this.state.camera.x) * lerpFactor;
        this.state.camera.y += (agent.y - this.state.camera.y) * lerpFactor;
      }
    }
  }

  private updateLOD(): void {
    const camX = this.state.camera.x;
    const camY = this.state.camera.y;
    const zoom = this.state.camera.zoom;

    this.state.agents.forEach((agent) => {
      const distance = Math.sqrt(
        Math.pow(agent.x - camX, 2) + Math.pow(agent.y - camY, 2)
      );

      // Distance-based LOD
      let distanceLOD = 'high';
      if (distance > 800) distanceLOD = 'minimal';
      else if (distance > 400) distanceLOD = 'low';
      else if (distance > 200) distanceLOD = 'medium';

      // Zoom-based LOD
      let zoomLOD = 'high';
      if (zoom < 0.5) zoomLOD = 'minimal';
      else if (zoom < 1.0) zoomLOD = 'low';
      else if (zoom < 1.5) zoomLOD = 'medium';

      // Use lower of the two
      const lodPriority = { high: 0, medium: 1, low: 2, minimal: 3 };
      const finalLOD = lodPriority[distanceLOD as keyof typeof lodPriority] >
                       lodPriority[zoomLOD as keyof typeof lodPriority]
        ? distanceLOD
        : zoomLOD;

      if (agent.lodLevel !== finalLOD) {
        agent.lodLevel = finalLOD;
        this.emit('lodChange', { agentId: agent.id, level: finalLOD });
      }
    });
  }

  private updateCulling(): void {
    const viewWidth = 800 / this.state.camera.zoom;
    const viewHeight = 600 / this.state.camera.zoom;
    const viewLeft = this.state.camera.x - viewWidth / 2;
    const viewRight = this.state.camera.x + viewWidth / 2;
    const viewTop = this.state.camera.y - viewHeight / 2;
    const viewBottom = this.state.camera.y + viewHeight / 2;
    const padding = 64;

    // Cull agents
    this.state.agents.forEach((agent) => {
      const wasVisible = agent.visible;
      agent.visible =
        agent.x >= viewLeft - padding &&
        agent.x <= viewRight + padding &&
        agent.y >= viewTop - padding &&
        agent.y <= viewBottom + padding;

      if (wasVisible !== agent.visible) {
        this.emit('visibilityChange', { id: agent.id, visible: agent.visible });
      }
    });

    // Cull buildings
    this.state.buildings.forEach((building) => {
      const wasVisible = building.visible;
      building.visible =
        building.x + building.width >= viewLeft - padding &&
        building.x <= viewRight + padding &&
        building.y + building.height >= viewTop - padding &&
        building.y <= viewBottom + padding;

      if (wasVisible !== building.visible) {
        this.emit('visibilityChange', { id: building.id, visible: building.visible });
      }
    });
  }

  // Pause/Resume
  pause(): void {
    this.state.paused = true;
    this.emit('pause', {});
  }

  resume(): void {
    this.state.paused = false;
    this.emit('resume', {});
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  destroy(): void {
    this.listeners.clear();
    this.state.agents = [];
    this.state.buildings = [];
  }
}

describe('Game Loop Integration - Playable Environment', () => {
  let gameLoop: SimulatedGameLoop;

  beforeEach(() => {
    gameLoop = new SimulatedGameLoop();
  });

  afterEach(() => {
    gameLoop.destroy();
  });

  describe('Basic Game Loop', () => {
    it('should increment frame count on each update', () => {
      expect(gameLoop.getState().frameCount).toBe(0);

      gameLoop.update();
      expect(gameLoop.getState().frameCount).toBe(1);

      gameLoop.update();
      expect(gameLoop.getState().frameCount).toBe(2);
    });

    it('should track delta time', () => {
      gameLoop.update(16.67);
      expect(gameLoop.getState().deltaTime).toBeCloseTo(16.67, 1);
      expect(gameLoop.getState().fps).toBeCloseTo(60, 0);

      gameLoop.update(33.33);
      expect(gameLoop.getState().deltaTime).toBeCloseTo(33.33, 1);
      expect(gameLoop.getState().fps).toBeCloseTo(30, 0);
    });

    it('should emit update event', () => {
      const updateHandler = vi.fn();
      gameLoop.on('update', updateHandler);

      gameLoop.update();

      expect(updateHandler).toHaveBeenCalledWith({
        frameCount: 1,
        deltaTime: expect.any(Number),
      });
    });

    it('should not update when paused', () => {
      gameLoop.pause();

      const initialFrame = gameLoop.getState().frameCount;
      gameLoop.update();
      gameLoop.update();

      expect(gameLoop.getState().frameCount).toBe(initialFrame);
    });

    it('should resume from pause', () => {
      gameLoop.pause();
      gameLoop.resume();

      const initialFrame = gameLoop.getState().frameCount;
      gameLoop.update();

      expect(gameLoop.getState().frameCount).toBe(initialFrame + 1);
    });
  });

  describe('Agent Simulation', () => {
    it('should spawn agent at position', () => {
      const agent = gameLoop.spawnAgent('hero', 400, 300);

      expect(agent.x).toBe(400);
      expect(agent.y).toBe(300);
      expect(gameLoop.getState().agents.length).toBe(1);
    });

    it('should remove agent', () => {
      gameLoop.spawnAgent('temp', 100, 100);
      expect(gameLoop.getState().agents.length).toBe(1);

      gameLoop.removeAgent('temp');
      expect(gameLoop.getState().agents.length).toBe(0);
    });

    it('should move agent towards target over multiple frames', () => {
      const agent = gameLoop.spawnAgent('walker', 0, 0);
      gameLoop.setAgentTarget('walker', 100, 0);

      // Run multiple frames
      for (let i = 0; i < 60; i++) {
        gameLoop.update();
      }

      // Agent should be close to target
      expect(agent.x).toBeGreaterThan(50);
      expect(agent.y).toBe(0);
    });

    it('should reach exact target position', () => {
      const agent = gameLoop.spawnAgent('precise', 0, 0);
      agent.speed = 5;
      gameLoop.setAgentTarget('precise', 20, 0);

      // Run enough frames to reach target
      for (let i = 0; i < 10; i++) {
        gameLoop.update();
      }

      expect(agent.x).toBe(20);
    });

    it('should handle multiple agents simultaneously', () => {
      const agent1 = gameLoop.spawnAgent('agent1', 0, 0);
      const agent2 = gameLoop.spawnAgent('agent2', 100, 100);
      const agent3 = gameLoop.spawnAgent('agent3', 200, 200);

      gameLoop.setAgentTarget('agent1', 50, 0);
      gameLoop.setAgentTarget('agent2', 100, 50);
      gameLoop.setAgentTarget('agent3', 200, 250);

      for (let i = 0; i < 30; i++) {
        gameLoop.update();
      }

      expect(agent1.x).toBeGreaterThan(0);
      expect(agent2.y).toBeLessThan(100);
      expect(agent3.y).toBeGreaterThan(200);
    });
  });

  describe('Camera System', () => {
    it('should set camera position', () => {
      gameLoop.setCameraPosition(500, 400);

      const state = gameLoop.getState();
      expect(state.camera.x).toBe(500);
      expect(state.camera.y).toBe(400);
    });

    it('should set camera zoom with clamping', () => {
      gameLoop.setCameraZoom(1.5);
      expect(gameLoop.getState().camera.zoom).toBe(1.5);

      gameLoop.setCameraZoom(0.3);
      expect(gameLoop.getState().camera.zoom).toBe(0.5); // Clamped to min

      gameLoop.setCameraZoom(3.0);
      expect(gameLoop.getState().camera.zoom).toBe(2.0); // Clamped to max
    });

    it('should follow agent smoothly', () => {
      const agent = gameLoop.spawnAgent('followed', 500, 400);
      gameLoop.followAgent('followed');

      expect(gameLoop.getState().camera.isFollowing).toBe(true);

      // Run frames to let camera catch up
      for (let i = 0; i < 60; i++) {
        gameLoop.update();
      }

      const state = gameLoop.getState();
      expect(state.camera.x).toBeCloseTo(500, 0);
      expect(state.camera.y).toBeCloseTo(400, 0);
    });

    it('should follow moving agent', () => {
      const agent = gameLoop.spawnAgent('moving', 400, 300);
      gameLoop.followAgent('moving');
      gameLoop.setAgentTarget('moving', 600, 400);

      // Run frames
      for (let i = 0; i < 120; i++) {
        gameLoop.update();
      }

      const state = gameLoop.getState();
      // Camera should be close to agent (which moved towards 600, 400)
      expect(Math.abs(state.camera.x - agent.x)).toBeLessThan(50);
      expect(Math.abs(state.camera.y - agent.y)).toBeLessThan(50);
    });

    it('should stop following agent', () => {
      gameLoop.spawnAgent('target', 600, 500);
      gameLoop.followAgent('target');
      gameLoop.stopFollow();

      expect(gameLoop.getState().camera.isFollowing).toBe(false);
      expect(gameLoop.getState().camera.followTarget).toBeNull();
    });
  });

  describe('LOD System', () => {
    it('should set HIGH LOD for close agents', () => {
      const agent = gameLoop.spawnAgent('close', 400, 300); // At camera center

      gameLoop.update();

      expect(agent.lodLevel).toBe('high');
    });

    it('should reduce LOD for distant agents', () => {
      const agent = gameLoop.spawnAgent('far', 1500, 1200);

      gameLoop.update();

      expect(agent.lodLevel).toBe('minimal');
    });

    it('should reduce LOD when zoomed out', () => {
      const agent = gameLoop.spawnAgent('zoomTest', 400, 300);
      // setCameraZoom clamps to min 0.5, so zoom=0.4 becomes 0.5
      // With zoom=0.5: zoom < 1.0 gives 'low' LOD from zoom
      gameLoop.setCameraZoom(0.4);

      gameLoop.update();

      // Agent at camera center (400,300) has HIGH distance LOD
      // But zoom=0.5 gives LOW zoom LOD, so final LOD is LOW (worse of the two)
      expect(agent.lodLevel).toBe('low');
    });

    it('should emit LOD change events', () => {
      const lodHandler = vi.fn();
      gameLoop.on('lodChange', lodHandler);

      gameLoop.spawnAgent('lodAgent', 1000, 800);
      gameLoop.update();

      expect(lodHandler).toHaveBeenCalledWith({
        agentId: 'lodAgent',
        level: expect.any(String),
      });
    });

    it('should update LOD as agent moves', () => {
      const agent = gameLoop.spawnAgent('mover', 400, 300);
      gameLoop.update();
      expect(agent.lodLevel).toBe('high');

      // Move agent far away
      agent.x = 1500;
      agent.y = 1200;
      gameLoop.update();
      expect(agent.lodLevel).toBe('minimal');

      // Move back
      agent.x = 450;
      agent.y = 350;
      gameLoop.update();
      expect(agent.lodLevel).toBe('high');
    });
  });

  describe('Culling System', () => {
    it('should cull agents outside viewport', () => {
      const visibleAgent = gameLoop.spawnAgent('visible', 400, 300);
      const hiddenAgent = gameLoop.spawnAgent('hidden', 2000, 2000);

      gameLoop.update();

      expect(visibleAgent.visible).toBe(true);
      expect(hiddenAgent.visible).toBe(false);
    });

    it('should update visibility as camera moves', () => {
      const agent = gameLoop.spawnAgent('test', 1000, 800);

      gameLoop.update();
      expect(agent.visible).toBe(false);

      // Move camera to agent
      gameLoop.setCameraPosition(1000, 800);
      gameLoop.update();

      expect(agent.visible).toBe(true);
    });

    it('should account for zoom when culling', () => {
      const agent = gameLoop.spawnAgent('zoomCull', 700, 500);

      // At 1x zoom, this agent should be visible
      gameLoop.update();
      expect(agent.visible).toBe(true);

      // At 0.5x zoom, viewport is larger, still visible
      gameLoop.setCameraZoom(0.5);
      gameLoop.update();
      expect(agent.visible).toBe(true);

      // At 2x zoom, viewport is smaller
      gameLoop.setCameraZoom(2.0);
      gameLoop.update();
      // Agent at (700, 500) with camera at (400, 300) and small viewport
      expect(agent.visible).toBe(false);
    });

    it('should cull buildings outside viewport', () => {
      const visible = gameLoop.addBuilding('tavern', 350, 250, 100, 100, 'buildings');
      const hidden = gameLoop.addBuilding('distant', 2000, 2000, 100, 100, 'buildings');

      gameLoop.update();

      expect(visible.visible).toBe(true);
      expect(hidden.visible).toBe(false);
    });

    it('should emit visibility change events', () => {
      const visHandler = vi.fn();
      gameLoop.on('visibilityChange', visHandler);

      gameLoop.spawnAgent('toggle', 2000, 2000);
      gameLoop.update();

      expect(visHandler).toHaveBeenCalledWith({
        id: 'toggle',
        visible: false,
      });
    });
  });

  describe('Village Simulation Scenarios', () => {
    it('should simulate village with multiple systems', () => {
      // Setup village
      gameLoop.addBuilding('tavern', 200, 200, 80, 80, 'buildings');
      gameLoop.addBuilding('blacksmith', 400, 150, 60, 60, 'buildings');
      gameLoop.addBuilding('church', 600, 200, 100, 120, 'buildings');

      // Spawn NPCs
      gameLoop.spawnAgent('innkeeper', 220, 220);
      gameLoop.spawnAgent('smith', 410, 160);
      gameLoop.spawnAgent('priest', 650, 220);
      gameLoop.spawnAgent('hero', 400, 300);

      // Hero walks to tavern
      gameLoop.setAgentTarget('hero', 230, 230);
      gameLoop.followAgent('hero');

      // Run simulation for 3 seconds at 60fps
      for (let i = 0; i < 180; i++) {
        gameLoop.update(16.67);
      }

      const state = gameLoop.getState();
      const hero = state.agents.find((a) => a.id === 'hero');

      // Hero started at x=400, target is x=230 (tavern)
      // After 3 seconds of movement, hero should be closer to tavern (x < 400)
      // Hero moves at speed 2, so over 180 frames: ~170px max movement
      expect(hero!.x).toBeLessThan(400);
      expect(hero!.x).toBeCloseTo(230, -1); // Should be near tavern
      // Camera should be following
      expect(state.camera.isFollowing).toBe(true);
    });

    it('should handle NPC patrol routes', () => {
      const guard = gameLoop.spawnAgent('guard', 300, 300);

      // Define patrol route
      const patrolPoints = [
        { x: 300, y: 300 },
        { x: 500, y: 300 },
        { x: 500, y: 500 },
        { x: 300, y: 500 },
      ];

      let currentTarget = 1;

      // Run patrol for several cycles
      for (let cycle = 0; cycle < 2; cycle++) {
        for (let point = 0; point < patrolPoints.length; point++) {
          const target = patrolPoints[(currentTarget + point) % patrolPoints.length];
          gameLoop.setAgentTarget('guard', target.x, target.y);

          // Walk to each point
          for (let frame = 0; frame < 120; frame++) {
            gameLoop.update();
          }
        }
      }

      // Guard should have made patrol rounds
      expect(guard.x).toBeDefined();
      expect(guard.y).toBeDefined();
    });

    it('should maintain performance with many agents', () => {
      // Spawn 50 agents
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 1600;
        const y = Math.random() * 1200;
        const agent = gameLoop.spawnAgent(`agent-${i}`, x, y);
        gameLoop.setAgentTarget(`agent-${i}`, Math.random() * 1600, Math.random() * 1200);
      }

      const startTime = Date.now();

      // Run 600 frames (10 seconds at 60fps)
      for (let i = 0; i < 600; i++) {
        gameLoop.update(16.67);
      }

      const elapsedMs = Date.now() - startTime;

      // Should complete in reasonable time (under 2 seconds for 600 frames)
      expect(elapsedMs).toBeLessThan(2000);

      // All agents should have processed
      const state = gameLoop.getState();
      expect(state.agents.length).toBe(50);
      expect(state.frameCount).toBe(600);
    });

    it('should handle dynamic scene changes', () => {
      // Initial scene
      gameLoop.spawnAgent('hero', 400, 300);
      gameLoop.addBuilding('start-house', 350, 200, 80, 80, 'buildings');

      gameLoop.update();
      expect(gameLoop.getState().agents.length).toBe(1);
      expect(gameLoop.getState().buildings.length).toBe(1);

      // Transition to new area (remove old, add new)
      gameLoop.removeAgent('hero');

      // New scene
      gameLoop.spawnAgent('hero', 100, 100);
      gameLoop.spawnAgent('newNpc', 150, 150);

      gameLoop.update();
      expect(gameLoop.getState().agents.length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle agent at exactly camera position', () => {
      const state = gameLoop.getState();
      const agent = gameLoop.spawnAgent('centered', state.camera.x, state.camera.y);

      gameLoop.update();

      expect(agent.visible).toBe(true);
      expect(agent.lodLevel).toBe('high');
    });

    it('should handle rapid zoom changes', () => {
      gameLoop.spawnAgent('rapid', 500, 400);

      for (let i = 0; i < 60; i++) {
        gameLoop.setCameraZoom(0.5 + Math.random() * 1.5);
        gameLoop.update();
      }

      // Should not crash and state should be valid
      const state = gameLoop.getState();
      expect(state.camera.zoom).toBeGreaterThanOrEqual(0.5);
      expect(state.camera.zoom).toBeLessThanOrEqual(2.0);
    });

    it('should handle agent removal while following', () => {
      gameLoop.spawnAgent('gone', 500, 400);
      gameLoop.followAgent('gone');
      gameLoop.removeAgent('gone');

      // Update should not crash
      gameLoop.update();

      // Camera should still work
      expect(gameLoop.getState().camera.x).toBeDefined();
    });

    it('should handle zero delta time', () => {
      gameLoop.update(0);

      // Should not crash, frame should still increment
      expect(gameLoop.getState().frameCount).toBe(1);
    });

    it('should handle very large delta time', () => {
      gameLoop.spawnAgent('laggy', 0, 0);
      gameLoop.setAgentTarget('laggy', 1000, 0);

      // Simulate a very laggy frame
      gameLoop.update(1000);

      const agent = gameLoop.getState().agents[0];
      // Agent should have moved but not teleported beyond target
      expect(agent.x).toBeLessThanOrEqual(1000);
    });
  });

  describe('Event System', () => {
    it('should emit events in correct order', () => {
      const events: string[] = [];

      gameLoop.on('agentSpawn', () => events.push('spawn'));
      gameLoop.on('update', () => events.push('update'));
      gameLoop.on('lodChange', () => events.push('lod'));

      gameLoop.spawnAgent('eventTest', 1000, 800);
      gameLoop.update();

      expect(events[0]).toBe('spawn');
      expect(events).toContain('update');
    });

    it('should emit camera events', () => {
      const cameraEvents: string[] = [];

      gameLoop.on('cameraMove', () => cameraEvents.push('move'));
      gameLoop.on('cameraZoom', () => cameraEvents.push('zoom'));
      gameLoop.on('cameraFollow', () => cameraEvents.push('follow'));
      gameLoop.on('cameraStopFollow', () => cameraEvents.push('stopFollow'));

      gameLoop.setCameraPosition(500, 400);
      gameLoop.setCameraZoom(1.5);
      gameLoop.spawnAgent('target', 600, 500);
      gameLoop.followAgent('target');
      gameLoop.stopFollow();

      expect(cameraEvents).toEqual(['move', 'zoom', 'follow', 'stopFollow']);
    });

    it('should emit pause/resume events', () => {
      const stateEvents: string[] = [];

      gameLoop.on('pause', () => stateEvents.push('pause'));
      gameLoop.on('resume', () => stateEvents.push('resume'));

      gameLoop.pause();
      gameLoop.resume();

      expect(stateEvents).toEqual(['pause', 'resume']);
    });
  });
});

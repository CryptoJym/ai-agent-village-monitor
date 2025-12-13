# Agent Behavior System Specification

> Version 2.0 | December 2025
> Detailed technical specification for AI agent behavior modeling using XState v5 and Yuka.js

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [State Machine Definition](#state-machine-definition)
4. [Steering Behaviors](#steering-behaviors)
5. [Emote System](#emote-system)
6. [Animation Controller](#animation-controller)
7. [Work Stream Integration](#work-stream-integration)
8. [Multiplayer Synchronization](#multiplayer-synchronization)
9. [Performance Optimization](#performance-optimization)
10. [Implementation Guide](#implementation-guide)

---

## Overview

### Purpose

The Agent Behavior System creates believable, responsive AI agents that visually reflect their actual cognitive states. Agents don't just walk randomly - their movements, expressions, and behaviors are directly driven by real work activity from GitHub events, terminal output, and MCP interactions.

### Design Philosophy

```
Reality → Cognition → Behavior → Animation → Display

┌─────────────────┐    ┌───────────────┐    ┌────────────────┐
│  Work Streams   │───▶│  State Machine │───▶│  Steering      │
│  (GitHub, MCP)  │    │  (XState v5)   │    │  (Yuka.js)     │
└─────────────────┘    └───────────────┘    └────────────────┘
                              │                      │
                              ▼                      ▼
                       ┌────────────┐        ┌────────────────┐
                       │  Emotes    │        │  Animation     │
                       │  System    │        │  Controller    │
                       └────────────┘        └────────────────┘
```

### Key Principles

1. **Reality-Driven**: All behaviors stem from actual work events
2. **Deterministic**: Same input sequence produces same behavior
3. **Responsive**: State changes within 100ms of triggering event
4. **Expressive**: Rich visual vocabulary for cognitive states
5. **Efficient**: Batch updates, spatial culling, LOD support

---

## Core Architecture

### System Components

```typescript
// packages/frontend/src/agents/AgentBehaviorSystem.ts

import { createActor, createMachine } from 'xstate';
import { Vehicle, SteeringBehavior, Vector3 } from 'yuka';

export interface AgentBehaviorSystem {
  // Core components
  stateMachine: AgentStateMachine;
  steeringController: SteeringController;
  emoteManager: EmoteManager;
  animationController: AnimationController;

  // Integration
  workStreamAdapter: WorkStreamAdapter;
  networkSync: NetworkSyncAdapter;

  // Update loop
  update(deltaTime: number): void;

  // Event handlers
  onWorkEvent(event: WorkEvent): void;
  onNetworkUpdate(update: NetworkUpdate): void;
}

export interface AgentContext {
  // Identity
  agentId: string;
  houseId: string;
  currentRoomId: string;

  // Position (Yuka uses Vector3, we convert to 2D)
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  heading: number; // radians

  // Cognitive state
  workload: number;         // 0-100, derived from event frequency
  frustration: number;      // 0-100, derived from errors/retries
  focus: number;            // 0-100, time in flow state
  energy: number;           // 0-100, decreases with activity

  // Work context
  currentTask: TaskContext | null;
  recentEvents: WorkEvent[];
  errorStreak: number;
  successStreak: number;

  // Movement
  targetPosition: { x: number; y: number } | null;
  wanderTarget: { x: number; y: number } | null;
  pathToFollow: { x: number; y: number }[] | null;

  // Timers
  lastActivityTime: number;
  stateEnteredAt: number;
  idleSince: number | null;
}

export interface TaskContext {
  id: string;
  type: 'commit' | 'pr' | 'issue' | 'review' | 'build' | 'test' | 'deploy';
  description: string;
  startedAt: number;
  files: string[];
  complexity: number; // 1-10
}
```

### Agent Entity (Yuka Vehicle)

```typescript
// packages/frontend/src/agents/AgentVehicle.ts

import { Vehicle, Vector3, GameEntity, SteeringManager } from 'yuka';

export class AgentVehicle extends Vehicle {
  agentId: string;
  behaviorSystem: AgentBehaviorSystem;

  // Yuka properties (inherited)
  // position: Vector3
  // velocity: Vector3
  // maxSpeed: number
  // maxForce: number
  // mass: number

  // Custom properties
  currentRoom: string;
  isIndoors: boolean;
  canPassThroughDoors: boolean;

  constructor(agentId: string) {
    super();
    this.agentId = agentId;

    // Configure vehicle properties
    this.maxSpeed = 100;           // pixels per second
    this.maxForce = 200;           // steering force limit
    this.mass = 1;                 // affects acceleration
    this.boundingRadius = 16;      // collision radius

    // Smoother movement
    this.smoother = new Smoother(10);
  }

  update(delta: number): this {
    // Update Yuka vehicle physics
    super.update(delta);

    // Sync with behavior system
    this.behaviorSystem.syncPosition(this.position);

    return this;
  }

  // Convert Yuka Vector3 to 2D for Phaser
  get position2D(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.z };
  }
}
```

---

## State Machine Definition

### Primary States

The agent state machine uses XState v5's actor model for clean, predictable state management.

```typescript
// packages/frontend/src/agents/stateMachine/agentMachine.ts

import { setup, assign, fromPromise } from 'xstate';

// State definitions
export type AgentState =
  | 'idle'
  | 'working'
  | 'thinking'
  | 'frustrated'
  | 'celebrating'
  | 'resting'
  | 'socializing'
  | 'traveling'
  | 'observing';

// Event definitions
export type AgentEvent =
  | { type: 'WORK_STARTED'; task: TaskContext }
  | { type: 'WORK_COMPLETED'; task: TaskContext; success: boolean }
  | { type: 'WORK_PROGRESS'; progress: number; details?: string }
  | { type: 'ERROR_OCCURRED'; error: ErrorContext }
  | { type: 'ERROR_RESOLVED' }
  | { type: 'IDLE_TIMEOUT' }
  | { type: 'ENERGY_LOW' }
  | { type: 'ENERGY_RESTORED' }
  | { type: 'AGENT_NEARBY'; agentId: string }
  | { type: 'AGENT_LEFT'; agentId: string }
  | { type: 'NAVIGATE_TO'; target: { x: number; y: number }; roomId?: string }
  | { type: 'ARRIVED' }
  | { type: 'INTERESTING_EVENT'; source: string; details: any }
  | { type: 'TICK'; deltaTime: number };

export const agentMachine = setup({
  types: {
    context: {} as AgentContext,
    events: {} as AgentEvent,
  },

  guards: {
    isHighFrustration: ({ context }) => context.frustration > 70,
    isLowEnergy: ({ context }) => context.energy < 20,
    hasTarget: ({ context }) => context.targetPosition !== null,
    isAtTarget: ({ context }) => {
      if (!context.targetPosition) return true;
      const dx = context.position.x - context.targetPosition.x;
      const dy = context.position.y - context.targetPosition.y;
      return Math.sqrt(dx * dx + dy * dy) < 10;
    },
    hasNearbyAgents: ({ context }) => context.nearbyAgents.length > 0,
    shouldRest: ({ context }) =>
      context.energy < 30 && Date.now() - context.stateEnteredAt > 60000,
    canCelebrate: ({ context }) =>
      context.successStreak >= 3 || context.currentTask?.complexity >= 7,
  },

  actions: {
    updatePosition: assign({
      position: ({ context, event }) => {
        if (event.type === 'TICK') {
          // Position updated by Yuka, just sync
          return context.position;
        }
        return context.position;
      }
    }),

    setTarget: assign({
      targetPosition: ({ event }) => {
        if (event.type === 'NAVIGATE_TO') {
          return event.target;
        }
        return null;
      }
    }),

    clearTarget: assign({
      targetPosition: null,
      pathToFollow: null,
    }),

    startTask: assign({
      currentTask: ({ event }) => {
        if (event.type === 'WORK_STARTED') {
          return event.task;
        }
        return null;
      },
      stateEnteredAt: () => Date.now(),
      focus: 50,
    }),

    completeTask: assign({
      currentTask: null,
      successStreak: ({ context, event }) => {
        if (event.type === 'WORK_COMPLETED' && event.success) {
          return context.successStreak + 1;
        }
        return 0;
      },
      errorStreak: ({ context, event }) => {
        if (event.type === 'WORK_COMPLETED' && !event.success) {
          return context.errorStreak + 1;
        }
        return 0;
      },
    }),

    increaseFrustration: assign({
      frustration: ({ context }) => Math.min(100, context.frustration + 15),
      errorStreak: ({ context }) => context.errorStreak + 1,
    }),

    decreaseFrustration: assign({
      frustration: ({ context }) => Math.max(0, context.frustration - 10),
    }),

    increaseEnergy: assign({
      energy: ({ context }) => Math.min(100, context.energy + 20),
    }),

    decreaseEnergy: assign({
      energy: ({ context }) => Math.max(0, context.energy - 5),
    }),

    recordActivity: assign({
      lastActivityTime: () => Date.now(),
      idleSince: null,
    }),

    startIdle: assign({
      idleSince: () => Date.now(),
    }),

    triggerEmote: ({ context }, params: { emote: EmoteType }) => {
      // Side effect - emit event for emote system
      context.emoteManager?.show(params.emote);
    },

    updateWorkload: assign({
      workload: ({ context }) => {
        // Calculate based on recent event frequency
        const recentCount = context.recentEvents.filter(
          e => Date.now() - e.timestamp < 60000
        ).length;
        return Math.min(100, recentCount * 10);
      }
    }),
  },

  delays: {
    IDLE_TIMEOUT: 30000,        // 30 seconds before idle wander
    THINK_DURATION: 2000,       // 2 seconds of thinking animation
    CELEBRATE_DURATION: 3000,   // 3 seconds of celebration
    REST_DURATION: 10000,       // 10 seconds of rest
    SOCIALIZE_DURATION: 5000,   // 5 seconds of social interaction
  },
}).createMachine({
  id: 'agent',
  initial: 'idle',
  context: ({ input }) => ({
    agentId: input.agentId,
    houseId: input.houseId,
    currentRoomId: input.currentRoomId ?? 'main',
    position: input.position ?? { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    workload: 0,
    frustration: 0,
    focus: 50,
    energy: 100,
    currentTask: null,
    recentEvents: [],
    errorStreak: 0,
    successStreak: 0,
    targetPosition: null,
    wanderTarget: null,
    pathToFollow: null,
    lastActivityTime: Date.now(),
    stateEnteredAt: Date.now(),
    idleSince: null,
    nearbyAgents: [],
  }),

  states: {
    idle: {
      entry: ['startIdle'],
      after: {
        IDLE_TIMEOUT: [
          { guard: 'shouldRest', target: 'resting' },
          { target: 'observing' },
        ],
      },
      on: {
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask', 'recordActivity'],
        },
        NAVIGATE_TO: {
          target: 'traveling',
          actions: ['setTarget'],
        },
        AGENT_NEARBY: {
          guard: 'hasNearbyAgents',
          target: 'socializing',
        },
        INTERESTING_EVENT: {
          target: 'observing',
        },
      },
    },

    working: {
      entry: [
        { type: 'triggerEmote', params: { emote: 'working' } },
        'decreaseEnergy',
      ],
      on: {
        WORK_COMPLETED: [
          {
            guard: 'canCelebrate',
            target: 'celebrating',
            actions: ['completeTask'],
          },
          {
            target: 'idle',
            actions: ['completeTask'],
          },
        ],
        WORK_PROGRESS: {
          actions: ['recordActivity', 'updateWorkload'],
        },
        ERROR_OCCURRED: [
          {
            guard: 'isHighFrustration',
            target: 'frustrated',
            actions: ['increaseFrustration'],
          },
          {
            target: 'thinking',
            actions: ['increaseFrustration'],
          },
        ],
        ENERGY_LOW: {
          guard: 'isLowEnergy',
          target: 'resting',
        },
        TICK: {
          actions: ['updatePosition', 'decreaseEnergy'],
        },
      },
    },

    thinking: {
      entry: [
        { type: 'triggerEmote', params: { emote: 'thinking' } },
      ],
      after: {
        THINK_DURATION: 'working',
      },
      on: {
        ERROR_RESOLVED: {
          target: 'working',
          actions: ['decreaseFrustration'],
        },
        ERROR_OCCURRED: {
          guard: 'isHighFrustration',
          target: 'frustrated',
          actions: ['increaseFrustration'],
        },
      },
    },

    frustrated: {
      entry: [
        { type: 'triggerEmote', params: { emote: 'frustrated' } },
      ],
      on: {
        ERROR_RESOLVED: {
          target: 'working',
          actions: ['decreaseFrustration', 'decreaseFrustration'],
        },
        IDLE_TIMEOUT: {
          target: 'resting',
        },
        WORK_COMPLETED: {
          target: 'idle',
          actions: ['completeTask', 'decreaseFrustration'],
        },
      },
      after: {
        // Auto-calm down after 10 seconds
        10000: {
          target: 'thinking',
          actions: ['decreaseFrustration'],
        },
      },
    },

    celebrating: {
      entry: [
        { type: 'triggerEmote', params: { emote: 'celebrating' } },
        'increaseEnergy',
      ],
      after: {
        CELEBRATE_DURATION: 'idle',
      },
      on: {
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
      },
    },

    resting: {
      entry: [
        { type: 'triggerEmote', params: { emote: 'resting' } },
      ],
      after: {
        REST_DURATION: {
          target: 'idle',
          actions: ['increaseEnergy', 'increaseEnergy'],
        },
      },
      on: {
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask', 'increaseEnergy'],
        },
        ENERGY_RESTORED: {
          target: 'idle',
        },
      },
    },

    socializing: {
      entry: [
        { type: 'triggerEmote', params: { emote: 'waving' } },
      ],
      after: {
        SOCIALIZE_DURATION: 'idle',
      },
      on: {
        AGENT_LEFT: {
          target: 'idle',
        },
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
      },
    },

    traveling: {
      entry: ['recordActivity'],
      always: [
        {
          guard: 'isAtTarget',
          target: 'idle',
          actions: ['clearTarget'],
        },
      ],
      on: {
        ARRIVED: {
          target: 'idle',
          actions: ['clearTarget'],
        },
        NAVIGATE_TO: {
          actions: ['setTarget'],
        },
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask', 'clearTarget'],
        },
        TICK: {
          actions: ['updatePosition'],
        },
      },
    },

    observing: {
      entry: [
        { type: 'triggerEmote', params: { emote: 'curious' } },
      ],
      on: {
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
        INTERESTING_EVENT: {
          // Stay observing, refresh timer
          target: 'observing',
          reenter: true,
        },
        IDLE_TIMEOUT: {
          target: 'idle',
        },
      },
      after: {
        5000: 'idle',
      },
    },
  },
});

// Create actor factory
export function createAgentActor(input: {
  agentId: string;
  houseId: string;
  currentRoomId?: string;
  position?: { x: number; y: number };
}) {
  return createActor(agentMachine, { input });
}
```

### State Diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                       │
                    ▼                                                       │
              ┌──────────┐                                                  │
     ┌───────▶│   IDLE   │◀─────────────────────────────────┐              │
     │        └────┬─────┘                                   │              │
     │             │                                         │              │
     │   ┌─────────┼─────────┬──────────┬──────────┐        │              │
     │   │         │         │          │          │        │              │
     │   ▼         ▼         ▼          ▼          ▼        │              │
     │ ┌────┐  ┌───────┐  ┌─────┐  ┌────────┐  ┌───────┐    │              │
     │ │REST│  │TRAVEL │  │SOCIAL│ │OBSERVE │  │ WORK  │────┼──────────────┤
     │ └─┬──┘  └───┬───┘  └──┬──┘  └───┬────┘  └───┬───┘    │              │
     │   │         │         │         │           │        │              │
     │   │         │         │         │           │        │              │
     │   └─────────┴─────────┴─────────┘           │        │              │
     │                                             │        │              │
     │                                     ┌───────┴───────┐│              │
     │                                     │               ││              │
     │                                     ▼               ▼│              │
     │                                ┌─────────┐    ┌──────┴───┐          │
     │                                │ THINKING│───▶│FRUSTRATED│──────────┤
     │                                └────┬────┘    └──────────┘          │
     │                                     │                               │
     │                                     ▼                               │
     │                               ┌───────────┐                         │
     └───────────────────────────────│CELEBRATING│─────────────────────────┘
                                     └───────────┘
```

---

## Steering Behaviors

### Yuka.js Integration

```typescript
// packages/frontend/src/agents/steering/SteeringController.ts

import {
  Vehicle,
  SteeringBehavior,
  WanderBehavior,
  SeekBehavior,
  ArriveBehavior,
  ObstacleAvoidanceBehavior,
  SeparationBehavior,
  Vector3,
  Path,
  NavMesh,
} from 'yuka';

export class SteeringController {
  private vehicle: AgentVehicle;
  private behaviors: Map<string, SteeringBehavior> = new Map();
  private navMesh: NavMesh | null = null;

  // Behavior weights
  private weights = {
    wander: 0.3,
    seek: 1.0,
    arrive: 1.0,
    separation: 0.8,
    obstacleAvoidance: 1.5,
  };

  constructor(vehicle: AgentVehicle) {
    this.vehicle = vehicle;
    this.initializeBehaviors();
  }

  private initializeBehaviors(): void {
    // Wander - random movement when idle
    const wander = new WanderBehavior();
    wander.weight = this.weights.wander;
    wander.jitter = 50;        // randomness
    wander.radius = 30;        // wander circle radius
    wander.distance = 100;     // distance ahead
    this.behaviors.set('wander', wander);

    // Seek - move toward target
    const seek = new SeekBehavior();
    seek.weight = this.weights.seek;
    this.behaviors.set('seek', seek);

    // Arrive - slow down as approaching target
    const arrive = new ArriveBehavior();
    arrive.weight = this.weights.arrive;
    arrive.deceleration = 2;   // 1=slow, 2=normal, 3=fast
    this.behaviors.set('arrive', arrive);

    // Separation - avoid crowding other agents
    const separation = new SeparationBehavior();
    separation.weight = this.weights.separation;
    this.behaviors.set('separation', separation);

    // Obstacle Avoidance
    const obstacleAvoidance = new ObstacleAvoidanceBehavior();
    obstacleAvoidance.weight = this.weights.obstacleAvoidance;
    obstacleAvoidance.dBoxLength = 50;
    this.behaviors.set('obstacleAvoidance', obstacleAvoidance);

    // Add default behaviors to vehicle
    this.vehicle.steering.add(obstacleAvoidance);
    this.vehicle.steering.add(separation);
  }

  // State-specific behavior configurations
  configureForeState(state: AgentState): void {
    // Clear current behaviors (keep always-on ones)
    this.vehicle.steering.clear();
    this.vehicle.steering.add(this.behaviors.get('obstacleAvoidance')!);
    this.vehicle.steering.add(this.behaviors.get('separation')!);

    switch (state) {
      case 'idle':
        // Gentle wander
        this.configureWander(0.3, 30, 50);
        break;

      case 'working':
        // Stay mostly in place with slight movement
        this.configureWander(0.1, 10, 20);
        break;

      case 'thinking':
        // Pace back and forth
        this.configurePacing();
        break;

      case 'frustrated':
        // Erratic, faster movement
        this.configureWander(0.5, 60, 80);
        this.vehicle.maxSpeed = 150;
        break;

      case 'celebrating':
        // Bouncy, energetic movement
        this.configureBounce();
        break;

      case 'resting':
        // Stop moving
        this.vehicle.velocity.set(0, 0, 0);
        break;

      case 'socializing':
        // Face other agent, slight sway
        this.configureSocialPosition();
        break;

      case 'traveling':
        // Direct path following
        this.configurePathFollow();
        break;

      case 'observing':
        // Look around, minimal movement
        this.configureWander(0.1, 15, 30);
        break;
    }
  }

  private configureWander(weight: number, radius: number, distance: number): void {
    const wander = this.behaviors.get('wander') as WanderBehavior;
    wander.weight = weight;
    wander.radius = radius;
    wander.distance = distance;
    this.vehicle.steering.add(wander);
  }

  private configurePacing(): void {
    // Create a small path to pace along
    const pos = this.vehicle.position;
    const pacePath = new Path();
    pacePath.add(new Vector3(pos.x - 30, 0, pos.z));
    pacePath.add(new Vector3(pos.x + 30, 0, pos.z));
    pacePath.loop = true;

    const followPath = new FollowPathBehavior(pacePath);
    followPath.weight = 0.6;
    this.vehicle.steering.add(followPath);
  }

  private configureBounce(): void {
    // Circular celebration path
    const pos = this.vehicle.position;
    const celebratePath = new Path();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      celebratePath.add(new Vector3(
        pos.x + Math.cos(angle) * 20,
        0,
        pos.z + Math.sin(angle) * 20
      ));
    }
    celebratePath.loop = true;

    const followPath = new FollowPathBehavior(celebratePath);
    followPath.weight = 0.8;
    this.vehicle.steering.add(followPath);
    this.vehicle.maxSpeed = 180;
  }

  private configureSocialPosition(): void {
    // Minimal movement while socializing
    const wander = this.behaviors.get('wander') as WanderBehavior;
    wander.weight = 0.05;
    this.vehicle.steering.add(wander);
  }

  private configurePathFollow(): void {
    // Path following for travel
    if (this.vehicle.pathToFollow) {
      const followPath = new FollowPathBehavior(
        this.createPathFromPoints(this.vehicle.pathToFollow)
      );
      followPath.weight = 1.0;
      this.vehicle.steering.add(followPath);
    } else if (this.vehicle.targetPosition) {
      // Direct arrive
      const arrive = this.behaviors.get('arrive') as ArriveBehavior;
      arrive.target = new Vector3(
        this.vehicle.targetPosition.x,
        0,
        this.vehicle.targetPosition.y
      );
      this.vehicle.steering.add(arrive);
    }
  }

  // Navigation mesh for pathfinding
  setNavMesh(navMesh: NavMesh): void {
    this.navMesh = navMesh;
  }

  findPath(target: { x: number; y: number }): { x: number; y: number }[] | null {
    if (!this.navMesh) return null;

    const from = new Vector3(
      this.vehicle.position.x,
      0,
      this.vehicle.position.z
    );
    const to = new Vector3(target.x, 0, target.y);

    const path = this.navMesh.findPath(from, to);

    return path.map(p => ({ x: p.x, y: p.z }));
  }

  private createPathFromPoints(points: { x: number; y: number }[]): Path {
    const path = new Path();
    for (const p of points) {
      path.add(new Vector3(p.x, 0, p.y));
    }
    return path;
  }

  // Update called each frame
  update(deltaTime: number): void {
    // Yuka handles steering calculations internally
    // We just need to ensure proper behavior configuration
  }
}
```

### Behavior Configurations by State

| State | Wander | Seek | Arrive | Separation | Speed Modifier |
|-------|--------|------|--------|------------|----------------|
| idle | 0.3 | - | - | 0.8 | 1.0x |
| working | 0.1 | - | - | 0.8 | 0.5x |
| thinking | pace | - | - | 0.5 | 0.8x |
| frustrated | 0.5 | - | - | 0.3 | 1.5x |
| celebrating | bounce | - | - | 0.4 | 1.8x |
| resting | - | - | - | 1.0 | 0x |
| socializing | 0.05 | - | face | 0.6 | 0.3x |
| traveling | - | path | 1.0 | 0.8 | 1.2x |
| observing | 0.1 | - | - | 0.8 | 0.4x |

---

## Emote System

### Emote Types and Triggers

```typescript
// packages/frontend/src/agents/emotes/EmoteManager.ts

export type EmoteType =
  // Work states
  | 'working'         // Typing animation
  | 'thinking'        // Thought bubble with ?
  | 'eureka'          // Lightbulb moment
  | 'frustrated'      // Angry symbols (!)
  | 'confused'        // Question marks

  // Emotional states
  | 'happy'           // Smile
  | 'celebrating'     // Party/confetti
  | 'tired'           // Zzz
  | 'excited'         // Sparkles

  // Social
  | 'waving'          // Wave gesture
  | 'greeting'        // Hello bubble
  | 'curious'         // Looking around

  // Progress indicators
  | 'loading'         // Spinner
  | 'success'         // Checkmark
  | 'error'           // X mark
  | 'warning';        // Exclamation

export interface EmoteConfig {
  type: EmoteType;
  spriteKey: string;
  frames: number[];
  duration: number;      // ms, 0 for infinite
  loop: boolean;
  offsetY: number;       // Pixels above head
  scale: number;
  priority: number;      // Higher = interrupts lower
}

export const EMOTE_CONFIGS: Record<EmoteType, EmoteConfig> = {
  working: {
    type: 'working',
    spriteKey: 'emotes',
    frames: [0, 1, 2, 3],    // Typing dots animation
    duration: 0,              // Continuous while working
    loop: true,
    offsetY: -24,
    scale: 1.0,
    priority: 2,
  },
  thinking: {
    type: 'thinking',
    spriteKey: 'emotes',
    frames: [4, 5, 6, 7],    // Thought bubble
    duration: 2000,
    loop: true,
    offsetY: -28,
    scale: 1.0,
    priority: 3,
  },
  eureka: {
    type: 'eureka',
    spriteKey: 'emotes',
    frames: [8, 9, 10, 11],  // Lightbulb
    duration: 1500,
    loop: false,
    offsetY: -32,
    scale: 1.2,
    priority: 5,
  },
  frustrated: {
    type: 'frustrated',
    spriteKey: 'emotes',
    frames: [12, 13, 14, 15], // Anger marks
    duration: 0,
    loop: true,
    offsetY: -24,
    scale: 1.0,
    priority: 4,
  },
  confused: {
    type: 'confused',
    spriteKey: 'emotes',
    frames: [16, 17],        // ? marks
    duration: 2000,
    loop: true,
    offsetY: -28,
    scale: 1.0,
    priority: 3,
  },
  happy: {
    type: 'happy',
    spriteKey: 'emotes',
    frames: [20, 21, 22],    // Hearts/sparkles
    duration: 2000,
    loop: false,
    offsetY: -24,
    scale: 1.0,
    priority: 3,
  },
  celebrating: {
    type: 'celebrating',
    spriteKey: 'emotes',
    frames: [24, 25, 26, 27], // Confetti
    duration: 3000,
    loop: true,
    offsetY: -32,
    scale: 1.3,
    priority: 5,
  },
  tired: {
    type: 'tired',
    spriteKey: 'emotes',
    frames: [28, 29, 30],    // Zzz
    duration: 0,
    loop: true,
    offsetY: -20,
    scale: 1.0,
    priority: 1,
  },
  excited: {
    type: 'excited',
    spriteKey: 'emotes',
    frames: [32, 33, 34],    // Sparkles
    duration: 1500,
    loop: false,
    offsetY: -28,
    scale: 1.0,
    priority: 4,
  },
  waving: {
    type: 'waving',
    spriteKey: 'emotes',
    frames: [36, 37, 38],    // Hand wave
    duration: 1000,
    loop: false,
    offsetY: -20,
    scale: 1.0,
    priority: 3,
  },
  greeting: {
    type: 'greeting',
    spriteKey: 'emotes',
    frames: [40, 41],        // Speech bubble
    duration: 2000,
    loop: false,
    offsetY: -28,
    scale: 1.0,
    priority: 3,
  },
  curious: {
    type: 'curious',
    spriteKey: 'emotes',
    frames: [44, 45],        // Eye looking
    duration: 3000,
    loop: true,
    offsetY: -24,
    scale: 1.0,
    priority: 2,
  },
  loading: {
    type: 'loading',
    spriteKey: 'emotes',
    frames: [48, 49, 50, 51], // Spinner
    duration: 0,
    loop: true,
    offsetY: -24,
    scale: 0.8,
    priority: 1,
  },
  success: {
    type: 'success',
    spriteKey: 'emotes',
    frames: [52, 53, 54],    // Checkmark pop
    duration: 1500,
    loop: false,
    offsetY: -28,
    scale: 1.0,
    priority: 4,
  },
  error: {
    type: 'error',
    spriteKey: 'emotes',
    frames: [56, 57, 58],    // X pop
    duration: 2000,
    loop: false,
    offsetY: -28,
    scale: 1.0,
    priority: 4,
  },
  warning: {
    type: 'warning',
    spriteKey: 'emotes',
    frames: [60, 61],        // !
    duration: 2000,
    loop: true,
    offsetY: -24,
    scale: 1.0,
    priority: 3,
  },
};

export class EmoteManager {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private currentEmote: Phaser.GameObjects.Sprite | null = null;
  private currentConfig: EmoteConfig | null = null;
  private queue: EmoteType[] = [];
  private autoHideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    parent.add(this.container);
  }

  show(emoteType: EmoteType): void {
    const config = EMOTE_CONFIGS[emoteType];

    // Priority check
    if (this.currentConfig && this.currentConfig.priority > config.priority) {
      // Queue lower priority emote
      this.queue.push(emoteType);
      return;
    }

    // Clear current emote
    this.hide();

    // Create new emote sprite
    this.currentEmote = this.scene.add.sprite(0, config.offsetY, config.spriteKey);
    this.currentEmote.setScale(config.scale);

    // Play animation
    this.currentEmote.play({
      key: `emote_${emoteType}`,
      repeat: config.loop ? -1 : 0,
      frameRate: 8,
    });

    this.container.add(this.currentEmote);
    this.currentConfig = config;

    // Entry animation (pop in)
    this.currentEmote.setScale(0);
    this.scene.tweens.add({
      targets: this.currentEmote,
      scale: config.scale,
      duration: 150,
      ease: 'Back.easeOut',
    });

    // Auto-hide after duration
    if (config.duration > 0) {
      this.autoHideTimer = this.scene.time.delayedCall(
        config.duration,
        () => this.hide()
      );
    }
  }

  hide(): void {
    if (this.autoHideTimer) {
      this.autoHideTimer.destroy();
      this.autoHideTimer = null;
    }

    if (this.currentEmote) {
      // Exit animation (pop out)
      this.scene.tweens.add({
        targets: this.currentEmote,
        scale: 0,
        duration: 100,
        ease: 'Back.easeIn',
        onComplete: () => {
          this.currentEmote?.destroy();
          this.currentEmote = null;
          this.currentConfig = null;

          // Process queue
          if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            this.show(next);
          }
        },
      });
    }
  }

  // Update position to follow agent
  updatePosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }
}
```

### Emote Trigger Rules

```typescript
// packages/frontend/src/agents/emotes/EmoteTriggers.ts

import type { WorkEvent } from '../workStream/types';
import type { EmoteType } from './EmoteManager';

export interface EmoteTriggerRule {
  condition: (event: WorkEvent, context: AgentContext) => boolean;
  emote: EmoteType;
  priority: number;
}

export const EMOTE_TRIGGER_RULES: EmoteTriggerRule[] = [
  // Work events
  {
    condition: (e) => e.type === 'commit' && e.additions > 100,
    emote: 'celebrating',
    priority: 10,
  },
  {
    condition: (e) => e.type === 'commit',
    emote: 'success',
    priority: 5,
  },
  {
    condition: (e) => e.type === 'pr_merged',
    emote: 'celebrating',
    priority: 10,
  },
  {
    condition: (e) => e.type === 'pr_opened',
    emote: 'excited',
    priority: 7,
  },
  {
    condition: (e) => e.type === 'pr_review' && e.state === 'approved',
    emote: 'happy',
    priority: 8,
  },
  {
    condition: (e) => e.type === 'pr_review' && e.state === 'changes_requested',
    emote: 'thinking',
    priority: 6,
  },

  // Build/test events
  {
    condition: (e) => e.type === 'build_started',
    emote: 'loading',
    priority: 3,
  },
  {
    condition: (e) => e.type === 'build_success',
    emote: 'success',
    priority: 6,
  },
  {
    condition: (e) => e.type === 'build_failed',
    emote: 'error',
    priority: 7,
  },
  {
    condition: (e) => e.type === 'test_failed',
    emote: 'frustrated',
    priority: 7,
  },

  // Error events
  {
    condition: (e, ctx) => e.type === 'error' && ctx.errorStreak >= 3,
    emote: 'frustrated',
    priority: 9,
  },
  {
    condition: (e) => e.type === 'error',
    emote: 'confused',
    priority: 6,
  },
  {
    condition: (e, ctx) => e.type === 'error_resolved' && ctx.errorStreak > 0,
    emote: 'eureka',
    priority: 8,
  },

  // Context-based
  {
    condition: (e, ctx) => ctx.frustration > 70,
    emote: 'frustrated',
    priority: 4,
  },
  {
    condition: (e, ctx) => ctx.energy < 20,
    emote: 'tired',
    priority: 3,
  },
  {
    condition: (e, ctx) => ctx.successStreak >= 5,
    emote: 'celebrating',
    priority: 8,
  },
];

export function selectEmote(event: WorkEvent, context: AgentContext): EmoteType | null {
  const matchingRules = EMOTE_TRIGGER_RULES
    .filter(rule => rule.condition(event, context))
    .sort((a, b) => b.priority - a.priority);

  return matchingRules[0]?.emote ?? null;
}
```

---

## Animation Controller

### Sprite Animation System

```typescript
// packages/frontend/src/agents/animation/AnimationController.ts

export type AnimationDirection = 'down' | 'up' | 'left' | 'right';
export type AnimationAction = 'idle' | 'walk' | 'run' | 'work' | 'sleep' | 'sit';

export interface AnimationState {
  action: AnimationAction;
  direction: AnimationDirection;
}

export class AnimationController {
  private sprite: Phaser.GameObjects.Sprite;
  private currentState: AnimationState = { action: 'idle', direction: 'down' };
  private scene: Phaser.Scene;
  private spriteKey: string;

  // Animation frame configurations
  private readonly FRAME_CONFIG = {
    idle: {
      down: { start: 0, end: 3 },
      up: { start: 4, end: 7 },
      left: { start: 8, end: 11 },
      right: { start: 12, end: 15 },
    },
    walk: {
      down: { start: 16, end: 23 },
      up: { start: 24, end: 31 },
      left: { start: 32, end: 39 },
      right: { start: 40, end: 47 },
    },
    run: {
      down: { start: 48, end: 53 },
      up: { start: 54, end: 59 },
      left: { start: 60, end: 65 },
      right: { start: 66, end: 71 },
    },
    work: {
      down: { start: 72, end: 79 },  // Typing at desk
      up: { start: 72, end: 79 },
      left: { start: 80, end: 87 },
      right: { start: 88, end: 95 },
    },
    sleep: {
      down: { start: 96, end: 99 },  // Zzz animation
      up: { start: 96, end: 99 },
      left: { start: 96, end: 99 },
      right: { start: 96, end: 99 },
    },
    sit: {
      down: { start: 100, end: 103 },
      up: { start: 104, end: 107 },
      left: { start: 108, end: 111 },
      right: { start: 112, end: 115 },
    },
  };

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, spriteKey: string) {
    this.scene = scene;
    this.sprite = sprite;
    this.spriteKey = spriteKey;

    this.createAnimations();
  }

  private createAnimations(): void {
    const actions: AnimationAction[] = ['idle', 'walk', 'run', 'work', 'sleep', 'sit'];
    const directions: AnimationDirection[] = ['down', 'up', 'left', 'right'];

    for (const action of actions) {
      for (const direction of directions) {
        const config = this.FRAME_CONFIG[action][direction];
        const key = `${this.spriteKey}_${action}_${direction}`;

        if (!this.scene.anims.exists(key)) {
          this.scene.anims.create({
            key,
            frames: this.scene.anims.generateFrameNumbers(this.spriteKey, {
              start: config.start,
              end: config.end,
            }),
            frameRate: action === 'run' ? 12 : 8,
            repeat: -1,
          });
        }
      }
    }
  }

  // Determine animation from velocity
  updateFromVelocity(velocity: { x: number; y: number }): void {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

    // Determine action based on speed
    let action: AnimationAction;
    if (speed < 5) {
      action = 'idle';
    } else if (speed < 80) {
      action = 'walk';
    } else {
      action = 'run';
    }

    // Determine direction based on velocity
    let direction: AnimationDirection;
    if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
      direction = velocity.x > 0 ? 'right' : 'left';
    } else {
      direction = velocity.y > 0 ? 'down' : 'up';
    }

    this.setState({ action, direction });
  }

  // Set animation from agent state
  setFromAgentState(agentState: AgentState): void {
    const stateActionMap: Partial<Record<AgentState, AnimationAction>> = {
      working: 'work',
      resting: 'sleep',
      thinking: 'idle',
      frustrated: 'idle',
      celebrating: 'idle',
      socializing: 'idle',
      observing: 'idle',
    };

    const action = stateActionMap[agentState];
    if (action) {
      this.setState({ action, direction: this.currentState.direction });
    }
  }

  setState(state: AnimationState): void {
    if (
      state.action === this.currentState.action &&
      state.direction === this.currentState.direction
    ) {
      return; // No change
    }

    this.currentState = state;
    const animKey = `${this.spriteKey}_${state.action}_${state.direction}`;

    if (this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.play(animKey, true);
    }
  }

  // Override for specific states
  forceAction(action: AnimationAction): void {
    this.setState({ action, direction: this.currentState.direction });
  }

  forceDirection(direction: AnimationDirection): void {
    this.setState({ action: this.currentState.action, direction });
  }

  getState(): AnimationState {
    return { ...this.currentState };
  }
}
```

### State-to-Animation Mapping

| Agent State | Primary Animation | Secondary Animation | Special Effects |
|------------|-------------------|---------------------|-----------------|
| idle | idle | walk (if wandering) | None |
| working | work | idle (brief pauses) | Keyboard particles |
| thinking | idle | pace (walking) | Thought bubbles |
| frustrated | idle (fast) | walk (erratic) | Anger particles |
| celebrating | idle | jump (custom) | Confetti particles |
| resting | sleep | sit | Zzz particles |
| socializing | idle | - | Speech bubbles |
| traveling | walk/run | - | Dust particles |
| observing | idle | - | Eye highlight |

---

## Work Stream Integration

### Event Processing

```typescript
// packages/frontend/src/agents/workStream/WorkStreamAdapter.ts

export interface WorkEvent {
  id: string;
  timestamp: number;
  type: WorkEventType;
  agentId: string;
  houseId: string;

  // Event-specific data
  payload: Record<string, any>;
}

export type WorkEventType =
  // GitHub events
  | 'commit'
  | 'pr_opened'
  | 'pr_merged'
  | 'pr_closed'
  | 'pr_review'
  | 'issue_opened'
  | 'issue_closed'
  | 'issue_comment'

  // Build events
  | 'build_started'
  | 'build_success'
  | 'build_failed'
  | 'test_passed'
  | 'test_failed'
  | 'deploy_started'
  | 'deploy_success'
  | 'deploy_failed'

  // Terminal events
  | 'command_executed'
  | 'command_error'
  | 'command_output'

  // MCP events
  | 'tool_invoked'
  | 'tool_completed'
  | 'tool_error'

  // Generic
  | 'error'
  | 'error_resolved'
  | 'activity';

export class WorkStreamAdapter {
  private agentId: string;
  private stateMachine: ActorRef<typeof agentMachine>;
  private eventBuffer: WorkEvent[] = [];
  private processingInterval: number | null = null;

  constructor(agentId: string, stateMachine: ActorRef<typeof agentMachine>) {
    this.agentId = agentId;
    this.stateMachine = stateMachine;

    // Process events at regular intervals for smooth state transitions
    this.processingInterval = window.setInterval(() => {
      this.processBuffer();
    }, 100);
  }

  // Receive events from various sources
  receiveEvent(event: WorkEvent): void {
    if (event.agentId !== this.agentId) return;

    this.eventBuffer.push(event);
  }

  private processBuffer(): void {
    if (this.eventBuffer.length === 0) return;

    // Sort by timestamp
    this.eventBuffer.sort((a, b) => a.timestamp - b.timestamp);

    // Process all buffered events
    for (const event of this.eventBuffer) {
      this.processEvent(event);
    }

    this.eventBuffer = [];
  }

  private processEvent(event: WorkEvent): void {
    // Convert work event to state machine event
    const machineEvent = this.convertToMachineEvent(event);

    if (machineEvent) {
      this.stateMachine.send(machineEvent);
    }
  }

  private convertToMachineEvent(event: WorkEvent): AgentEvent | null {
    switch (event.type) {
      // Work start events
      case 'commit':
      case 'pr_opened':
      case 'build_started':
      case 'deploy_started':
      case 'tool_invoked':
        return {
          type: 'WORK_STARTED',
          task: this.createTaskContext(event),
        };

      // Work completion events
      case 'pr_merged':
      case 'build_success':
      case 'deploy_success':
      case 'tool_completed':
        return {
          type: 'WORK_COMPLETED',
          task: this.createTaskContext(event),
          success: true,
        };

      // Work failure events
      case 'pr_closed': // Without merge
      case 'build_failed':
      case 'deploy_failed':
      case 'tool_error':
        return {
          type: 'WORK_COMPLETED',
          task: this.createTaskContext(event),
          success: false,
        };

      // Error events
      case 'command_error':
      case 'test_failed':
      case 'error':
        return {
          type: 'ERROR_OCCURRED',
          error: {
            message: event.payload.message ?? 'Unknown error',
            code: event.payload.code,
            recoverable: event.payload.recoverable ?? true,
          },
        };

      case 'error_resolved':
        return { type: 'ERROR_RESOLVED' };

      // Progress events
      case 'command_output':
      case 'activity':
        return {
          type: 'WORK_PROGRESS',
          progress: event.payload.progress ?? 50,
          details: event.payload.details,
        };

      // PR review events
      case 'pr_review':
        if (event.payload.state === 'changes_requested') {
          return {
            type: 'ERROR_OCCURRED',
            error: {
              message: 'Changes requested on PR',
              code: 'PR_CHANGES_REQUESTED',
              recoverable: true,
            },
          };
        }
        return {
          type: 'INTERESTING_EVENT',
          source: 'github',
          details: event.payload,
        };

      // Issue events
      case 'issue_opened':
      case 'issue_comment':
        return {
          type: 'INTERESTING_EVENT',
          source: 'github',
          details: event.payload,
        };

      default:
        return null;
    }
  }

  private createTaskContext(event: WorkEvent): TaskContext {
    return {
      id: event.id,
      type: this.mapEventTypeToTaskType(event.type),
      description: event.payload.description ?? event.type,
      startedAt: event.timestamp,
      files: event.payload.files ?? [],
      complexity: this.estimateComplexity(event),
    };
  }

  private mapEventTypeToTaskType(eventType: WorkEventType): TaskContext['type'] {
    const mapping: Partial<Record<WorkEventType, TaskContext['type']>> = {
      commit: 'commit',
      pr_opened: 'pr',
      pr_merged: 'pr',
      pr_review: 'review',
      issue_opened: 'issue',
      build_started: 'build',
      build_success: 'build',
      build_failed: 'build',
      test_passed: 'test',
      test_failed: 'test',
      deploy_started: 'deploy',
      deploy_success: 'deploy',
      deploy_failed: 'deploy',
    };

    return mapping[eventType] ?? 'commit';
  }

  private estimateComplexity(event: WorkEvent): number {
    // Estimate task complexity from event data
    let complexity = 5; // Base

    if (event.payload.additions) {
      if (event.payload.additions > 500) complexity += 3;
      else if (event.payload.additions > 100) complexity += 2;
      else if (event.payload.additions > 20) complexity += 1;
    }

    if (event.payload.files?.length) {
      if (event.payload.files.length > 20) complexity += 2;
      else if (event.payload.files.length > 5) complexity += 1;
    }

    if (event.type === 'deploy_started') complexity += 2;
    if (event.type === 'pr_opened') complexity += 1;

    return Math.min(10, complexity);
  }

  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}
```

### GitHub Webhook Integration

```typescript
// packages/backend/src/events/GitHubWebhookHandler.ts

export class GitHubWebhookHandler {
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  async handleWebhook(payload: any, eventType: string): Promise<void> {
    const workEvent = this.convertToWorkEvent(payload, eventType);

    if (workEvent) {
      // Find agent associated with this repository
      const agentId = await this.findAgentForRepo(payload.repository?.full_name);

      if (agentId) {
        workEvent.agentId = agentId;
        this.eventEmitter.emit('work_event', workEvent);
      }
    }
  }

  private convertToWorkEvent(payload: any, eventType: string): WorkEvent | null {
    const timestamp = Date.now();
    const baseEvent = {
      id: `gh_${timestamp}_${Math.random().toString(36).slice(2)}`,
      timestamp,
      houseId: payload.repository?.id?.toString() ?? 'unknown',
      agentId: '', // Set by caller
    };

    switch (eventType) {
      case 'push':
        return {
          ...baseEvent,
          type: 'commit',
          payload: {
            sha: payload.head_commit?.id,
            message: payload.head_commit?.message,
            additions: payload.head_commit?.added?.length ?? 0,
            deletions: payload.head_commit?.removed?.length ?? 0,
            files: [
              ...(payload.head_commit?.added ?? []),
              ...(payload.head_commit?.modified ?? []),
            ],
          },
        };

      case 'pull_request':
        const prAction = payload.action;
        let prType: WorkEventType;

        if (prAction === 'opened') prType = 'pr_opened';
        else if (prAction === 'closed' && payload.pull_request?.merged) prType = 'pr_merged';
        else if (prAction === 'closed') prType = 'pr_closed';
        else return null;

        return {
          ...baseEvent,
          type: prType,
          payload: {
            number: payload.pull_request?.number,
            title: payload.pull_request?.title,
            additions: payload.pull_request?.additions,
            deletions: payload.pull_request?.deletions,
            files: payload.pull_request?.changed_files,
          },
        };

      case 'pull_request_review':
        return {
          ...baseEvent,
          type: 'pr_review',
          payload: {
            number: payload.pull_request?.number,
            state: payload.review?.state,
            body: payload.review?.body,
          },
        };

      case 'check_run':
        if (payload.action !== 'completed') return null;

        const conclusion = payload.check_run?.conclusion;
        return {
          ...baseEvent,
          type: conclusion === 'success' ? 'build_success' : 'build_failed',
          payload: {
            name: payload.check_run?.name,
            conclusion,
            output: payload.check_run?.output,
          },
        };

      case 'workflow_run':
        if (payload.action !== 'completed') return null;

        const workflowConclusion = payload.workflow_run?.conclusion;
        return {
          ...baseEvent,
          type: workflowConclusion === 'success' ? 'build_success' : 'build_failed',
          payload: {
            name: payload.workflow_run?.name,
            conclusion: workflowConclusion,
          },
        };

      case 'issues':
        if (payload.action === 'opened') {
          return {
            ...baseEvent,
            type: 'issue_opened',
            payload: {
              number: payload.issue?.number,
              title: payload.issue?.title,
            },
          };
        }
        if (payload.action === 'closed') {
          return {
            ...baseEvent,
            type: 'issue_closed',
            payload: {
              number: payload.issue?.number,
              title: payload.issue?.title,
            },
          };
        }
        return null;

      default:
        return null;
    }
  }

  private async findAgentForRepo(repoFullName: string): Promise<string | null> {
    // Query database for agent associated with this repo
    // Implementation depends on your data model
    return null;
  }
}
```

---

## Multiplayer Synchronization

### State Sync Protocol

```typescript
// packages/frontend/src/agents/network/NetworkSyncAdapter.ts

import { Doc, encodeStateAsUpdate, applyUpdate } from 'yjs';
import * as Y from 'yjs';

export interface AgentNetworkState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  state: AgentState;
  emote: EmoteType | null;
  animation: AnimationState;
  heading: number;
}

export class NetworkSyncAdapter {
  private doc: Y.Doc;
  private agentId: string;
  private agentsMap: Y.Map<AgentNetworkState>;
  private updateCallback: (agentId: string, state: AgentNetworkState) => void;

  // Interpolation for smooth remote agent movement
  private remoteAgentStates: Map<string, {
    current: AgentNetworkState;
    target: AgentNetworkState;
    interpolationTime: number;
  }> = new Map();

  constructor(
    doc: Y.Doc,
    agentId: string,
    onRemoteUpdate: (agentId: string, state: AgentNetworkState) => void
  ) {
    this.doc = doc;
    this.agentId = agentId;
    this.updateCallback = onRemoteUpdate;

    this.agentsMap = doc.getMap('agents');

    // Listen for remote changes
    this.agentsMap.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (key !== this.agentId) {
          const state = this.agentsMap.get(key);
          if (state) {
            this.handleRemoteUpdate(key, state);
          }
        }
      });
    });
  }

  // Send local state update
  updateLocalState(state: Partial<AgentNetworkState>): void {
    const currentState = this.agentsMap.get(this.agentId) ?? {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      state: 'idle',
      emote: null,
      animation: { action: 'idle', direction: 'down' },
      heading: 0,
    };

    this.agentsMap.set(this.agentId, {
      ...currentState,
      ...state,
    });
  }

  private handleRemoteUpdate(agentId: string, state: AgentNetworkState): void {
    // Set up interpolation
    const existing = this.remoteAgentStates.get(agentId);

    this.remoteAgentStates.set(agentId, {
      current: existing?.target ?? state,
      target: state,
      interpolationTime: 0,
    });

    this.updateCallback(agentId, state);
  }

  // Called each frame to interpolate remote agents
  updateInterpolation(deltaTime: number): Map<string, AgentNetworkState> {
    const INTERPOLATION_DURATION = 100; // ms
    const interpolated = new Map<string, AgentNetworkState>();

    for (const [agentId, data] of this.remoteAgentStates) {
      data.interpolationTime += deltaTime * 1000;
      const t = Math.min(1, data.interpolationTime / INTERPOLATION_DURATION);

      interpolated.set(agentId, {
        position: {
          x: data.current.position.x + (data.target.position.x - data.current.position.x) * t,
          y: data.current.position.y + (data.target.position.y - data.current.position.y) * t,
        },
        velocity: data.target.velocity,
        state: data.target.state,
        emote: data.target.emote,
        animation: data.target.animation,
        heading: data.current.heading + (data.target.heading - data.current.heading) * t,
      });

      if (t >= 1) {
        data.current = data.target;
        data.interpolationTime = 0;
      }
    }

    return interpolated;
  }

  // Rate limiting for position updates
  private lastPositionUpdate = 0;
  private POSITION_UPDATE_INTERVAL = 50; // 20 updates per second

  maybeUpdatePosition(position: { x: number; y: number }, velocity: { x: number; y: number }): void {
    const now = Date.now();

    if (now - this.lastPositionUpdate >= this.POSITION_UPDATE_INTERVAL) {
      this.updateLocalState({ position, velocity });
      this.lastPositionUpdate = now;
    }
  }

  // Immediate updates for state changes
  updateState(state: AgentState): void {
    this.updateLocalState({ state });
  }

  updateEmote(emote: EmoteType | null): void {
    this.updateLocalState({ emote });
  }

  updateAnimation(animation: AnimationState): void {
    this.updateLocalState({ animation });
  }
}
```

### Update Rate Optimization

```typescript
// packages/frontend/src/agents/network/UpdateRateLimiter.ts

export interface UpdatePriority {
  position: number;      // Updates per second
  velocity: number;
  state: number;
  emote: number;
  animation: number;
}

export const DEFAULT_UPDATE_RATES: UpdatePriority = {
  position: 20,     // 50ms interval
  velocity: 20,
  state: 10,        // 100ms interval (state changes are less frequent)
  emote: 5,         // 200ms interval
  animation: 15,    // ~67ms interval
};

export class UpdateRateLimiter {
  private lastUpdates: Map<keyof UpdatePriority, number> = new Map();
  private rates: UpdatePriority;

  constructor(rates: UpdatePriority = DEFAULT_UPDATE_RATES) {
    this.rates = rates;

    for (const key of Object.keys(rates) as (keyof UpdatePriority)[]) {
      this.lastUpdates.set(key, 0);
    }
  }

  shouldUpdate(type: keyof UpdatePriority): boolean {
    const now = Date.now();
    const lastUpdate = this.lastUpdates.get(type) ?? 0;
    const interval = 1000 / this.rates[type];

    if (now - lastUpdate >= interval) {
      this.lastUpdates.set(type, now);
      return true;
    }

    return false;
  }

  // Force update (bypasses rate limiting)
  forceUpdate(type: keyof UpdatePriority): void {
    this.lastUpdates.set(type, Date.now());
  }

  // Adjust rates based on network conditions
  adjustRates(quality: 'good' | 'fair' | 'poor'): void {
    const multipliers = {
      good: 1.0,
      fair: 0.5,
      poor: 0.25,
    };

    const mult = multipliers[quality];

    this.rates = {
      position: Math.max(5, DEFAULT_UPDATE_RATES.position * mult),
      velocity: Math.max(5, DEFAULT_UPDATE_RATES.velocity * mult),
      state: Math.max(2, DEFAULT_UPDATE_RATES.state * mult),
      emote: Math.max(1, DEFAULT_UPDATE_RATES.emote * mult),
      animation: Math.max(5, DEFAULT_UPDATE_RATES.animation * mult),
    };
  }
}
```

---

## Performance Optimization

### Level of Detail (LOD) System

```typescript
// packages/frontend/src/agents/optimization/AgentLOD.ts

export type LODLevel = 'full' | 'reduced' | 'minimal' | 'culled';

export interface LODConfig {
  full: { maxDistance: number; updateRate: number; features: string[] };
  reduced: { maxDistance: number; updateRate: number; features: string[] };
  minimal: { maxDistance: number; updateRate: number; features: string[] };
  culled: { maxDistance: number; updateRate: number; features: string[] };
}

export const DEFAULT_LOD_CONFIG: LODConfig = {
  full: {
    maxDistance: 300,
    updateRate: 60,    // 60 FPS
    features: ['animation', 'emotes', 'particles', 'shadows', 'smoothSteering'],
  },
  reduced: {
    maxDistance: 600,
    updateRate: 30,    // 30 FPS
    features: ['animation', 'emotes', 'shadows'],
  },
  minimal: {
    maxDistance: 1000,
    updateRate: 15,    // 15 FPS
    features: ['animation'],
  },
  culled: {
    maxDistance: Infinity,
    updateRate: 0,
    features: [],
  },
};

export class AgentLODManager {
  private config: LODConfig;
  private agentLODs: Map<string, LODLevel> = new Map();
  private cameraPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(config: LODConfig = DEFAULT_LOD_CONFIG) {
    this.config = config;
  }

  updateCameraPosition(x: number, y: number): void {
    this.cameraPosition = { x, y };
  }

  calculateLOD(agentPosition: { x: number; y: number }): LODLevel {
    const dx = agentPosition.x - this.cameraPosition.x;
    const dy = agentPosition.y - this.cameraPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= this.config.full.maxDistance) return 'full';
    if (distance <= this.config.reduced.maxDistance) return 'reduced';
    if (distance <= this.config.minimal.maxDistance) return 'minimal';
    return 'culled';
  }

  updateAgentLOD(agentId: string, position: { x: number; y: number }): LODLevel {
    const newLOD = this.calculateLOD(position);
    const currentLOD = this.agentLODs.get(agentId);

    if (newLOD !== currentLOD) {
      this.agentLODs.set(agentId, newLOD);
    }

    return newLOD;
  }

  getAgentLOD(agentId: string): LODLevel {
    return this.agentLODs.get(agentId) ?? 'full';
  }

  getUpdateRate(lod: LODLevel): number {
    return this.config[lod].updateRate;
  }

  hasFeature(lod: LODLevel, feature: string): boolean {
    return this.config[lod].features.includes(feature);
  }

  // Get agents that need updates this frame
  getAgentsToUpdate(frameTime: number): string[] {
    const agentsToUpdate: string[] = [];

    for (const [agentId, lod] of this.agentLODs) {
      const updateRate = this.config[lod].updateRate;
      if (updateRate === 0) continue;

      const updateInterval = 1000 / updateRate;
      // Use frame time modulo to distribute updates
      const hash = this.hashString(agentId);
      const offset = (hash % updateInterval);

      if ((frameTime + offset) % updateInterval < 16.67) { // 60fps base
        agentsToUpdate.push(agentId);
      }
    }

    return agentsToUpdate;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
```

### Spatial Partitioning

```typescript
// packages/frontend/src/agents/optimization/SpatialHash.ts

export class SpatialHash<T extends { position: { x: number; y: number } }> {
  private cellSize: number;
  private cells: Map<string, Set<T>> = new Map();
  private entityCells: Map<T, string> = new Map();

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  insert(entity: T): void {
    const key = this.getCellKey(entity.position.x, entity.position.y);

    // Remove from old cell if exists
    const oldKey = this.entityCells.get(entity);
    if (oldKey && oldKey !== key) {
      this.cells.get(oldKey)?.delete(entity);
    }

    // Add to new cell
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key)!.add(entity);
    this.entityCells.set(entity, key);
  }

  remove(entity: T): void {
    const key = this.entityCells.get(entity);
    if (key) {
      this.cells.get(key)?.delete(entity);
      this.entityCells.delete(entity);
    }
  }

  update(entity: T): void {
    this.insert(entity); // Insert handles re-assignment
  }

  // Get entities in radius
  query(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const radiusSquared = radius * radius;

    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const key = `${cellX},${cellY}`;
        const cell = this.cells.get(key);

        if (cell) {
          for (const entity of cell) {
            const dx = entity.position.x - x;
            const dy = entity.position.y - y;
            if (dx * dx + dy * dy <= radiusSquared) {
              results.push(entity);
            }
          }
        }
      }
    }

    return results;
  }

  // Get all entities in a cell
  getCell(x: number, y: number): T[] {
    const key = this.getCellKey(x, y);
    return Array.from(this.cells.get(key) ?? []);
  }

  clear(): void {
    this.cells.clear();
    this.entityCells.clear();
  }
}
```

---

## Implementation Guide

### File Structure

```
packages/frontend/src/agents/
├── index.ts                           # Public API
├── AgentBehaviorSystem.ts             # Main system coordinator
├── AgentEntity.ts                     # Phaser game object wrapper
│
├── stateMachine/
│   ├── agentMachine.ts                # XState machine definition
│   ├── guards.ts                      # State guards
│   ├── actions.ts                     # State actions
│   └── types.ts                       # Type definitions
│
├── steering/
│   ├── SteeringController.ts          # Yuka.js integration
│   ├── AgentVehicle.ts                # Yuka Vehicle subclass
│   └── behaviors/                     # Custom behaviors
│       ├── PacingBehavior.ts
│       └── BounceBehavior.ts
│
├── emotes/
│   ├── EmoteManager.ts                # Emote display system
│   ├── EmoteTriggers.ts               # Trigger rules
│   └── emoteConfigs.ts                # Emote definitions
│
├── animation/
│   ├── AnimationController.ts         # Sprite animation
│   ├── animationConfigs.ts            # Animation definitions
│   └── AnimationFactory.ts            # Animation creation
│
├── workStream/
│   ├── WorkStreamAdapter.ts           # Event processing
│   ├── types.ts                       # Event type definitions
│   └── eventConverters.ts             # Event conversion logic
│
├── network/
│   ├── NetworkSyncAdapter.ts          # Multiplayer sync
│   ├── UpdateRateLimiter.ts           # Rate limiting
│   └── InterpolationManager.ts        # Smooth remote movement
│
└── optimization/
    ├── AgentLOD.ts                    # Level of detail
    ├── SpatialHash.ts                 # Spatial partitioning
    └── AgentPool.ts                   # Object pooling
```

### Integration Example

```typescript
// packages/frontend/src/scenes/VillageScene.ts

import { AgentBehaviorSystem, createAgentBehaviorSystem } from '../agents';
import { EntityManager, Time } from 'yuka';

export class VillageScene extends Phaser.Scene {
  private yukaEntityManager: EntityManager;
  private agentSystems: Map<string, AgentBehaviorSystem> = new Map();
  private yukaTime: Time;

  create(): void {
    // Initialize Yuka
    this.yukaEntityManager = new EntityManager();
    this.yukaTime = new Time();

    // Create agents for each house
    for (const house of this.houses) {
      const agentSystem = createAgentBehaviorSystem({
        scene: this,
        agentId: house.agentId,
        houseId: house.id,
        position: house.spawnPoint,
        entityManager: this.yukaEntityManager,
      });

      this.agentSystems.set(house.agentId, agentSystem);
    }

    // Connect to work stream
    this.workStreamClient.on('event', (event) => {
      const system = this.agentSystems.get(event.agentId);
      if (system) {
        system.workStreamAdapter.receiveEvent(event);
      }
    });
  }

  update(time: number, delta: number): void {
    // Update Yuka
    const deltaSeconds = delta / 1000;
    this.yukaTime.update().getDelta();
    this.yukaEntityManager.update(deltaSeconds);

    // Update agent systems
    for (const [agentId, system] of this.agentSystems) {
      system.update(deltaSeconds);
    }
  }
}
```

### Testing Strategy

```typescript
// packages/frontend/src/agents/__tests__/agentMachine.test.ts

import { createActor } from 'xstate';
import { agentMachine } from '../stateMachine/agentMachine';

describe('Agent State Machine', () => {
  it('should transition from idle to working on WORK_STARTED', () => {
    const actor = createActor(agentMachine, {
      input: {
        agentId: 'test-agent',
        houseId: 'test-house',
      },
    });

    actor.start();
    expect(actor.getSnapshot().value).toBe('idle');

    actor.send({
      type: 'WORK_STARTED',
      task: {
        id: 'task-1',
        type: 'commit',
        description: 'Test commit',
        startedAt: Date.now(),
        files: [],
        complexity: 5,
      },
    });

    expect(actor.getSnapshot().value).toBe('working');
    actor.stop();
  });

  it('should transition to frustrated after multiple errors', () => {
    const actor = createActor(agentMachine, {
      input: {
        agentId: 'test-agent',
        houseId: 'test-house',
      },
    });

    actor.start();

    // Start working
    actor.send({
      type: 'WORK_STARTED',
      task: { id: '1', type: 'commit', description: '', startedAt: 0, files: [], complexity: 5 },
    });

    // Send multiple errors
    for (let i = 0; i < 5; i++) {
      actor.send({
        type: 'ERROR_OCCURRED',
        error: { message: 'Error', code: 'ERR', recoverable: true },
      });
    }

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.frustration).toBeGreaterThan(70);
    expect(snapshot.value).toBe('frustrated');

    actor.stop();
  });

  it('should celebrate after successful complex task', () => {
    const actor = createActor(agentMachine, {
      input: {
        agentId: 'test-agent',
        houseId: 'test-house',
      },
    });

    actor.start();

    // Start complex work
    actor.send({
      type: 'WORK_STARTED',
      task: {
        id: 'task-1',
        type: 'pr',
        description: 'Major feature',
        startedAt: Date.now(),
        files: [],
        complexity: 8, // High complexity
      },
    });

    // Complete successfully
    actor.send({
      type: 'WORK_COMPLETED',
      task: { id: 'task-1', type: 'pr', description: '', startedAt: 0, files: [], complexity: 8 },
      success: true,
    });

    expect(actor.getSnapshot().value).toBe('celebrating');

    actor.stop();
  });
});
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| State transitions | < 5ms | From event to state change |
| Steering update | < 1ms per agent | Yuka vehicle update |
| Animation update | < 0.5ms per agent | Frame selection |
| Emote render | < 0.5ms per agent | Sprite positioning |
| Network sync | < 2ms per update | Yjs state encoding |
| LOD calculation | < 0.1ms per agent | Distance check |
| Spatial query | < 1ms for 100 agents | Nearby agent lookup |
| Total per agent | < 10ms | Full update cycle |
| Memory per agent | < 50KB | Including all systems |

---

## Next Steps

After implementing this system:

1. **Sprite Generation System** - Define agent appearance generation
2. **Room Interior System** - How agents interact with room furniture
3. **Quest/Task System** - Visual task tracking within buildings
4. **Sound Design** - Audio cues for state changes

---

*Document Version: 2.0*
*Last Updated: December 2025*
*Author: AI Agent Village Monitor Development Team*

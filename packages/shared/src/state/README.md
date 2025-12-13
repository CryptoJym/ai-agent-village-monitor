# Agent State Machine

XState v5 implementation for AI Agent Village Monitor RPG system. This state machine manages agent behaviors, animations, and reactions to work events from GitHub.

## Overview

The Agent State Machine models the cognitive and emotional states of agents in the village. Agent states directly drive:

- **Animations**: Sprite animations tied to current state
- **Steering Behaviors**: Yuka.js navigation and movement patterns
- **Emotes**: Visual indicators of agent mood and activity
- **Work Events**: Real-time reactions to GitHub commits, PRs, builds

## Architecture

```
packages/shared/src/state/
├── agentMachine.ts       # Main state machine definition
├── guards.ts             # Transition guard conditions
├── actions.ts            # State update actions
├── workEventAdapter.ts   # GitHub event converter
├── useAgent.ts          # React hook integration
└── __tests__/           # Comprehensive test suite
```

## Agent States

The state machine implements 9 distinct states from the Prisma schema:

### Core States

| State | Description | Entry Conditions | Visual Behavior |
|-------|-------------|------------------|-----------------|
| **idle** | Default wandering state | Low frustration, normal energy | Random movement, relaxed animation |
| **working** | Actively coding/committing | WORK_STARTED event | Focused animation, desk/terminal context |
| **thinking** | Processing, problem-solving | Error occurred, moderate frustration | Contemplative pose, reduced movement |
| **frustrated** | High error streak, build failures | BUILD_FAILED, high error count | Agitated animation, pacing |
| **celebrating** | PR merged, milestone reached | Success streak ≥3 or milestone | Happy animation, confetti effects |
| **resting** | Energy recovery | Energy < 20 | Sleeping/relaxing animation |
| **socializing** | Interacting with other agents | Nearby agent detected | Group animation, speech bubbles |
| **traveling** | Moving to target location | MOVE_TO command | Walking animation, path following |
| **observing** | Watching others work | Near active agent | Standing still, looking animation |

## Context (Agent Metrics)

```typescript
interface AgentContext {
  energy: number;         // 0-100, decreases with work
  frustration: number;    // 0-100, increases with errors
  workload: number;       // 0-100, current task load
  streak: number;         // Consecutive successes
  errorStreak: number;    // Consecutive errors
  targetPosition?: { x: number; y: number };
  currentTask?: string;
}
```

### Metric Dynamics

- **Energy**: Decreases during work (-5/tick), increases during rest (+15/tick)
- **Frustration**: Increases with errors (+5 to +30 based on severity), decreases naturally (-1 to -5/tick)
- **Workload**: Increases when tasks start (+20), decreases as work progresses (-10/tick)
- **Streak**: Increments on success (+1), resets on failure (0)
- **Error Streak**: Increments on errors (+1), resets on success (0)

## Events

### Work Events

```typescript
type AgentEvent =
  | { type: 'WORK_STARTED'; task: string }
  | { type: 'WORK_COMPLETED'; success: boolean }
  | { type: 'ERROR_OCCURRED'; severity: 'low' | 'medium' | 'high' }
  | { type: 'BUILD_FAILED' }
  | { type: 'PR_MERGED' }
  | { type: 'MILESTONE_REACHED' }
```

### Navigation Events

```typescript
  | { type: 'MOVE_TO'; target: { x: number; y: number } }
  | { type: 'ARRIVED' }
```

### Social Events

```typescript
  | { type: 'AGENT_NEARBY' }
  | { type: 'AGENT_LEFT' }
```

### System Events

```typescript
  | { type: 'ENERGY_LOW' }
  | { type: 'ENERGY_RESTORED' }
  | { type: 'TICK' } // Regular update (every frame or interval)
```

## Usage

### React Components

```typescript
import { useAgentState } from '@ai-agent-village-monitor/shared';

function AgentComponent({ agentId }) {
  const { state, context, send, matches } = useAgentState({
    initialContext: {
      energy: 80,
      frustration: 10,
      workload: 0,
      streak: 0,
      errorStreak: 0,
    },
  });

  // Render based on state
  return (
    <div className={`agent agent-${state}`}>
      <AgentSprite state={state} />
      <EnergyBar value={context.energy} />
      <FrustrationIndicator value={context.frustration} />

      {matches('working') && <WorkIndicator task={context.currentTask} />}
      {matches('celebrating') && <Confetti />}

      <button onClick={() => send({ type: 'WORK_STARTED', task: 'coding' })}>
        Start Work
      </button>
    </div>
  );
}
```

### Server-Side (Node.js)

```typescript
import { createAgentActor } from '@ai-agent-village-monitor/shared';
import { convertWorkEventToAgentEvents } from '@ai-agent-village-monitor/shared';

// Create actor for an agent
const actor = createAgentActor({
  energy: 100,
  frustration: 0,
  workload: 0,
  streak: 0,
  errorStreak: 0,
});

actor.start();

// Subscribe to state changes
actor.subscribe((snapshot) => {
  console.log('Agent state:', snapshot.value);
  console.log('Agent context:', snapshot.context);

  // Persist to database
  await db.agent.update({
    where: { id: agentId },
    data: {
      currentState: snapshot.value,
      energy: snapshot.context.energy,
      frustration: snapshot.context.frustration,
      workload: snapshot.context.workload,
      streak: snapshot.context.streak,
      errorStreak: snapshot.context.errorStreak,
    },
  });
});

// Process GitHub webhook
const workEvent = createWorkEventFromGitHub('push', webhookPayload);
const agentEvents = convertWorkEventToAgentEvents(workEvent);

agentEvents.forEach(event => actor.send(event));
```

### Work Event Adapter

The adapter converts GitHub webhooks to agent events:

```typescript
import {
  createWorkEventFromGitHub,
  convertWorkEventToAgentEvents
} from '@ai-agent-village-monitor/shared';

// From GitHub webhook
app.post('/webhook/github', (req, res) => {
  const eventType = req.headers['x-github-event'];
  const payload = req.body;

  // Convert to work event
  const workEvent = createWorkEventFromGitHub(eventType, payload);

  // Convert to agent events
  const agentEvents = convertWorkEventToAgentEvents(workEvent);

  // Send to all agents working on this repo
  const agents = await getAgentsForRepo(payload.repository.id);

  agents.forEach(agent => {
    agentEvents.forEach(event => agent.send(event));
  });

  res.status(200).send('OK');
});
```

## GitHub Event Mapping

| GitHub Event | Action | Agent Events |
|--------------|--------|--------------|
| `push` | - | WORK_STARTED, WORK_COMPLETED |
| `pull_request` | opened | WORK_STARTED, WORK_COMPLETED |
| `pull_request` | closed (merged) | PR_MERGED |
| `check_run` | completed (success) | WORK_COMPLETED |
| `check_run` | completed (failure) | BUILD_FAILED |
| `check_run` | completed (cancelled) | ERROR_OCCURRED (medium) |
| `workflow_run` | completed (success) | WORK_COMPLETED |
| `workflow_run` | completed (failure) | BUILD_FAILED |
| `issues` | opened | WORK_STARTED |
| `issues` | closed | WORK_COMPLETED |
| `milestone` | closed | MILESTONE_REACHED |
| `release` | published | MILESTONE_REACHED |

## State Transition Examples

### Happy Path: Work → Success → Celebration

```typescript
actor.send({ type: 'WORK_STARTED', task: 'feature-x' });
// State: idle → working
// Context: workload +20, energy -5/tick

actor.send({ type: 'WORK_COMPLETED', success: true });
// State: working → idle (or celebrating if streak ≥ 3)
// Context: streak +1, workload -20, frustration -5

// After 3 successes
actor.send({ type: 'WORK_COMPLETED', success: true });
// State: working → celebrating
// Context: streak +1, frustration = 0
```

### Error Recovery: Error → Think → Recover

```typescript
actor.send({ type: 'WORK_STARTED', task: 'refactor' });
// State: idle → working

actor.send({ type: 'ERROR_OCCURRED', severity: 'medium' });
// State: working → thinking
// Context: frustration +15, energy -5, errorStreak +1

// TICK events gradually reduce frustration
actor.send({ type: 'TICK' });
actor.send({ type: 'TICK' });
// State: thinking → idle (when frustration < 30)
// Context: frustration -5/tick
```

### Burnout: Overwork → Frustrated → Rest

```typescript
// Multiple failures
actor.send({ type: 'WORK_STARTED', task: 'bugfix' });
actor.send({ type: 'BUILD_FAILED' });
// State: working → frustrated
// Context: frustration +30, energy -15, errorStreak +1, streak = 0

// Energy continues to decrease
for (let i = 0; i < 20; i++) {
  actor.send({ type: 'TICK' });
}
// State: frustrated → resting (when energy < 10)

// Recovery
actor.send({ type: 'TICK' });
// State: resting
// Context: energy +15/tick, frustration -10/tick
```

## Guards (Transition Conditions)

Guards control when transitions can occur:

```typescript
// Energy guards
isLowEnergy(context)          // energy < 20
isCriticallyLowEnergy(context) // energy < 10
isWellRested(context)         // energy >= 80

// Frustration guards
isHighFrustration(context)     // frustration > 70
isModerateFrustration(context) // 40 ≤ frustration ≤ 70
isFrustrationLow(context)      // frustration < 30

// Work guards
isHighWorkload(context)        // workload > 70
shouldRest(context)            // energy < 30 && !currentTask
canCelebrate(context)          // streak >= 3

// Navigation guards
hasTarget(context)             // targetPosition defined
isAtTarget(context)            // near targetPosition

// Social guards
hasNearbyAgents(context)       // other agents nearby
hasHighErrorStreak(context)    // errorStreak >= 3
```

## Actions (State Updates)

Actions modify the agent context:

```typescript
// Energy management
decreaseEnergy()              // energy -= 5
increaseEnergy()              // energy += 10
restRecovery()                // energy += 15, frustration -= 10

// Frustration management
increaseFrustration(amount)   // frustration += amount
decreaseFrustration()         // frustration -= 5
resetFrustration()            // frustration = 0

// Work management
startTask(task)               // currentTask = task, workload += 20
completeTask()                // currentTask = undefined, workload -= 20
handleWorkSuccess()           // Complete + streak++, frustration -= 5
handleWorkFailure()           // Complete + errorStreak++, frustration += 15

// Special events
handleBuildFailure()          // frustration += 30, errorStreak++
handlePRMerged()              // frustration = 0, energy += 20, streak += 3
handleMilestone()             // frustration = 0, energy += 30, streak += 5

// Navigation
setTarget(position)           // targetPosition = position
clearTarget()                 // targetPosition = undefined
```

## Testing

The state machine includes comprehensive tests:

```bash
# Run all state machine tests
pnpm vitest run packages/shared/src/state/__tests__

# Run specific test file
pnpm vitest run packages/shared/src/state/__tests__/agentMachine.test.ts

# Run with coverage
pnpm vitest run --coverage packages/shared/src/state
```

Test coverage includes:

- ✅ All state transitions
- ✅ All guards and conditions
- ✅ All actions and context updates
- ✅ GitHub event conversion
- ✅ Complex multi-step workflows
- ✅ Edge cases and boundary conditions

## Integration Points

### Frontend (Phaser/PixiJS)

```typescript
// In your game update loop
function updateAgent(agent, deltaTime) {
  // Send TICK events for gradual changes
  agent.send({ type: 'TICK' });

  // Update sprite based on state
  const state = agent.snapshot.value;
  sprite.play(`agent_${state}_animation`);

  // Apply steering behaviors
  if (state === 'traveling' && agent.context.targetPosition) {
    moveTowards(sprite, agent.context.targetPosition);
  }

  // Show emotes
  if (state === 'frustrated' && agent.context.frustration > 80) {
    showEmote(sprite, 'angry');
  }
}
```

### Backend (Database Sync)

```typescript
// Persist state changes to Prisma
actor.subscribe(async (snapshot) => {
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      currentState: snapshot.value,
      previousState: snapshot.history?.value,
      energy: snapshot.context.energy,
      frustration: snapshot.context.frustration,
      workload: snapshot.context.workload,
      streak: snapshot.context.streak,
      errorStreak: snapshot.context.errorStreak,
      stateHistory: {
        push: {
          state: snapshot.value,
          timestamp: new Date(),
          context: snapshot.context,
        },
      },
    },
  });
});
```

### WebSocket (Real-time Updates)

```typescript
// Broadcast state changes to connected clients
actor.subscribe((snapshot) => {
  io.to(`village:${villageId}`).emit('agent:state', {
    agentId,
    state: snapshot.value,
    context: snapshot.context,
  });
});
```

## Performance Considerations

- **TICK Events**: Throttle to 10-30 FPS to avoid excessive updates
- **Batch Processing**: Process multiple GitHub events together
- **Debouncing**: Debounce rapid state changes for animations
- **Persistence**: Batch database writes every 5-10 seconds instead of per-event

## Future Enhancements

- [ ] Agent personality traits affecting transition thresholds
- [ ] Team dynamics (nearby agents affecting each other)
- [ ] Learning from past mistakes (adaptive frustration thresholds)
- [ ] Custom state extensions for special agent types
- [ ] State machine visualization tools
- [ ] Historical state analytics and insights

## References

- [XState v5 Documentation](https://stately.ai/docs/xstate)
- [Prisma Schema](../../server/prisma/schema.prisma) - Agent model definition
- [GitHub Webhooks](https://docs.github.com/en/webhooks) - Event payload structure

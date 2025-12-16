# Task ID: 15

**Title:** Set up XState v5 agent state machines

**Status:** done

**Dependencies:** 4 ✓

**Priority:** high

**Description:** Create type-safe state machines for agent behaviors

**Details:**

XState v5.9.0 with TypeScript. States: idle/working/thinking/frustrated/celebrating/resting/socializing/traveling. Guards: energy/frustration thresholds, proximity checks. Actions: position updates, emote triggers, energy decay.

**Test Strategy:**

Test all state transitions, guard conditions, and action side effects with XState test utilities.

# Task ID: 9

**Title:** Refactor Phaser scene structure and camera system

**Status:** done

**Dependencies:** None

**Priority:** high

**Description:** Create core Phaser scenes with smooth camera controls

**Details:**

Phaser v3.80.1. Scenes: BootScene, PreloadScene, VillageScene, HouseScene. Camera: zoom 0.5x-2x (lerp 0.1), pan (drag/edge), bounds checking, follow mode. Use Phaser's built-in camera smoothing.

**Test Strategy:**

Vitest unit tests for camera math. Playwright E2E tests for scene transitions and camera controls.

# Task ID: 11

**Title:** Create Prando seeded RNG and BSP tree generator

**Status:** done

**Dependencies:** 7 ✓

**Priority:** high

**Description:** Implement deterministic BSP layout generation

**Details:**

Prando v3.1.0 seeded from repo+commit SHA256 hash. BSP: split ratios 0.45-0.55, max depth=log(roomCount), min room 4x4 tiles. Verify reproducibility with seed replay.

**Test Strategy:**

Test determinism (same seed=same layout), connectivity, no overlaps. 100+ random seeds.

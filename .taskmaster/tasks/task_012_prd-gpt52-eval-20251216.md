# Task ID: 12

**Title:** Implement room placement, Delaunay triangulation, and corridor generation

**Status:** done

**Dependencies:** 11 ✓

**Priority:** high

**Description:** Complete building layout algorithm

**Details:**

Room placement: shrink BSP leaf by 10% margin, size by module complexity. Delaunay triangulation (d3-delaunay v7.0.2) for room connections. Kruskal's MST with Union-Find + 30% extra edges. L-shaped corridor carving with door placement.

**Test Strategy:**

Verify all rooms connected, no overlaps, reasonable corridor lengths. Test with 10-100 rooms.

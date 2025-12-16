# Task ID: 3

**Title:** Create House CRUD endpoints with repo analysis trigger

**Status:** in-progress

**Dependencies:** 1, 2 ✓

**Priority:** high

**Description:** Implement house management API that triggers repository analysis on creation

**Details:**

Fastify routes: GET /api/houses?villageId=..., POST /api/houses (queue repo analysis with BullMQ v5.3.0), GET /api/houses/:id (populate rooms/agents). Use async queue for repo analysis to prevent blocking. Implement repo analysis service stub.

**Test Strategy:**

Test queue integration, repo analysis triggering, and populated responses. Mock BullMQ and GitHub client.

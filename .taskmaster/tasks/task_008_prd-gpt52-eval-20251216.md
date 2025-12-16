# Task ID: 8

**Title:** Set up webhook endpoint and event processing

**Status:** in-progress

**Dependencies:** 3 ⧖, 6 ✓

**Priority:** high

**Description:** Create secure GitHub webhook handler with async processing

**Details:**

POST /api/webhooks/github with HMAC signature verification (github-webhook-middleware v2.1.1). Route events: push->activity, pr->state, check_run->build. Use BullMQ queue for async processing. Add retry logic and dead letter queue.

**Test Strategy:**

Test signature verification, event routing, and queue integration with real webhook payloads.

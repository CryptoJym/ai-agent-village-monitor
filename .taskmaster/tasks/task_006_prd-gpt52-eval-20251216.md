# Task ID: 6

**Title:** Create GitHub GraphQL client wrapper

**Status:** done

**Dependencies:** 5 ✓

**Priority:** high

**Description:** Build typed GraphQL client with rate limiting and caching

**Details:**

Use graphql-request v7.1.0 with typed schemas from GitHub GraphQL API v4. Implement rate limiting (5000 points/hour) using bottleneck v2.19.5. Add Redis caching (ioredis v5.4.1) with 1h TTL. Batch requests where possible.

**Test Strategy:**

Mock GitHub responses with MSW. Test rate limiting, caching, and error recovery.

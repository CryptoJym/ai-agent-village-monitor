# Testing Quick Start Guide

A quick reference for running tests in the AI Agent Village Monitor project.

## Install Dependencies

```bash
pnpm install
```

## Running Tests

### All Tests
```bash
# Run all unit and integration tests
pnpm test

# Run with coverage reports
pnpm test:coverage

# Watch mode (re-run on file changes)
pnpm test:watch
```

### Backend Tests Only
```bash
# Run all backend tests
pnpm -C packages/server test

# Run specific test file
pnpm -C packages/server test src/__tests__/villages.test.ts

# Run integration tests (requires Docker)
USE_TESTCONTAINERS=true pnpm -C packages/server test:int

# Watch mode
pnpm -C packages/server test --watch
```

### Frontend Tests Only
```bash
# Run all frontend tests
pnpm -C packages/frontend test

# Run specific test file
pnpm -C packages/frontend test test/example.test.tsx

# Watch mode
pnpm -C packages/frontend test --watch
```

### E2E Tests
```bash
# Run all E2E tests (all browsers)
pnpm test:e2e

# Run on specific browser
pnpm test:e2e:chromium
pnpm test:e2e:firefox
pnpm test:e2e:webkit

# Mobile browsers
pnpm test:e2e:mobile

# Interactive UI mode (recommended for development)
pnpm e2e:ui

# Debug mode
pnpm e2e:debug

# Specific test file
pnpm test:e2e tests/e2e/villages.spec.ts
```

### Performance Tests
```bash
# Install Lighthouse CLI (one time)
npm install -g @lhci/cli

# Run Lighthouse audit
pnpm lighthouse

# Mobile audit
pnpm lighthouse:mobile
```

## Writing Tests

### Backend Unit Test Example
```typescript
// packages/server/src/__tests__/myservice.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockPrisma } from '../../test/mocks/prisma';
import { generateMockVillage } from '../../test/helpers';

describe('MyService', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('should do something', async () => {
    const mockVillage = generateMockVillage();
    mockPrisma.village.findUnique.mockResolvedValue(mockVillage);

    const result = await myService.getVillage(1);

    expect(result).toEqual(mockVillage);
    expect(mockPrisma.village.findUnique).toHaveBeenCalledWith({
      where: { id: 1 }
    });
  });
});
```

### Frontend Component Test Example
```typescript
// packages/frontend/src/components/MyComponent.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/helpers';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent name="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### API Integration Test Example
```typescript
// packages/server/src/__tests__/integration/myapi.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('My API', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    const { createApp } = await import('../../app');
    const { signAccessToken } = await import('../../auth/jwt');

    app = createApp();
    authToken = signAccessToken(1, 'testuser');
  });

  it('should create a resource', async () => {
    const response = await request(app)
      .post('/api/resource')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(Number),
      name: 'Test'
    });
  });
});
```

### E2E Test Example
```typescript
// tests/e2e/myfeature.spec.ts
import { test, expect } from '@playwright/test';
import { checkAccessibility } from './helpers';

test.describe('My Feature', () => {
  test('should work correctly', async ({ page }) => {
    await page.goto('/my-feature');

    await page.click('button:has-text("Click Me")');

    await expect(page.locator('.result')).toContainText('Success');

    // Check accessibility
    await checkAccessibility(page);
  });
});
```

## Test Utilities

### Backend Helpers
```typescript
import {
  createTestVillage,
  createTestAgent,
  generateMockVillage,
  generateMockAgent,
  cleanupTestData,
  retry,
  waitFor,
} from '../test/helpers';

// Create test data in database
const village = await createTestVillage(prisma, { name: 'Test' });

// Generate mock data
const mockAgent = generateMockAgent({ status: 'ACTIVE' });

// Cleanup
await cleanupTestData(prisma);

// Retry flaky operations
await retry(() => flakeyOperation(), { retries: 3 });
```

### Frontend Helpers
```typescript
import {
  render,
  screen,
  waitFor,
  generateMockVillage,
  createMockScene,
  mockFetchSuccess,
  mockLocalStorage,
} from '../test/helpers';

// Render with router
render(<MyComponent />, { initialRoute: '/villages/1' });

// Mock API
mockFetchSuccess({ id: 1, name: 'Test' });

// Mock Phaser
const scene = createMockScene();

// Mock localStorage
const storage = mockLocalStorage();
```

### E2E Helpers
```typescript
import {
  checkAccessibility,
  measurePerformance,
  waitForPhaserGame,
  mockApiResponse,
  takeSnapshot,
} from './helpers';

// Accessibility
await checkAccessibility(page);

// Performance
const metrics = await measurePerformance(page);
expect(metrics.domContentLoaded).toBeLessThan(3000);

// Visual regression
await takeSnapshot(page, 'my-page');

// Mock API for E2E
await mockApiResponse(page, /\/api\/villages/, { id: 1, name: 'Test' });
```

## Coverage Reports

### Generate Coverage
```bash
# All packages
VITEST_COVERAGE=true pnpm test

# Backend only
VITEST_COVERAGE=true pnpm -C packages/server test

# Frontend only
VITEST_COVERAGE=true pnpm -C packages/frontend test
```

### View Coverage
```bash
# Open HTML report
open packages/server/coverage/index.html
open packages/frontend/coverage/index.html
```

## Troubleshooting

### Tests not running?
```bash
# Clear cache
rm -rf node_modules/.cache

# Rebuild
pnpm build

# Re-install dependencies
rm -rf node_modules && pnpm install
```

### Playwright issues?
```bash
# Install browsers
pnpm exec playwright install

# Install system dependencies
pnpm exec playwright install-deps

# Clear test results
rm -rf test-results
```

### Database tests failing?
```bash
# Make sure Docker is running
docker ps

# Set environment variable
export USE_TESTCONTAINERS=true

# Run migration
pnpm db:migrate
```

## Test Reports

### Playwright Reports
```bash
# View last test run
pnpm exec playwright show-report test-results/playwright-html

# Reports are in:
# - test-results/playwright-html/index.html (HTML)
# - test-results/playwright-report.json (JSON)
# - test-results/playwright-junit.xml (JUnit)
```

### Coverage Reports
```bash
# Located at:
# - packages/server/coverage/
# - packages/frontend/coverage/
```

## CI/CD

Tests run automatically in GitHub Actions:
- Unit tests on every push
- E2E tests on every PR
- Lighthouse audits on every PR
- Coverage uploaded to CI artifacts

## Quick Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Run with coverage |
| `pnpm test:watch` | Watch mode |
| `pnpm test:e2e` | E2E tests (all browsers) |
| `pnpm e2e:ui` | E2E UI mode |
| `pnpm test:e2e:chromium` | E2E Chromium only |
| `pnpm test:integration` | Integration tests |
| `pnpm lighthouse` | Performance audit |

## Documentation

For detailed documentation, see:
- `docs/TESTING.md` - Comprehensive testing guide
- `TESTING_SETUP_SUMMARY.md` - What was implemented

## Getting Help

If you encounter issues:
1. Check `docs/TESTING.md` troubleshooting section
2. Clear caches and rebuild: `rm -rf node_modules/.cache && pnpm build`
3. Check test output for specific error messages
4. Ensure all dependencies are installed: `pnpm install`

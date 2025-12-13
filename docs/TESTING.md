# Testing Infrastructure

Comprehensive testing setup for the AI Agent Village Monitor project.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [E2E Testing](#e2e-testing)
- [Performance Testing](#performance-testing)
- [Running Tests](#running-tests)
- [Coverage Reports](#coverage-reports)
- [CI/CD Integration](#cicd-integration)

## Overview

This project uses a comprehensive testing strategy with multiple layers:

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and service integration
- **E2E Tests**: Test complete user flows with Playwright
- **Performance Tests**: Lighthouse CI for performance budgets
- **Accessibility Tests**: Axe-core for WCAG compliance

## Test Types

### Unit Tests
- **Backend**: Vitest (packages/server)
- **Frontend**: Vitest with jsdom (packages/frontend)
- **Coverage Target**: 80%+

### Integration Tests
- **API Tests**: Supertest for all endpoints
- **Database Tests**: Testcontainers for real database testing
- **WebSocket Tests**: Socket.IO client testing

### E2E Tests
- **Framework**: Playwright
- **Browsers**: Chromium, Firefox, WebKit, Mobile
- **Features**: Visual regression, accessibility, performance

### Performance Tests
- **Tool**: Lighthouse CI
- **Metrics**: Core Web Vitals, LCP, FID, CLS
- **Budget**: Performance score >= 80

## Backend Testing

### Location
```
packages/server/
├── src/__tests__/          # Unit tests
│   ├── integration/       # API integration tests
│   └── *.test.ts         # Unit test files
├── test/                  # Test utilities
│   ├── helpers.ts        # Test data factories
│   ├── mocks/           # Mock implementations
│   └── setup.ts         # Test setup
├── jest.config.js        # Jest config (alternative)
└── vitest.config.ts      # Vitest config (primary)
```

### Running Backend Tests

```bash
# Run all tests
pnpm -C packages/server test

# Run with coverage
VITEST_COVERAGE=true pnpm -C packages/server test

# Run integration tests with testcontainers
USE_TESTCONTAINERS=true pnpm -C packages/server test:int

# Run specific test file
pnpm -C packages/server test src/__tests__/villages.test.ts

# Watch mode
pnpm -C packages/server test --watch
```

### Test Utilities

#### Mock Prisma Client
```typescript
import { createMockPrisma } from '../test/mocks/prisma';

const mockPrisma = createMockPrisma();
mockPrisma.village.create.mockResolvedValue({ id: 1, name: 'Test' });
```

#### Test Data Factories
```typescript
import { createTestVillage, generateMockAgent } from '../test/helpers';

const village = await createTestVillage(prisma, { name: 'Test Village' });
const mockAgent = generateMockAgent({ status: 'ACTIVE' });
```

### Integration Tests

#### Villages API
- `POST /api/villages` - Create village
- `GET /api/villages` - List villages
- `GET /api/villages/:id` - Get village
- `PATCH /api/villages/:id` - Update village
- `DELETE /api/villages/:id` - Delete village

#### Agents API
- Full CRUD operations
- Status updates
- Activity tracking
- Heartbeat updates

#### Houses & Rooms API
- Nested resource management
- Cascade deletion
- Position validation

## Frontend Testing

### Location
```
packages/frontend/
├── src/__tests__/         # Component tests (future)
├── test/                  # Test utilities
│   ├── helpers.tsx       # Render helpers
│   ├── setup.ts         # Test setup
│   └── stubs/           # Phaser mocks
└── vitest.config.ts      # Vitest config
```

### Running Frontend Tests

```bash
# Run all tests
pnpm -C packages/frontend test

# Run with coverage
VITEST_COVERAGE=true pnpm -C packages/frontend test

# Watch mode
pnpm -C packages/frontend test --watch
```

### Test Utilities

#### Render with Providers
```typescript
import { render, screen } from '../test/helpers';

render(<MyComponent />, { initialRoute: '/villages/1' });
expect(screen.getByText('Hello')).toBeInTheDocument();
```

#### Mock Phaser Scene
```typescript
import { createMockScene } from '../test/helpers';

const scene = createMockScene();
const container = scene.add.container();
expect(scene.add.container).toHaveBeenCalled();
```

#### Mock API Responses
```typescript
import { mockFetchSuccess, mockFetchError } from '../test/helpers';

mockFetchSuccess({ id: 1, name: 'Test' });
await fetch('/api/test'); // Returns mocked data

mockFetchError(404, 'Not Found');
```

## E2E Testing

### Location
```
tests/e2e/
├── villages.spec.ts      # Village CRUD flows
├── agents.spec.ts        # Agent interactions
├── helpers.ts           # E2E test utilities
└── ...
```

### Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run in UI mode
pnpm e2e:ui

# Run specific browser
pnpm test:e2e --project=chromium

# Run specific test file
pnpm test:e2e tests/e2e/villages.spec.ts

# Debug mode
pnpm test:e2e --debug
```

### Multi-Browser Testing

Tests run on:
- Desktop Chrome (1920x1080)
- Desktop Firefox (1920x1080)
- Desktop Safari (1920x1080)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Accessibility Testing

```typescript
import { checkAccessibility } from './helpers';

test('should be accessible', async ({ page }) => {
  await page.goto('/villages');
  await checkAccessibility(page); // Runs axe-core
});
```

### Visual Regression

```typescript
import { takeSnapshot } from './helpers';

test('should match snapshot', async ({ page }) => {
  await page.goto('/villages');
  await takeSnapshot(page, 'villages-page');
});
```

### Performance Metrics

```typescript
import { measurePerformance } from './helpers';

test('should load quickly', async ({ page }) => {
  await page.goto('/');
  const metrics = await measurePerformance(page);
  expect(metrics.domContentLoaded).toBeLessThan(3000);
});
```

## Performance Testing

### Lighthouse CI

#### Configuration
See `lighthouserc.js` for performance budgets:
- Performance: >= 80
- Accessibility: >= 90
- Best Practices: >= 90
- SEO: >= 80

#### Running Lighthouse

```bash
# Install globally
npm install -g @lhci/cli

# Run audit
lhci autorun

# Custom URL
lhci autorun --url=http://localhost:4173/villages
```

#### Core Web Vitals Budgets
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- TBT (Total Blocking Time): < 300ms

## Running Tests

### All Tests

```bash
# Run all tests (unit + integration + e2e)
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run only e2e tests
pnpm test:e2e
```

### Individual Packages

```bash
# Backend tests
pnpm -C packages/server test

# Frontend tests
pnpm -C packages/frontend test
```

### Watch Mode

```bash
# Backend watch
pnpm -C packages/server test --watch

# Frontend watch
pnpm -C packages/frontend test --watch
```

## Coverage Reports

### Generate Coverage

```bash
# Backend coverage
VITEST_COVERAGE=true pnpm -C packages/server test

# Frontend coverage
VITEST_COVERAGE=true pnpm -C packages/frontend test
```

### View Coverage Reports

```bash
# Open HTML coverage report
open packages/server/coverage/index.html
open packages/frontend/coverage/index.html
```

### Coverage Thresholds

**Backend:**
- Lines: 80%
- Functions: 80%
- Statements: 80%
- Branches: 70%

**Frontend:**
- Lines: 70%
- Functions: 70%
- Statements: 70%
- Branches: 65%

## CI/CD Integration

### GitHub Actions

#### Test Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test
```

#### Lighthouse Workflow
See `.github/workflows/lighthouse.yml` for performance testing in CI.

### Test Reports

Playwright generates multiple report formats:
- HTML: `test-results/playwright-html/index.html`
- JSON: `test-results/playwright-report.json`
- JUnit: `test-results/playwright-junit.xml`

## Best Practices

### Writing Tests

1. **Use descriptive test names**
   ```typescript
   it('should create a village with valid data', async () => {
     // Test implementation
   });
   ```

2. **Arrange-Act-Assert pattern**
   ```typescript
   // Arrange
   const data = { name: 'Test' };

   // Act
   const result = await createVillage(data);

   // Assert
   expect(result).toMatchObject(data);
   ```

3. **Use test utilities**
   ```typescript
   import { createTestVillage } from '../test/helpers';
   const village = await createTestVillage(prisma);
   ```

4. **Clean up after tests**
   ```typescript
   afterAll(async () => {
     await cleanupTestData(prisma);
   });
   ```

### Test Isolation

- Each test should be independent
- Use `beforeEach` for test setup
- Clean up resources in `afterEach`/`afterAll`
- Don't rely on test execution order

### Mocking

- Mock external dependencies
- Use real database for integration tests with testcontainers
- Mock Phaser for frontend unit tests
- Use network mocking for E2E tests when needed

## Troubleshooting

### Tests Failing Locally

```bash
# Clear test cache
rm -rf node_modules/.cache

# Rebuild
pnpm build

# Run tests with more verbose output
pnpm test --reporter=verbose
```

### Playwright Issues

```bash
# Install browsers
pnpm exec playwright install

# Install system dependencies
pnpm exec playwright install-deps

# Clear Playwright cache
rm -rf test-results
```

### Coverage Issues

```bash
# Clean coverage directory
rm -rf coverage

# Run coverage with v8 provider
VITEST_COVERAGE=true pnpm test
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Axe Accessibility](https://www.deque.com/axe/)

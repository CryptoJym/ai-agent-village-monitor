# Testing Guide

Comprehensive testing infrastructure for the AI Agent Village Monitor RPG system.

## Overview

This project uses **Vitest** for both backend and frontend testing, with:
- 80%+ code coverage target
- Unit tests with mocked dependencies
- Integration tests with real database
- Component tests with React Testing Library
- E2E tests with Playwright
- CI/CD integration with GitHub Actions

## Test Structure

```
packages/
├── server/
│   ├── vitest.config.ts         # Backend test configuration
│   ├── test/
│   │   ├── setup.ts             # Global test setup
│   │   ├── helpers.ts           # Test helper functions
│   │   └── mocks/
│   │       └── prisma.ts        # Prisma mock client
│   └── src/__tests__/
│       ├── utils/               # Test utilities
│       │   ├── db.ts            # Database test utilities
│       │   ├── auth.ts          # Authentication mocking
│       │   └── fixtures.ts      # Test data factories
│       ├── integration/         # Integration tests
│       │   ├── villages.test.ts
│       │   ├── houses.test.ts
│       │   ├── agents.test.ts
│       │   └── rooms.test.ts
│       └── *.test.ts            # Unit tests alongside source
│
└── frontend/
    ├── vitest.config.ts         # Frontend test configuration
    ├── test/
    │   ├── setup.ts             # Global test setup
    │   ├── helpers.tsx          # React test helpers
    │   └── stubs/
    │       ├── phaser.ts        # Phaser mock for jsdom
    │       └── phaser3spectorjs.ts
    └── src/
        └── **/*.test.tsx        # Component tests
```

## Running Tests

### Root Level Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run with coverage reporting
pnpm test:coverage

# Run tests in CI mode (with JUnit reporter)
pnpm test:ci

# Run E2E tests with Playwright
pnpm test:e2e
pnpm test:e2e:ui         # With UI mode
pnpm test:e2e:debug      # With debugging
```

### Backend Tests (packages/server)

```bash
cd packages/server

# Run all backend tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run only unit tests (excluding integration)
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run with coverage
pnpm test:coverage

# Run in CI mode
pnpm test:ci
```

### Frontend Tests (packages/frontend)

```bash
cd packages/frontend

# Run all frontend tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run only unit tests
pnpm test:unit

# Run with coverage
pnpm test:coverage

# Run in CI mode
pnpm test:ci
```

## Backend Testing

### Unit Tests

Unit tests use mocked dependencies for isolated testing:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockPrisma } from '../../test/mocks/prisma';
import { generateMockVillage } from '../../test/helpers';

describe('VillageService', () => {
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('should create a village', async () => {
    const mockVillage = generateMockVillage({ name: 'Test Village' });
    mockPrisma.village.create.mockResolvedValue(mockVillage);

    const result = await villageService.create(mockPrisma, {
      name: 'Test Village',
    });

    expect(result.name).toBe('Test Village');
  });
});
```

### Integration Tests

Integration tests use a real database with transaction rollback for isolation:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../utils/db';
import { getAuthHeaders, generateTestToken } from '../utils/auth';

describe('Villages API', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('should create a village', async () => {
    const response = await request(app)
      .post('/api/villages')
      .set(getAuthHeaders())
      .send({ name: 'Test Village' })
      .expect(201);

    expect(response.body.name).toBe('Test Village');
  });
});
```

### Test Utilities

#### Database Utilities (`src/__tests__/utils/db.ts`)

- `setupTestDatabase()` - Initialize test database
- `teardownTestDatabase()` - Clean up test database
- `cleanDatabase(prisma)` - Delete all test data
- `seedTestData(prisma)` - Create basic test data
- `withTestTransaction(callback)` - Run test in transaction

#### Authentication Utilities (`src/__tests__/utils/auth.ts`)

- `generateTestToken(payload)` - Create JWT token
- `getAuthHeaders(token)` - Get Bearer auth headers
- `getCookieHeaders(token)` - Get cookie headers
- `mockAuthMiddleware(user)` - Mock auth middleware
- `createAuthenticatedRequest(user)` - Create mock request

#### Test Fixtures (`src/__tests__/utils/fixtures.ts`)

Factory functions for creating test data:
- `createVillageFixture(options)` - Create village mock
- `createHouseFixture(options)` - Create house mock
- `createAgentFixture(options)` - Create agent mock
- `createRoomFixture(options)` - Create room mock
- `createUserFixture(options)` - Create user mock

## Frontend Testing

### Component Tests

Component tests use React Testing Library:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VillageCard } from './VillageCard';

describe('VillageCard', () => {
  it('should render village name', () => {
    render(<VillageCard village={{ name: 'Test Village' }} />);
    expect(screen.getByText('Test Village')).toBeInTheDocument();
  });
});
```

### Phaser Mocks

Phaser is automatically stubbed in tests to avoid Canvas dependencies:

```typescript
// Automatically mocked via vitest.config.ts alias
import Phaser from 'phaser'; // Uses test/stubs/phaser.ts

// No special setup needed - just import and use
```

## Coverage Reports

### Viewing Coverage

After running tests with coverage:

```bash
pnpm test:coverage

# Open HTML report
open packages/server/coverage/index.html    # Backend
open packages/frontend/coverage/index.html  # Frontend
```

### Coverage Thresholds

**Backend (packages/server):**
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

**Frontend (packages/frontend):**
- Lines: 70%
- Functions: 70%
- Branches: 65%
- Statements: 70%

## CI/CD Integration

Tests run automatically on:
- Pull requests to `main`/`master`
- Pushes to `main`/`master`
- Manual workflow dispatch

### GitHub Actions Workflows

**`.github/workflows/ci.yml`** includes:

1. **Lint Job** - ESLint checks
2. **Type Check Job** - TypeScript compilation
3. **Unit Tests Job** - Unit tests with coverage (matrix: frontend, server)
4. **Integration Tests Job** - API integration tests with SQLite
5. **E2E Tests Job** - Playwright end-to-end tests

Coverage reports are uploaded to Codecov after each test run.

### CI Environment Variables

Required in GitHub Actions:
- `JWT_SECRET` - JWT signing secret
- `DATABASE_URL` - Database connection (SQLite in CI)
- `REDIS_URL` - Redis connection

## Best Practices

### Test Organization

1. **Co-locate unit tests** - Place unit tests next to source files
2. **Separate integration tests** - Keep integration tests in `__tests__/integration/`
3. **Use descriptive names** - Test names should describe behavior
4. **Follow AAA pattern** - Arrange, Act, Assert

### Writing Tests

```typescript
describe('Feature', () => {
  // Group related tests
  describe('when condition', () => {
    // Setup
    beforeEach(() => {
      // Arrange
    });

    it('should do something specific', () => {
      // Arrange - setup test data
      const input = { name: 'Test' };

      // Act - perform action
      const result = doSomething(input);

      // Assert - verify result
      expect(result).toMatchObject({ name: 'Test' });
    });
  });
});
```

### Test Data

1. **Use fixtures** - Use factory functions for consistent test data
2. **Randomize IDs** - Use `Date.now()` or random values to avoid conflicts
3. **Clean up** - Always clean database between tests
4. **Isolate tests** - Each test should be independent

### Mocking

1. **Mock external dependencies** - API calls, third-party services
2. **Use real database for integration tests** - Test actual queries
3. **Mock auth in unit tests** - Use `mockAuthMiddleware()`
4. **Stub Phaser in frontend tests** - Automatically handled

## Debugging Tests

### Run single test file

```bash
pnpm test path/to/test.test.ts
```

### Run single test case

```bash
pnpm test -t "test name pattern"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Current Test",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${relativeFile}"],
  "cwd": "${workspaceFolder}",
  "console": "integratedTerminal"
}
```

### Verbose output

```bash
pnpm test --reporter=verbose
```

## Common Issues

### Database locked errors

**Solution:** Ensure tests clean up connections:

```typescript
afterAll(async () => {
  await teardownTestDatabase();
});
```

### Timeout errors

**Solution:** Increase timeout in test:

```typescript
it('slow test', async () => {
  // test code
}, 30000); // 30 second timeout
```

### Prisma client errors

**Solution:** Generate Prisma client before tests:

```bash
pnpm -C packages/server prisma:generate
```

### Canvas/WebGL errors in frontend tests

**Solution:** Already handled by Phaser stubs. If you see errors, ensure:
- `test/stubs/phaser.ts` exists
- `vitest.config.ts` has correct alias

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure tests pass locally
3. Check coverage meets thresholds
4. Add integration tests for API endpoints
5. Add component tests for UI changes
6. Update this guide if needed

## Support

For questions or issues with testing:
- Check existing tests for examples
- Review test utilities in `src/__tests__/utils/`
- Consult this guide
- Ask in project discussions

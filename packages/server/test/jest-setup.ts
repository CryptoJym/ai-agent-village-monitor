/**
 * Jest global setup
 * This file runs before all tests when using Jest
 */

// Ensure JWT secret is available
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

// Disable database tests by default
process.env.DISABLE_DB_TESTS = process.env.DISABLE_DB_TESTS || 'true';

// Skip GitHub API tests by default
process.env.SKIP_GH_TESTS = process.env.SKIP_GH_TESTS || 'true';

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);

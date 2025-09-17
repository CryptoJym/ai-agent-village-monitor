// Ensure JWT secret available before any imports
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

// Disable DB-dependent integration in default test runs
process.env.DISABLE_DB_TESTS = 'true';
// Skip GitHub API tests by default unless explicitly enabled
if (!process.env.SKIP_GH_TESTS) process.env.SKIP_GH_TESTS = 'true';

import { describe, it } from 'vitest';

// This suite is a placeholder for a true live OAuth E2E hitting GitHub.
// It is skipped by default and documents the manual steps and env required.
//
// To enable:
// 1) Create a GitHub OAuth App with callback: ${PUBLIC_SERVER_URL}/auth/github/callback
// 2) Set env: GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, JWT_SECRET,
//    PUBLIC_SERVER_URL (e.g., http://localhost:3000), PUBLIC_APP_URL.
// 3) Start the server (packages/server) on the same PUBLIC_SERVER_URL host/port.
// 4) Unskip this test and run `pnpm -C packages/server test`.
// 5) The test will open /auth/login, follow redirects in a real browser (manual),
//    then assert cookies and /auth/me profile in the same session.

describe.skip('GitHub OAuth (live E2E in test org)', () => {
  it('manual flow: login → approve → callback → me', async () => {
    // Manual runbook:
    // - Navigate to http://localhost:3000/auth/login in a real browser
    // - Approve the OAuth consent for the configured test org
    // - Verify that you are redirected to PUBLIC_APP_URL and that cookies are set
    // - Call GET /auth/me and confirm your GitHub username is returned
    // - Optionally test POST /auth/refresh and POST /auth/logout flows
  });
});


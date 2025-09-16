GitHub OAuth App Setup

Follow these steps to enable the GitHub OAuth 2.0 login flow for the server.

Prerequisites
- A GitHub account and (optionally) an organization where you can register an OAuth App.
- The server running locally at `http://localhost:3000` (default) or reachable on a public URL.

1) Create an OAuth App
- Navigate to: https://github.com/settings/developers (or org-level: https://github.com/organizations/<your-org>/settings/applications)
- Click "New OAuth App"
- Application name: AI Agent Village Monitor (local)
- Homepage URL: `http://localhost:5173` (or your frontend URL)
- Authorization callback URL:
  - Local: `http://localhost:3000/auth/github/callback`
  - Production: `https://<your-domain>/auth/github/callback`
- Save and note the Client ID and Client Secret.

2) Configure environment variables
Create or update `.env` (repo root or `packages/server/.env`):

GITHUB_OAUTH_CLIENT_ID="<client_id>"
GITHUB_OAUTH_CLIENT_SECRET="<client_secret>"
JWT_SECRET="a-long-random-secret"
PUBLIC_SERVER_URL="http://localhost:3000"
PUBLIC_APP_URL="http://localhost:5173"
OAUTH_REDIRECT_URI="http://localhost:3000/auth/github/callback"
# Add 'repo' scope only if you truly need private repo access
OAUTH_SCOPES="read:user read:org workflow"
COOKIE_DOMAIN="localhost" # Set to ".example.com" in production

3) Run the server

pnpm -F @ai-agent-village-monitor/server dev

4) Test the flow
- Open `http://localhost:3000/auth/login`
- Sign in with GitHub and authorize the app
- You will be redirected to `PUBLIC_APP_URL` (default `http://localhost:5173`)
- Call `GET http://localhost:3000/auth/me` from the browser (same-site cookies are used) to verify login
- Logout via `POST http://localhost:3000/auth/logout`

Security Notes
- Tokens are never stored in plaintext; we persist a salted SHA-256 hash of the GitHub access token.
- Access token cookie is HttpOnly and SameSite=Lax; Secure=true in production.
- CORS is restricted to `PUBLIC_APP_URL` and uses credentials.
- The OAuth state parameter and PKCE (S256) are used to protect against CSRF and code interception.

Troubleshooting
- 401 on `/auth/me`: Ensure cookies are sent (same-site) or use `credentials: 'include'` if you make cross-origin requests explicitly.
- Callback mismatch: Confirm `OAUTH_REDIRECT_URI` matches the Authorization callback URL in your OAuth App.
- Missing env: In production, the server requires `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `JWT_SECRET`, and either `OAUTH_REDIRECT_URI` or `PUBLIC_SERVER_URL`.


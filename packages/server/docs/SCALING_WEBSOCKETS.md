WebSocket Scaling & Stickiness Strategy

Overview

- Socket.IO is configured to use Redis adapter when `REDIS_URL` is set, allowing multi-instance scaling.
- CORS and WS origins are restricted via `CORS_ALLOWED_ORIGINS` and `WS_ALLOWED_ORIGINS` (comma-separated).
- For production, prefer `websocket` transport to reduce reliance on HTTP long-polling and sticky sessions.

Configuration

- Allowed origins:
  - HTTP CORS: `CORS_ALLOWED_ORIGINS="https://app.example.com"`
  - WS origins: `WS_ALLOWED_ORIGINS="https://app.example.com"`
- Transports:
  - `WS_TRANSPORTS=websocket` (recommended in production)
  - Default is `websocket,polling` (dev-friendly)
- Redis adapter:
  - `REDIS_URL=redis://user:pass@host:6379/0`

Load Balancer Stickiness

- If `polling` transport is enabled, enable sticky sessions at your load balancer:
  - NGINX example:
    upstream app_backend { server app-1; server app-2; sticky cookie io expires=1h domain=.example.com path=/; }
    map $http_upgrade $connection_upgrade { default upgrade; '' close; }
    server {
    location /socket.io/ {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_pass http://app_backend;
    }
    }
- Alternatively, avoid `polling` by setting `WS_TRANSPORTS=websocket`.

Security

- Only allow known origins. The server rejects unknown origins during the WS handshake.
- Helmet CSP includes `connect-src` with allowed origins.

Troubleshooting

- Connection errors with message like `xhr poll error` are often due to missing stickiness when `polling` is enabled.
- Verify Redis adapter logs and connectivity when scaling across instances.

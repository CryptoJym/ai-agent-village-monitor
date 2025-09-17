# Frontend Deployment on Vercel (Task 87.1)

This project uses a pnpm monorepo. Deploy the frontend (`packages/frontend`) to Vercel with a custom domain and HSTS.

## 1) Project setup

- In Vercel, create a new project from this repo.
- Set “Root Directory” to `packages/frontend`.
- Build command: `pnpm build` (Vercel detects; package.json already defines `build`).
- Output: `dist` (default Vite output).

## 2) Custom domain and HTTPS

- Add your domain (e.g., `app.example.com`) to the project in Vercel → Domains.
- Create DNS record:
  - Subdomain: CNAME `app.example.com` → `{project}.vercel.app`
  - Apex: use A/ALIAS per provider docs.
- Enable “Enforce HTTPS”. Vercel will issue TLS automatically.

## 3) HSTS and headers

- `packages/frontend/vercel.json` is included and adds:
  - HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - SPA rewrite: `/(.*)` → `/index.html`
  - Additional headers: Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
- After going live, optionally submit your domain to hstspreload.org.

## 4) Capture frontend origins

Record these for backend CORS/WS allowlists (env `WS_ALLOWED_ORIGINS`):

- `https://app.example.com`
- Your Vercel preview domain: `https://<project>-<hash>.vercel.app`

## 5) Environment (frontend)

If needed, add public vars in Vercel → Settings → Environment Variables:

- `VITE_API_ORIGIN` → `https://api.example.com`
- `VITE_WS_URL` → `wss://api.example.com`

> Next steps: proceed with 87.2/87.3 to provision backend and wire CORS/WS origins.

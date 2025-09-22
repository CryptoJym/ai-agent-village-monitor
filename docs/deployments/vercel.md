# Frontend on Vercel

The frontend builds as a fully static bundle, but it still needs to talk to the Express backend (API + Socket.IO). Set the following environment variables in your Vercel project before triggering a production deployment:

| Vercel Env Var                 | Example                                       | Notes                                                                                                                          |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `BACKEND_URL`                  | `https://ai-agent-village.up.railway.app`     | Base origin (no trailing slash). All `/api`, `/auth`, and `/socket.io` traffic is rewritten here via `vercel.json`.            |
| `VITE_API_BASE_URL` (optional) | `https://ai-agent-village.up.railway.app/api` | Only needed if you want the statically-built bundle to bake in the backend URL. With the rewrite in place this can be omitted. |
| `VITE_WS_URL` (optional)       | `wss://ai-agent-village.up.railway.app`       | Override only if you want the Socket.IO client to skip the rewrite and connect directly.                                       |

After setting the env vars, redeploy (`vercel deploy --prod`) so the rewrites take effect. Verify:

```bash
curl -i https://<your-vercel-app>/api/health
# HTTP/1.1 200 ... (proxied response from backend)
```

If you see a `404`, double-check `BACKEND_URL` and that the backend is publicly reachable.

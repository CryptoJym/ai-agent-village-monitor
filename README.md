# AI Agent Village Monitor

> A playful control center for your AI teammate fleet. Villages are orgs, houses are repos, agents are the autonomous workers keeping everything humming.

We are turning this project into a fully open-source, community-driven beta. If you love shipping with AI copilots, observability dashboards, and thoughtful UX, you are in the right place. Join us to polish the experience, stress-test real-world workflows, and shape the roadmap.

---

## ✨ Highlights

- **Spatial operations view** – Phaser-powered "village" world that visualizes agents, repos, and live status at a glance.
- **Task & command orchestration** – Start, stop, and steer agents with optimistic feedback, audit trails, and queue awareness.
- **GitHub-native integrations** – OAuth, repo sync, webhook dedupe, and BullMQ pipelines for background automation.
- **Privacy-first analytics** – DNT/GPC aware telemetry with opt-outs, hashed identifiers, and strong defaults.
- **Battle-tested backend** – Express + Prisma + Socket.IO, integration-tests via Testcontainers, and a growing observability toolkit.

---

## 🧱 Monorepo at a Glance

```
.
├── packages/
│   ├── frontend   # Vite + React + Phaser app (UI, tests, e2e fixtures)
│   ├── server     # Express API, WebSockets, BullMQ queues, Prisma schema
│   └── shared     # Shared TypeScript types and utilities
├── docs/          # Architecture, PRDs, deployment guides, runbooks
├── task-master/   # Task Master automation & project plan artifacts
└── ...            # Tooling, scripts, configs
```

Key references:

- [Architecture overview](docs/ARCHITECTURE.md)
- [Product requirements](docs/PRD.md)
- [Launch playbooks](docs/launch/)
- [Staging & deployment guides](docs/STAGING.md), [deploy-production.md](docs/deploy-production.md)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- `pnpm` 9+
- Optional: Docker (for Postgres/Redis via `docker compose`)

### Install & Seed

```bash
pnpm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, etc.
pnpm prisma:generate        # Prisma client (runs in server package)
```

### Run Everything (dev mode)

```bash
pnpm -w dev                 # frontend + server in parallel
```

Frontend dev server → http://localhost:5173  
API & WebSockets → http://localhost:3000

### Verify

```bash
pnpm -w lint
pnpm -r test                # Vitest suites (frontend + server)
pnpm -w build               # Production builds
pnpm e2e:preview            # Playwright smoke (Phaser preview)
```

For staging/soak environments, follow [`docs/STAGING.md`](docs/STAGING.md). Deployment recipes for Vercel + Railway live in [`docs/deploy-production.md`](docs/deploy-production.md).

---

## 🧪 Testing & Quality

| Command                                | Scope                                            |
| -------------------------------------- | ------------------------------------------------ |
| `pnpm -r test`                         | Vitest (frontend & server)                       |
| `pnpm lint:strict`                     | ESLint with zero-warning budget                  |
| `pnpm e2e:preview`                     | Playwright UI journey (runs Vite preview server) |
| `pnpm -C packages/server test:int`     | Server integration tests (Testcontainers)        |
| `pnpm -C packages/server load:run:all` | Load & soak scripts (BullMQ, WS)                 |

Artifacts go to `test-results/` and Playwright stores traces in `playwright-report/`.

---

## 🌍 Join the Beta

We are preparing a public beta with:

- Vercel-hosted frontend & Railway backend
- GitHub OAuth setup, WebSocket stickiness, and Redis-backed queues
- Observability dashboards and alerting per `docs/launch/observability.md`

Want early access? Open an issue tagged `beta-volunteer` or reach out via Discussions. We will coordinate staging invites, seed data, and feedback loops.

### Asset Pack Needed

The Phaser preload expects the following directories to be populated:

- `packages/frontend/public/assets/agents/<archetype>/` (rotations + animation frames)
- `packages/frontend/public/assets/emotes/<key>/` and `bug-bots/<key>/` (frame stacks)
- `packages/frontend/public/assets/houses/house_<language>.png`
- `packages/frontend/public/assets/tiles/(biome|interior)/<theme>/` (`tileset.png`, `metadata.json`, `wang-metadata.json`)
- `packages/frontend/public/assets/interiors/<theme>/props/*.png`
- Optional celebratory SFX: `packages/frontend/public/assets/audio/celebrate.mp3` (retro ambience is generated procedurally via WebAudio)

If you are a designer or audio tinkerer, contributions here are hugely appreciated. Drop assets in those paths or submit a PR with new filenames + manifest updates (`packages/frontend/src/assets/atlases.ts` and `packages/frontend/src/assets/pixellabManifest.ts`).

---

## 🤝 Contributing

1. **Find an issue** – Browse [Issues](https://github.com/CryptoJym/ai-agent-village-monitor/issues), the [ROADMAP](ROADMAP.md), or the Task Master board in `.taskmaster/`.
2. **Create a branch** – `git checkout -b feature/<short-description>`
3. **Write code & tests** – Keep packages scoped; favor TypeScript; run lint/tests/build locally.
4. **Document** – Update README, docs, or PRDs when behavior changes.
5. **Conventional commits** – `feat(frontend): add house dashboard (task 68.5)`
6. **Open a PR** – Include test plan, screenshots/gifs for UI, and reference Task IDs when applicable.

Refer to:

- [CONTRIBUTING](CONTRIBUTING.md)
- [CODE OF CONDUCT](CODE_OF_CONDUCT.md)
- [SECURITY](SECURITY.md) for vulnerability reporting

If you are new to open source, check out `docs/developer/` for setup notes and checklists.

---

## 📚 Helpful Documentation

- **Getting Started Guide** – `docs/GETTING_STARTED.md`
- **Deployment runbooks** – `docs/deploy-production.md`, `docs/launch/runbook.md`
- **Load testing** – `docs/LOAD_TESTING.md`
- **Privacy & compliance** – `docs/PRIVACY.md`
- **MCP integration** – `docs/MCP_INTEGRATION.md`

We try to keep documentation living close to code. If something is out-of-date, open an issue or PR!

---

## 🗺️ Roadmap

Near-term focus:

- Polish asset pipeline and art direction for beta launch
- Harden GitHub Actions dispatch flows and Probot webhook coverage
- Expand analytics & KPI dashboards with opt-in telemetry
- Finalize CI/CD (GitHub Actions) and automated security checks

See the [ROADMAP](ROADMAP.md) and Task Master exports for detailed milestones.

---

## 💬 Community & Support

- Issues: [github.com/CryptoJym/ai-agent-village-monitor/issues](https://github.com/CryptoJym/ai-agent-village-monitor/issues)
- Discussions: use the GitHub Discussions tab for ideas, showcase, and questions
- Security: follow the process in [`SECURITY.md`](SECURITY.md)

We care about a welcoming community. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before engaging.

---

## 📄 License

MIT – see [LICENSE](LICENSE).

If you build something with the Agent Village Monitor, let us know! We are especially excited to showcase creative agent workflows, custom asset packs, and integrations that push the boundaries of autonomous dev tooling.

Welcome to the village. 🏡🤖

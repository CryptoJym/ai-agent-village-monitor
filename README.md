# AI Agent Village Monitor (MVP)

Gamified, spatial UI for managing AI agents across GitHub organizations. Villages represent orgs, houses represent repos, and agent sprites show real‑time activity with full control parity via MCP.

## Repo Layout (initial)

- `docs/PRD.md` — Product Requirements Document (source of truth)
- `task-master/plan.json` — Parsed plan extracted from the PRD
- `task-master/cli.mjs` — Lightweight Task‑master CLI (uses `gh` to open issues)
- `scripts/gantt.py` — Gantt chart generator for 6‑week MVP plan

## Quickstart

1) Ensure prerequisites:
   - Node.js 18+
   - GitHub CLI `gh` authenticated (`gh auth login`)
   - Python 3.10+ (optional for Gantt)

2) Inspect the plan
```
node task-master/cli.mjs list --phase foundation
node task-master/cli.mjs list --week 1
```

3) Open GitHub issues from the plan (creates week/milestone issues)
```
node task-master/cli.mjs issues:create --weeks 1,2,3,4,5,6
```

4) Generate the Gantt chart (optional)
```
python3 -m pip install plotly kaleido pandas
python3 scripts/gantt.py
```

## Next Steps

- Scaffold `apps/web` (Vite + React + Phaser) and `apps/server` (Express + TS)
- Connect MCP SDK and GitHub OAuth
- Stand up Probot app for Bug Bots

## License

TBD


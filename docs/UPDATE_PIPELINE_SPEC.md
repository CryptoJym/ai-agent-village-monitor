# Runtime Update & Compatibility Pipeline Spec

"New Codex/Claude/Gemini update drops → we adapt safely and fast"

## 0) Summary

This pipeline ensures the platform stays compatible with fast-changing CLIs by:

- detecting upstream updates
- validating via compatibility tests (canary)
- rolling out in stable/beta channels
- optionally triggering repo patrol "improvement sweeps" after upgrades

This is a **revenue + trust** feature:

- paid tiers can get "fast channel" updates
- enterprise can pin versions, require signed builds, and demand auditability

---

## 1) Goals

1. Detect updates for:
   - Codex CLI
   - Claude Code
   - Gemini CLI
   - internal adapters / runner components
2. Prevent regressions via:
   - canary testing on a controlled set of repos
3. Support rollout strategies:
   - stable channel (default)
   - beta channel (opt-in)
   - pinned enterprise versions
4. Trigger repo review sweeps when upgrades land:
   - re-run health checks
   - generate PRs faster using improved tooling/model behaviors
5. Provide visibility:
   - dashboard of versions
   - "known good" registry

---

## 2) Non-goals (MVP)

- Automatically upgrading customer-hosted runners without explicit consent.
- Building a public blockchain ledger for updates.

---

## 3) Architecture Components

### 3.1 Version Watchers

A scheduled job (Control Plane) that checks:

- current deployed versions (from runner heartbeats)
- latest available versions (from upstream or internal registry)

### 3.2 Compatibility Lab

A deterministic test environment that can:

- launch runner builds with candidate versions
- run contract test suites (adapter + runner)
- run "golden path" workflows on sample repos

### 3.3 Release Channels

- **stable**: default; only after canary passes
- **beta**: opt-in; canary required but less conservative
- **pinned**: enterprise; updates only by explicit admin action

### 3.4 Known-Good Registry

A database table that stores:

- provider versions
- adapter versions
- runner versions
- compatibility results
- recommended flags/modes

---

## 4) Update Detection Strategies

Different environments require different methods:

### 4.1 Hosted Runner (you control infra)

- Watch upstream releases and package registries (server-side internet access OK)
- Build new runner images with new CLI versions
- Run canary tests
- Roll out automatically

### 4.2 Customer-Hosted Runner

- Runner reports installed versions to Control Plane
- Control Plane can notify: "new version available"
- Customer decides when to upgrade
- Provide a one-command upgrade script and release notes

---

## 5) Canary Test Plan (Compatibility Lab)

### 5.1 Minimum test suite (per provider update)

1. Start a session in a sample repo
2. Perform a small edit task:
   - change a string
   - update a function
3. Run tests (or a dummy command) and capture exit codes
4. Produce a diff and open a draft PR (if configured)
5. Validate approval gating:
   - attempt a "risky action" and ensure it is blocked without approval
6. Validate metering:
   - USAGE_TICK emitted properly

### 5.2 Test inputs

- Use 2–3 internal "canary repos":
  - small JS/TS repo
  - small Python repo (optional)
  - repo with CI configured (ideal)

---

## 6) Rollout Policy

### 6.1 Hosted runner rollout

- Deploy candidate to 1% of sessions
- Monitor:
  - failure rate
  - session start latency
  - terminal disconnect rate
- Increase to 10% → 50% → 100%

### 6.2 Customer-hosted rollout

- Notify admin with:
  - version number
  - compatibility status (green/yellow/red)
  - changes summary
  - rollback instructions
- Provide:
  - pinned default
  - explicit "upgrade now" action

### 6.3 Rollback

- Keep last 2 known-good versions available
- Ability to switch org to previous version immediately (hosted)
- For customer-hosted: provide rollback script

---

## 7) Post-Update Repo Improvement Sweeps

When a provider update is promoted to stable, optionally trigger:

- `PATROL_SWEEP` jobs across opted-in repos:
  - re-run lint/tests
  - detect failing workflows
  - open "maintenance PRs"
  - re-run dependency suggestions

**Important:**

- Never auto-merge by default.
- Always respect org policies and approval gates.

This feature is one of your strongest "compounding value" levers:

> the platform improves codebases automatically as tooling improves.

---

## 8) Revenue & Tiering

Update pipeline features map cleanly to plans:

### Free

- stable channel only
- limited notifications
- no automated sweeps

### Team

- stable + optional beta
- limited sweeps (e.g., 1 repo/day)

### Enterprise

- pinned versions + dedicated channels
- audit logs for updates
- customer-hosted runner support
- advanced sweeps & policy rules

This gives investors a clear path to cash:

- seat revenue + concurrency
- usage revenue on hosted compute
- enterprise ACV via governance + deployment controls

---

## 9) Data Model (suggested)

Tables:

- `runtime_versions` (provider_id, version, released_at, source_url)
- `runner_builds` (runner_version, adapters, bundled_runtime_versions)
- `compat_results` (build_id, test_suite, status, metrics_json)
- `org_runtime_pins` (org_id, channel, pinned_build_id)
- `rollout_events` (org_id, from_build, to_build, ts, actor)

---

## 10) Observability KPIs

Track:

- session start success %
- average time-to-terminal
- disconnect rate
- command failure rate
- approval gate count and resolution times
- cost per agent-hour (hosted)
- sweep PR acceptance rate (value metric)

---

## 11) Acceptance Criteria

1. A new CLI version can be introduced without breaking production sessions.
2. Canary tests gate all stable rollouts.
3. Enterprises can pin and audit runtime versions.
4. Optional post-update sweeps run safely and produce reviewable PRs.

---

## 12) Implementation Tickets (handoff)

- [ ] Implement version watcher job + registry
- [ ] Implement runner heartbeat reporting versions/capabilities
- [ ] Implement Compatibility Lab harness (container-based)
- [ ] Implement canary test suite runner (adapter contract + golden path)
- [ ] Implement stable/beta rollout controller
- [ ] Implement org pinning + update UI
- [ ] Implement post-update sweep triggers + policy guards
- [ ] Add dashboards for update status and compatibility history

---

_Document Version: 1.0_
_Last Updated: December 2025_

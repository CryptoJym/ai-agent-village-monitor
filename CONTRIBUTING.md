# Contributing Guide

Thanks for your interest in contributing! This guide covers how to set up your environment, coding standards, and how we review changes.

## Getting Started

- Install dependencies: `pnpm install`
- Run dev: `pnpm -w dev`
- Lint: `pnpm -w lint`
- Typecheck: `pnpm -w typecheck`
- Tests: `pnpm -r test` (server: `pnpm -C packages/server test`)
- Build: `pnpm -w build`

## Coding Standards

- TypeScript throughout, ESLint + Prettier enforced
- Conventional Commits for messages (e.g., `feat(server): add API`)
- Keep modules small with colocated tests (`*.test.ts[x]`)

## Pull Requests

- Draft PRs welcome; include context and test plan
- Ensure CI is green (lint, typecheck, unit/integration/e2e)
- Update docs when changing APIs/behavior
- Link related issues; mark breaking changes clearly

## Commit Messages

- Use Conventional Commits (`feat|fix|docs|refactor|test|chore(scope): subject`)
- Squash merge preferred to keep history tidy

## Security

- Do not include secrets in code, commits, or logs
- See SECURITY.md for reporting vulnerabilities

## Community

- Be respectful and inclusive (see CODE_OF_CONDUCT.md)
- Use Discussions for proposals; Issues for bugs/features

## Local Tips

- Skip GH-dependent tests: `SKIP_GH_TESTS=true`
- Enable coverage locally: `VITEST_COVERAGE=true pnpm -C packages/server test`

## License

By contributing, you agree your contributions will be licensed under the MIT License (LICENSE).

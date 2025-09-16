# MCP Integration Guide

This project is designed to work alongside Task Master AI via MCP in Claude Code.

## Configure MCP

Check `.mcp.json` at the repo root. It includes a Task Master server definition using `npx task-master-ai` with API keys sourced from `.env`.

Required keys:

- `ANTHROPIC_API_KEY` (recommended)
- Optionally `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, etc.

## Claude Code Setup

- Ensure `.claude/settings.json` allows the Task Master tools (see CLAUDE.md).
- Use custom slash commands in `.claude/commands/` such as `taskmaster-next.md` and `taskmaster-complete.md`.

## Common Flows

- Initialize tasks: `task-master init`, parse PRD, expand, analyze complexity.
- Daily: `task-master next`, `task-master show <id>`, update subtasks, mark done.


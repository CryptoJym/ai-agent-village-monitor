/**
 * Village Monitor Agent Bridge
 *
 * This package provides a CLI wrapper and programmatic API for connecting
 * terminal-based AI agents (Claude Code, Aider, Codex, etc.) to the
 * Village Monitor visualization system.
 *
 * @example CLI Usage
 * ```bash
 * # Wrap Claude Code
 * npx village-bridge --village my-village --type claude -- claude
 *
 * # Wrap Aider with custom name
 * npx village-bridge -v my-village -t aider -n "Aider-Backend" -- aider
 *
 * # Custom command with verbose logging
 * npx village-bridge -v prod -t custom --verbose -- ./my-agent.sh
 * ```
 *
 * @example Programmatic Usage
 * ```typescript
 * import { AgentBridge } from '@ai-agent-village-monitor/bridge';
 *
 * const bridge = new AgentBridge({
 *   serverUrl: 'http://localhost:4000',
 *   villageId: 'my-village',
 *   agentType: 'claude',
 *   repoPath: process.cwd(),
 * });
 *
 * await bridge.connect();
 * bridge.wrap('claude', []);
 * ```
 */

export { AgentBridge } from './bridge.js';
export { getParserForAgent, parseOutput } from './parsers.js';
export type {
  AgentBridgeConfig,
  AgentSession,
  AgentType,
  AgentState,
  WorkStreamEvent,
  WorkStreamEventType,
  AgentParserConfig,
  AgentOutputPattern,
} from './types.js';

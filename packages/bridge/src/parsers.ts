/**
 * Output parsers for different AI agent CLI tools
 *
 * Each parser defines regex patterns to detect agent activity
 * and extract relevant information from terminal output.
 */

import type { AgentParserConfig, AgentOutputPattern, WorkStreamEventType } from './types.js';

/**
 * Claude Code CLI parser
 * Parses output from the `claude` command
 */
export const claudeCodeParser: AgentParserConfig = {
  name: 'claude',
  promptIndicator: /^(claude|>)\s*$/m,
  patterns: [
    // Thinking/planning
    {
      type: 'thinking',
      pattern: /^(Thinking|Analyzing|Planning|Considering|Looking at)[\s.:]/im,
      extractPayload: (m) => ({ action: m[1] }),
    },
    // Reading files
    {
      type: 'file_read',
      pattern: /^Reading\s+(?:file\s+)?[`']?([^`'\n]+)[`']?/im,
      extractPayload: (m) => ({ file: m[1].trim() }),
    },
    // Editing files
    {
      type: 'file_edit',
      pattern: /^(Editing|Updating|Modifying|Writing to)\s+[`']?([^`'\n]+)[`']?/im,
      extractPayload: (m) => ({ action: m[1], file: m[2].trim() }),
    },
    // Creating files
    {
      type: 'file_create',
      pattern: /^(Creating|Writing|Generating)\s+(?:new\s+)?(?:file\s+)?[`']?([^`'\n]+)[`']?/im,
      extractPayload: (m) => ({ action: m[1], file: m[2].trim() }),
    },
    // Running commands
    {
      type: 'command',
      pattern: /^(?:Running|Executing|Calling)(?:\s+command)?[:\s]+[`]?([^`\n]+)[`]?/im,
      extractPayload: (m) => ({ command: m[1].trim() }),
    },
    // Tool usage
    {
      type: 'tool_use',
      pattern: /^(?:Using|Calling)\s+tool[:\s]+(\w+)/im,
      extractPayload: (m) => ({ tool: m[1] }),
    },
    // Search operations
    {
      type: 'search',
      pattern: /^(?:Searching|Grepping|Finding)\s+(?:for\s+)?[`']?([^`'\n]+)[`']?/im,
      extractPayload: (m) => ({ query: m[1].trim() }),
    },
    // Completion indicators
    {
      type: 'completed',
      pattern: /^(?:Done|Completed|Finished|Success|✓|✔)/im,
    },
    // Error detection
    {
      type: 'error',
      pattern: /^(?:Error|Failed|Exception|✗|✘)[:\s]/im,
      extractPayload: (m) => ({ raw: m[0] }),
    },
  ],
};

/**
 * Aider CLI parser
 * Parses output from the `aider` command
 */
export const aiderParser: AgentParserConfig = {
  name: 'aider',
  promptIndicator: /^(aider|>)\s*$/m,
  patterns: [
    // Git operations
    {
      type: 'command',
      pattern: /^(Applied edit to|Git|Commit)\s+(.+)$/im,
      extractPayload: (m) => ({ action: m[1], target: m[2] }),
    },
    // File edits
    {
      type: 'file_edit',
      pattern: /^(?:Editing|Applied edit to)\s+[`']?([^`'\n]+)[`']?/im,
      extractPayload: (m) => ({ file: m[1].trim() }),
    },
    // Adding files to chat
    {
      type: 'file_read',
      pattern: /^(?:Added|Adding)\s+[`']?([^`'\n]+)[`']?\s+to the chat/im,
      extractPayload: (m) => ({ file: m[1].trim() }),
    },
    // Model thinking
    {
      type: 'thinking',
      pattern: /^(?:Thinking|Processing|Analyzing)/im,
    },
    // Completion
    {
      type: 'completed',
      pattern: /^(?:Done|Applied|Committed)/im,
    },
  ],
};

/**
 * OpenAI Codex CLI parser
 * Parses output from the `codex` command
 */
export const codexParser: AgentParserConfig = {
  name: 'codex',
  promptIndicator: /^(codex|>)\s*$/m,
  patterns: [
    // Code generation
    {
      type: 'file_create',
      pattern: /^(?:Generating|Creating|Writing)\s+(?:code\s+(?:for|in)\s+)?[`']?([^`'\n]+)[`']?/im,
      extractPayload: (m) => ({ file: m[1].trim() }),
    },
    // Thinking
    {
      type: 'thinking',
      pattern: /^(?:Thinking|Processing)/im,
    },
    // Running
    {
      type: 'command',
      pattern: /^(?:Running|Executing)[:\s]+(.+)$/im,
      extractPayload: (m) => ({ command: m[1].trim() }),
    },
  ],
};

/**
 * Cursor AI parser (for when run from terminal)
 */
export const cursorParser: AgentParserConfig = {
  name: 'cursor',
  patterns: [
    {
      type: 'thinking',
      pattern: /^(?:Thinking|Processing|Analyzing)/im,
    },
    {
      type: 'file_edit',
      pattern: /^(?:Editing|Modifying)\s+[`']?([^`'\n]+)[`']?/im,
      extractPayload: (m) => ({ file: m[1].trim() }),
    },
  ],
};

/**
 * Generic parser for custom/unknown agents
 */
export const genericParser: AgentParserConfig = {
  name: 'generic',
  patterns: [
    // Common file operations
    {
      type: 'file_read',
      pattern: /(?:read|reading|open|opening)\s+(?:file\s+)?[`'":]?\s*([^\s`'":\n]+)/i,
      extractPayload: (m) => ({ file: m[1] }),
    },
    {
      type: 'file_edit',
      pattern: /(?:edit|editing|write|writing|modify|modifying|update|updating)\s+(?:file\s+)?[`'":]?\s*([^\s`'":\n]+)/i,
      extractPayload: (m) => ({ file: m[1] }),
    },
    {
      type: 'file_create',
      pattern: /(?:create|creating|new|generating)\s+(?:file\s+)?[`'":]?\s*([^\s`'":\n]+)/i,
      extractPayload: (m) => ({ file: m[1] }),
    },
    // Command execution
    {
      type: 'command',
      pattern: /(?:run|running|exec|executing|shell)[:\s]+[`'"]*([^`'"\n]+)/i,
      extractPayload: (m) => ({ command: m[1].trim() }),
    },
    // General activity indicators
    {
      type: 'thinking',
      pattern: /(?:thinking|processing|analyzing|considering|planning)/i,
    },
    {
      type: 'completed',
      pattern: /(?:done|complete|finished|success)/i,
    },
    {
      type: 'error',
      pattern: /(?:error|failed|exception|fail)/i,
    },
  ],
};

/**
 * Get the appropriate parser for an agent type
 */
export function getParserForAgent(agentType: string): AgentParserConfig {
  switch (agentType.toLowerCase()) {
    case 'claude':
      return claudeCodeParser;
    case 'aider':
      return aiderParser;
    case 'codex':
      return codexParser;
    case 'cursor':
      return cursorParser;
    default:
      return genericParser;
  }
}

/**
 * Parse a line of output and return detected events
 */
export function parseOutput(
  line: string,
  parser: AgentParserConfig
): { type: WorkStreamEventType; payload: Record<string, unknown> } | null {
  for (const pattern of parser.patterns) {
    const match = line.match(pattern.pattern);
    if (match) {
      const payload = pattern.extractPayload
        ? pattern.extractPayload(match)
        : { raw: match[0] };
      return {
        type: pattern.type,
        payload: { ...payload, rawLine: line },
      };
    }
  }
  return null;
}

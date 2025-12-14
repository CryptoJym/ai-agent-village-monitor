/**
 * Claude Code Adapter
 * Provider adapter for Anthropic's Claude Code CLI
 *
 * Per spec section 7.2: Claude Code Adapter
 * - Strong candidate for "Reviewer" role
 * - May support MCP-based tool access
 * - PTY spawn + help detection + env
 */

import type {
  ProviderId,
  Capability,
  StartSessionArgs,
  ProviderEvent,
} from '@ai-agent-village-monitor/shared';
import { BaseAdapter, type BaseAdapterConfig } from './BaseAdapter';

/**
 * Claude Code specific configuration
 */
export type ClaudeCodeAdapterConfig = Omit<BaseAdapterConfig, 'command'> & {
  /** Custom command path (default: 'claude') */
  command?: string;
  /** Model to use (default: claude-sonnet-4-20250514) */
  model?: string;
  /** API key (if not in env) */
  apiKey?: string;
  /** Enable MCP if available */
  enableMCP?: boolean;
};

/**
 * Detected Claude Code features from --help
 */
type ClaudeCodeFeatures = {
  hasNonInteractive: boolean;
  hasContinue: boolean;
  hasResume: boolean;
  hasAllowedTools: boolean;
  hasMCP: boolean;
  hasOutputFormat: boolean;
};

/**
 * Adapter for Claude Code CLI
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  readonly id: ProviderId = 'claude_code';

  private claudeConfig: ClaudeCodeAdapterConfig;
  private features: ClaudeCodeFeatures | null = null;

  constructor(config: ClaudeCodeAdapterConfig = {}) {
    super({
      command: config.command ?? 'claude',
      defaultArgs: [],
      env: config.env,
      detectionTimeout: config.detectionTimeout,
    });
    this.claudeConfig = config;
  }

  /**
   * Get Claude Code capabilities
   */
  async capabilities(): Promise<Capability> {
    if (this.detectedCapabilities) {
      return this.detectedCapabilities;
    }

    // Detect features from help
    this.features = await this.detectFeatures();

    this.detectedCapabilities = {
      ptyStreaming: true,
      structuredEdits: 'fileEvents', // Claude Code can output structured info
      supportsMCP: this.features.hasMCP && (this.claudeConfig.enableMCP ?? true),
      supportsNonInteractive: this.features.hasNonInteractive,
      supportsPlanAndExecute: true, // Claude Code supports planning
      supportsPRFlow: 'full', // Can create and review PRs
      maxContextHint: '200k tokens',
    };

    return this.detectedCapabilities;
  }

  /**
   * Build Claude Code command arguments
   */
  protected buildCommandArgs(args: StartSessionArgs): string[] {
    const cmdArgs: string[] = [];

    // Non-interactive mode if available and task is specified
    if (this.features?.hasNonInteractive && args.task.goal) {
      cmdArgs.push('-p', this.buildPrompt(args));
    }

    // Output format if available
    if (this.features?.hasOutputFormat) {
      cmdArgs.push('--output-format', 'stream-json');
    }

    // Model selection
    if (this.claudeConfig.model) {
      cmdArgs.push('--model', this.claudeConfig.model);
    }

    // Allowed tools based on policy
    if (this.features?.hasAllowedTools) {
      const tools = this.buildAllowedTools(args);
      if (tools.length > 0) {
        cmdArgs.push('--allowedTools', tools.join(','));
      }
    }

    return cmdArgs;
  }

  /**
   * Parse structured events from Claude Code output
   */
  protected parseStructuredEvents(data: string): ProviderEvent[] {
    const events: ProviderEvent[] = [];

    // Try to parse JSON output (if using --output-format stream-json)
    const lines = data.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        if (line.startsWith('{')) {
          const parsed = JSON.parse(line);

          // Handle different event types from Claude Code
          if (parsed.type === 'assistant' && parsed.message?.content) {
            // Assistant message - could contain tool use
            const content = parsed.message.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'tool_use') {
                  events.push(this.createToolRequestEvent(item));
                }
              }
            }
          }

          // Handle file operations
          if (parsed.type === 'file_write' || parsed.type === 'file_read') {
            events.push({
              type: 'HINT_FILES_TOUCHED',
              providerId: this.id,
              timestamp: Date.now(),
              sessionId: this.currentSessionId ?? undefined,
              paths: [parsed.path],
              operation: parsed.type === 'file_write' ? 'write' : 'read',
            });
          }

          // Handle git operations
          if (parsed.type === 'bash' && parsed.command?.includes('git')) {
            if (parsed.command.includes('commit') || parsed.command.includes('push')) {
              events.push({
                type: 'REQUEST_APPROVAL',
                providerId: this.id,
                timestamp: Date.now(),
                sessionId: this.currentSessionId ?? undefined,
                approvalId: `approval_${Date.now()}`,
                category: 'merge',
                summary: `Git operation: ${parsed.command}`,
                risk: 'med',
              });
            }
          }
        }
      } catch {
        // Not JSON, continue
      }
    }

    // Pattern-based detection for non-JSON output
    if (events.length === 0) {
      events.push(...this.detectPatternsFromText(data));
    }

    return events;
  }

  /**
   * Parse version from Claude output
   */
  protected parseVersion(output: string): string | null {
    // Claude version format: "claude v1.0.0" or similar
    const match = output.match(/claude[- ]?(?:code)?[- ]?v?(\d+\.\d+\.\d+)/i);
    return match ? match[1] : super.parseVersion(output);
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private async detectFeatures(): Promise<ClaudeCodeFeatures> {
    const features: ClaudeCodeFeatures = {
      hasNonInteractive: false,
      hasContinue: false,
      hasResume: false,
      hasAllowedTools: false,
      hasMCP: false,
      hasOutputFormat: false,
    };

    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync(`${this.config.command} --help`, {
        timeout: this.config.detectionTimeout,
      });

      const helpText = (stdout + stderr).toLowerCase();

      // Detect features from help text
      features.hasNonInteractive = helpText.includes('-p') || helpText.includes('--print');
      features.hasContinue = helpText.includes('--continue');
      features.hasResume = helpText.includes('--resume');
      features.hasAllowedTools = helpText.includes('--allowedtools') || helpText.includes('allowed-tools');
      features.hasMCP = helpText.includes('mcp') || helpText.includes('model context protocol');
      features.hasOutputFormat = helpText.includes('--output-format');
    } catch {
      // Use defaults if detection fails
    }

    return features;
  }

  private buildPrompt(args: StartSessionArgs): string {
    const { task, policy } = args;

    let prompt = `# Task: ${task.title}\n\n`;
    prompt += `## Goal\n${task.goal}\n\n`;

    if (task.constraints.length > 0) {
      prompt += `## Constraints\n`;
      for (const constraint of task.constraints) {
        prompt += `- ${constraint}\n`;
      }
      prompt += '\n';
    }

    if (task.acceptance.length > 0) {
      prompt += `## Acceptance Criteria\n`;
      for (const criterion of task.acceptance) {
        prompt += `- ${criterion}\n`;
      }
      prompt += '\n';
    }

    if (task.roomPath) {
      prompt += `## Focus Area\nPrimarily work in: ${task.roomPath}\n\n`;
    }

    // Add policy reminders
    if (policy.requiresApprovalFor.length > 0) {
      prompt += `## Important: Approval Required\n`;
      prompt += `The following actions require explicit human approval:\n`;
      for (const action of policy.requiresApprovalFor) {
        prompt += `- ${action}\n`;
      }
      prompt += '\n';
    }

    return prompt;
  }

  private buildAllowedTools(args: StartSessionArgs): string[] {
    const tools: string[] = [
      'View',
      'GlobTool',
      'GrepTool',
      'LS',
    ];

    // Conditionally add write tools based on policy
    if (!args.policy.shellDenylist.includes('edit')) {
      tools.push('Edit', 'Write', 'MultiEdit');
    }

    // Conditionally add bash based on policy
    if (args.policy.shellAllowlist.length > 0 || args.policy.shellDenylist.length === 0) {
      tools.push('Bash');
    }

    return tools;
  }

  private createToolRequestEvent(toolUse: { id: string; name: string; input: unknown }): ProviderEvent {
    return {
      type: 'TOOL_REQUEST',
      providerId: this.id,
      timestamp: Date.now(),
      sessionId: this.currentSessionId ?? undefined,
      toolName: toolUse.name,
      args: toolUse.input as Record<string, unknown>,
      requestId: toolUse.id,
    };
  }

  private detectPatternsFromText(text: string): ProviderEvent[] {
    const events: ProviderEvent[] = [];

    // Detect file operations
    const filePatterns = [
      /(?:reading|wrote|created|deleted|modified)\s+(?:file[:\s]+)?([^\s]+\.[a-z]+)/gi,
      /(?:cat|vim|nano|code)\s+([^\s]+\.[a-z]+)/gi,
    ];

    for (const pattern of filePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        events.push({
          type: 'HINT_FILES_TOUCHED',
          providerId: this.id,
          timestamp: Date.now(),
          sessionId: this.currentSessionId ?? undefined,
          paths: [match[1]],
        });
      }
    }

    // Detect approval-requiring operations
    if (/npm\s+(?:install|add)/i.test(text)) {
      events.push({
        type: 'REQUEST_APPROVAL',
        providerId: this.id,
        timestamp: Date.now(),
        sessionId: this.currentSessionId ?? undefined,
        approvalId: `approval_${Date.now()}`,
        category: 'deps_add',
        summary: 'Adding npm dependencies',
        risk: 'low',
      });
    }

    if (/git\s+push/i.test(text)) {
      events.push({
        type: 'REQUEST_APPROVAL',
        providerId: this.id,
        timestamp: Date.now(),
        sessionId: this.currentSessionId ?? undefined,
        approvalId: `approval_${Date.now()}`,
        category: 'merge',
        summary: 'Pushing changes to remote',
        risk: 'med',
      });
    }

    return events;
  }
}

/**
 * Create a Claude Code adapter instance
 */
export function createClaudeCodeAdapter(config?: ClaudeCodeAdapterConfig): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter(config);
}

/**
 * Codex Adapter
 * Provider adapter for OpenAI's Codex CLI
 *
 * Per spec section 7.1: Codex CLI Adapter
 * - PTY spawn + dynamic --help detection
 * - Prefer non-interactive execution when available
 * - Emit structured events best-effort (JSON line parsing + heuristics)
 */

import type {
  ProviderId,
  Capability,
  StartSessionArgs,
  ProviderEvent,
} from '@ai-agent-village-monitor/shared';
import { BaseAdapter, type BaseAdapterConfig } from './BaseAdapter';

/**
 * Codex-specific configuration
 */
export type CodexAdapterConfig = Omit<BaseAdapterConfig, 'command'> & {
  /** Custom command path (default: 'codex') */
  command?: string;
  /** Model to use (when supported by CLI) */
  model?: string;
  /** API key (if not already in env) */
  apiKey?: string;
};

type CodexFeatures = {
  hasExec: boolean;
  hasJson: boolean;
  hasModelFlag: boolean;
};

export class CodexAdapter extends BaseAdapter {
  readonly id: ProviderId = 'codex';

  private codexConfig: CodexAdapterConfig;
  private features: CodexFeatures | null = null;

  constructor(config: CodexAdapterConfig = {}) {
    super({
      command: config.command ?? 'codex',
      defaultArgs: [],
      env: {
        ...config.env,
        ...(config.apiKey ? { OPENAI_API_KEY: config.apiKey } : {}),
      },
      detectionTimeout: config.detectionTimeout,
    });
    this.codexConfig = config;
  }

  async capabilities(): Promise<Capability> {
    if (this.detectedCapabilities) {
      return this.detectedCapabilities;
    }

    this.features = await this.detectFeatures();

    this.detectedCapabilities = {
      ptyStreaming: true,
      structuredEdits: 'diff',
      supportsMCP: false,
      supportsNonInteractive: this.features.hasExec,
      supportsPlanAndExecute: true,
      supportsPRFlow: 'full',
      maxContextHint: 'unknown',
    };

    return this.detectedCapabilities;
  }

  protected buildCommandArgs(args: StartSessionArgs): string[] {
    const cmdArgs: string[] = [];

    // Prefer `codex exec` when available so a session can run a bounded task
    if (this.features?.hasExec && args.task.goal) {
      cmdArgs.push('exec');

      if (this.features.hasJson) {
        cmdArgs.push('--json');
      }

      if (this.codexConfig.model && this.features.hasModelFlag) {
        cmdArgs.push('--model', this.codexConfig.model);
      }

      cmdArgs.push(this.buildPrompt(args));
      return cmdArgs;
    }

    // Fallback: start the interactive CLI (if present) with no extra args
    if (this.codexConfig.model && this.features?.hasModelFlag) {
      cmdArgs.push('--model', this.codexConfig.model);
    }

    return cmdArgs;
  }

  protected parseStructuredEvents(data: string): ProviderEvent[] {
    const events: ProviderEvent[] = [];

    // Best-effort JSON line parsing (e.g., `codex exec --json`)
    const lines = data.split('\n').filter((line) => line.trim());
    for (const line of lines) {
      try {
        if (!line.startsWith('{')) continue;
        const parsed = JSON.parse(line);

        // Heuristic: treat explicit file operations if present
        if (typeof parsed?.path === 'string' && typeof parsed?.type === 'string') {
          const t = String(parsed.type);
          if (t.includes('file')) {
            events.push({
              type: 'HINT_FILES_TOUCHED',
              providerId: this.id,
              timestamp: Date.now(),
              sessionId: this.currentSessionId ?? undefined,
              paths: [parsed.path],
              operation: t.includes('write') ? 'write' : t.includes('delete') ? 'delete' : 'read',
            });
          }
        }

        // Heuristic: request approval on risky git operations
        if (typeof parsed?.command === 'string' && parsed.command.includes('git')) {
          if (parsed.command.includes('push') || parsed.command.includes('commit')) {
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
      } catch {
        // Not JSON; ignore.
      }
    }

    return events;
  }

  protected parseVersion(output: string): string | null {
    // Common formats: "codex 1.2.3" | "codex version 1.2.3"
    const match = output.match(/codex(?:\\s+version)?\\s+v?(\\d+\\.\\d+\\.\\d+)/i);
    return match ? match[1] : super.parseVersion(output);
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async detectFeatures(): Promise<CodexFeatures> {
    const features: CodexFeatures = {
      hasExec: false,
      hasJson: false,
      hasModelFlag: false,
    };

    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync(`${this.config.command} --help`, {
        timeout: this.config.detectionTimeout,
        env: { ...process.env, ...this.config.env },
      });

      const helpText = (stdout + stderr).toLowerCase();

      features.hasExec = helpText.includes('\nexec') || helpText.includes(' exec');
      features.hasJson = helpText.includes('--json');
      features.hasModelFlag = helpText.includes('--model');
    } catch {
      // Defaults remain false; adapter will still attempt best-effort usage.
    }

    return features;
  }

  private buildPrompt(args: StartSessionArgs): string {
    const { task, policy } = args;

    let prompt = `# Task: ${task.title}\\n\\n`;
    prompt += `## Goal\\n${task.goal}\\n\\n`;

    if (task.constraints.length > 0) {
      prompt += `## Constraints\\n`;
      for (const constraint of task.constraints) {
        prompt += `- ${constraint}\\n`;
      }
      prompt += '\\n';
    }

    if (task.acceptance.length > 0) {
      prompt += `## Acceptance Criteria\\n`;
      for (const criterion of task.acceptance) {
        prompt += `- ${criterion}\\n`;
      }
      prompt += '\\n';
    }

    if (task.roomPath) {
      prompt += `## Focus Area\\nPrimarily work in: ${task.roomPath}\\n\\n`;
    }

    prompt += `## Policy\\n`;
    prompt += `- Network mode: ${policy.networkMode}\\n`;
    prompt += `- Approvals required for: ${policy.requiresApprovalFor.join(', ') || 'none'}\\n\\n`;

    return prompt;
  }
}

export function createCodexAdapter(config: CodexAdapterConfig = {}): CodexAdapter {
  return new CodexAdapter(config);
}

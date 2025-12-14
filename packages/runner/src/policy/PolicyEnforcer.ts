/**
 * Policy Enforcer
 * Local safety layer that enforces policies even if agent attempts forbidden actions
 *
 * Per spec section 4.5: Policy Enforcement
 * - Forbidden shell commands
 * - Forbidden filesystem paths
 * - Secret redaction
 * - Network egress policies
 * - No auto-merge unless explicitly enabled
 */

import type { PolicySpec } from '@ai-agent-village-monitor/shared';

/**
 * Policy violation details
 */
export type PolicyViolation = {
  /** Type of violation */
  type: 'shell_command' | 'filesystem_path' | 'secret_detected' | 'network_egress' | 'approval_required';
  /** Description of what was blocked */
  description: string;
  /** The blocked value (command, path, etc.) */
  value: string;
  /** Severity level */
  severity: 'warn' | 'block';
  /** Timestamp */
  timestamp: number;
};

/**
 * Command check result
 */
export type CommandCheckResult = {
  allowed: boolean;
  violations: PolicyViolation[];
  sanitizedCommand?: string;
};

/**
 * Secret patterns for detection
 */
const SECRET_PATTERNS = [
  // API keys
  /(?:api[_-]?key|apikey)[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
  // AWS credentials
  /(?:aws[_-]?(?:access[_-]?key|secret))[=:]\s*['"]?([A-Z0-9]{20,})['"]?/gi,
  // GitHub tokens
  /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}/g,
  // Generic tokens
  /(?:token|secret|password|passwd|pwd)[=:]\s*['"]?([a-zA-Z0-9_-]{8,})['"]?/gi,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  // Private keys
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
];

/**
 * Dangerous commands that should always be blocked
 */
const ALWAYS_BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf ~/*',
  'dd if=/dev/zero',
  'mkfs',
  ':(){:|:&};:',
  'chmod -R 777 /',
  'chown -R',
  '> /dev/sda',
  'curl | sh',
  'curl | bash',
  'wget | sh',
  'wget | bash',
];

/**
 * Dangerous command patterns
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-[rf]+\s+\/(?!tmp)/i, // rm -rf not in /tmp
  />\s*\/etc\//i, // Overwrite system files
  />\s*\/usr\//i,
  /chmod\s+777/i, // Overly permissive
  /curl.*\|\s*(?:bash|sh)/i, // Pipe curl to shell
  /wget.*\|\s*(?:bash|sh)/i, // Pipe wget to shell
  /eval\s*\(/i, // Eval execution
  /\$\([^)]*rm/i, // Command substitution with rm
];

/**
 * Enforces policies on agent actions
 */
export class PolicyEnforcer {
  private policy: PolicySpec;
  private violations: PolicyViolation[] = [];

  constructor(policy: PolicySpec) {
    this.policy = policy;
  }

  /**
   * Check if a shell command is allowed
   */
  checkCommand(command: string): CommandCheckResult {
    const violations: PolicyViolation[] = [];
    const normalizedCommand = command.trim().toLowerCase();

    // Check always-blocked commands
    for (const blocked of ALWAYS_BLOCKED_COMMANDS) {
      if (normalizedCommand.includes(blocked.toLowerCase())) {
        violations.push({
          type: 'shell_command',
          description: `Dangerous command blocked: ${blocked}`,
          value: command,
          severity: 'block',
          timestamp: Date.now(),
        });
      }
    }

    // Check dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        violations.push({
          type: 'shell_command',
          description: `Dangerous command pattern detected`,
          value: command,
          severity: 'block',
          timestamp: Date.now(),
        });
      }
    }

    // Check policy denylist
    for (const denied of this.policy.shellDenylist) {
      const deniedLower = denied.toLowerCase();
      // Check if command starts with denied command or contains it as a separate command
      if (
        normalizedCommand.startsWith(deniedLower) ||
        normalizedCommand.includes(` ${deniedLower}`) ||
        normalizedCommand.includes(`|${deniedLower}`) ||
        normalizedCommand.includes(`| ${deniedLower}`)
      ) {
        violations.push({
          type: 'shell_command',
          description: `Command in denylist: ${denied}`,
          value: command,
          severity: 'block',
          timestamp: Date.now(),
        });
      }
    }

    // If allowlist is specified, command must be in it
    if (this.policy.shellAllowlist.length > 0) {
      const commandBase = command.split(/\s+/)[0];
      const isAllowed = this.policy.shellAllowlist.some(
        (allowed) =>
          commandBase.toLowerCase() === allowed.toLowerCase() ||
          commandBase.toLowerCase().endsWith(`/${allowed.toLowerCase()}`)
      );

      if (!isAllowed) {
        violations.push({
          type: 'shell_command',
          description: `Command not in allowlist: ${commandBase}`,
          value: command,
          severity: 'block',
          timestamp: Date.now(),
        });
      }
    }

    this.violations.push(...violations);

    return {
      allowed: violations.filter((v) => v.severity === 'block').length === 0,
      violations,
    };
  }

  /**
   * Check if a filesystem path access is allowed
   */
  checkPath(path: string, operation: 'read' | 'write' | 'delete'): CommandCheckResult {
    const violations: PolicyViolation[] = [];

    // Block access to sensitive system paths
    const blockedPaths = [
      '/etc/passwd',
      '/etc/shadow',
      '/etc/sudoers',
      '/root',
      '/home/*/.ssh',
      '/home/*/.gnupg',
      '/var/log',
      '/sys',
      '/proc',
    ];

    for (const blocked of blockedPaths) {
      const pattern = blocked.replace('*', '.*');
      if (new RegExp(`^${pattern}`).test(path)) {
        violations.push({
          type: 'filesystem_path',
          description: `Access to sensitive path blocked: ${blocked}`,
          value: path,
          severity: 'block',
          timestamp: Date.now(),
        });
      }
    }

    // Prevent directory traversal
    if (path.includes('..')) {
      violations.push({
        type: 'filesystem_path',
        description: 'Directory traversal detected',
        value: path,
        severity: 'block',
        timestamp: Date.now(),
      });
    }

    this.violations.push(...violations);

    return {
      allowed: violations.filter((v) => v.severity === 'block').length === 0,
      violations,
    };
  }

  /**
   * Redact secrets from text
   */
  redactSecrets(text: string): { redacted: string; secretsFound: number } {
    let redacted = text;
    let secretsFound = 0;

    for (const pattern of SECRET_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        secretsFound += matches.length;
        redacted = redacted.replace(pattern, (match) => {
          // Keep first 4 chars, redact rest
          const prefix = match.substring(0, Math.min(4, match.length));
          return `${prefix}${'*'.repeat(Math.max(0, match.length - 4))}`;
        });
      }
    }

    if (secretsFound > 0) {
      this.violations.push({
        type: 'secret_detected',
        description: `${secretsFound} potential secret(s) redacted`,
        value: '[REDACTED]',
        severity: 'warn',
        timestamp: Date.now(),
      });
    }

    return { redacted, secretsFound };
  }

  /**
   * Check if an action requires approval
   */
  requiresApproval(action: 'merge' | 'deps_add' | 'secrets' | 'deploy'): boolean {
    return this.policy.requiresApprovalFor.includes(action);
  }

  /**
   * Check network egress policy
   */
  checkNetworkEgress(url: string): CommandCheckResult {
    const violations: PolicyViolation[] = [];

    if (this.policy.networkMode === 'restricted') {
      // In restricted mode, only allow specific domains
      const allowedDomains = [
        'github.com',
        'gitlab.com',
        'bitbucket.org',
        'npmjs.org',
        'pypi.org',
        'registry.npmjs.org',
      ];

      try {
        const urlObj = new URL(url);
        const isAllowed = allowedDomains.some(
          (domain) =>
            urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );

        if (!isAllowed) {
          violations.push({
            type: 'network_egress',
            description: `Network access to ${urlObj.hostname} blocked (restricted mode)`,
            value: url,
            severity: 'block',
            timestamp: Date.now(),
          });
        }
      } catch {
        violations.push({
          type: 'network_egress',
          description: 'Invalid URL blocked',
          value: url,
          severity: 'block',
          timestamp: Date.now(),
        });
      }
    }

    this.violations.push(...violations);

    return {
      allowed: violations.filter((v) => v.severity === 'block').length === 0,
      violations,
    };
  }

  /**
   * Get all violations recorded
   */
  getViolations(): PolicyViolation[] {
    return [...this.violations];
  }

  /**
   * Get violation count by type
   */
  getViolationStats(): Record<PolicyViolation['type'], number> {
    const stats: Record<PolicyViolation['type'], number> = {
      shell_command: 0,
      filesystem_path: 0,
      secret_detected: 0,
      network_egress: 0,
      approval_required: 0,
    };

    for (const v of this.violations) {
      stats[v.type]++;
    }

    return stats;
  }

  /**
   * Clear recorded violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Update the policy
   */
  updatePolicy(policy: PolicySpec): void {
    this.policy = policy;
  }

  /**
   * Get current policy
   */
  getPolicy(): PolicySpec {
    return { ...this.policy };
  }
}

/**
 * Create a policy enforcer for a session
 */
export function createPolicyEnforcer(policy: PolicySpec): PolicyEnforcer {
  return new PolicyEnforcer(policy);
}

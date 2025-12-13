#!/usr/bin/env node

/**
 * Village Bridge CLI
 *
 * Wraps terminal AI agents (Claude Code, Aider, Codex) and streams
 * their activity to the Village Monitor for real-time visualization.
 *
 * Usage:
 *   village-bridge --village <id> --type claude -- claude
 *   village-bridge --village <id> --type aider -- aider
 *   village-bridge -v my-village -t codex -- codex
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { AgentBridge } from './bridge.js';
import type { AgentType } from './types.js';

const program = new Command();

program
  .name('village-bridge')
  .description('Bridge terminal AI agents to Village Monitor visualization')
  .version('0.1.0')
  .option('-s, --server <url>', 'Village Monitor server URL', 'http://localhost:4000')
  .option('-v, --village <id>', 'Village ID to join', 'default')
  .option('-t, --type <type>', 'Agent type (claude, aider, codex, cursor, custom)', 'claude')
  .option('-n, --name <name>', 'Custom agent name')
  .option('-d, --dir <path>', 'Working directory', process.cwd())
  .option('--token <token>', 'JWT auth token')
  .option('--verbose', 'Enable verbose logging', false)
  .argument('[command...]', 'Command to wrap and arguments')
  .action(async (commandArgs, options) => {
    // Validate agent type
    const validTypes = ['claude', 'aider', 'codex', 'cursor', 'custom'];
    if (!validTypes.includes(options.type)) {
      console.error(chalk.red(`Error: Invalid agent type "${options.type}"`));
      console.error(chalk.gray(`Valid types: ${validTypes.join(', ')}`));
      process.exit(1);
    }

    // Get command to wrap
    let command: string;
    let args: string[];

    if (commandArgs.length > 0) {
      command = commandArgs[0];
      args = commandArgs.slice(1);
    } else {
      // Default commands based on agent type
      const defaultCommands: Record<string, string> = {
        claude: 'claude',
        aider: 'aider',
        codex: 'codex',
        cursor: 'cursor',
        custom: 'bash',
      };
      command = defaultCommands[options.type];
      args = [];
    }

    const workingDir = resolve(options.dir);

    console.log(chalk.blue('┌─────────────────────────────────────────┐'));
    console.log(chalk.blue('│') + chalk.bold.white('     Village Monitor Agent Bridge     ') + chalk.blue('│'));
    console.log(chalk.blue('└─────────────────────────────────────────┘'));
    console.log();
    console.log(chalk.gray(`  Server:    ${options.server}`));
    console.log(chalk.gray(`  Village:   ${options.village}`));
    console.log(chalk.gray(`  Agent:     ${options.type}${options.name ? ` (${options.name})` : ''}`));
    console.log(chalk.gray(`  Directory: ${workingDir}`));
    console.log(chalk.gray(`  Command:   ${command} ${args.join(' ')}`));
    console.log();

    const bridge = new AgentBridge({
      serverUrl: options.server,
      villageId: options.village,
      agentType: options.type as AgentType,
      agentName: options.name,
      repoPath: workingDir,
      authToken: options.token,
      verbose: options.verbose,
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log(chalk.yellow('\n[bridge] Shutting down...'));
      await bridge.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
      console.log(chalk.cyan('[bridge] Connecting to Village Monitor...'));
      await bridge.connect();
      console.log(chalk.green('[bridge] Connected! Agent ID: ' + bridge.getAgentId()));
      console.log(chalk.gray('[bridge] Session ID: ' + bridge.getSessionId()));
      console.log();
      console.log(chalk.cyan(`[bridge] Starting ${options.type}...`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log();

      bridge.wrap(command, args);
    } catch (err) {
      console.error(chalk.red(`[bridge] Failed to connect: ${(err as Error).message}`));
      console.error(chalk.gray('[bridge] Make sure the Village Monitor server is running'));
      process.exit(1);
    }
  });

// Handle `--` separator for command arguments
const args = process.argv;
const separatorIndex = args.indexOf('--');

if (separatorIndex !== -1) {
  // Parse everything before `--` as options, everything after as command
  const optionArgs = args.slice(0, separatorIndex);
  const commandArgs = args.slice(separatorIndex + 1);

  // Reconstruct argv for commander
  program.parse([...optionArgs, ...commandArgs]);
} else {
  program.parse();
}

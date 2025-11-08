import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  CommandArgs,
  CommandResult,
  MCPAgentController,
  RunCommandOptions,
  StreamEvent,
} from './controller';

/**
 * MCP Client Controller for Claude Code Integration
 *
 * Connects to Claude Code MCP servers as a client to monitor agent sessions.
 * Uses the official @modelcontextprotocol/sdk to communicate via stdio.
 */
export class MCPClientController implements MCPAgentController {
  private clients = new Map<string, Client>();
  private transports = new Map<string, StdioClientTransport>();
  private eventHandlers = new Map<string, (evt: StreamEvent) => void>();

  constructor(
    private mcpServerCommand: string = 'npx',
    private mcpServerArgs: string[] = ['-y', '@modelcontextprotocol/server-everything'],
  ) {}

  async start(agentId: string | number): Promise<{ ok: boolean; sessionToken?: string }> {
    const id = String(agentId);

    try {
      // Create stdio transport to spawn/connect to MCP server
      const transport = new StdioClientTransport({
        command: this.mcpServerCommand,
        args: [...this.mcpServerArgs, '--session', id],
        env: {
          ...process.env,
          AGENT_ID: id,
        },
      });

      // Create MCP client
      const client = new Client(
        {
          name: 'ai-agent-village-monitor',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        },
      );

      // Set up logging and notification handlers
      client.setNotificationHandler({
        method: 'notifications/message',
        handler: (notification: any) => {
          const handler = this.eventHandlers.get(id);
          if (handler) {
            handler({
              type: 'log',
              message: notification.params?.message || String(notification.params),
            });
          }
        },
      });

      client.setNotificationHandler({
        method: 'notifications/progress',
        handler: (notification: any) => {
          const handler = this.eventHandlers.get(id);
          if (handler && notification.params) {
            handler({
              type: 'progress',
              progress: notification.params.progress || 0,
              message: notification.params.message,
            });
          }
        },
      });

      // Connect to the MCP server
      await client.connect(transport);

      // Store client and transport
      this.clients.set(id, client);
      this.transports.set(id, transport);

      // Generate a session token
      const sessionToken = `mcp_${id}_${Date.now()}`;

      return { ok: true, sessionToken };
    } catch (error: any) {
      console.error(`[MCP] Failed to start agent ${id}:`, error);
      return { ok: false };
    }
  }

  async stop(agentId: string | number): Promise<{ ok: boolean }> {
    const id = String(agentId);

    try {
      const client = this.clients.get(id);
      const transport = this.transports.get(id);

      if (client) {
        await client.close();
        this.clients.delete(id);
      }

      if (transport) {
        await transport.close();
        this.transports.delete(id);
      }

      this.eventHandlers.delete(id);

      return { ok: true };
    } catch (error: any) {
      console.error(`[MCP] Failed to stop agent ${id}:`, error);
      return { ok: false };
    }
  }

  async runCommand(
    agentId: string | number,
    command: string,
    args?: CommandArgs,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    const id = String(agentId);
    const client = this.clients.get(id);

    if (!client) {
      return {
        ok: false,
        error: `Agent ${id} not connected. Call start() first.`,
      };
    }

    // Register event handler for this command execution
    if (opts?.onEvent) {
      this.eventHandlers.set(id, opts.onEvent);
    }

    try {
      // Emit start event
      opts?.onEvent?.({
        type: 'status',
        message: `Executing command: ${command}`,
      });

      // Call the tool on the MCP server
      const result = await client.callTool({
        name: command,
        arguments: args || {},
      });

      // Emit completion event
      opts?.onEvent?.({
        type: 'log',
        message: `Command ${command} completed`,
      });

      return {
        ok: !result.isError,
        output: result.content,
        error: result.isError ? 'Tool execution failed' : undefined,
      };
    } catch (error: any) {
      opts?.onEvent?.({
        type: 'error',
        message: error.message || String(error),
      });

      return {
        ok: false,
        error: error.message || String(error),
      };
    } finally {
      // Clean up event handler after command completes
      if (opts?.onEvent) {
        this.eventHandlers.delete(id);
      }
    }
  }

  async runTool(
    agentId: string | number,
    tool: string,
    params?: Record<string, unknown>,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    return this.runCommand(agentId, tool, params, opts);
  }

  async runTask(
    agentId: string | number,
    description: string,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    const id = String(agentId);
    const client = this.clients.get(id);

    if (!client) {
      return {
        ok: false,
        error: `Agent ${id} not connected. Call start() first.`,
      };
    }

    if (opts?.onEvent) {
      this.eventHandlers.set(id, opts.onEvent);
    }

    try {
      opts?.onEvent?.({
        type: 'status',
        message: `Starting task: ${description.slice(0, 50)}...`,
      });

      // For tasks, we might want to use a generic "execute_task" tool
      // or directly prompt the model via resources
      const result = await client.callTool({
        name: 'execute_task',
        arguments: { description },
      });

      opts?.onEvent?.({
        type: 'log',
        message: `Task completed`,
      });

      return {
        ok: !result.isError,
        output: result.content,
      };
    } catch (error: any) {
      opts?.onEvent?.({
        type: 'error',
        message: error.message || String(error),
      });

      return {
        ok: false,
        error: error.message || String(error),
      };
    } finally {
      if (opts?.onEvent) {
        this.eventHandlers.delete(id);
      }
    }
  }

  async shutdown(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [id] of this.clients) {
      closePromises.push(this.stop(id).then(() => {}));
    }

    await Promise.all(closePromises);
  }

  /**
   * List available tools from an agent's MCP server
   */
  async listTools(agentId: string | number): Promise<string[]> {
    const id = String(agentId);
    const client = this.clients.get(id);

    if (!client) {
      return [];
    }

    try {
      const result = await client.listTools();
      return result.tools.map((tool) => tool.name);
    } catch {
      return [];
    }
  }

  /**
   * List available resources from an agent's MCP server
   */
  async listResources(agentId: string | number): Promise<string[]> {
    const id = String(agentId);
    const client = this.clients.get(id);

    if (!client) {
      return [];
    }

    try {
      const result = await client.listResources();
      return result.resources.map((resource) => resource.uri);
    } catch {
      return [];
    }
  }
}

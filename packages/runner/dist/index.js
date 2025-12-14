// src/Runner.ts
import { EventEmitter as EventEmitter4 } from "events";
import { v4 as uuidv4 } from "uuid";

// src/session/SessionManager.ts
import { EventEmitter as EventEmitter2 } from "events";
import { createActor } from "xstate";

// src/session/sessionMachine.ts
import { createMachine, assign } from "xstate";
function createSessionMachine(config) {
  const initialContext = {
    config,
    eventSeq: 0,
    pendingApprovals: [],
    usage: {
      agentSeconds: 0,
      terminalKb: 0,
      filesTouched: 0,
      commandsRun: 0,
      approvalsRequested: 0
    }
  };
  return createMachine({
    id: `session-${config.sessionId}`,
    initial: "created",
    context: initialContext,
    states: {
      created: {
        entry: ["logStateEntry"],
        on: {
          WORKSPACE_READY: {
            target: "preparingWorkspace"
          }
        },
        after: {
          // Auto-transition to preparing workspace
          0: "preparingWorkspace"
        }
      },
      preparingWorkspace: {
        entry: ["logStateEntry", "prepareWorkspace"],
        on: {
          WORKSPACE_READY: {
            target: "startingProvider",
            actions: assign({
              workspace: ({ event }) => event.workspace
            })
          },
          WORKSPACE_FAILED: {
            target: "failed",
            actions: assign({
              errorMessage: ({ event }) => event.error
            })
          }
        }
      },
      startingProvider: {
        entry: ["logStateEntry", "startProvider"],
        on: {
          PROVIDER_STARTED: {
            target: "running",
            actions: assign({
              providerPid: ({ event }) => event.pid,
              providerVersion: ({ event }) => event.version,
              startedAt: () => Date.now()
            })
          },
          PROVIDER_FAILED: {
            target: "failed",
            actions: assign({
              errorMessage: ({ event }) => event.error
            })
          }
        }
      },
      running: {
        entry: ["logStateEntry", "startUsageTicker"],
        exit: ["stopUsageTicker"],
        on: {
          APPROVAL_REQUESTED: {
            target: "waitingForApproval",
            actions: [
              assign({
                pendingApprovals: ({ context, event }) => [
                  ...context.pendingApprovals,
                  event.approval
                ],
                usage: ({ context }) => ({
                  ...context.usage,
                  approvalsRequested: context.usage.approvalsRequested + 1
                })
              })
            ]
          },
          PAUSE: {
            target: "pausedByHuman",
            actions: assign({
              pauseReason: () => "User requested pause"
            })
          },
          STOP: {
            target: "stopping"
          },
          PROVIDER_EXITED: {
            target: "completed",
            actions: assign({
              exitCode: ({ event }) => event.exitCode,
              endedAt: () => Date.now()
            })
          },
          ERROR: {
            target: "failed",
            actions: assign({
              errorMessage: ({ event }) => event.error,
              endedAt: () => Date.now()
            })
          },
          USAGE_TICK: {
            actions: assign({
              usage: ({ context, event }) => ({
                agentSeconds: context.usage.agentSeconds + (event.metrics.agentSeconds ?? 0),
                terminalKb: context.usage.terminalKb + (event.metrics.terminalKb ?? 0),
                filesTouched: context.usage.filesTouched + (event.metrics.filesTouched ?? 0),
                commandsRun: context.usage.commandsRun + (event.metrics.commandsRun ?? 0),
                approvalsRequested: context.usage.approvalsRequested
              }),
              eventSeq: ({ context }) => context.eventSeq + 1
            })
          }
        }
      },
      waitingForApproval: {
        entry: ["logStateEntry"],
        on: {
          APPROVAL_RESOLVED: [
            {
              target: "running",
              guard: ({ context, event }) => {
                const pending = context.pendingApprovals.find(
                  (a) => a.approvalId === event.approvalId
                );
                return pending !== void 0 && event.decision === "allow";
              },
              actions: assign({
                pendingApprovals: ({ context, event }) => context.pendingApprovals.filter((a) => a.approvalId !== event.approvalId)
              })
            },
            {
              target: "stopping",
              guard: ({ event }) => event.decision === "deny",
              actions: assign({
                errorMessage: () => "Approval denied by user",
                pendingApprovals: ({ context, event }) => context.pendingApprovals.filter((a) => a.approvalId !== event.approvalId)
              })
            }
          ],
          PAUSE: {
            target: "pausedByHuman"
          },
          STOP: {
            target: "stopping"
          },
          ERROR: {
            target: "failed",
            actions: assign({
              errorMessage: ({ event }) => event.error
            })
          }
        }
      },
      pausedByHuman: {
        entry: ["logStateEntry"],
        on: {
          RESUME: {
            target: "running",
            actions: assign({
              pauseReason: () => void 0
            })
          },
          STOP: {
            target: "stopping"
          },
          ERROR: {
            target: "failed",
            actions: assign({
              errorMessage: ({ event }) => event.error
            })
          }
        }
      },
      stopping: {
        entry: ["logStateEntry", "stopProvider"],
        on: {
          PROVIDER_EXITED: {
            target: "completed",
            actions: assign({
              exitCode: ({ event }) => event.exitCode,
              endedAt: () => Date.now()
            })
          },
          ERROR: {
            target: "failed",
            actions: assign({
              errorMessage: ({ event }) => event.error,
              endedAt: () => Date.now()
            })
          }
        },
        after: {
          // Force kill after timeout
          3e4: {
            target: "completed",
            actions: assign({
              endedAt: () => Date.now()
            })
          }
        }
      },
      completed: {
        type: "final",
        entry: ["logStateEntry", "cleanupResources", "emitSessionEnded"]
      },
      failed: {
        type: "final",
        entry: ["logStateEntry", "cleanupResources", "emitSessionEnded"]
      }
    }
  });
}
function mapToSessionState(stateValue) {
  const mapping = {
    created: "CREATED",
    preparingWorkspace: "PREPARING_WORKSPACE",
    startingProvider: "STARTING_PROVIDER",
    running: "RUNNING",
    waitingForApproval: "WAITING_FOR_APPROVAL",
    pausedByHuman: "PAUSED_BY_HUMAN",
    stopping: "STOPPING",
    completed: "COMPLETED",
    failed: "FAILED"
  };
  return mapping[stateValue] ?? "FAILED";
}
function getSessionStateFromContext(context, stateValue) {
  return {
    state: mapToSessionState(stateValue),
    context
  };
}

// src/workspace/WorkspaceManager.ts
import { simpleGit } from "simple-git";
import { mkdir, rm, access, readdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
var DEFAULT_CONFIG = {
  baseDir: "/tmp/ai-village-workspaces",
  cacheDir: "/tmp/ai-village-cache",
  shallowClone: true,
  maxCacheAge: 24 * 60 * 60 * 1e3,
  // 24 hours
  maxCachedRepos: 50
};
var WorkspaceManager = class {
  config;
  activeWorkspaces = /* @__PURE__ */ new Map();
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  /**
   * Initialize the workspace manager
   * Creates necessary directories
   */
  async initialize() {
    await mkdir(this.config.baseDir, { recursive: true });
    await mkdir(this.config.cacheDir, { recursive: true });
  }
  /**
   * Create a workspace for a session
   */
  async createWorkspace(sessionId, repoRef, checkout, options = {}) {
    const workspaceId = `ws_${randomUUID().slice(0, 8)}`;
    const worktreePath = join(this.config.baseDir, sessionId, workspaceId);
    const cachePath = await this.ensureCachedClone(repoRef, options.authToken);
    await this.createWorktree(cachePath, worktreePath, checkout);
    const workspaceRef = {
      workspaceId,
      repoRef,
      checkout,
      worktreePath,
      roomPath: options.roomPath,
      readOnly: options.readOnly ?? false,
      createdAt: Date.now()
    };
    this.activeWorkspaces.set(sessionId, workspaceRef);
    return workspaceRef;
  }
  /**
   * Get the workspace for a session
   */
  getWorkspace(sessionId) {
    return this.activeWorkspaces.get(sessionId);
  }
  /**
   * Destroy a workspace and clean up resources
   */
  async destroyWorkspace(sessionId) {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace) {
      return;
    }
    try {
      const cachePath = this.getCachePath(workspace.repoRef);
      const git = simpleGit(cachePath);
      try {
        await git.raw(["worktree", "remove", workspace.worktreePath, "--force"]);
      } catch {
      }
      const sessionDir = join(this.config.baseDir, sessionId);
      await rm(sessionDir, { recursive: true, force: true });
    } finally {
      this.activeWorkspaces.delete(sessionId);
    }
  }
  /**
   * Get the full path to a file in the workspace
   */
  getFilePath(sessionId, relativePath) {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace) {
      return void 0;
    }
    return join(workspace.worktreePath, relativePath);
  }
  /**
   * Get the room path within a workspace
   */
  getRoomPath(sessionId) {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace?.roomPath) {
      return void 0;
    }
    return join(workspace.worktreePath, workspace.roomPath);
  }
  /**
   * Get a git instance for the workspace
   */
  getGit(sessionId) {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace) {
      return void 0;
    }
    return simpleGit(workspace.worktreePath);
  }
  /**
   * Ensure a cached clone exists for the repository
   */
  async ensureCachedClone(repoRef, authToken) {
    const cachePath = this.getCachePath(repoRef);
    try {
      await access(cachePath);
      const git = simpleGit(cachePath);
      await git.fetch(["--prune"]);
      return cachePath;
    } catch {
      const url = this.getRepoUrl(repoRef, authToken);
      await mkdir(cachePath, { recursive: true });
      const gitOptions = {
        baseDir: cachePath,
        binary: "git"
      };
      const git = simpleGit(gitOptions);
      const cloneOptions = this.config.shallowClone ? ["--depth", "1", "--single-branch"] : [];
      await git.clone(url, cachePath, ["--bare", ...cloneOptions]);
      const bareGit = simpleGit(cachePath);
      await bareGit.raw(["config", "core.bare", "false"]);
      return cachePath;
    }
  }
  /**
   * Create a worktree from the cached clone
   */
  async createWorktree(cachePath, worktreePath, checkout) {
    await mkdir(worktreePath, { recursive: true });
    const git = simpleGit(cachePath);
    const ref = this.getCheckoutRef(checkout);
    try {
      await git.raw(["worktree", "add", worktreePath, ref]);
    } catch (error) {
      await git.fetch(["origin", ref]);
      await git.raw(["worktree", "add", worktreePath, ref]);
    }
  }
  /**
   * Get the cache path for a repository
   */
  getCachePath(repoRef) {
    const repoKey = `${repoRef.provider}-${repoRef.owner}-${repoRef.name}`;
    return join(this.config.cacheDir, repoKey);
  }
  /**
   * Get the clone URL for a repository
   */
  getRepoUrl(repoRef, authToken) {
    const { provider, owner, name } = repoRef;
    switch (provider) {
      case "github": {
        if (authToken) {
          return `https://${authToken}@github.com/${owner}/${name}.git`;
        }
        return `https://github.com/${owner}/${name}.git`;
      }
      case "gitlab": {
        if (authToken) {
          return `https://oauth2:${authToken}@gitlab.com/${owner}/${name}.git`;
        }
        return `https://gitlab.com/${owner}/${name}.git`;
      }
      case "bitbucket": {
        if (authToken) {
          return `https://x-token-auth:${authToken}@bitbucket.org/${owner}/${name}.git`;
        }
        return `https://bitbucket.org/${owner}/${name}.git`;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  /**
   * Get the git ref from a checkout spec
   */
  getCheckoutRef(checkout) {
    switch (checkout.type) {
      case "branch":
        return checkout.ref;
      case "commit":
        return checkout.sha;
      case "tag":
        return checkout.tag;
    }
  }
  /**
   * Clean up old cached repositories
   */
  async pruneCache() {
    const entries = await readdir(this.config.cacheDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    if (dirs.length <= this.config.maxCachedRepos) {
      return 0;
    }
    const toRemove = dirs.length - this.config.maxCachedRepos;
    let removed = 0;
    for (let i = 0; i < toRemove && i < dirs.length; i++) {
      const dirPath = join(this.config.cacheDir, dirs[i].name);
      await rm(dirPath, { recursive: true, force: true });
      removed++;
    }
    return removed;
  }
  /**
   * Get statistics about active workspaces
   */
  getStats() {
    const workspaces = [];
    for (const [sessionId, ws] of this.activeWorkspaces) {
      workspaces.push({
        sessionId,
        repoRef: ws.repoRef,
        createdAt: ws.createdAt
      });
    }
    return {
      activeWorkspaces: this.activeWorkspaces.size,
      workspaces
    };
  }
};
var workspaceManager = null;
function getWorkspaceManager(config) {
  if (!workspaceManager) {
    workspaceManager = new WorkspaceManager(config);
  }
  return workspaceManager;
}

// src/pty/PTYManager.ts
import { EventEmitter } from "events";
var PTYManager = class extends EventEmitter {
  sessions = /* @__PURE__ */ new Map();
  nodePty = null;
  /**
   * Initialize the PTY manager
   * Dynamically imports node-pty to handle native module loading
   */
  async initialize() {
    this.nodePty = await import("node-pty");
  }
  /**
   * Spawn a new PTY process
   */
  spawn(sessionId, options) {
    if (!this.nodePty) {
      throw new Error("PTYManager not initialized. Call initialize() first.");
    }
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has an active PTY`);
    }
    const {
      command,
      args = [],
      cwd,
      env = {},
      cols = 120,
      rows = 40,
      shell
    } = options;
    const fullEnv = {
      ...process.env,
      ...env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor"
    };
    const pty = this.nodePty.spawn(shell ?? command, shell ? ["-c", command] : args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: fullEnv
    });
    const session = {
      pty,
      sessionId,
      pid: pty.pid,
      startedAt: Date.now(),
      cwd,
      command,
      dataBuffer: [],
      maxBufferSize: 1e4
      // Keep last 10k lines
    };
    pty.onData((data) => {
      session.dataBuffer.push(data);
      if (session.dataBuffer.length > session.maxBufferSize) {
        session.dataBuffer.shift();
      }
      const event = {
        sessionId,
        data,
        stream: "stdout",
        // node-pty combines stdout/stderr
        timestamp: Date.now()
      };
      this.emit("data", event);
    });
    pty.onExit(({ exitCode, signal }) => {
      const event = {
        sessionId,
        exitCode,
        signal: signal !== void 0 ? String(signal) : void 0,
        timestamp: Date.now()
      };
      this.emit("exit", event);
      this.sessions.delete(sessionId);
    });
    this.sessions.set(sessionId, session);
    return pty.pid;
  }
  /**
   * Send input to a PTY session
   */
  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active PTY for session ${sessionId}`);
    }
    session.pty.write(data);
  }
  /**
   * Resize a PTY session
   */
  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active PTY for session ${sessionId}`);
    }
    session.pty.resize(cols, rows);
  }
  /**
   * Kill a PTY session
   */
  kill(sessionId, signal = "SIGTERM") {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.pty.kill(signal);
  }
  /**
   * Get the PID of a session
   */
  getPid(sessionId) {
    return this.sessions.get(sessionId)?.pid;
  }
  /**
   * Check if a session is active
   */
  isActive(sessionId) {
    return this.sessions.has(sessionId);
  }
  /**
   * Get buffered output for a session
   */
  getBuffer(sessionId) {
    return this.sessions.get(sessionId)?.dataBuffer ?? [];
  }
  /**
   * Get session statistics
   */
  getStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return void 0;
    }
    return {
      pid: session.pid,
      startedAt: session.startedAt,
      cwd: session.cwd,
      command: session.command,
      bufferSize: session.dataBuffer.length
    };
  }
  /**
   * Get all active session IDs
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }
  /**
   * Cleanup all sessions
   */
  async cleanup() {
    const promises = [];
    for (const [sessionId] of this.sessions) {
      promises.push(
        new Promise((resolve) => {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.pty.onExit(() => resolve());
            session.pty.kill("SIGKILL");
          } else {
            resolve();
          }
        })
      );
    }
    await Promise.all(promises);
    this.sessions.clear();
  }
};
var ptyManager = null;
async function getPTYManager() {
  if (!ptyManager) {
    ptyManager = new PTYManager();
    await ptyManager.initialize();
  }
  return ptyManager;
}

// src/session/SessionManager.ts
var DEFAULT_CONFIG2 = {
  maxSessions: 10,
  usageTickIntervalMs: 3e4,
  sessionTimeoutMs: 60 * 60 * 1e3
};
var SessionManager = class extends EventEmitter2 {
  sessions = /* @__PURE__ */ new Map();
  workspaceManager;
  ptyManager;
  config;
  initialized = false;
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG2, ...config };
  }
  /**
   * Initialize the session manager
   */
  async initialize() {
    if (this.initialized) return;
    this.workspaceManager = getWorkspaceManager();
    await this.workspaceManager.initialize();
    this.ptyManager = await getPTYManager();
    this.ptyManager.on("data", this.handlePTYData.bind(this));
    this.ptyManager.on("exit", this.handlePTYExit.bind(this));
    this.initialized = true;
  }
  /**
   * Start a new session
   */
  async startSession(config) {
    if (!this.initialized) {
      throw new Error("SessionManager not initialized");
    }
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(`Maximum sessions (${this.config.maxSessions}) reached`);
    }
    if (this.sessions.has(config.sessionId)) {
      throw new Error(`Session ${config.sessionId} already exists`);
    }
    const machine = createSessionMachine(config);
    const actor = createActor(machine, {
      systemId: config.sessionId
    });
    const session = {
      config,
      actor,
      lastState: "CREATED",
      eventSeq: 0
    };
    actor.subscribe((snapshot) => {
      const newState = mapToSessionState(String(snapshot.value));
      if (newState !== session.lastState) {
        this.emitStateChanged(session, session.lastState, newState);
        session.lastState = newState;
      }
    });
    this.sessions.set(config.sessionId, session);
    actor.start();
    try {
      const workspace = await this.workspaceManager.createWorkspace(
        config.sessionId,
        config.repoRef,
        config.checkout,
        { roomPath: config.roomPath }
      );
      actor.send({ type: "WORKSPACE_READY", workspace });
    } catch (error) {
      actor.send({
        type: "WORKSPACE_FAILED",
        error: error instanceof Error ? error.message : "Workspace creation failed"
      });
    }
    return this.getSessionState(config.sessionId);
  }
  /**
   * Set the provider adapter for a session and start it
   */
  async setProviderAdapter(sessionId, adapter) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.adapter = adapter;
    const workspace = this.workspaceManager.getWorkspace(sessionId);
    if (!workspace) {
      throw new Error(`Workspace not found for session ${sessionId}`);
    }
    try {
      const { sessionPid } = await adapter.startSession({
        repoPath: workspace.worktreePath,
        task: session.config.task,
        policy: session.config.policy,
        env: session.config.env ?? {}
      });
      const detection = await adapter.detect();
      session.actor.send({
        type: "PROVIDER_STARTED",
        pid: sessionPid,
        version: detection.version ?? "unknown"
      });
      this.emitSessionStarted(session, workspace.worktreePath, detection.version ?? "unknown");
      this.startUsageTicker(sessionId);
      adapter.onEvent((evt) => {
        this.handleProviderEvent(sessionId, evt);
      });
    } catch (error) {
      session.actor.send({
        type: "PROVIDER_FAILED",
        error: error instanceof Error ? error.message : "Provider start failed"
      });
    }
  }
  /**
   * Send input to a session
   */
  async sendInput(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (!session.adapter) {
      throw new Error(`No adapter for session ${sessionId}`);
    }
    await session.adapter.sendInput(data);
  }
  /**
   * Pause a session
   */
  pauseSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.actor.send({ type: "PAUSE" });
  }
  /**
   * Resume a paused session
   */
  resumeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.actor.send({ type: "RESUME" });
  }
  /**
   * Stop a session
   */
  async stopSession(sessionId, graceful = true) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.actor.send({ type: "STOP", graceful });
    if (session.adapter) {
      await session.adapter.stop();
    }
  }
  /**
   * Resolve an approval request
   */
  resolveApproval(sessionId, approvalId, decision, note) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.actor.send({ type: "APPROVAL_RESOLVED", approvalId, decision });
    this.emitEvent({
      type: "APPROVAL_RESOLVED",
      sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      approvalId,
      decision,
      note
    });
  }
  /**
   * Get the current state of a session
   */
  getSessionState(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return void 0;
    }
    const snapshot = session.actor.getSnapshot();
    const context = snapshot.context;
    return {
      sessionId,
      state: session.lastState,
      providerId: session.config.providerId,
      workspace: context.workspace,
      startedAt: context.startedAt,
      providerPid: context.providerPid,
      lastEventSeq: session.eventSeq,
      pendingApprovals: context.pendingApprovals.map((a) => a.approvalId),
      errorMessage: context.errorMessage,
      exitCode: context.exitCode
    };
  }
  /**
   * Get all active session IDs
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }
  /**
   * Get session count by state
   */
  getSessionStats() {
    const stats = {
      CREATED: 0,
      PREPARING_WORKSPACE: 0,
      STARTING_PROVIDER: 0,
      RUNNING: 0,
      WAITING_FOR_APPROVAL: 0,
      PAUSED_BY_HUMAN: 0,
      STOPPING: 0,
      COMPLETED: 0,
      FAILED: 0
    };
    for (const session of this.sessions.values()) {
      stats[session.lastState]++;
    }
    return stats;
  }
  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    const stopPromises = Array.from(this.sessions.keys()).map(
      (id) => this.stopSession(id, false)
    );
    await Promise.all(stopPromises);
    await this.ptyManager.cleanup();
    this.sessions.clear();
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  handlePTYData(event) {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;
    this.emitEvent({
      type: "TERMINAL_CHUNK",
      sessionId: event.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: event.timestamp,
      seq: this.nextSeq(session),
      data: event.data,
      stream: event.stream
    });
  }
  handlePTYExit(event) {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;
    session.actor.send({ type: "PROVIDER_EXITED", exitCode: event.exitCode });
  }
  handleProviderEvent(sessionId, evt) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (evt.type === "REQUEST_APPROVAL") {
      const approval = {
        approvalId: evt.approvalId,
        sessionId,
        category: evt.category,
        summary: evt.summary,
        risk: evt.risk,
        context: evt.context,
        requestedAt: Date.now(),
        timeoutAt: evt.timeout ? Date.now() + evt.timeout : void 0
      };
      session.actor.send({ type: "APPROVAL_REQUESTED", approval });
      this.emitEvent({
        type: "APPROVAL_REQUESTED",
        sessionId,
        orgId: session.config.orgId,
        repoRef: session.config.repoRef,
        ts: Date.now(),
        seq: this.nextSeq(session),
        approval
      });
    }
    this.emitEvent({
      type: "PROVIDER_EVENT_FORWARDED",
      sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      providerEvent: evt
    });
  }
  startUsageTicker(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.usageTickInterval = setInterval(() => {
      this.emitUsageTick(sessionId);
    }, this.config.usageTickIntervalMs);
  }
  stopUsageTicker(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session?.usageTickInterval) return;
    clearInterval(session.usageTickInterval);
    session.usageTickInterval = void 0;
  }
  emitUsageTick(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const snapshot = session.actor.getSnapshot();
    const context = snapshot.context;
    const metrics = {
      agentSeconds: this.config.usageTickIntervalMs / 1e3,
      terminalKb: 0,
      // Would be calculated from PTY buffer
      filesTouched: 0,
      commandsRun: 0,
      approvalsRequested: 0
    };
    session.actor.send({ type: "USAGE_TICK", metrics });
    this.emitEvent({
      type: "USAGE_TICK",
      sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      providerId: session.config.providerId,
      units: metrics,
      intervalMs: this.config.usageTickIntervalMs
    });
  }
  emitSessionStarted(session, workspacePath, version) {
    this.emitEvent({
      type: "SESSION_STARTED",
      sessionId: session.config.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      providerId: session.config.providerId,
      providerVersion: version,
      workspacePath,
      roomPath: session.config.roomPath
    });
  }
  emitStateChanged(session, previousState, newState) {
    this.emitEvent({
      type: "SESSION_STATE_CHANGED",
      sessionId: session.config.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      previousState,
      newState
    });
    if (newState === "COMPLETED" || newState === "FAILED") {
      this.stopUsageTicker(session.config.sessionId);
      this.emitSessionEnded(session, newState);
      this.cleanupSession(session.config.sessionId);
    }
  }
  emitSessionEnded(session, finalState) {
    const snapshot = session.actor.getSnapshot();
    const context = snapshot.context;
    this.emitEvent({
      type: "SESSION_ENDED",
      sessionId: session.config.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      finalState,
      exitCode: context.exitCode,
      totalDurationMs: context.endedAt ? context.endedAt - (context.startedAt ?? context.endedAt) : 0,
      totalUsage: context.usage
    });
  }
  async cleanupSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    await this.workspaceManager.destroyWorkspace(sessionId);
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 5e3);
  }
  nextSeq(session) {
    return ++session.eventSeq;
  }
  emitEvent(event) {
    this.emit("event", event);
  }
};
var sessionManager = null;
async function getSessionManager(config) {
  if (!sessionManager) {
    sessionManager = new SessionManager(config);
    await sessionManager.initialize();
  }
  return sessionManager;
}

// src/events/EventStream.ts
import { EventEmitter as EventEmitter3 } from "events";
import WebSocket from "ws";
var DEFAULT_CONFIG3 = {
  reconnectIntervalMs: 5e3,
  maxReconnectAttempts: 10,
  maxBufferSize: 1e4,
  pingIntervalMs: 3e4
};
var EventStream = class extends EventEmitter3 {
  config;
  ws = null;
  state = "disconnected";
  buffer = [];
  reconnectAttempts = 0;
  reconnectTimeout = null;
  pingInterval = null;
  constructor(config) {
    super();
    this.config = { ...DEFAULT_CONFIG3, ...config };
  }
  /**
   * Connect to Control Plane
   */
  async connect() {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }
    this.state = "connecting";
    this.emit("stateChange", this.state);
    return new Promise((resolve, reject) => {
      const url = `${this.config.controlPlaneUrl}?token=${this.config.authToken}&runner=${this.config.runnerId}`;
      try {
        this.ws = new WebSocket(url);
        this.ws.on("open", () => {
          this.state = "connected";
          this.reconnectAttempts = 0;
          this.emit("stateChange", this.state);
          this.startPing();
          this.flushBuffer();
          resolve();
        });
        this.ws.on("close", (code, reason) => {
          this.handleDisconnect(code, reason.toString());
        });
        this.ws.on("error", (error) => {
          this.emit("error", error);
          if (this.state === "connecting") {
            reject(error);
          }
        });
        this.ws.on("message", (data) => {
          this.handleMessage(data);
        });
        this.ws.on("pong", () => {
          this.emit("pong");
        });
      } catch (error) {
        this.state = "disconnected";
        this.emit("stateChange", this.state);
        reject(error);
      }
    });
  }
  /**
   * Disconnect from Control Plane
   */
  disconnect() {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close(1e3, "Client disconnect");
      this.ws = null;
    }
    this.state = "disconnected";
    this.emit("stateChange", this.state);
  }
  /**
   * Send an event to Control Plane
   */
  send(event) {
    if (this.state === "connected" && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
        return true;
      } catch {
        this.bufferEvent(event);
        return false;
      }
    } else {
      this.bufferEvent(event);
      return false;
    }
  }
  /**
   * Send multiple events
   */
  sendBatch(events) {
    let sent = 0;
    for (const event of events) {
      if (this.send(event)) {
        sent++;
      }
    }
    return sent;
  }
  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }
  /**
   * Get buffer size
   */
  getBufferSize() {
    return this.buffer.length;
  }
  /**
   * Clear the event buffer
   */
  clearBuffer() {
    this.buffer = [];
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  bufferEvent(event) {
    this.buffer.push(event);
    while (this.buffer.length > this.config.maxBufferSize) {
      const evicted = this.buffer.shift();
      if (evicted) {
        this.emit("eventEvicted", evicted);
      }
    }
  }
  flushBuffer() {
    if (this.buffer.length === 0) return;
    const events = [...this.buffer];
    this.buffer = [];
    for (const event of events) {
      if (!this.send(event)) {
        break;
      }
    }
  }
  handleDisconnect(code, reason) {
    this.stopPing();
    this.ws = null;
    if (this.state === "disconnected") {
      return;
    }
    this.emit("disconnected", { code, reason });
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.state = "disconnected";
      this.emit("stateChange", this.state);
      this.emit("maxReconnectAttemptsReached");
    }
  }
  scheduleReconnect() {
    this.state = "reconnecting";
    this.emit("stateChange", this.state);
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectIntervalMs * Math.pow(2, this.reconnectAttempts - 1),
      6e4
      // Max 1 minute
    );
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
      }
    }, delay);
    this.emit("reconnecting", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delayMs: delay
    });
  }
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.emit("message", message);
    } catch {
      this.emit("error", new Error("Failed to parse message from Control Plane"));
    }
  }
  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.config.pingIntervalMs);
  }
  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
};
function createEventStream(config) {
  return new EventStream(config);
}

// src/Runner.ts
var Runner = class extends EventEmitter4 {
  config;
  state = "stopped";
  sessionManager;
  eventStream;
  heartbeatInterval = null;
  startedAt = null;
  constructor(config) {
    super();
    this.config = config;
  }
  /**
   * Start the runner
   */
  async start() {
    if (this.state !== "stopped") {
      throw new Error(`Cannot start runner in state: ${this.state}`);
    }
    this.state = "starting";
    this.emit("stateChange", this.state);
    try {
      this.sessionManager = await getSessionManager({
        maxSessions: this.config.maxSessions
      });
      this.sessionManager.on("event", (event) => {
        this.handleSessionEvent(event);
      });
      this.eventStream = createEventStream({
        controlPlaneUrl: this.config.controlPlaneUrl,
        authToken: this.config.authToken,
        runnerId: this.config.runnerId,
        reconnectIntervalMs: 5e3,
        maxReconnectAttempts: 10,
        maxBufferSize: 1e4,
        pingIntervalMs: 3e4
      });
      this.eventStream.on("message", (message) => {
        this.handleControlPlaneMessage(message);
      });
      this.eventStream.on("error", (error) => {
        this.emit("error", error);
      });
      await this.eventStream.connect();
      this.startHeartbeat();
      this.startedAt = Date.now();
      this.state = "running";
      this.emit("stateChange", this.state);
      this.emit("started");
    } catch (error) {
      this.state = "error";
      this.emit("stateChange", this.state);
      throw error;
    }
  }
  /**
   * Stop the runner
   */
  async stop() {
    if (this.state !== "running") {
      return;
    }
    this.state = "stopping";
    this.emit("stateChange", this.state);
    try {
      this.stopHeartbeat();
      await this.sessionManager.shutdown();
      this.eventStream.disconnect();
      this.state = "stopped";
      this.emit("stateChange", this.state);
      this.emit("stopped");
    } catch (error) {
      this.state = "error";
      this.emit("stateChange", this.state);
      throw error;
    }
  }
  /**
   * Handle a command from Control Plane
   */
  async handleCommand(command) {
    switch (command.type) {
      case "START":
        await this.handleStartCommand(command.config);
        break;
      case "INPUT":
        if (!command.sessionId) throw new Error("Session ID required for INPUT");
        await this.sessionManager.sendInput(command.sessionId, command.input.data);
        break;
      case "STOP":
        if (!command.sessionId) throw new Error("Session ID required for STOP");
        await this.sessionManager.stopSession(command.sessionId, command.graceful);
        break;
      case "PAUSE":
        if (!command.sessionId) throw new Error("Session ID required for PAUSE");
        this.sessionManager.pauseSession(command.sessionId);
        break;
      case "RESUME":
        if (!command.sessionId) throw new Error("Session ID required for RESUME");
        this.sessionManager.resumeSession(command.sessionId);
        break;
      case "APPROVE":
        if (!command.sessionId) throw new Error("Session ID required for APPROVE");
        this.sessionManager.resolveApproval(
          command.sessionId,
          command.approvalId,
          command.decision,
          command.note
        );
        break;
    }
  }
  /**
   * Get runner info for heartbeat
   */
  getInfo() {
    const providerVersions = {
      codex: null,
      claude_code: null,
      gemini_cli: null,
      omnara: null
    };
    for (const [providerId] of this.config.adapterFactories) {
      providerVersions[providerId] = "available";
    }
    return {
      runnerId: this.config.runnerId,
      mode: this.config.mode,
      version: this.config.version,
      capabilities: this.getCapabilities(),
      activeSessionCount: this.sessionManager?.getActiveSessions().length ?? 0,
      maxSessions: this.config.maxSessions,
      lastHeartbeatAt: Date.now(),
      providerVersions
    };
  }
  /**
   * Get runner state
   */
  getState() {
    return this.state;
  }
  /**
   * Get uptime in milliseconds
   */
  getUptime() {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  async handleStartCommand(config) {
    const adapterFactory = this.config.adapterFactories.get(config.providerId);
    if (!adapterFactory) {
      throw new Error(`No adapter available for provider: ${config.providerId}`);
    }
    await this.sessionManager.startSession(config);
    const adapter = adapterFactory();
    await this.sessionManager.setProviderAdapter(config.sessionId, adapter);
  }
  handleSessionEvent(event) {
    this.eventStream.send(event);
    this.emit("sessionEvent", event);
  }
  handleControlPlaneMessage(message) {
    if (isSessionCommand(message)) {
      this.handleCommand(message).catch((error) => {
        this.emit("error", error);
      });
    }
  }
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatIntervalMs);
    this.sendHeartbeat();
  }
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  sendHeartbeat() {
    const info = this.getInfo();
    this.eventStream.send({
      type: "SESSION_STATE_CHANGED",
      sessionId: "runner_heartbeat",
      orgId: "system",
      ts: Date.now(),
      seq: 0,
      previousState: "RUNNING",
      newState: "RUNNING",
      reason: JSON.stringify(info)
    });
  }
  getCapabilities() {
    const caps = ["pty_streaming", "workspace_isolation", "policy_enforcement"];
    if (this.config.adapterFactories.has("codex")) {
      caps.push("codex_provider");
    }
    if (this.config.adapterFactories.has("claude_code")) {
      caps.push("claude_code_provider");
    }
    if (this.config.adapterFactories.has("gemini_cli")) {
      caps.push("gemini_cli_provider");
    }
    return caps;
  }
};
function isSessionCommand(message) {
  return typeof message === "object" && message !== null && "type" in message && typeof message.type === "string" && ["START", "INPUT", "STOP", "PAUSE", "RESUME", "APPROVE"].includes(
    message.type
  );
}
function createRunner(config) {
  return new Runner(config);
}
function createDefaultRunner(controlPlaneUrl, authToken, adapterFactories) {
  return new Runner({
    runnerId: `runner_${uuidv4().slice(0, 8)}`,
    mode: "hosted",
    version: "0.1.0",
    controlPlaneUrl,
    authToken,
    maxSessions: 10,
    heartbeatIntervalMs: 3e4,
    adapterFactories
  });
}

// src/policy/PolicyEnforcer.ts
var SECRET_PATTERNS = [
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
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g
];
var ALWAYS_BLOCKED_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "rm -rf ~",
  "rm -rf ~/*",
  "dd if=/dev/zero",
  "mkfs",
  ":(){:|:&};:",
  "chmod -R 777 /",
  "chown -R",
  "> /dev/sda",
  "curl | sh",
  "curl | bash",
  "wget | sh",
  "wget | bash"
];
var DANGEROUS_PATTERNS = [
  /rm\s+-[rf]+\s+\/(?!tmp)/i,
  // rm -rf not in /tmp
  />\s*\/etc\//i,
  // Overwrite system files
  />\s*\/usr\//i,
  /chmod\s+777/i,
  // Overly permissive
  /curl.*\|\s*(?:bash|sh)/i,
  // Pipe curl to shell
  /wget.*\|\s*(?:bash|sh)/i,
  // Pipe wget to shell
  /eval\s*\(/i,
  // Eval execution
  /\$\([^)]*rm/i
  // Command substitution with rm
];
var PolicyEnforcer = class {
  policy;
  violations = [];
  constructor(policy) {
    this.policy = policy;
  }
  /**
   * Check if a shell command is allowed
   */
  checkCommand(command) {
    const violations = [];
    const normalizedCommand = command.trim().toLowerCase();
    for (const blocked of ALWAYS_BLOCKED_COMMANDS) {
      if (normalizedCommand.includes(blocked.toLowerCase())) {
        violations.push({
          type: "shell_command",
          description: `Dangerous command blocked: ${blocked}`,
          value: command,
          severity: "block",
          timestamp: Date.now()
        });
      }
    }
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        violations.push({
          type: "shell_command",
          description: `Dangerous command pattern detected`,
          value: command,
          severity: "block",
          timestamp: Date.now()
        });
      }
    }
    for (const denied of this.policy.shellDenylist) {
      const deniedLower = denied.toLowerCase();
      if (normalizedCommand.startsWith(deniedLower) || normalizedCommand.includes(` ${deniedLower}`) || normalizedCommand.includes(`|${deniedLower}`) || normalizedCommand.includes(`| ${deniedLower}`)) {
        violations.push({
          type: "shell_command",
          description: `Command in denylist: ${denied}`,
          value: command,
          severity: "block",
          timestamp: Date.now()
        });
      }
    }
    if (this.policy.shellAllowlist.length > 0) {
      const commandBase = command.split(/\s+/)[0];
      const isAllowed = this.policy.shellAllowlist.some(
        (allowed) => commandBase.toLowerCase() === allowed.toLowerCase() || commandBase.toLowerCase().endsWith(`/${allowed.toLowerCase()}`)
      );
      if (!isAllowed) {
        violations.push({
          type: "shell_command",
          description: `Command not in allowlist: ${commandBase}`,
          value: command,
          severity: "block",
          timestamp: Date.now()
        });
      }
    }
    this.violations.push(...violations);
    return {
      allowed: violations.filter((v) => v.severity === "block").length === 0,
      violations
    };
  }
  /**
   * Check if a filesystem path access is allowed
   */
  checkPath(path, operation) {
    const violations = [];
    const blockedPaths = [
      "/etc/passwd",
      "/etc/shadow",
      "/etc/sudoers",
      "/root",
      "/home/*/.ssh",
      "/home/*/.gnupg",
      "/var/log",
      "/sys",
      "/proc"
    ];
    for (const blocked of blockedPaths) {
      const pattern = blocked.replace("*", ".*");
      if (new RegExp(`^${pattern}`).test(path)) {
        violations.push({
          type: "filesystem_path",
          description: `Access to sensitive path blocked: ${blocked}`,
          value: path,
          severity: "block",
          timestamp: Date.now()
        });
      }
    }
    if (path.includes("..")) {
      violations.push({
        type: "filesystem_path",
        description: "Directory traversal detected",
        value: path,
        severity: "block",
        timestamp: Date.now()
      });
    }
    this.violations.push(...violations);
    return {
      allowed: violations.filter((v) => v.severity === "block").length === 0,
      violations
    };
  }
  /**
   * Redact secrets from text
   */
  redactSecrets(text) {
    let redacted = text;
    let secretsFound = 0;
    for (const pattern of SECRET_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        secretsFound += matches.length;
        redacted = redacted.replace(pattern, (match) => {
          const prefix = match.substring(0, Math.min(4, match.length));
          return `${prefix}${"*".repeat(Math.max(0, match.length - 4))}`;
        });
      }
    }
    if (secretsFound > 0) {
      this.violations.push({
        type: "secret_detected",
        description: `${secretsFound} potential secret(s) redacted`,
        value: "[REDACTED]",
        severity: "warn",
        timestamp: Date.now()
      });
    }
    return { redacted, secretsFound };
  }
  /**
   * Check if an action requires approval
   */
  requiresApproval(action) {
    return this.policy.requiresApprovalFor.includes(action);
  }
  /**
   * Check network egress policy
   */
  checkNetworkEgress(url) {
    const violations = [];
    if (this.policy.networkMode === "restricted") {
      const allowedDomains = [
        "github.com",
        "gitlab.com",
        "bitbucket.org",
        "npmjs.org",
        "pypi.org",
        "registry.npmjs.org"
      ];
      try {
        const urlObj = new URL(url);
        const isAllowed = allowedDomains.some(
          (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );
        if (!isAllowed) {
          violations.push({
            type: "network_egress",
            description: `Network access to ${urlObj.hostname} blocked (restricted mode)`,
            value: url,
            severity: "block",
            timestamp: Date.now()
          });
        }
      } catch {
        violations.push({
          type: "network_egress",
          description: "Invalid URL blocked",
          value: url,
          severity: "block",
          timestamp: Date.now()
        });
      }
    }
    this.violations.push(...violations);
    return {
      allowed: violations.filter((v) => v.severity === "block").length === 0,
      violations
    };
  }
  /**
   * Get all violations recorded
   */
  getViolations() {
    return [...this.violations];
  }
  /**
   * Get violation count by type
   */
  getViolationStats() {
    const stats = {
      shell_command: 0,
      filesystem_path: 0,
      secret_detected: 0,
      network_egress: 0,
      approval_required: 0
    };
    for (const v of this.violations) {
      stats[v.type]++;
    }
    return stats;
  }
  /**
   * Clear recorded violations
   */
  clearViolations() {
    this.violations = [];
  }
  /**
   * Update the policy
   */
  updatePolicy(policy) {
    this.policy = policy;
  }
  /**
   * Get current policy
   */
  getPolicy() {
    return { ...this.policy };
  }
};
function createPolicyEnforcer(policy) {
  return new PolicyEnforcer(policy);
}

// src/adapters/BaseAdapter.ts
import { EventEmitter as EventEmitter5 } from "events";
import { exec } from "child_process";
import { promisify } from "util";
var execAsync = promisify(exec);
var BaseAdapter = class {
  config;
  eventEmitter;
  ptyManager = null;
  currentSessionId = null;
  detectedCapabilities = null;
  detectedVersion = null;
  constructor(config) {
    this.config = {
      detectionTimeout: 5e3,
      ...config
    };
    this.eventEmitter = new EventEmitter5();
  }
  /**
   * Detect if the provider CLI is installed
   */
  async detect() {
    try {
      const { stdout, stderr } = await execAsync(`${this.config.command} --version`, {
        timeout: this.config.detectionTimeout,
        env: { ...process.env, ...this.config.env }
      });
      const output = stdout || stderr;
      const version = this.parseVersion(output);
      this.detectedVersion = version;
      return {
        installed: true,
        version: version ?? void 0,
        details: `Found at: ${this.config.command}`
      };
    } catch (error) {
      try {
        const whichCmd = process.platform === "win32" ? "where" : "which";
        const { stdout } = await execAsync(`${whichCmd} ${this.config.command}`, {
          timeout: this.config.detectionTimeout
        });
        return {
          installed: true,
          details: `Found at: ${stdout.trim()}`
        };
      } catch {
        return {
          installed: false,
          details: error instanceof Error ? error.message : "Command not found"
        };
      }
    }
  }
  /**
   * Get provider capabilities
   * Subclasses should override to provide accurate capabilities
   */
  async capabilities() {
    if (this.detectedCapabilities) {
      return this.detectedCapabilities;
    }
    this.detectedCapabilities = {
      ptyStreaming: true,
      structuredEdits: "none",
      supportsMCP: false,
      supportsNonInteractive: false,
      supportsPlanAndExecute: false,
      supportsPRFlow: "none"
    };
    return this.detectedCapabilities;
  }
  /**
   * Start a provider session
   */
  async startSession(args) {
    if (this.currentSessionId) {
      throw new Error("Session already active");
    }
    this.ptyManager = await getPTYManager();
    const cmdArgs = this.buildCommandArgs(args);
    this.currentSessionId = `${this.id}_${Date.now()}`;
    const pid = this.ptyManager.spawn(this.currentSessionId, {
      command: this.config.command,
      args: cmdArgs,
      cwd: args.repoPath,
      env: {
        ...this.config.env,
        ...args.env
      }
    });
    this.ptyManager.on("data", this.handlePTYData.bind(this));
    this.ptyManager.on("exit", this.handlePTYExit.bind(this));
    this.emitEvent({
      type: "PROVIDER_STARTED",
      providerId: this.id,
      timestamp: Date.now(),
      sessionId: this.currentSessionId,
      version: this.detectedVersion ?? "unknown"
    });
    return { sessionPid: pid };
  }
  /**
   * Send input to the running session
   */
  async sendInput(data) {
    if (!this.currentSessionId || !this.ptyManager) {
      throw new Error("No active session");
    }
    this.ptyManager.write(this.currentSessionId, data);
  }
  /**
   * Stop the running session
   */
  async stop() {
    if (!this.currentSessionId || !this.ptyManager) {
      return;
    }
    this.ptyManager.kill(this.currentSessionId, "SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    if (this.ptyManager.isActive(this.currentSessionId)) {
      this.ptyManager.kill(this.currentSessionId, "SIGKILL");
    }
  }
  /**
   * Subscribe to provider events
   */
  onEvent(cb) {
    this.eventEmitter.on("event", cb);
  }
  /**
   * Unsubscribe from provider events
   */
  offEvent(cb) {
    this.eventEmitter.off("event", cb);
  }
  // ============================================================================
  // Protected methods for subclasses
  // ============================================================================
  /**
   * Build command arguments from session args
   * Subclasses should override for provider-specific args
   */
  buildCommandArgs(args) {
    return [...this.config.defaultArgs ?? []];
  }
  /**
   * Parse version from CLI output
   * Subclasses should override for provider-specific parsing
   */
  parseVersion(output) {
    const patterns = [
      /version[:\s]+v?(\d+\.\d+\.\d+)/i,
      /v(\d+\.\d+\.\d+)/,
      /(\d+\.\d+\.\d+)/
    ];
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }
  /**
   * Parse structured events from terminal output
   * Subclasses should override for provider-specific parsing
   */
  parseStructuredEvents(data) {
    return [];
  }
  /**
   * Emit a provider event
   */
  emitEvent(event) {
    this.eventEmitter.emit("event", event);
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  handlePTYData(event) {
    if (event.sessionId !== this.currentSessionId) {
      return;
    }
    this.emitEvent({
      type: "PROVIDER_MESSAGE",
      providerId: this.id,
      timestamp: event.timestamp,
      sessionId: this.currentSessionId,
      text: event.data,
      source: event.stream
    });
    const structuredEvents = this.parseStructuredEvents(event.data);
    for (const evt of structuredEvents) {
      this.emitEvent(evt);
    }
  }
  handlePTYExit(event) {
    if (event.sessionId !== this.currentSessionId) {
      return;
    }
    this.emitEvent({
      type: "PROVIDER_STOPPED",
      providerId: this.id,
      timestamp: Date.now(),
      sessionId: this.currentSessionId,
      exitCode: event.exitCode,
      reason: event.exitCode === 0 ? "completed" : "error"
    });
    this.currentSessionId = null;
  }
};

// src/adapters/ClaudeCodeAdapter.ts
var ClaudeCodeAdapter = class extends BaseAdapter {
  id = "claude_code";
  claudeConfig;
  features = null;
  constructor(config = {}) {
    super({
      command: config.command ?? "claude",
      defaultArgs: [],
      env: config.env,
      detectionTimeout: config.detectionTimeout
    });
    this.claudeConfig = config;
  }
  /**
   * Get Claude Code capabilities
   */
  async capabilities() {
    if (this.detectedCapabilities) {
      return this.detectedCapabilities;
    }
    this.features = await this.detectFeatures();
    this.detectedCapabilities = {
      ptyStreaming: true,
      structuredEdits: "fileEvents",
      // Claude Code can output structured info
      supportsMCP: this.features.hasMCP && (this.claudeConfig.enableMCP ?? true),
      supportsNonInteractive: this.features.hasNonInteractive,
      supportsPlanAndExecute: true,
      // Claude Code supports planning
      supportsPRFlow: "full",
      // Can create and review PRs
      maxContextHint: "200k tokens"
    };
    return this.detectedCapabilities;
  }
  /**
   * Build Claude Code command arguments
   */
  buildCommandArgs(args) {
    const cmdArgs = [];
    if (this.features?.hasNonInteractive && args.task.goal) {
      cmdArgs.push("-p", this.buildPrompt(args));
    }
    if (this.features?.hasOutputFormat) {
      cmdArgs.push("--output-format", "stream-json");
    }
    if (this.claudeConfig.model) {
      cmdArgs.push("--model", this.claudeConfig.model);
    }
    if (this.features?.hasAllowedTools) {
      const tools = this.buildAllowedTools(args);
      if (tools.length > 0) {
        cmdArgs.push("--allowedTools", tools.join(","));
      }
    }
    return cmdArgs;
  }
  /**
   * Parse structured events from Claude Code output
   */
  parseStructuredEvents(data) {
    const events = [];
    const lines = data.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      try {
        if (line.startsWith("{")) {
          const parsed = JSON.parse(line);
          if (parsed.type === "assistant" && parsed.message?.content) {
            const content = parsed.message.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === "tool_use") {
                  events.push(this.createToolRequestEvent(item));
                }
              }
            }
          }
          if (parsed.type === "file_write" || parsed.type === "file_read") {
            events.push({
              type: "HINT_FILES_TOUCHED",
              providerId: this.id,
              timestamp: Date.now(),
              sessionId: this.currentSessionId ?? void 0,
              paths: [parsed.path],
              operation: parsed.type === "file_write" ? "write" : "read"
            });
          }
          if (parsed.type === "bash" && parsed.command?.includes("git")) {
            if (parsed.command.includes("commit") || parsed.command.includes("push")) {
              events.push({
                type: "REQUEST_APPROVAL",
                providerId: this.id,
                timestamp: Date.now(),
                sessionId: this.currentSessionId ?? void 0,
                approvalId: `approval_${Date.now()}`,
                category: "merge",
                summary: `Git operation: ${parsed.command}`,
                risk: "med"
              });
            }
          }
        }
      } catch {
      }
    }
    if (events.length === 0) {
      events.push(...this.detectPatternsFromText(data));
    }
    return events;
  }
  /**
   * Parse version from Claude output
   */
  parseVersion(output) {
    const match = output.match(/claude[- ]?(?:code)?[- ]?v?(\d+\.\d+\.\d+)/i);
    return match ? match[1] : super.parseVersion(output);
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  async detectFeatures() {
    const features = {
      hasNonInteractive: false,
      hasContinue: false,
      hasResume: false,
      hasAllowedTools: false,
      hasMCP: false,
      hasOutputFormat: false
    };
    try {
      const { exec: exec2 } = await import("child_process");
      const { promisify: promisify2 } = await import("util");
      const execAsync2 = promisify2(exec2);
      const { stdout, stderr } = await execAsync2(`${this.config.command} --help`, {
        timeout: this.config.detectionTimeout
      });
      const helpText = (stdout + stderr).toLowerCase();
      features.hasNonInteractive = helpText.includes("-p") || helpText.includes("--print");
      features.hasContinue = helpText.includes("--continue");
      features.hasResume = helpText.includes("--resume");
      features.hasAllowedTools = helpText.includes("--allowedtools") || helpText.includes("allowed-tools");
      features.hasMCP = helpText.includes("mcp") || helpText.includes("model context protocol");
      features.hasOutputFormat = helpText.includes("--output-format");
    } catch {
    }
    return features;
  }
  buildPrompt(args) {
    const { task, policy } = args;
    let prompt = `# Task: ${task.title}

`;
    prompt += `## Goal
${task.goal}

`;
    if (task.constraints.length > 0) {
      prompt += `## Constraints
`;
      for (const constraint of task.constraints) {
        prompt += `- ${constraint}
`;
      }
      prompt += "\n";
    }
    if (task.acceptance.length > 0) {
      prompt += `## Acceptance Criteria
`;
      for (const criterion of task.acceptance) {
        prompt += `- ${criterion}
`;
      }
      prompt += "\n";
    }
    if (task.roomPath) {
      prompt += `## Focus Area
Primarily work in: ${task.roomPath}

`;
    }
    if (policy.requiresApprovalFor.length > 0) {
      prompt += `## Important: Approval Required
`;
      prompt += `The following actions require explicit human approval:
`;
      for (const action of policy.requiresApprovalFor) {
        prompt += `- ${action}
`;
      }
      prompt += "\n";
    }
    return prompt;
  }
  buildAllowedTools(args) {
    const tools = [
      "View",
      "GlobTool",
      "GrepTool",
      "LS"
    ];
    if (!args.policy.shellDenylist.includes("edit")) {
      tools.push("Edit", "Write", "MultiEdit");
    }
    if (args.policy.shellAllowlist.length > 0 || args.policy.shellDenylist.length === 0) {
      tools.push("Bash");
    }
    return tools;
  }
  createToolRequestEvent(toolUse) {
    return {
      type: "TOOL_REQUEST",
      providerId: this.id,
      timestamp: Date.now(),
      sessionId: this.currentSessionId ?? void 0,
      toolName: toolUse.name,
      args: toolUse.input,
      requestId: toolUse.id
    };
  }
  detectPatternsFromText(text) {
    const events = [];
    const filePatterns = [
      /(?:reading|wrote|created|deleted|modified)\s+(?:file[:\s]+)?([^\s]+\.[a-z]+)/gi,
      /(?:cat|vim|nano|code)\s+([^\s]+\.[a-z]+)/gi
    ];
    for (const pattern of filePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        events.push({
          type: "HINT_FILES_TOUCHED",
          providerId: this.id,
          timestamp: Date.now(),
          sessionId: this.currentSessionId ?? void 0,
          paths: [match[1]]
        });
      }
    }
    if (/npm\s+(?:install|add)/i.test(text)) {
      events.push({
        type: "REQUEST_APPROVAL",
        providerId: this.id,
        timestamp: Date.now(),
        sessionId: this.currentSessionId ?? void 0,
        approvalId: `approval_${Date.now()}`,
        category: "deps_add",
        summary: "Adding npm dependencies",
        risk: "low"
      });
    }
    if (/git\s+push/i.test(text)) {
      events.push({
        type: "REQUEST_APPROVAL",
        providerId: this.id,
        timestamp: Date.now(),
        sessionId: this.currentSessionId ?? void 0,
        approvalId: `approval_${Date.now()}`,
        category: "merge",
        summary: "Pushing changes to remote",
        risk: "med"
      });
    }
    return events;
  }
};
function createClaudeCodeAdapter(config) {
  return new ClaudeCodeAdapter(config);
}

// src/adapters/FileWatcher.ts
import { EventEmitter as EventEmitter6 } from "events";
import { watch } from "fs";
import { readdir as readdir2 } from "fs/promises";
import { join as join2, relative, dirname } from "path";
var DEFAULT_CONFIG4 = {
  debounceMs: 100,
  ignorePatterns: [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "__pycache__",
    ".pytest_cache",
    "coverage",
    ".nyc_output",
    "*.log",
    ".DS_Store"
  ],
  maxDepth: 10
};
var FileWatcher = class extends EventEmitter6 {
  config;
  watchers = /* @__PURE__ */ new Map();
  pendingEvents = /* @__PURE__ */ new Map();
  debounceTimer = null;
  isWatching = false;
  constructor(config) {
    super();
    this.config = { ...DEFAULT_CONFIG4, ...config };
  }
  /**
   * Start watching the filesystem
   */
  async start() {
    if (this.isWatching) {
      return;
    }
    await this.watchDirectory(this.config.rootPath, 0);
    this.isWatching = true;
  }
  /**
   * Stop watching
   */
  stop() {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isWatching = false;
  }
  /**
   * Get files changed since last check
   */
  getChangedFiles() {
    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();
    return events;
  }
  /**
   * Map a file path to its room path
   */
  getRoomPath(filePath) {
    const relativePath = relative(this.config.rootPath, filePath);
    const parts = relativePath.split("/");
    if (parts.length >= 2) {
      return parts.slice(0, 2).join("/");
    } else if (parts.length === 1) {
      return dirname(relativePath);
    }
    return void 0;
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  async watchDirectory(dirPath, depth) {
    if (depth > this.config.maxDepth) {
      return;
    }
    if (this.shouldIgnore(dirPath)) {
      return;
    }
    try {
      const watcher = watch(dirPath, { persistent: true }, (eventType, filename) => {
        if (filename) {
          this.handleFileEvent(eventType, join2(dirPath, filename));
        }
      });
      watcher.on("error", (error) => {
        this.emit("error", error);
      });
      this.watchers.set(dirPath, watcher);
      const entries = await readdir2(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !this.shouldIgnore(entry.name)) {
          await this.watchDirectory(join2(dirPath, entry.name), depth + 1);
        }
      }
    } catch (error) {
      this.emit("error", error);
    }
  }
  handleFileEvent(eventType, filePath) {
    if (this.shouldIgnore(filePath)) {
      return;
    }
    const relativePath = relative(this.config.rootPath, filePath);
    const roomPath = this.getRoomPath(filePath);
    const event = {
      path: filePath,
      relativePath,
      type: eventType === "rename" ? "add" : "change",
      // Simplified
      timestamp: Date.now(),
      roomPath
    };
    this.pendingEvents.set(filePath, event);
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flushEvents();
    }, this.config.debounceMs);
  }
  flushEvents() {
    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();
    for (const event of events) {
      this.emit("change", event);
    }
    if (events.length > 0) {
      this.emit("batch", events);
    }
  }
  shouldIgnore(pathOrName) {
    const name = pathOrName.split("/").pop() ?? pathOrName;
    for (const pattern of this.config.ignorePatterns) {
      if (pattern.startsWith("*")) {
        const suffix = pattern.slice(1);
        if (name.endsWith(suffix)) {
          return true;
        }
      } else if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        if (name.startsWith(prefix)) {
          return true;
        }
      } else if (name === pattern) {
        return true;
      }
    }
    return false;
  }
};
function createFileWatcher(rootPath, options) {
  return new FileWatcher({
    rootPath,
    debounceMs: options?.debounceMs ?? 100,
    ignorePatterns: options?.ignorePatterns ?? DEFAULT_CONFIG4.ignorePatterns,
    maxDepth: options?.maxDepth ?? 10
  });
}

// src/adapters/DiffSummarizer.ts
import { simpleGit as simpleGit2 } from "simple-git";
var DiffSummarizer = class {
  git;
  rootPath;
  lastCommit = null;
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.git = simpleGit2(rootPath);
  }
  /**
   * Get diff summary for staged changes
   */
  async getStagedDiff() {
    const diff = await this.git.diff(["--cached", "--numstat"]);
    return this.parseDiffNumstat(diff, "staged");
  }
  /**
   * Get diff summary for unstaged changes
   */
  async getUnstagedDiff() {
    const diff = await this.git.diff(["--numstat"]);
    return this.parseDiffNumstat(diff, "unstaged");
  }
  /**
   * Get diff summary for all changes (staged + unstaged)
   */
  async getAllChanges() {
    const diff = await this.git.diff(["HEAD", "--numstat"]);
    return this.parseDiffNumstat(diff, "all");
  }
  /**
   * Get diff since a specific commit
   */
  async getDiffSince(commitSha) {
    const diff = await this.git.diff([commitSha, "HEAD", "--numstat"]);
    return this.parseDiffNumstat(diff, "since");
  }
  /**
   * Get diff since last check (tracks state)
   */
  async getDiffSinceLastCheck() {
    const currentCommit = await this.getCurrentCommit();
    if (!this.lastCommit) {
      this.lastCommit = currentCommit;
      return null;
    }
    if (this.lastCommit === currentCommit) {
      return this.getAllChanges();
    }
    const diff = await this.getDiffSince(this.lastCommit);
    this.lastCommit = currentCommit;
    return diff;
  }
  /**
   * Get list of changed files (names only)
   */
  async getChangedFiles() {
    const status = await this.git.status();
    return [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map((r) => r.to)
    ];
  }
  /**
   * Get diff grouped by room (directory)
   */
  async getDiffByRoom(roomDepth = 2) {
    const diff = await this.getAllChanges();
    const roomMap = /* @__PURE__ */ new Map();
    for (const file of diff.files) {
      const roomPath = this.getFileRoomPath(file.path, roomDepth);
      const existing = roomMap.get(roomPath);
      if (existing) {
        existing.filesChanged++;
        existing.linesAdded += file.additions;
        existing.linesRemoved += file.deletions;
      } else {
        roomMap.set(roomPath, {
          roomPath,
          filesChanged: 1,
          linesAdded: file.additions,
          linesRemoved: file.deletions
        });
      }
    }
    return Array.from(roomMap.values());
  }
  /**
   * Create a DiffSummaryEvent for the runner
   */
  async createDiffEvent(sessionId, orgId, seq) {
    const diff = await this.getAllChanges();
    if (diff.filesChanged === 0) {
      return null;
    }
    return {
      type: "DIFF_SUMMARY",
      sessionId,
      orgId,
      ts: Date.now(),
      seq,
      filesChanged: diff.filesChanged,
      linesAdded: diff.linesAdded,
      linesRemoved: diff.linesRemoved,
      files: diff.files.map((f) => ({
        path: f.path,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions
      }))
    };
  }
  /**
   * Reset tracking state
   */
  async reset() {
    this.lastCommit = await this.getCurrentCommit();
  }
  // ============================================================================
  // Private methods
  // ============================================================================
  async getCurrentCommit() {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash ?? "HEAD";
    } catch {
      return "HEAD";
    }
  }
  parseDiffNumstat(output, _source) {
    const files = [];
    let totalAdded = 0;
    let totalRemoved = 0;
    const lines = output.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split("	");
      if (parts.length < 3) continue;
      const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
      const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
      let path = parts[2];
      let oldPath;
      let status = "modified";
      if (path.includes("=>")) {
        const match = path.match(/(?:{([^}]+)\s*=>\s*([^}]+)}|([^\s]+)\s*=>\s*([^\s]+))/);
        if (match) {
          oldPath = match[1] || match[3];
          path = match[2] || match[4];
          status = "renamed";
        }
      }
      if (status !== "renamed") {
        if (additions > 0 && deletions === 0) {
          status = "added";
        } else if (additions === 0 && deletions > 0) {
          status = "deleted";
        }
      }
      totalAdded += additions;
      totalRemoved += deletions;
      files.push({
        path,
        status,
        additions,
        deletions,
        oldPath
      });
    }
    return {
      filesChanged: files.length,
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
      files
    };
  }
  getFileRoomPath(filePath, depth) {
    const parts = filePath.split("/");
    if (parts.length <= depth) {
      return parts.slice(0, -1).join("/") || ".";
    }
    return parts.slice(0, depth).join("/");
  }
};
function createDiffSummarizer(rootPath) {
  return new DiffSummarizer(rootPath);
}
export {
  BaseAdapter,
  ClaudeCodeAdapter,
  DiffSummarizer,
  EventStream,
  FileWatcher,
  PTYManager,
  PolicyEnforcer,
  Runner,
  SessionManager,
  WorkspaceManager,
  createClaudeCodeAdapter,
  createDefaultRunner,
  createDiffSummarizer,
  createEventStream,
  createFileWatcher,
  createPolicyEnforcer,
  createRunner,
  createSessionMachine,
  getPTYManager,
  getSessionManager,
  getSessionStateFromContext,
  getWorkspaceManager,
  mapToSessionState
};

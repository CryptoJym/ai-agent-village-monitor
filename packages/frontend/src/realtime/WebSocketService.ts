import { io, Socket } from 'socket.io-client';
import { eventBus } from './EventBus';

export type WebSocketOptions = {
  url?: string; // default derived from location
  token?: string; // JWT
  transports?: ('websocket' | 'polling')[];
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
};

export class WebSocketService {
  private socket?: Socket;
  private opts: Required<WebSocketOptions>;
  // Throttled event buffers
  private wsQueue: any[] = [];
  private rafScheduled = false;

  constructor(options: WebSocketOptions = {}) {
    const envWs = (import.meta as any)?.env?.VITE_WS_URL as string | undefined;
    const defaultUrl = (() => {
      if (envWs) return envWs;
      if (typeof location === 'undefined') return 'ws://localhost:3000';
      const { protocol, hostname, port } = location;
      const scheme = protocol === 'https:' ? 'wss' : 'ws';
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      if (
        hostname === 'ai-agent-village-monitor-vuplicity.vercel.app' ||
        hostname.endsWith('.ai-agent-village-monitor-vuplicity.vercel.app')
      ) {
        return 'wss://backend-production-6a6e4.up.railway.app';
      }
      if (isLocal && port !== '3000') {
        return `${scheme}://${hostname}:3000`;
      }
      const host = port ? `${hostname}:${port}` : hostname;
      return `${scheme}://${host}`;
    })();
    this.opts = {
      url: options.url ?? defaultUrl,
      token: options.token ?? '',
      // Allow polling fallback; Socket.IO will prefer websocket when available
      transports: options.transports ?? ['websocket', 'polling'],
      reconnectionAttempts: options.reconnectionAttempts ?? 10,
      reconnectionDelay: options.reconnectionDelay ?? 1000,
    };
  }

  connect() {
    if (this.socket) return;
    eventBus.emit('connection_status', { status: 'connecting' });
    this.socket = io(this.opts.url, {
      transports: this.opts.transports,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.opts.reconnectionAttempts,
      reconnectionDelay: this.opts.reconnectionDelay,
      auth: (cb) => cb({ token: this.opts.token }),
    });

    this.socket.on('connect', () => {
      eventBus.emit('connection_status', { status: 'connected' });
      // Start latency measurements using socket.io's own ping
      const start = performance.now();
      this.socket?.timeout(2000).emit('ping', () => {
        const rttMs = performance.now() - start;
        eventBus.emit('latency', { rttMs });
      });
      // Optional catch-up flow after reconnect
      void this.fetchCatchup().catch(() => {});
    });

    this.socket.on('connect_error', (error) => {
      const message = typeof error?.message === 'string' ? error.message : 'connection failed';
      eventBus.emit('connection_status', { status: 'disconnected', error: message });
    });

    this.socket.on('disconnect', (reason) => {
      const message = typeof reason === 'string' ? reason : undefined;
      eventBus.emit('connection_status', { status: 'disconnected', error: message });
    });

    // Server events → event bus (throttled for high-frequency streams)
    this.socket.on('agent_update', (payload) => this.enqueue('agent_update', payload));
    this.socket.on('work_stream', (payload) => this.enqueue('work_stream', payload));
    this.socket.on('bug_bot_spawn', (payload) => eventBus.emit('bug_bot_spawn', payload));
    this.socket.on('bug_bot_progress', (payload) => eventBus.emit('bug_bot_progress', payload));
    this.socket.on('bug_bot_resolved', (payload) => eventBus.emit('bug_bot_resolved', payload));
    this.socket.on('house.activity', (payload) => eventBus.emit('house_activity', payload));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = undefined;
  }

  private enqueue(type: 'agent_update' | 'work_stream', payload: any) {
    // In Vitest, emit synchronously to simplify tests
    try {
      const inTest =
        typeof process !== 'undefined' &&
        ((process as any).env?.VITEST || (process as any).env?.VITEST_WORKER_ID);
      if (inTest) {
        eventBus.emit(type, payload);
        return;
      }
    } catch (e) {
      void e;
    }
    this.wsQueue.push({ type, payload });
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      const schedule =
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number;
      schedule(() => this.flush());
    }
  }

  private flush() {
    this.rafScheduled = false;
    if (this.wsQueue.length === 0) return;
    const q = this.wsQueue.splice(0);
    // Coalesce by type if needed; for now, emit in order
    for (const e of q) eventBus.emit(e.type, e.payload);
  }

  joinVillage(villageId: string) {
    this.socket?.emit('join_village', { villageId });
  }

  joinAgent(agentId: string) {
    this.socket?.emit('join_agent', { agentId });
  }

  // Placeholder REST catch-up; adapt to your backend API
  async fetchCatchup(): Promise<void> {
    try {
      // e.g., const res = await fetch('/api/catchup'); await res.json();
      return;
    } catch {
      return;
    }
  }
}

// Convenience singleton for app-wide use if desired
export const ws = new WebSocketService();

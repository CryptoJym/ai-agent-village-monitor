/**
 * Event Stream
 * Handles streaming runner events to the Control Plane via WebSocket
 *
 * Per spec section 6.4: Runner → Control Plane streaming events
 * - WebSocket multiplexing
 * - Event buffering and retry
 * - Connection management
 */

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { RunnerEvent } from '@ai-agent-village-monitor/shared';

/**
 * Event stream configuration
 */
export type EventStreamConfig = {
  /** Control Plane WebSocket URL */
  controlPlaneUrl: string;
  /** Authentication token */
  authToken: string;
  /** Runner ID */
  runnerId: string;
  /** Reconnect interval in ms */
  reconnectIntervalMs: number;
  /** Max reconnect attempts */
  maxReconnectAttempts: number;
  /** Buffer size for offline events */
  maxBufferSize: number;
  /** Ping interval in ms */
  pingIntervalMs: number;
};

const DEFAULT_CONFIG: Partial<EventStreamConfig> = {
  reconnectIntervalMs: 5000,
  maxReconnectAttempts: 10,
  maxBufferSize: 10000,
  pingIntervalMs: 30000,
};

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Streams runner events to Control Plane
 */
export class EventStream extends EventEmitter {
  private config: EventStreamConfig;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private buffer: RunnerEvent[] = [];
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: EventStreamConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as EventStreamConfig;
  }

  /**
   * Connect to Control Plane
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';
    this.emit('stateChange', this.state);

    return new Promise((resolve, reject) => {
      const url = `${this.config.controlPlaneUrl}?token=${this.config.authToken}&runner=${this.config.runnerId}`;

      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          this.emit('stateChange', this.state);
          this.startPing();
          this.flushBuffer();
          resolve();
        });

        this.ws.on('close', (code, reason) => {
          this.handleDisconnect(code, reason.toString());
        });

        this.ws.on('error', (error) => {
          this.emit('error', error);
          if (this.state === 'connecting') {
            reject(error);
          }
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('pong', () => {
          this.emit('pong');
        });
      } catch (error) {
        this.state = 'disconnected';
        this.emit('stateChange', this.state);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from Control Plane
   */
  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = 'disconnected';
    this.emit('stateChange', this.state);
  }

  /**
   * Send an event to Control Plane
   */
  send(event: RunnerEvent): boolean {
    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
        return true;
      } catch {
        // Buffer on failure
        this.bufferEvent(event);
        return false;
      }
    } else {
      // Buffer if not connected
      this.bufferEvent(event);
      return false;
    }
  }

  /**
   * Send multiple events
   */
  sendBatch(events: RunnerEvent[]): number {
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
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear the event buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private bufferEvent(event: RunnerEvent): void {
    this.buffer.push(event);

    // Evict oldest events if buffer is full
    while (this.buffer.length > this.config.maxBufferSize) {
      const evicted = this.buffer.shift();
      if (evicted) {
        this.emit('eventEvicted', evicted);
      }
    }
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    for (const event of events) {
      if (!this.send(event)) {
        // Re-buffer failed events
        break;
      }
    }
  }

  private handleDisconnect(code: number, reason: string): void {
    this.stopPing();
    this.ws = null;

    if (this.state === 'disconnected') {
      return; // Intentional disconnect
    }

    this.emit('disconnected', { code, reason });

    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.state = 'disconnected';
      this.emit('stateChange', this.state);
      this.emit('maxReconnectAttemptsReached');
    }
  }

  private scheduleReconnect(): void {
    this.state = 'reconnecting';
    this.emit('stateChange', this.state);
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.min(
      this.config.reconnectIntervalMs * Math.pow(2, this.reconnectAttempts - 1),
      60000 // Max 1 minute
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // Will trigger reconnect again via disconnect handler
      }
    }, delay);

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delayMs: delay,
    });
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString());
      this.emit('message', message);
    } catch {
      this.emit('error', new Error('Failed to parse message from Control Plane'));
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.config.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

/**
 * Create an event stream with the session manager
 */
export function createEventStream(config: EventStreamConfig): EventStream {
  return new EventStream(config);
}

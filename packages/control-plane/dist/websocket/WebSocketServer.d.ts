/**
 * WebSocket Server
 *
 * Manages WebSocket connections for real-time session streaming,
 * event notifications, and terminal access.
 */
import { EventEmitter } from 'events';
import type { Server as HttpServer } from 'http';
import type { WebSocketMessage } from '../types';
/** WebSocket server configuration */
export interface WebSocketServerConfig {
    /** Ping interval (ms) */
    pingIntervalMs: number;
    /** Connection timeout (ms) */
    connectionTimeoutMs: number;
    /** Maximum message size (bytes) */
    maxMessageSize: number;
    /** Maximum connections per user */
    maxConnectionsPerUser: number;
}
/**
 * WebSocketServer manages real-time connections for the control plane.
 *
 * Features:
 * - Session streaming (output, approval requests, completion)
 * - Terminal PTY streaming
 * - Event notifications
 * - Authentication integration
 *
 * Emits:
 * - 'client_connected': When a client connects
 * - 'client_disconnected': When a client disconnects
 * - 'client_authenticated': When a client authenticates
 * - 'session_subscribed': When client subscribes to a session
 * - 'terminal_input': When terminal input is received
 */
export declare class WebSocketServerManager extends EventEmitter {
    private config;
    private wss;
    private clients;
    private userConnections;
    private pingTimer;
    constructor(config?: Partial<WebSocketServerConfig>);
    /**
     * Attach to an HTTP server.
     */
    attach(server: HttpServer, path?: string): void;
    /**
     * Create standalone server.
     */
    listen(port: number, host?: string): void;
    /**
     * Shutdown the server.
     */
    shutdown(): Promise<void>;
    /**
     * Handle new connection.
     */
    private handleConnection;
    /**
     * Handle incoming message.
     */
    private handleMessage;
    /**
     * Handle authentication.
     */
    private handleAuthenticate;
    /**
     * Handle subscription request.
     */
    private handleSubscribe;
    /**
     * Handle unsubscription request.
     */
    private handleUnsubscribe;
    /**
     * Handle terminal input.
     */
    private handleTerminalInput;
    /**
     * Handle client disconnect.
     */
    private handleDisconnect;
    /**
     * Handle client error.
     */
    private handleError;
    /**
     * Send message to client.
     */
    private sendToClient;
    /**
     * Send error to client.
     */
    private sendError;
    /**
     * Broadcast session output to subscribed clients.
     */
    broadcastSessionOutput(sessionId: string, output: string, stream: 'stdout' | 'stderr'): void;
    /**
     * Broadcast session state change.
     */
    broadcastSessionStateChange(sessionId: string, state: string, data?: Record<string, unknown>): void;
    /**
     * Broadcast approval request.
     */
    broadcastApprovalRequest(sessionId: string, requestId: string, action: string, details: Record<string, unknown>): void;
    /**
     * Broadcast terminal output.
     */
    broadcastTerminalOutput(sessionId: string, data: string): void;
    /**
     * Broadcast event to all connected clients.
     */
    broadcastEvent(event: string, data: Record<string, unknown>): void;
    /**
     * Broadcast to specific user.
     */
    broadcastToUser(userId: string, message: WebSocketMessage): void;
    /**
     * Get connected client count.
     */
    getClientCount(): number;
    /**
     * Get authenticated client count.
     */
    getAuthenticatedClientCount(): number;
    /**
     * Start ping timer.
     */
    private startPingTimer;
    /**
     * Stop ping timer.
     */
    private stopPingTimer;
}
export default WebSocketServerManager;
//# sourceMappingURL=WebSocketServer.d.ts.map
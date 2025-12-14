/**
 * WebSocket Server
 *
 * Manages WebSocket connections for real-time session streaming,
 * event notifications, and terminal access.
 */
import { EventEmitter } from 'events';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
const DEFAULT_CONFIG = {
    pingIntervalMs: 30000,
    connectionTimeoutMs: 60000,
    maxMessageSize: 1024 * 1024, // 1MB
    maxConnectionsPerUser: 10,
};
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
export class WebSocketServerManager extends EventEmitter {
    config;
    wss = null;
    clients = new Map();
    userConnections = new Map();
    pingTimer = null;
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Attach to an HTTP server.
     */
    attach(server, path = '/ws') {
        this.wss = new WSServer({
            server,
            path,
            maxPayload: this.config.maxMessageSize,
        });
        this.wss.on('connection', (socket, request) => {
            this.handleConnection(socket, request);
        });
        this.startPingTimer();
    }
    /**
     * Create standalone server.
     */
    listen(port, host = '0.0.0.0') {
        this.wss = new WSServer({
            port,
            host,
            maxPayload: this.config.maxMessageSize,
        });
        this.wss.on('connection', (socket, request) => {
            this.handleConnection(socket, request);
        });
        this.startPingTimer();
    }
    /**
     * Shutdown the server.
     */
    async shutdown() {
        this.stopPingTimer();
        // Close all client connections
        for (const client of this.clients.values()) {
            client.socket.close(1001, 'Server shutting down');
        }
        this.clients.clear();
        this.userConnections.clear();
        // Close server
        if (this.wss) {
            await new Promise((resolve, reject) => {
                this.wss.close(err => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            this.wss = null;
        }
    }
    /**
     * Handle new connection.
     */
    handleConnection(socket, request) {
        const clientId = uuidv4();
        const client = {
            clientId,
            socket,
            subscribedSessions: new Set(),
            subscribedRunners: new Set(),
            connectedAt: new Date(),
            lastPingAt: new Date(),
        };
        this.clients.set(clientId, client);
        this.emit('client_connected', {
            clientId,
            remoteAddress: request.socket.remoteAddress,
            timestamp: client.connectedAt,
        });
        socket.on('message', (data) => {
            this.handleMessage(client, data);
        });
        socket.on('close', (code, reason) => {
            this.handleDisconnect(client, code, reason.toString());
        });
        socket.on('error', (error) => {
            this.handleError(client, error);
        });
        socket.on('pong', () => {
            client.lastPingAt = new Date();
        });
        // Send welcome message
        this.sendToClient(client, {
            type: 'event',
            event: 'connected',
            data: { clientId },
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Handle incoming message.
     */
    handleMessage(client, data) {
        try {
            const message = JSON.parse(data);
            switch (message.type) {
                case 'authenticate':
                    this.handleAuthenticate(client, message);
                    break;
                case 'subscribe':
                    this.handleSubscribe(client, message);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(client, message);
                    break;
                case 'terminal':
                    this.handleTerminalInput(client, message);
                    break;
                case 'ping':
                    this.sendToClient(client, {
                        type: 'pong',
                        timestamp: new Date().toISOString(),
                    });
                    break;
                default:
                    this.sendError(client, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
            }
        }
        catch (error) {
            this.sendError(client, 'INVALID_MESSAGE', error instanceof Error ? error.message : 'Invalid message format');
        }
    }
    /**
     * Handle authentication.
     */
    handleAuthenticate(client, message) {
        // Placeholder - would validate JWT token
        if (message.token && message.userId) {
            // Check connection limit
            const userConns = this.userConnections.get(message.userId);
            if (userConns && userConns.size >= this.config.maxConnectionsPerUser) {
                this.sendError(client, 'CONNECTION_LIMIT', 'Maximum connections exceeded');
                return;
            }
            client.userId = message.userId;
            client.authenticatedAt = new Date();
            // Track user connections
            if (!this.userConnections.has(message.userId)) {
                this.userConnections.set(message.userId, new Set());
            }
            this.userConnections.get(message.userId).add(client.clientId);
            this.emit('client_authenticated', {
                clientId: client.clientId,
                userId: message.userId,
                timestamp: client.authenticatedAt,
            });
            this.sendToClient(client, {
                type: 'event',
                event: 'authenticated',
                data: { userId: message.userId },
                timestamp: new Date().toISOString(),
            });
        }
        else {
            this.sendError(client, 'AUTH_FAILED', 'Authentication failed');
        }
    }
    /**
     * Handle subscription request.
     */
    handleSubscribe(client, message) {
        if (!client.authenticatedAt) {
            this.sendError(client, 'NOT_AUTHENTICATED', 'Must authenticate first');
            return;
        }
        if (message.sessionId) {
            client.subscribedSessions.add(message.sessionId);
            this.emit('session_subscribed', {
                clientId: client.clientId,
                sessionId: message.sessionId,
            });
            this.sendToClient(client, {
                type: 'event',
                event: 'subscribed',
                data: { sessionId: message.sessionId },
                timestamp: new Date().toISOString(),
            });
        }
        if (message.runnerId) {
            client.subscribedRunners.add(message.runnerId);
            this.sendToClient(client, {
                type: 'event',
                event: 'subscribed',
                data: { runnerId: message.runnerId },
                timestamp: new Date().toISOString(),
            });
        }
    }
    /**
     * Handle unsubscription request.
     */
    handleUnsubscribe(client, message) {
        if (message.sessionId) {
            client.subscribedSessions.delete(message.sessionId);
        }
        if (message.runnerId) {
            client.subscribedRunners.delete(message.runnerId);
        }
        this.sendToClient(client, {
            type: 'event',
            event: 'unsubscribed',
            data: {
                sessionId: message.sessionId,
                runnerId: message.runnerId,
            },
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Handle terminal input.
     */
    handleTerminalInput(client, message) {
        if (!client.authenticatedAt) {
            this.sendError(client, 'NOT_AUTHENTICATED', 'Must authenticate first');
            return;
        }
        if (!client.subscribedSessions.has(message.sessionId)) {
            this.sendError(client, 'NOT_SUBSCRIBED', 'Not subscribed to this session');
            return;
        }
        this.emit('terminal_input', {
            clientId: client.clientId,
            sessionId: message.sessionId,
            data: message.data,
        });
    }
    /**
     * Handle client disconnect.
     */
    handleDisconnect(client, code, reason) {
        // Clean up user connections
        if (client.userId) {
            const userConns = this.userConnections.get(client.userId);
            if (userConns) {
                userConns.delete(client.clientId);
                if (userConns.size === 0) {
                    this.userConnections.delete(client.userId);
                }
            }
        }
        this.clients.delete(client.clientId);
        this.emit('client_disconnected', {
            clientId: client.clientId,
            code,
            reason,
            timestamp: new Date(),
        });
    }
    /**
     * Handle client error.
     */
    handleError(client, error) {
        this.emit('client_error', {
            clientId: client.clientId,
            error: error.message,
        });
        // Close connection on error
        client.socket.close(1011, 'Internal error');
    }
    /**
     * Send message to client.
     */
    sendToClient(client, message) {
        if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify(message));
        }
    }
    /**
     * Send error to client.
     */
    sendError(client, code, message) {
        const errorMsg = {
            type: 'error',
            code,
            message,
            timestamp: new Date().toISOString(),
        };
        this.sendToClient(client, errorMsg);
    }
    /**
     * Broadcast session output to subscribed clients.
     */
    broadcastSessionOutput(sessionId, output, stream) {
        const message = {
            type: 'session',
            sessionId,
            action: 'output',
            data: { output, stream },
            timestamp: new Date().toISOString(),
        };
        for (const client of this.clients.values()) {
            if (client.subscribedSessions.has(sessionId)) {
                this.sendToClient(client, message);
            }
        }
    }
    /**
     * Broadcast session state change.
     */
    broadcastSessionStateChange(sessionId, state, data) {
        const message = {
            type: 'session',
            sessionId,
            action: 'state_change',
            data: { state, ...data },
            timestamp: new Date().toISOString(),
        };
        for (const client of this.clients.values()) {
            if (client.subscribedSessions.has(sessionId)) {
                this.sendToClient(client, message);
            }
        }
    }
    /**
     * Broadcast approval request.
     */
    broadcastApprovalRequest(sessionId, requestId, action, details) {
        const message = {
            type: 'session',
            sessionId,
            action: 'approval_request',
            data: { requestId, action, details },
            timestamp: new Date().toISOString(),
        };
        for (const client of this.clients.values()) {
            if (client.subscribedSessions.has(sessionId)) {
                this.sendToClient(client, message);
            }
        }
    }
    /**
     * Broadcast terminal output.
     */
    broadcastTerminalOutput(sessionId, data) {
        const message = {
            type: 'terminal',
            sessionId,
            action: 'output',
            data,
            timestamp: new Date().toISOString(),
        };
        for (const client of this.clients.values()) {
            if (client.subscribedSessions.has(sessionId)) {
                this.sendToClient(client, message);
            }
        }
    }
    /**
     * Broadcast event to all connected clients.
     */
    broadcastEvent(event, data) {
        const message = {
            type: 'event',
            event,
            data,
            timestamp: new Date().toISOString(),
        };
        for (const client of this.clients.values()) {
            if (client.authenticatedAt) {
                this.sendToClient(client, message);
            }
        }
    }
    /**
     * Broadcast to specific user.
     */
    broadcastToUser(userId, message) {
        const userConns = this.userConnections.get(userId);
        if (!userConns)
            return;
        for (const clientId of userConns) {
            const client = this.clients.get(clientId);
            if (client) {
                this.sendToClient(client, message);
            }
        }
    }
    /**
     * Get connected client count.
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Get authenticated client count.
     */
    getAuthenticatedClientCount() {
        let count = 0;
        for (const client of this.clients.values()) {
            if (client.authenticatedAt)
                count++;
        }
        return count;
    }
    /**
     * Start ping timer.
     */
    startPingTimer() {
        this.pingTimer = setInterval(() => {
            const now = Date.now();
            for (const client of this.clients.values()) {
                const timeSincePing = now - client.lastPingAt.getTime();
                if (timeSincePing > this.config.connectionTimeoutMs) {
                    // Connection timed out
                    client.socket.close(1001, 'Connection timeout');
                }
                else if (client.socket.readyState === WebSocket.OPEN) {
                    client.socket.ping();
                }
            }
        }, this.config.pingIntervalMs);
    }
    /**
     * Stop ping timer.
     */
    stopPingTimer() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
}
export default WebSocketServerManager;

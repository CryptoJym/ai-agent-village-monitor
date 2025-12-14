/**
 * WebSocketServer Tests
 *
 * Tests for real-time WebSocket communication.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServerManager } from '../websocket/WebSocketServer';
import { WebSocket } from 'ws';

// Mock WebSocket
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn((cb) => cb()),
  })),
  WebSocket: {
    OPEN: 1,
    CLOSED: 3,
  },
}));

describe('WebSocketServerManager', () => {
  let server: WebSocketServerManager;

  beforeEach(() => {
    server = new WebSocketServerManager({
      pingIntervalMs: 30000,
      connectionTimeoutMs: 60000,
      maxMessageSize: 1024 * 1024,
      maxConnectionsPerUser: 10,
    });
  });

  afterEach(async () => {
    await server.shutdown();
  });

  describe('initialization', () => {
    it('should create a WebSocket server manager', () => {
      expect(server).toBeDefined();
    });

    it('should start with zero clients', () => {
      expect(server.getClientCount()).toBe(0);
      expect(server.getAuthenticatedClientCount()).toBe(0);
    });
  });

  describe('broadcast methods', () => {
    // Note: These tests verify the broadcast methods don't throw
    // Full integration tests would require actual WebSocket connections

    it('should broadcast session output', () => {
      expect(() => {
        server.broadcastSessionOutput('session-1', 'test output', 'stdout');
      }).not.toThrow();
    });

    it('should broadcast session state change', () => {
      expect(() => {
        server.broadcastSessionStateChange('session-1', 'RUNNING', { reason: 'test' });
      }).not.toThrow();
    });

    it('should broadcast approval request', () => {
      expect(() => {
        server.broadcastApprovalRequest('session-1', 'approval-1', 'merge', {
          prNumber: 123,
        });
      }).not.toThrow();
    });

    it('should broadcast terminal output', () => {
      expect(() => {
        server.broadcastTerminalOutput('session-1', 'terminal data');
      }).not.toThrow();
    });

    it('should broadcast event', () => {
      expect(() => {
        server.broadcastEvent('test_event', { foo: 'bar' });
      }).not.toThrow();
    });

    it('should broadcast to user', () => {
      expect(() => {
        server.broadcastToUser('user-1', {
          type: 'event',
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await expect(server.shutdown()).resolves.toBeUndefined();
    });
  });
});

describe('WebSocketServerManager message handling', () => {
  let server: WebSocketServerManager;
  let mockSocket: any;
  let messageHandler: Function;
  let closeHandler: Function;
  let errorHandler: Function;
  let pongHandler: Function;

  beforeEach(() => {
    server = new WebSocketServerManager();

    // Create a mock socket
    mockSocket = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'message') messageHandler = handler;
        if (event === 'close') closeHandler = handler;
        if (event === 'error') errorHandler = handler;
        if (event === 'pong') pongHandler = handler;
      }),
      ping: vi.fn(),
    };
  });

  afterEach(async () => {
    await server.shutdown();
  });

  // Helper to simulate a connection
  function simulateConnection(): void {
    const handleConnection = (server as any).handleConnection.bind(server);
    handleConnection(mockSocket, { socket: { remoteAddress: '127.0.0.1' } });
  }

  describe('connection handling', () => {
    it('should emit client_connected on new connection', () => {
      const handler = vi.fn();
      server.on('client_connected', handler);

      simulateConnection();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: expect.any(String),
          remoteAddress: '127.0.0.1',
          timestamp: expect.any(Date),
        })
      );

      // Verify the clientId is a valid UUID format
      const eventData = handler.mock.calls[0][0];
      expect(eventData.clientId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should send welcome message on connection', () => {
      simulateConnection();

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"event"')
      );
      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"event":"connected"')
      );
    });

    it('should increment client count on connection', () => {
      expect(server.getClientCount()).toBe(0);
      simulateConnection();
      expect(server.getClientCount()).toBe(1);
    });
  });

  describe('message parsing', () => {
    beforeEach(() => {
      simulateConnection();
    });

    it('should handle ping messages', () => {
      const message = JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() });
      messageHandler(message);

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('should send error for invalid JSON', () => {
      messageHandler('not valid json');

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"INVALID_MESSAGE"')
      );
    });

    it('should send error for unknown message type', () => {
      const message = JSON.stringify({
        type: 'unknown_type',
        timestamp: new Date().toISOString(),
      });
      messageHandler(message);

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"UNKNOWN_MESSAGE_TYPE"')
      );
    });
  });

  describe('authentication', () => {
    beforeEach(() => {
      simulateConnection();
    });

    it('should authenticate with valid credentials', () => {
      const handler = vi.fn();
      server.on('client_authenticated', handler);

      const message = JSON.stringify({
        type: 'authenticate',
        token: 'valid-token',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      });
      messageHandler(message);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: expect.any(String),
          userId: 'user-1',
          timestamp: expect.any(Date),
        })
      );
      expect(server.getAuthenticatedClientCount()).toBe(1);

      // Verify the authenticated response was sent to client
      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"event":"authenticated"')
      );
      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"userId":"user-1"')
      );
    });

    it('should reject authentication without token', () => {
      const message = JSON.stringify({
        type: 'authenticate',
        timestamp: new Date().toISOString(),
      });
      messageHandler(message);

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"AUTH_FAILED"')
      );
    });
  });

  describe('subscriptions', () => {
    beforeEach(() => {
      simulateConnection();

      // Authenticate first
      const authMessage = JSON.stringify({
        type: 'authenticate',
        token: 'valid-token',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      });
      messageHandler(authMessage);
    });

    it('should subscribe to session', () => {
      const handler = vi.fn();
      server.on('session_subscribed', handler);

      const message = JSON.stringify({
        type: 'subscribe',
        sessionId: 'session-1',
        timestamp: new Date().toISOString(),
      });
      messageHandler(message);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
        })
      );
    });

    it('should reject subscription without authentication', () => {
      // Create new server and connection without auth
      const newServer = new WebSocketServerManager();
      const newSocket = {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'message') {
            // Store for later use
            (newSocket as any).messageHandler = handler;
          }
        }),
        ping: vi.fn(),
      };

      const handleConnection = (newServer as any).handleConnection.bind(newServer);
      handleConnection(newSocket, { socket: { remoteAddress: '127.0.0.1' } });

      const message = JSON.stringify({
        type: 'subscribe',
        sessionId: 'session-1',
        timestamp: new Date().toISOString(),
      });
      (newSocket as any).messageHandler(message);

      expect(newSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"NOT_AUTHENTICATED"')
      );
    });

    it('should unsubscribe from session', () => {
      // Subscribe first
      messageHandler(
        JSON.stringify({
          type: 'subscribe',
          sessionId: 'session-1',
          timestamp: new Date().toISOString(),
        })
      );

      // Then unsubscribe
      messageHandler(
        JSON.stringify({
          type: 'unsubscribe',
          sessionId: 'session-1',
          timestamp: new Date().toISOString(),
        })
      );

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"event":"unsubscribed"')
      );
    });
  });

  describe('terminal input', () => {
    beforeEach(() => {
      simulateConnection();

      // Authenticate and subscribe
      messageHandler(
        JSON.stringify({
          type: 'authenticate',
          token: 'valid-token',
          userId: 'user-1',
          timestamp: new Date().toISOString(),
        })
      );
      messageHandler(
        JSON.stringify({
          type: 'subscribe',
          sessionId: 'session-1',
          timestamp: new Date().toISOString(),
        })
      );
    });

    it('should emit terminal_input event', () => {
      const handler = vi.fn();
      server.on('terminal_input', handler);

      const message = JSON.stringify({
        type: 'terminal',
        sessionId: 'session-1',
        action: 'input',
        data: 'ls -la',
        timestamp: new Date().toISOString(),
      });
      messageHandler(message);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          data: 'ls -la',
        })
      );
    });

    it('should reject terminal input for unsubscribed session', () => {
      const message = JSON.stringify({
        type: 'terminal',
        sessionId: 'session-2', // Not subscribed
        action: 'input',
        data: 'ls',
        timestamp: new Date().toISOString(),
      });
      messageHandler(message);

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"NOT_SUBSCRIBED"')
      );
    });
  });

  describe('disconnection', () => {
    it('should emit client_disconnected on close', () => {
      const handler = vi.fn();
      server.on('client_disconnected', handler);

      simulateConnection();
      closeHandler(1000, 'Normal closure');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 1000,
          reason: 'Normal closure',
        })
      );
    });

    it('should decrement client count on disconnection', () => {
      simulateConnection();
      expect(server.getClientCount()).toBe(1);

      closeHandler(1000, 'Normal closure');
      expect(server.getClientCount()).toBe(0);
    });

    it('should handle errors gracefully', () => {
      simulateConnection();

      expect(() => {
        errorHandler(new Error('Test error'));
      }).not.toThrow();
    });
  });
});

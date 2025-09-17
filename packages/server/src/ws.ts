import type { Express } from 'express';
import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export type AttachedSocket = {
  io: SocketIOServer;
  close: () => Promise<void>;
};

// Attaches a Socket.io server to the given HTTP server and wires default handlers.
// Returns the io instance and a close() helper for tests/teardown.
export function attachSocket(server: HTTPServer, app: Express): AttachedSocket {
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Simple latency ping/ack
    socket.on('ping', (ack?: () => void) => {
      if (typeof ack === 'function') ack();
    });

    // Room helpers
    socket.on('join_village', ({ villageId }: { villageId: string }) => {
      if (typeof villageId === 'string') socket.join(`village:${villageId}`);
    });
    socket.on('join_agent', ({ agentId }: { agentId: string }) => {
      if (typeof agentId === 'string') socket.join(`agent:${agentId}`);
    });
  });

  // Make io accessible to Express handlers (e.g., REST endpoints triggering broadcasts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).set('io', io);

  return {
    io,
    close: async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}


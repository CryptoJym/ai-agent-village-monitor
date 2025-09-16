import type { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | undefined;

export function setIO(instance: SocketIOServer) {
  io = instance;
}

export function getIO(): SocketIOServer | undefined {
  return io;
}

export function emitToVillage(villageId: string, event: string, payload: any) {
  io?.to(`village:${villageId}`).emit(event, payload);
}

export function emitToAgent(agentId: string, event: string, payload: any) {
  io?.to(`agent:${agentId}`).emit(event, payload);
}

export function emitToRepo(repoId: string, event: string, payload: any) {
  io?.to(`repo:${repoId}`).emit(event, payload);
}

/**
 * Control Plane Package
 *
 * Central API layer for AI Agent Village Monitor.
 *
 * Components:
 * - SessionHandler: Session lifecycle management
 * - RunnerHandler: Runner fleet management
 * - UpdatePipelineHandler: Version and rollout management
 * - WebSocketServerManager: Real-time communication
 */

// Handlers
export {
  SessionHandler,
  RunnerHandler,
  UpdatePipelineHandler,
} from './handlers';

export type {
  SessionHandlerConfig,
  StoredSession,
  RunnerHandlerConfig,
  UpdatePipelineHandlerConfig,
} from './handlers';

// WebSocket
export { WebSocketServerManager } from './websocket';
export type { WebSocketServerConfig } from './websocket';

// Types
export type {
  // API types
  ApiError,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,

  // Session types
  CreateSessionRequest,
  SessionSummary,
  SessionDetail,
  SessionOutput,
  SessionEventSummary,
  ApprovalRequest,
  ApprovalResponse,
  ResolveApprovalRequest,

  // Runner types
  RegisterRunnerRequest,
  RunnerInfo,
  RunnerHeartbeat,

  // Update pipeline types
  VersionInfo,
  BuildInfo,
  RolloutStatus,
  InitiateRolloutRequest,
  OrgRuntimeConfigRequest,

  // WebSocket types
  WebSocketMessage,
  WebSocketSessionMessage,
  WebSocketTerminalMessage,
  WebSocketEventMessage,
  WebSocketErrorMessage,
  WsMessage,
  WsSubscribeSession,
  WsUnsubscribeSession,
  WsSessionEvent,
  WsTerminalData,
  WsTerminalInput,
  WsApprovalRequired,
  WsRunnerStatus,
} from './types';

// Schemas for validation
export {
  CreateSessionRequestSchema,
  PaginationParamsSchema,
  RegisterRunnerRequestSchema,
  ResolveApprovalRequestSchema,
  OrgRuntimeConfigRequestSchema,
  RunnerHeartbeatSchema,
  ApprovalResponseSchema,
} from './types';

// Type guards
export {
  isWsMessage,
  isWsTerminalInput,
  isWsSubscribeSession,
  isWsUnsubscribeSession,
} from './types';

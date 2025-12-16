/**
 * Update Pipeline Module
 *
 * Server-side integration for the @ai-agent-village-monitor/update-pipeline package.
 * Provides singleton lifecycle management and REST API endpoints.
 */

export {
  initUpdatePipeline,
  getUpdatePipelineStatus,
  getUpdatePipeline,
  isUpdatePipelineEnabled,
  shutdownUpdatePipeline,
} from './bootstrap';

export { updatePipelineRouter } from './router';

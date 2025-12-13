export { CameraController } from './CameraController';
export { InputHandler } from './InputHandler';
export { PortalSystem } from './PortalSystem';
export { SceneTransitionManager } from './SceneTransition';

export type { CameraControllerConfig } from './CameraController';
export type { InputConfig } from './InputHandler';
export type { Portal, DoorType, PortalSystemConfig } from './PortalSystem';
export type {
  TransitionEffect,
  SlideDirection,
  TransitionOptions,
  SceneState,
  TransitionData,
} from './SceneTransition';

export {
  createFadeTransition,
  createSlideTransition,
  createIrisTransition,
  createInstantTransition,
} from './SceneTransition';

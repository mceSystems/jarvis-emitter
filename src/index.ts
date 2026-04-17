export { createEmitter, JarvisEmitter } from './emitter.js';

export { event, notify, doneType, errorType } from './roles.js';

export { registry } from './registry.js';

export { EmitterTimeoutError } from './types.js';

export type {
  EmitterSchema,
  EmitterOptions,
  RoleConfig,
  PayloadOf,
  InterfaceMap,
  DoneTypeOf,
  ErrorTypeOf,
  TapPayload,
  Unsubscribe,
  Listener,
  TransformFn,
  RegistryEntry,
  RegistryEmitEvent,
} from './types.js';

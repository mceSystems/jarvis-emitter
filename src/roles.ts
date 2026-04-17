import type { RoleConfig } from './types.js';

interface RoleOptions {
  sticky?: boolean;
  stickyLast?: boolean;
}

export function event<T = void>(options?: RoleOptions): RoleConfig<T> {
  return { role: 'event', ...options };
}

export function notify<T = void>(options?: RoleOptions): RoleConfig<T> {
  return { role: 'notify', ...options };
}

/**
 * Phantom schema marker that sets the `done` payload type.
 * Use inside the schema passed to createEmitter to type the default `done` interface.
 */
export function doneType<T>(): RoleConfig<T> {
  return { role: 'done' };
}

/**
 * Phantom schema marker that sets the `error` payload type.
 * Use inside the schema passed to createEmitter to type the default `error` interface.
 */
export function errorType<T>(): RoleConfig<T> {
  return { role: 'error' };
}

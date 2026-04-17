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

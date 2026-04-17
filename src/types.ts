/**
 * Configuration for a single event in the emitter schema.
 * Created by event<T>(), notify<T>(), doneType<T>(), or errorType<T>().
 */
export interface RoleConfig<T = void> {
  /** Phantom field — carries the payload type at the type level. Never set at runtime. */
  readonly __type?: T;
  readonly role: 'event' | 'notify' | 'done' | 'error';
  readonly sticky?: boolean;
  readonly stickyLast?: boolean;
}

export type EmitterSchema = Record<string, RoleConfig<any>>;

export type PayloadOf<R> = R extends RoleConfig<infer T> ? T : never;

/** Extract the done payload type from a schema. Falls back to `unknown`. */
export type DoneTypeOf<S extends EmitterSchema> =
  'done' extends keyof S ? PayloadOf<S['done']> : unknown;

/** Extract the error payload type from a schema. Falls back to `unknown`. */
export type ErrorTypeOf<S extends EmitterSchema> =
  'error' extends keyof S ? PayloadOf<S['error']> : unknown;

export interface TapPayload {
  name: string;
  role?: string;
  data: unknown[];
}

/**
 * Full interface map combining defaults (done/error/always/catch/tap) with
 * schema-defined events. `done` and `error` get their types from the schema
 * if present, otherwise fall back to `unknown`.
 */
export type InterfaceMap<S extends EmitterSchema> = {
  done: DoneTypeOf<S>;
  error: ErrorTypeOf<S>;
  always: DoneTypeOf<S> | ErrorTypeOf<S>;
  catch: Error;
  tap: TapPayload;
} & {
  [K in Exclude<keyof S, 'done' | 'error' | 'always' | 'catch' | 'tap'>]:
    PayloadOf<S[K]>;
};

/** Options passed to createEmitter. */
export interface EmitterOptions<S extends EmitterSchema = {}> {
  label?: string;
  transformError?: (raw: unknown) => ErrorTypeOf<S>;
}

export type Unsubscribe = () => void;

export type Listener<T> = (arg: T) => void;

export type TransformFn<T> = (value: T) => T;

export interface RegistryEntry {
  label: string;
  events: string[];
  listeners: Record<string, number>;
}

export interface RegistryEmitEvent {
  label: string;
  event: string;
  data: unknown;
}

export class EmitterTimeoutError extends Error {
  constructor(public readonly ms: number) {
    super(`Emitter timed out after ${ms}ms`);
    this.name = 'EmitterTimeoutError';
  }
}

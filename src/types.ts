/**
 * Configuration for a single event in the emitter schema.
 * Created by event<T>() or notify<T>() helpers.
 */
export interface RoleConfig<T = void> {
  /** Phantom field — carries the payload type at the type level. Never set at runtime. */
  readonly __type?: T;
  readonly role: 'event' | 'notify';
  readonly sticky?: boolean;
  readonly stickyLast?: boolean;
}

export type EmitterSchema = Record<string, RoleConfig<any>>;

export type PayloadOf<R> = R extends RoleConfig<infer T> ? T : never;

export interface DefaultInterfaces<DoneType = unknown, ErrorType = unknown> {
  done: DoneType;
  error: ErrorType;
  always: DoneType | ErrorType;
  catch: Error;
  tap: TapPayload;
}

export interface TapPayload {
  name: string;
  role?: string;
  data: unknown[];
}

export type InterfaceMap<
  DoneType,
  ErrorType,
  Schema extends EmitterSchema,
> = DefaultInterfaces<DoneType, ErrorType> & {
  [K in keyof Schema]: PayloadOf<Schema[K]>;
};

export interface EmitterOptions<ErrorType> {
  label?: string;
  transformError?: (raw: unknown) => ErrorType;
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

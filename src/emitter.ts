import type {
  EmitterSchema,
  EmitterOptions,
  InterfaceMap,
  Unsubscribe,
  Listener,
  TransformFn,
  TapPayload,
  DoneTypeOf,
} from './types.js';
import { EmitterTimeoutError } from './types.js';

interface InterfaceEntry {
  listeners: Listener<any>[];
  transforms: TransformFn<any>[];
  sticky: boolean;
  stickyLast: boolean;
  stickyCalls: any[];
  role: string;
  name: string;
}

const unhandledExceptionCallbacks: Listener<any>[] = [];

type I<S extends EmitterSchema> = InterfaceMap<S>;

type OnNamespace<S extends EmitterSchema> = {
  [K in keyof I<S>]: (listener: Listener<I<S>[K]>) => Unsubscribe;
};

type OnceNamespace<S extends EmitterSchema> = OnNamespace<S>;

type EmitNamespace<S extends EmitterSchema> = {
  [K in keyof I<S>]: (value: I<S>[K]) => void;
};

type OffNamespace<S extends EmitterSchema> = {
  [K in keyof I<S>]: (listener?: Listener<I<S>[K]>) => void;
};

type TransformNamespace<S extends EmitterSchema> = {
  [K in keyof I<S>]: (fn: TransformFn<I<S>[K]>) => void;
};

export class JarvisEmitter<Schema extends EmitterSchema = {}> {
  /** @internal */
  readonly _interfaces = new Map<string, InterfaceEntry>();
  /** @internal */
  _destroyed = false;
  /** @internal */
  readonly _label: string;

  readonly on: OnNamespace<Schema>;
  readonly once: OnceNamespace<Schema>;
  readonly emit: EmitNamespace<Schema>;
  readonly off: OffNamespace<Schema>;
  readonly transform: TransformNamespace<Schema>;

  constructor(
    schema: Schema = {} as Schema,
    options?: EmitterOptions<Schema>,
  ) {
    this._label = options?.label ?? `emitter_${++JarvisEmitter._idCounter}`;

    this._registerInterface('done', 'done', true, false);
    this._registerInterface('error', 'done', true, false);
    this._registerInterface('always', 'done', true, false);
    this._registerInterface('catch', 'catch', true, false);
    this._registerInterface('tap', 'observe', false, false);

    for (const [name, config] of Object.entries(schema)) {
      // done/error are phantom type markers — already registered as defaults
      if (name === 'done' || name === 'error') continue;
      const sticky = config.stickyLast ? true : (config.sticky ?? false);
      const stickyLast = config.stickyLast ?? false;
      this._registerInterface(name, config.role, sticky, stickyLast);
    }

    if (options?.transformError) {
      const entry = this._interfaces.get('error')!;
      entry.transforms.push(options.transformError as TransformFn<any>);
    }

    this.on = this._buildOnNamespace();
    this.once = this._buildOnceNamespace();
    this.emit = this._buildEmitNamespace();
    this.off = this._buildOffNamespace();
    this.transform = this._buildTransformNamespace();
  }

  private static _idCounter = 0;

  private _registerInterface(
    name: string,
    role: string,
    sticky: boolean,
    stickyLast: boolean,
  ): void {
    this._interfaces.set(name, {
      listeners: [],
      transforms: [],
      sticky,
      stickyLast,
      stickyCalls: [],
      role,
      name,
    });
  }

  private _assertValid(): void {
    if (this._destroyed) {
      throw new Error('JarvisEmitter used after being destroyed');
    }
  }

  private _applyTransforms(entry: InterfaceEntry, value: any): any {
    let result = value;
    for (const fn of entry.transforms) {
      result = fn(result);
    }
    return result;
  }

  private _emitInternal(name: string, value: any): void {
    this._assertValid();
    const entry = this._interfaces.get(name);
    if (!entry) return;

    const transformed = this._applyTransforms(entry, value);

    if (entry.sticky) {
      if (entry.stickyLast) {
        entry.stickyCalls.length = 0;
      }
      entry.stickyCalls.push(transformed);
    }

    try {
      for (const listener of [...entry.listeners]) {
        listener(transformed);
      }
    } catch (e) {
      if (name === 'catch') {
        for (const cb of unhandledExceptionCallbacks) {
          cb(e);
        }
      } else {
        this._emitInternal('catch', e);
      }
      return;
    }

    if (entry.role === 'done' && name !== 'always') {
      this._emitAlways(transformed);
    }

    if (name !== 'always' && name !== 'tap') {
      this._emitTap(name, entry.role, value);
    }
  }

  private _emitAlways(value: any): void {
    const always = this._interfaces.get('always');
    if (!always) return;

    const transformed = this._applyTransforms(always, value);

    if (always.sticky) {
      if (always.stickyLast) {
        always.stickyCalls.length = 0;
      }
      always.stickyCalls.push(transformed);
    }

    try {
      for (const listener of [...always.listeners]) {
        listener(transformed);
      }
    } catch (e) {
      this._emitInternal('catch', e);
    }
  }

  private _emitTap(name: string, role: string, data: any): void {
    const tap = this._interfaces.get('tap');
    if (!tap) return;

    const payload: TapPayload = { name, role, data: [data] };
    try {
      for (const listener of [...tap.listeners]) {
        listener(payload);
      }
    } catch (e) {
      this._emitInternal('catch', e);
    }
  }

  private _addListener(name: string, listener: Listener<any>): Unsubscribe {
    this._assertValid();
    const entry = this._interfaces.get(name);
    if (!entry) {
      throw new Error(`Unknown event: ${name}`);
    }

    entry.listeners.push(listener);

    if (entry.sticky && entry.stickyCalls.length > 0) {
      for (const value of entry.stickyCalls) {
        try {
          listener(value);
        } catch (e) {
          if (name === 'catch') {
            for (const cb of unhandledExceptionCallbacks) {
              cb(e);
            }
          } else {
            this._emitInternal('catch', e);
          }
        }
      }
    }

    return () => {
      const idx = entry.listeners.indexOf(listener);
      if (idx !== -1) {
        entry.listeners.splice(idx, 1);
      }
    };
  }

  private _buildOnNamespace(): OnNamespace<Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (listener: Listener<any>) => this._addListener(name, listener);
    }
    return ns as OnNamespace<Schema>;
  }

  private _buildOnceNamespace(): OnceNamespace<Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (listener: Listener<any>) => {
        let fired = false;
        let unsub: Unsubscribe | undefined;
        const wrapped = (value: any) => {
          if (fired) return;
          fired = true;
          if (unsub) unsub();
          listener(value);
        };
        unsub = this._addListener(name, wrapped);
        if (fired) unsub();
        return () => {
          if (!fired) unsub!();
        };
      };
    }
    return ns as OnceNamespace<Schema>;
  }

  private _buildEmitNamespace(): EmitNamespace<Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (value: any) => this._emitInternal(name, value);
    }
    return ns as EmitNamespace<Schema>;
  }

  private _buildOffNamespace(): OffNamespace<Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (listener?: Listener<any>) => {
        this._assertValid();
        const entry = this._interfaces.get(name);
        if (!entry) return;
        if (listener) {
          const idx = entry.listeners.indexOf(listener);
          if (idx !== -1) {
            entry.listeners.splice(idx, 1);
          }
        } else {
          entry.listeners.length = 0;
        }
      };
    }
    return ns as OffNamespace<Schema>;
  }

  private _buildTransformNamespace(): TransformNamespace<Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (fn: TransformFn<any>) => {
        this._assertValid();
        const entry = this._interfaces.get(name);
        if (!entry) return;
        entry.transforms.push(fn);
      };
    }
    return ns as TransformNamespace<Schema>;
  }

  subscribe(
    listeners: Partial<{
      [K in keyof I<Schema>]: Listener<I<Schema>[K]>;
    }>,
  ): Unsubscribe {
    this._assertValid();
    const unsubs: Unsubscribe[] = [];
    for (const [name, listener] of Object.entries(listeners)) {
      if (listener && this._interfaces.has(name)) {
        unsubs.push(this._addListener(name, listener as Listener<any>));
      }
    }
    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }

  promise(options?: { timeout?: number }): Promise<DoneTypeOf<Schema>> {
    return new Promise<DoneTypeOf<Schema>>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      this.on.done(((value: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(value);
      }) as any);

      this.on.error(((value: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(value);
      }) as any);

      this.on.catch(((value: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(value);
      }) as any);

      if (options?.timeout !== undefined) {
        timeoutId = setTimeout(() => {
          reject(new EmitterTimeoutError(options.timeout!));
        }, options.timeout);
      }
    });
  }

  pipe(
    destination: JarvisEmitter<any>,
    mapping?: string[] | Record<string, string>,
  ): this {
    this._assertValid();

    if (Array.isArray(mapping)) {
      for (const name of mapping) {
        if (this._interfaces.has(name) && destination._interfaces.has(name)) {
          this._addListener(name, (value: any) => {
            destination._emitInternal(name, value);
          });
        }
      }
    } else if (mapping && typeof mapping === 'object') {
      for (const [srcName, destName] of Object.entries(mapping)) {
        if (this._interfaces.has(srcName) && destination._interfaces.has(destName)) {
          this._addListener(srcName, (value: any) => {
            destination._emitInternal(destName, value);
          });
        }
      }
    } else {
      for (const name of this._interfaces.keys()) {
        if (destination._interfaces.has(name)) {
          this._addListener(name, (value: any) => {
            destination._emitInternal(name, value);
          });
        }
      }
    }

    return this;
  }

  destroy(): void {
    for (const entry of this._interfaces.values()) {
      entry.listeners.length = 0;
      entry.transforms.length = 0;
      entry.stickyCalls.length = 0;
    }
    this._destroyed = true;
  }

  static all<J extends JarvisEmitter<any>[]>(
    ...emitters: J
  ): JarvisEmitter<any> {
    const result = new JarvisEmitter<any>();
    const results: any[] = [];
    let received = 0;

    if (emitters.length === 0) {
      (result.emit as any).done([]);
      return result;
    }

    for (let i = 0; i < emitters.length; i++) {
      emitters[i].on.done((value: any) => {
        results[i] = value;
        received++;
        if (received === emitters.length) {
          (result.emit as any).done(results);
        }
      });
      emitters[i].on.error((err: any) => {
        (result.emit as any).error(err);
      });
    }

    return result;
  }

  static some<J extends JarvisEmitter<any>[]>(
    ...emitters: J
  ): JarvisEmitter<any> {
    const result = new JarvisEmitter<any>();
    const results: any[] = [];
    let received = 0;

    if (emitters.length === 0) {
      (result.emit as any).done([]);
      return result;
    }

    for (let i = 0; i < emitters.length; i++) {
      emitters[i].on.done((value: any) => {
        results[i] = value;
        received++;
        if (received === emitters.length) {
          (result.emit as any).done(results);
        }
      });
      emitters[i].on.error(() => {
        results[i] = undefined;
        received++;
        if (received === emitters.length) {
          (result.emit as any).done(results);
        }
      });
    }

    return result;
  }

  static immediate<T>(
    result: T,
    eventName: string = 'done',
  ): JarvisEmitter<any> {
    const em = new JarvisEmitter<any>();
    (em as any)._emitInternal(eventName, result);
    return em;
  }

  static emitifyFromAsync<I extends any[], O>(
    fn: (...args: I) => Promise<O>,
  ): (...callArgs: I) => JarvisEmitter<any> {
    return (...callArgs: I) => {
      const em = new JarvisEmitter<any>();
      fn(...callArgs)
        .then((result) => {
          (em.emit as any).done(result);
        })
        .catch((err) => {
          (em.emit as any).error(err);
        });
      return em;
    };
  }

  /**
   * @deprecated Use emitifyFromAsync instead.
   */
  static emitify(
    fn: (...args: any[]) => any,
    resultsAsArray: boolean = true,
    cbIndex?: number,
  ): (...callArgs: any[]) => JarvisEmitter<any> {
    return (...callArgs: any[]) => {
      const em = new JarvisEmitter<any>();
      const idx = cbIndex === undefined ? callArgs.length : cbIndex;
      callArgs.splice(idx, 0, (...cbArgs: any[]) => {
        if (resultsAsArray) {
          return (em.emit as any).done(cbArgs);
        }
        (em.emit as any).done(...cbArgs);
      });
      fn(...callArgs);
      return em;
    };
  }

  static onUnhandledException(cb: Listener<any>): void {
    unhandledExceptionCallbacks.push(cb);
  }

  static offUnhandledException(cb: Listener<any>): void {
    const idx = unhandledExceptionCallbacks.indexOf(cb);
    if (idx !== -1) {
      unhandledExceptionCallbacks.splice(idx, 1);
    }
  }
}

export function createEmitter<const S extends EmitterSchema = {}>(
  schema?: S,
  options?: EmitterOptions<S>,
): JarvisEmitter<S> {
  return new JarvisEmitter<S>(schema ?? ({} as S), options);
}

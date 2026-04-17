# jarvis-emitter v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite jarvis-emitter as a modern TypeScript ESM library with a schema-first declarative API, replacing the boilerplate-heavy v3 `extend()` pattern.

**Architecture:** Factory function `createEmitter<DoneType, ErrorType>(schema?, options?)` creates emitters with typed `on/emit/off/once/transform` namespaces. Role helpers `event<T>()` and `notify<T>()` carry payload types. Internal state stored in a `Map<string, InterfaceEntry>`. Debug registry singleton tracks all live emitters via WeakRef.

**Tech Stack:** TypeScript 5.7+, ESNext modules, vitest for testing, tsc for build

**Spec:** `docs/superpowers/specs/2026-04-17-jarvis-emitter-v4-design.md`

---

## File Structure

```
src/
  index.ts              — export barrel
  types.ts              — all shared type definitions
  roles.ts              — event(), notify() helper functions
  emitter.ts            — JarvisEmitter class + createEmitter factory
  registry.ts           — debug registry singleton
test/
  types.test.ts         — compile-time type assertions (tsc --noEmit)
  roles.test.ts         — role helper tests
  emitter.test.ts       — core emitter behavior tests
  transform.test.ts     — transform system tests
  sticky.test.ts        — sticky/stickyLast tests
  subscribe.test.ts     — once/subscribe tests
  pipe.test.ts          — typed pipe tests
  registry.test.ts      — debug registry tests
  statics.test.ts       — static helpers + promise interop tests
  lifecycle.test.ts     — destroy/lifecycle tests
package.json
tsconfig.json
tsconfig.build.json
vitest.config.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Delete: `index.js`, `index.d.ts`, old `tsconfig.json`

- [ ] **Step 1: Back up old source files**

```bash
git mv index.js v3-reference/index.js
git mv index.d.ts v3-reference/index.d.ts
git mv test v3-reference/test
```

- [ ] **Step 2: Update package.json**

Replace the full contents of `package.json`:

```json
{
  "name": "jarvis-emitter",
  "version": "4.0.0-alpha.0",
  "description": "Typed, schema-first event emitter with transforms, sticky events, and debug registry",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:types": "tsc --noEmit",
    "prepack": "npm run build",
    "clean": "rm -rf dist"
  },
  "author": "mce",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/mceSystems/jarvis-emitter"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^3.1.1"
  }
}
```

Note: `debug` dependency is removed. v4 uses the debug registry instead.

- [ ] **Step 3: Create tsconfig.json (for IDE + type-checking)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create tsconfig.build.json (for build output)**

```json
{
  "extends": "./tsconfig.json",
  "include": ["src"],
  "exclude": ["test"]
}
```

- [ ] **Step 5: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create src/index.ts placeholder**

```ts
// jarvis-emitter v4
```

- [ ] **Step 7: Update .gitignore**

Add `dist` to `.gitignore`:

```
node_modules
dist
```

- [ ] **Step 8: Update .npmignore**

Replace contents:

```
.git
test
src
v3-reference
vitest.config.ts
tsconfig.json
tsconfig.build.json
docs
```

- [ ] **Step 9: Install dependencies and verify**

```bash
npm install
npx tsc --noEmit
npx vitest run
```

Expected: tsc passes (empty project), vitest reports no tests found (OK for now).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold v4 project structure with ESM + vitest"
```

---

### Task 2: Types Foundation

**Files:**
- Create: `src/types.ts`
- Create: `test/types.test.ts`

- [ ] **Step 1: Write type definitions in src/types.ts**

```ts
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

/**
 * A schema is a record mapping event names to their RoleConfig.
 * Passed to createEmitter() to declare custom events.
 */
export type EmitterSchema = Record<string, RoleConfig<any>>;

/** Extract the payload type from a RoleConfig. */
export type PayloadOf<R> = R extends RoleConfig<infer T> ? T : never;

/**
 * Default interfaces present on every emitter.
 * Derived from DoneType and ErrorType generics.
 */
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

/**
 * Full interface map combining defaults with schema-defined events.
 */
export type InterfaceMap<
  DoneType,
  ErrorType,
  Schema extends EmitterSchema,
> = DefaultInterfaces<DoneType, ErrorType> & {
  [K in keyof Schema]: PayloadOf<Schema[K]>;
};

/** Options passed to createEmitter. */
export interface EmitterOptions<ErrorType> {
  label?: string;
  transformError?: (raw: unknown) => ErrorType;
}

/** Unsubscribe function returned by on() and once(). */
export type Unsubscribe = () => void;

/** Listener callback type. */
export type Listener<T> = (arg: T) => void;

/** Transform function type. */
export type TransformFn<T> = (value: T) => T;

/** Entry returned by registry.list(). */
export interface RegistryEntry {
  label: string;
  events: string[];
  listeners: Record<string, number>;
}

/** Payload for registry.onEmit(). */
export interface RegistryEmitEvent {
  label: string;
  event: string;
  data: unknown;
}

/** Error thrown when promise() times out. */
export class EmitterTimeoutError extends Error {
  constructor(public readonly ms: number) {
    super(`Emitter timed out after ${ms}ms`);
    this.name = 'EmitterTimeoutError';
  }
}
```

- [ ] **Step 2: Write compile-time type assertions in test/types.test.ts**

```ts
import type { RoleConfig, PayloadOf, DefaultInterfaces, InterfaceMap, EmitterSchema } from '../src/types.js';

// ─── helpers ────────────────────────────────────────────────────
type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
type Assert<T extends true> = T;

// ─── PayloadOf extracts type from RoleConfig ────────────────────
{
  type _void = Assert<AssertEqual<PayloadOf<RoleConfig<void>>, void>>;
  type _string = Assert<AssertEqual<PayloadOf<RoleConfig<string>>, string>>;
  type _complex = Assert<AssertEqual<PayloadOf<RoleConfig<{ x: number }>>, { x: number }>>;
}

// ─── DefaultInterfaces types ────────────────────────────────────
{
  type DI = DefaultInterfaces<string, Error>;
  type _done = Assert<AssertEqual<DI['done'], string>>;
  type _error = Assert<AssertEqual<DI['error'], Error>>;
  type _always = Assert<AssertEqual<DI['always'], string | Error>>;
  type _catch = Assert<AssertEqual<DI['catch'], Error>>;
}

// ─── InterfaceMap merges defaults with schema ───────────────────
{
  type Schema = {
    status: RoleConfig<string>;
    data: RoleConfig<{ x: number }>;
  };
  type Map = InterfaceMap<boolean, Error, Schema>;
  type _done = Assert<AssertEqual<Map['done'], boolean>>;
  type _error = Assert<AssertEqual<Map['error'], Error>>;
  type _status = Assert<AssertEqual<Map['status'], string>>;
  type _data = Assert<AssertEqual<Map['data'], { x: number }>>;
}

// ─── unknown defaults ──────────────────────────────────────────
{
  type DI = DefaultInterfaces;
  type _done = Assert<AssertEqual<DI['done'], unknown>>;
  type _error = Assert<AssertEqual<DI['error'], unknown>>;
}
```

- [ ] **Step 3: Run type check to verify assertions pass**

```bash
npx tsc --noEmit
```

Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts test/types.test.ts
git commit -m "feat: add core type definitions and type-level tests"
```

---

### Task 3: Role Helpers

**Files:**
- Create: `src/roles.ts`
- Create: `test/roles.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { event, notify } from '../src/roles.js';

describe('event()', () => {
  it('returns a config with role "event"', () => {
    const config = event();
    expect(config.role).toBe('event');
  });

  it('defaults to no sticky', () => {
    const config = event();
    expect(config.sticky).toBeUndefined();
    expect(config.stickyLast).toBeUndefined();
  });

  it('accepts sticky option', () => {
    const config = event({ sticky: true });
    expect(config.sticky).toBe(true);
  });

  it('accepts stickyLast option', () => {
    const config = event({ stickyLast: true });
    expect(config.stickyLast).toBe(true);
  });
});

describe('notify()', () => {
  it('returns a config with role "notify"', () => {
    const config = notify();
    expect(config.role).toBe('notify');
  });

  it('defaults to no sticky', () => {
    const config = notify();
    expect(config.sticky).toBeUndefined();
    expect(config.stickyLast).toBeUndefined();
  });

  it('accepts sticky option', () => {
    const config = notify({ sticky: true });
    expect(config.sticky).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/roles.test.ts
```

Expected: FAIL — cannot find `../src/roles.js`.

- [ ] **Step 3: Implement src/roles.ts**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/roles.test.ts
```

Expected: PASS — all 7 tests pass.

- [ ] **Step 5: Add type tests for role helpers to test/types.test.ts**

Append to `test/types.test.ts`:

```ts
import type { RoleConfig } from '../src/types.js';

// ─── event() and notify() carry payload type ────────────────────
// (runtime tests in roles.test.ts; these are compile-time only)
{
  // Importing the actual functions for type-level testing
  type EventConfig = RoleConfig<string>;
  type NotifyConfig = RoleConfig<{ x: number }>;
  type _eventPayload = Assert<AssertEqual<PayloadOf<EventConfig>, string>>;
  type _notifyPayload = Assert<AssertEqual<PayloadOf<NotifyConfig>, { x: number }>>;

  // void default
  type VoidConfig = RoleConfig;
  type _voidPayload = Assert<AssertEqual<PayloadOf<VoidConfig>, void>>;
}
```

- [ ] **Step 6: Run full type check**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/roles.ts test/roles.test.ts test/types.test.ts
git commit -m "feat: add event() and notify() role helpers"
```

---

### Task 4: Emitter Core — Default Interfaces

**Files:**
- Create: `src/emitter.ts`
- Create: `test/emitter.test.ts`

- [ ] **Step 1: Write failing tests for basic on/emit/off with default interfaces**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';

describe('createEmitter — default interfaces', () => {
  describe('on/emit', () => {
    it('emits done to a registered listener', () => {
      const em = createEmitter<string>();
      const listener = vi.fn();
      em.on.done(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('emits error to a registered listener', () => {
      const em = createEmitter<string, Error>();
      const listener = vi.fn();
      em.on.error(listener);
      const err = new Error('fail');
      em.emit.error(err);
      expect(listener).toHaveBeenCalledWith(err);
    });

    it('emits always when done is emitted', () => {
      const em = createEmitter<string>();
      const listener = vi.fn();
      em.on.always(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('emits always when error is emitted', () => {
      const em = createEmitter<string, string>();
      const listener = vi.fn();
      em.on.always(listener);
      em.emit.error('fail');
      expect(listener).toHaveBeenCalledWith('fail');
    });

    it('emits tap when done is emitted', () => {
      const em = createEmitter<string>();
      const listener = vi.fn();
      em.on.tap(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith({
        name: 'done',
        role: 'done',
        data: ['hello'],
      });
    });

    it('emits tap when error is emitted', () => {
      const em = createEmitter<string, string>();
      const listener = vi.fn();
      em.on.tap(listener);
      em.emit.error('fail');
      expect(listener).toHaveBeenCalledWith({
        name: 'error',
        role: 'done',
        data: ['fail'],
      });
    });

    it('does not emit tap for always or tap itself', () => {
      const em = createEmitter<string>();
      const listener = vi.fn();
      em.on.tap(listener);
      em.emit.done('hello');
      // tap fires once (for done), not again for always or for itself
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('supports multiple listeners on the same event', () => {
      const em = createEmitter<string>();
      const l1 = vi.fn();
      const l2 = vi.fn();
      em.on.done(l1);
      em.on.done(l2);
      em.emit.done('hello');
      expect(l1).toHaveBeenCalledWith('hello');
      expect(l2).toHaveBeenCalledWith('hello');
    });
  });

  describe('on returns unsubscribe', () => {
    it('returns a function that removes the listener', () => {
      const em = createEmitter<string>();
      const listener = vi.fn();
      const unsub = em.on.done(listener);
      unsub();
      em.emit.done('hello');
      expect(listener).not.toHaveBeenCalled();
    });

    it('only removes the specific listener', () => {
      const em = createEmitter<string>();
      const l1 = vi.fn();
      const l2 = vi.fn();
      const unsub1 = em.on.done(l1);
      em.on.done(l2);
      unsub1();
      em.emit.done('hello');
      expect(l1).not.toHaveBeenCalled();
      expect(l2).toHaveBeenCalledWith('hello');
    });
  });

  describe('off', () => {
    it('removes all listeners when called without argument', () => {
      const em = createEmitter<string>();
      const l1 = vi.fn();
      const l2 = vi.fn();
      em.on.done(l1);
      em.on.done(l2);
      em.off.done();
      em.emit.done('hello');
      expect(l1).not.toHaveBeenCalled();
      expect(l2).not.toHaveBeenCalled();
    });

    it('removes a specific listener when passed as argument', () => {
      const em = createEmitter<string>();
      const l1 = vi.fn();
      const l2 = vi.fn();
      em.on.done(l1);
      em.on.done(l2);
      em.off.done(l1);
      em.emit.done('hello');
      expect(l1).not.toHaveBeenCalled();
      expect(l2).toHaveBeenCalledWith('hello');
    });
  });

  describe('catch', () => {
    it('catches exceptions thrown in done listeners', () => {
      const em = createEmitter<string>();
      const catchListener = vi.fn();
      em.on.catch(catchListener);
      em.on.done(() => {
        throw new Error('boom');
      });
      em.emit.done('hello');
      expect(catchListener).toHaveBeenCalledTimes(1);
      expect(catchListener.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(catchListener.mock.calls[0][0].message).toBe('boom');
    });

    it('catches exceptions thrown in error listeners', () => {
      const em = createEmitter<string, string>();
      const catchListener = vi.fn();
      em.on.catch(catchListener);
      em.on.error(() => {
        throw new Error('boom');
      });
      em.emit.error('fail');
      expect(catchListener).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/emitter.test.ts
```

Expected: FAIL — cannot find `../src/emitter.js`.

- [ ] **Step 3: Implement src/emitter.ts — core class and createEmitter**

```ts
import type {
  EmitterSchema,
  EmitterOptions,
  InterfaceMap,
  Unsubscribe,
  Listener,
  TransformFn,
  TapPayload,
} from './types.js';
import { EmitterTimeoutError } from './types.js';

/** Internal state for a single named event interface. */
interface InterfaceEntry {
  listeners: Listener<any>[];
  transforms: TransformFn<any>[];
  sticky: boolean;
  stickyLast: boolean;
  stickyCalls: any[];
  role: string;
  name: string;
}

// Module-level unhandled exception callbacks (legacy compat for emitify)
const unhandledExceptionCallbacks: Listener<any>[] = [];

type Interfaces<DoneType, ErrorType, Schema extends EmitterSchema> =
  InterfaceMap<DoneType, ErrorType, Schema>;

type OnNamespace<DoneType, ErrorType, Schema extends EmitterSchema> = {
  [K in keyof Interfaces<DoneType, ErrorType, Schema>]:
    (listener: Listener<Interfaces<DoneType, ErrorType, Schema>[K]>) => Unsubscribe;
};

type OnceNamespace<DoneType, ErrorType, Schema extends EmitterSchema> =
  OnNamespace<DoneType, ErrorType, Schema>;

type EmitNamespace<DoneType, ErrorType, Schema extends EmitterSchema> = {
  [K in keyof Interfaces<DoneType, ErrorType, Schema>]:
    (value: Interfaces<DoneType, ErrorType, Schema>[K]) => void;
};

type OffNamespace<DoneType, ErrorType, Schema extends EmitterSchema> = {
  [K in keyof Interfaces<DoneType, ErrorType, Schema>]:
    (listener?: Listener<Interfaces<DoneType, ErrorType, Schema>[K]>) => void;
};

type TransformNamespace<DoneType, ErrorType, Schema extends EmitterSchema> = {
  [K in keyof Interfaces<DoneType, ErrorType, Schema>]:
    (fn: TransformFn<Interfaces<DoneType, ErrorType, Schema>[K]>) => void;
};

export class JarvisEmitter<
  DoneType = unknown,
  ErrorType = unknown,
  Schema extends EmitterSchema = {},
> {
  /** @internal */
  readonly _interfaces = new Map<string, InterfaceEntry>();
  /** @internal */
  _destroyed = false;
  /** @internal */
  readonly _label: string;

  readonly on: OnNamespace<DoneType, ErrorType, Schema>;
  readonly once: OnceNamespace<DoneType, ErrorType, Schema>;
  readonly emit: EmitNamespace<DoneType, ErrorType, Schema>;
  readonly off: OffNamespace<DoneType, ErrorType, Schema>;
  readonly transform: TransformNamespace<DoneType, ErrorType, Schema>;

  constructor(
    schema: Schema = {} as Schema,
    options?: EmitterOptions<ErrorType>,
  ) {
    this._label = options?.label ?? `emitter_${++JarvisEmitter._idCounter}`;

    // Register default interfaces
    this._registerInterface('done', 'done', true, false);
    this._registerInterface('error', 'done', true, false);
    this._registerInterface('always', 'done', true, false);
    this._registerInterface('catch', 'catch', true, false);
    this._registerInterface('tap', 'observe', false, false);

    // Register schema-defined interfaces
    for (const [name, config] of Object.entries(schema)) {
      const sticky = config.stickyLast ? true : (config.sticky ?? false);
      const stickyLast = config.stickyLast ?? false;
      this._registerInterface(name, config.role, sticky, stickyLast);
    }

    // Store transformError if provided
    if (options?.transformError) {
      const entry = this._interfaces.get('error')!;
      entry.transforms.push(options.transformError as TransformFn<any>);
    }

    // Build namespace objects
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

    // Store sticky
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

    // Auto-emit always on done/error (but not when emitting always itself)
    if (entry.role === 'done' && name !== 'always') {
      this._emitAlways(transformed);
    }

    // Auto-emit tap (but not for always or tap itself)
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

    // Replay sticky calls
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

  private _buildOnNamespace(): OnNamespace<DoneType, ErrorType, Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (listener: Listener<any>) => this._addListener(name, listener);
    }
    return ns as OnNamespace<DoneType, ErrorType, Schema>;
  }

  private _buildOnceNamespace(): OnceNamespace<DoneType, ErrorType, Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (listener: Listener<any>) => {
        const unsub = this._addListener(name, (value: any) => {
          unsub();
          listener(value);
        });
        return unsub;
      };
    }
    return ns as OnceNamespace<DoneType, ErrorType, Schema>;
  }

  private _buildEmitNamespace(): EmitNamespace<DoneType, ErrorType, Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (value: any) => this._emitInternal(name, value);
    }
    return ns as EmitNamespace<DoneType, ErrorType, Schema>;
  }

  private _buildOffNamespace(): OffNamespace<DoneType, ErrorType, Schema> {
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
    return ns as OffNamespace<DoneType, ErrorType, Schema>;
  }

  private _buildTransformNamespace(): TransformNamespace<DoneType, ErrorType, Schema> {
    const ns: Record<string, any> = {};
    for (const name of this._interfaces.keys()) {
      ns[name] = (fn: TransformFn<any>) => {
        this._assertValid();
        const entry = this._interfaces.get(name);
        if (!entry) return;
        entry.transforms.push(fn);
      };
    }
    return ns as TransformNamespace<DoneType, ErrorType, Schema>;
  }

  /**
   * Bulk subscribe to multiple events. Returns a single unsubscribe function.
   */
  subscribe(
    listeners: Partial<{
      [K in keyof Interfaces<DoneType, ErrorType, Schema>]:
        Listener<Interfaces<DoneType, ErrorType, Schema>[K]>;
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

  /**
   * Returns a Promise that resolves on done or rejects on error/catch.
   */
  promise(options?: { timeout?: number }): Promise<DoneType> {
    return new Promise<DoneType>((resolve, reject) => {
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

  /**
   * Pipe events to another emitter.
   * - pipe(dest): pipe all matching event names
   * - pipe(dest, ['done', 'error']): pipe only listed events
   * - pipe(dest, { srcName: 'destName' }): pipe with name mapping
   */
  pipe(
    destination: JarvisEmitter<any, any, any>,
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

  /**
   * Destroy the emitter — purge all listeners, transforms, sticky state.
   */
  destroy(): void {
    for (const entry of this._interfaces.values()) {
      entry.listeners.length = 0;
      entry.transforms.length = 0;
      entry.stickyCalls.length = 0;
    }
    this._destroyed = true;
  }

  // ─── Static helpers ───────────────────────────────────────────

  static all<J extends JarvisEmitter<any, any, any>[]>(
    ...emitters: J
  ): JarvisEmitter<{ [I in keyof J]: J[I] extends JarvisEmitter<infer D, any, any> ? D : never }> {
    const result = new JarvisEmitter<any>();
    const results: any[] = [];
    let received = 0;

    if (emitters.length === 0) {
      result.emit.done([]);
      return result as any;
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

    return result as any;
  }

  static some<J extends JarvisEmitter<any, any, any>[]>(
    ...emitters: J
  ): JarvisEmitter<{ [I in keyof J]: (J[I] extends JarvisEmitter<infer D, any, any> ? D : never) | undefined }> {
    const result = new JarvisEmitter<any>();
    const results: any[] = [];
    let received = 0;

    if (emitters.length === 0) {
      result.emit.done([]);
      return result as any;
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

    return result as any;
  }

  static immediate<T>(
    result: T,
    eventName: string = 'done',
  ): JarvisEmitter<T> {
    const em = new JarvisEmitter<T>();
    (em as any)._emitInternal(eventName, result);
    return em;
  }

  static emitifyFromAsync<I extends any[], O>(
    fn: (...args: I) => Promise<O>,
  ): (...callArgs: I) => JarvisEmitter<O> {
    return (...callArgs: I) => {
      const em = new JarvisEmitter<O>();
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
   * Wraps a callback-style function into an emitter.
   */
  static emitify(
    fn: (...args: any[]) => any,
    resultsAsArray: boolean = true,
    cbIndex?: number,
  ): (...callArgs: any[]) => JarvisEmitter<unknown> {
    return (...callArgs: any[]) => {
      const em = new JarvisEmitter<unknown>();
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

/**
 * Factory function to create a new JarvisEmitter.
 */
export function createEmitter<
  DoneType = unknown,
  ErrorType = unknown,
  const S extends EmitterSchema = {},
>(
  schema?: S,
  options?: EmitterOptions<ErrorType>,
): JarvisEmitter<DoneType, ErrorType, S> {
  return new JarvisEmitter<DoneType, ErrorType, S>(
    schema ?? ({} as S),
    options,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/emitter.test.ts
```

Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/emitter.ts test/emitter.test.ts
git commit -m "feat: implement emitter core with on/emit/off for default interfaces"
```

---

### Task 5: Custom Events via Schema

**Files:**
- Modify: `test/emitter.test.ts` (append)

- [ ] **Step 1: Write failing tests for schema-based custom events**

Append to `test/emitter.test.ts`:

```ts
import { event, notify } from '../src/roles.js';

describe('createEmitter — custom events via schema', () => {
  it('registers custom event from schema', () => {
    const em = createEmitter<void>({
      status: event<string>(),
    });
    const listener = vi.fn();
    em.on.status(listener);
    em.emit.status('online');
    expect(listener).toHaveBeenCalledWith('online');
  });

  it('registers custom notify from schema', () => {
    const em = createEmitter<void>({
      command: notify<{ action: string }>(),
    });
    const listener = vi.fn();
    em.on.command(listener);
    em.emit.command({ action: 'start' });
    expect(listener).toHaveBeenCalledWith({ action: 'start' });
  });

  it('supports multiple custom events', () => {
    const em = createEmitter<void>({
      status: event<string>(),
      progress: event<number>(),
    });
    const statusListener = vi.fn();
    const progressListener = vi.fn();
    em.on.status(statusListener);
    em.on.progress(progressListener);
    em.emit.status('running');
    em.emit.progress(42);
    expect(statusListener).toHaveBeenCalledWith('running');
    expect(progressListener).toHaveBeenCalledWith(42);
  });

  it('custom events coexist with default events', () => {
    const em = createEmitter<string>({
      status: event<number>(),
    });
    const doneListener = vi.fn();
    const statusListener = vi.fn();
    em.on.done(doneListener);
    em.on.status(statusListener);
    em.emit.done('result');
    em.emit.status(100);
    expect(doneListener).toHaveBeenCalledWith('result');
    expect(statusListener).toHaveBeenCalledWith(100);
  });

  it('tap fires for custom events', () => {
    const em = createEmitter<void>({
      status: event<string>(),
    });
    const tapListener = vi.fn();
    em.on.tap(tapListener);
    em.emit.status('online');
    expect(tapListener).toHaveBeenCalledWith({
      name: 'status',
      role: 'event',
      data: ['online'],
    });
  });

  it('unsub works for custom events', () => {
    const em = createEmitter<void>({
      status: event<string>(),
    });
    const listener = vi.fn();
    const unsub = em.on.status(listener);
    unsub();
    em.emit.status('online');
    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

These tests should already pass because `createEmitter` processes the schema in the constructor.

```bash
npx vitest run test/emitter.test.ts
```

Expected: PASS — all tests pass (schema processing already implemented in Task 4).

- [ ] **Step 3: Commit**

```bash
git add test/emitter.test.ts
git commit -m "test: add custom event schema tests"
```

---

### Task 6: Sticky Events

**Files:**
- Create: `test/sticky.test.ts`

- [ ] **Step 1: Write tests for sticky and stickyLast behavior**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event } from '../src/roles.js';

describe('sticky events', () => {
  it('done is sticky by default — late subscriber gets the value', () => {
    const em = createEmitter<string>();
    em.emit.done('early');
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith('early');
  });

  it('error is sticky by default', () => {
    const em = createEmitter<string, string>();
    em.emit.error('fail');
    const listener = vi.fn();
    em.on.error(listener);
    expect(listener).toHaveBeenCalledWith('fail');
  });

  it('custom event with sticky replays to late subscriber', () => {
    const em = createEmitter<void>({
      status: event<string>({ sticky: true }),
    });
    em.emit.status('ready');
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).toHaveBeenCalledWith('ready');
  });

  it('custom event without sticky does not replay', () => {
    const em = createEmitter<void>({
      status: event<string>(),
    });
    em.emit.status('ready');
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it('sticky replays multiple emissions', () => {
    const em = createEmitter<void>({
      log: event<string>({ sticky: true }),
    });
    em.emit.log('first');
    em.emit.log('second');
    const listener = vi.fn();
    em.on.log(listener);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, 'first');
    expect(listener).toHaveBeenNthCalledWith(2, 'second');
  });

  it('stickyLast only replays the last emission', () => {
    const em = createEmitter<void>({
      status: event<string>({ stickyLast: true }),
    });
    em.emit.status('first');
    em.emit.status('second');
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('second');
  });

  it('stickyLast replays to late async subscriber', async () => {
    const em = createEmitter<void>({
      status: event<string>({ stickyLast: true }),
    });
    em.emit.status('hello');
    await new Promise((r) => setTimeout(r, 10));
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).toHaveBeenCalledWith('hello');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest run test/sticky.test.ts
```

Expected: PASS — sticky behavior is already implemented in the emitter core (Task 4).

- [ ] **Step 3: Commit**

```bash
git add test/sticky.test.ts
git commit -m "test: add sticky and stickyLast event tests"
```

---

### Task 7: once and subscribe

**Files:**
- Create: `test/subscribe.test.ts`

- [ ] **Step 1: Write tests for once and subscribe**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event } from '../src/roles.js';

describe('once', () => {
  it('fires listener only once then auto-unsubscribes', () => {
    const em = createEmitter<string>();
    const listener = vi.fn();
    em.once.done(listener);
    em.emit.done('first');
    em.emit.done('second');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('returns an unsubscribe function', () => {
    const em = createEmitter<string>();
    const listener = vi.fn();
    const unsub = em.once.done(listener);
    unsub();
    em.emit.done('hello');
    expect(listener).not.toHaveBeenCalled();
  });

  it('works with custom events', () => {
    const em = createEmitter<void>({
      status: event<string>(),
    });
    const listener = vi.fn();
    em.once.status(listener);
    em.emit.status('first');
    em.emit.status('second');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('replays sticky once then unsubscribes', () => {
    const em = createEmitter<string>();
    em.emit.done('early');
    const listener = vi.fn();
    em.once.done(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('early');
    // Should not fire again
    em.emit.done('late');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('subscribe', () => {
  it('subscribes to multiple events at once', () => {
    const em = createEmitter<string, string>({
      status: event<number>(),
    });
    const doneFn = vi.fn();
    const errorFn = vi.fn();
    const statusFn = vi.fn();
    em.subscribe({
      done: doneFn,
      error: errorFn,
      status: statusFn,
    });
    em.emit.done('result');
    em.emit.error('err');
    em.emit.status(42);
    expect(doneFn).toHaveBeenCalledWith('result');
    expect(errorFn).toHaveBeenCalledWith('err');
    expect(statusFn).toHaveBeenCalledWith(42);
  });

  it('returns a single unsub that removes all listeners', () => {
    const em = createEmitter<string, string>();
    const doneFn = vi.fn();
    const errorFn = vi.fn();
    const unsub = em.subscribe({
      done: doneFn,
      error: errorFn,
    });
    unsub();
    em.emit.done('result');
    em.emit.error('err');
    expect(doneFn).not.toHaveBeenCalled();
    expect(errorFn).not.toHaveBeenCalled();
  });

  it('allows partial subscription', () => {
    const em = createEmitter<string, string>();
    const doneFn = vi.fn();
    em.subscribe({ done: doneFn });
    em.emit.done('result');
    expect(doneFn).toHaveBeenCalledWith('result');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run test/subscribe.test.ts
```

Expected: PASS — `once` and `subscribe` are implemented in emitter core (Task 4).

- [ ] **Step 3: Commit**

```bash
git add test/subscribe.test.ts
git commit -m "test: add once and subscribe tests"
```

---

### Task 8: Transform System

**Files:**
- Create: `test/transform.test.ts`

- [ ] **Step 1: Write tests for transforms**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event } from '../src/roles.js';

describe('transform namespace', () => {
  it('transforms the value before it reaches listeners', () => {
    const em = createEmitter<string>();
    em.transform.done((val) => val.toUpperCase());
    const listener = vi.fn();
    em.on.done(listener);
    em.emit.done('hello');
    expect(listener).toHaveBeenCalledWith('HELLO');
  });

  it('transforms custom events', () => {
    const em = createEmitter<void>({
      status: event<string>(),
    });
    em.transform.status((val) => `status: ${val}`);
    const listener = vi.fn();
    em.on.status(listener);
    em.emit.status('online');
    expect(listener).toHaveBeenCalledWith('status: online');
  });

  it('composes multiple transforms in registration order', () => {
    const em = createEmitter<number>();
    em.transform.done((val) => val * 2);
    em.transform.done((val) => val + 1);
    const listener = vi.fn();
    em.on.done(listener);
    em.emit.done(5);
    // 5 → *2 → 10 → +1 → 11
    expect(listener).toHaveBeenCalledWith(11);
  });

  it('transforms apply to sticky replay', () => {
    const em = createEmitter<string>();
    em.transform.done((val) => val.toUpperCase());
    em.emit.done('hello');
    const listener = vi.fn();
    em.on.done(listener);
    // Sticky replays the already-transformed value
    expect(listener).toHaveBeenCalledWith('HELLO');
  });
});

describe('transformError option', () => {
  it('transforms error values via options', () => {
    class ServiceError extends Error {
      code: number;
      constructor(msg: string, code: number) {
        super(msg);
        this.code = code;
      }
    }

    const em = createEmitter<string, ServiceError>({}, {
      transformError: (raw) => {
        const msg = String(raw);
        return new ServiceError(msg, 500);
      },
    });
    const listener = vi.fn();
    em.on.error(listener);
    em.emit.error('server failure' as any);
    expect(listener).toHaveBeenCalledTimes(1);
    const err = listener.mock.calls[0][0];
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.message).toBe('server failure');
    expect(err.code).toBe(500);
  });

  it('transformError composes with transform.error', () => {
    const em = createEmitter<string, string>({}, {
      transformError: (raw) => `transformed: ${raw}`,
    });
    em.transform.error((val) => val.toUpperCase());
    const listener = vi.fn();
    em.on.error(listener);
    em.emit.error('fail' as any);
    // transformError runs first (registered in constructor), then transform.error
    expect(listener).toHaveBeenCalledWith('TRANSFORMED: FAIL');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run test/transform.test.ts
```

Expected: PASS — transform logic is in the emitter core (Task 4).

- [ ] **Step 3: Commit**

```bash
git add test/transform.test.ts
git commit -m "test: add transform system tests"
```

---

### Task 9: Destroy & Lifecycle

**Files:**
- Create: `test/lifecycle.test.ts`

- [ ] **Step 1: Write tests for destroy behavior**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event } from '../src/roles.js';

describe('destroy', () => {
  it('purges all listeners', () => {
    const em = createEmitter<string>({
      status: event<string>(),
    });
    const doneFn = vi.fn();
    const statusFn = vi.fn();
    em.on.done(doneFn);
    em.on.status(statusFn);
    em.destroy();
    // Cannot emit after destroy — but let's verify listeners were purged
    expect(() => em.emit.done('hello')).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on emit after destroy', () => {
    const em = createEmitter<string>();
    em.destroy();
    expect(() => em.emit.done('hello')).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on on after destroy', () => {
    const em = createEmitter<string>();
    em.destroy();
    expect(() => em.on.done(() => {})).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on off after destroy', () => {
    const em = createEmitter<string>();
    em.destroy();
    expect(() => em.off.done()).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on transform after destroy', () => {
    const em = createEmitter<string>();
    em.destroy();
    expect(() => em.transform.done((v) => v)).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on subscribe after destroy', () => {
    const em = createEmitter<string>();
    em.destroy();
    expect(() => em.subscribe({ done: () => {} })).toThrow('JarvisEmitter used after being destroyed');
  });

  it('clears sticky state', () => {
    const em = createEmitter<string>();
    em.emit.done('cached');
    em.destroy();
    // Create a new emitter to verify the old one is truly dead
    const em2 = createEmitter<string>();
    em2.emit.done('cached');
    const listener = vi.fn();
    em2.on.done(listener);
    expect(listener).toHaveBeenCalledWith('cached');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run test/lifecycle.test.ts
```

Expected: PASS — destroy is implemented in emitter core (Task 4).

- [ ] **Step 3: Commit**

```bash
git add test/lifecycle.test.ts
git commit -m "test: add destroy and lifecycle tests"
```

---

### Task 10: Typed Pipe

**Files:**
- Create: `test/pipe.test.ts`

- [ ] **Step 1: Write tests for pipe behavior**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event } from '../src/roles.js';

describe('pipe', () => {
  describe('basic pipe (all matching events)', () => {
    it('forwards done events', () => {
      const src = createEmitter<string>();
      const dest = createEmitter<string>();
      const listener = vi.fn();
      dest.on.done(listener);
      src.pipe(dest);
      src.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('forwards error events', () => {
      const src = createEmitter<string, string>();
      const dest = createEmitter<string, string>();
      const listener = vi.fn();
      dest.on.error(listener);
      src.pipe(dest);
      src.emit.error('fail');
      expect(listener).toHaveBeenCalledWith('fail');
    });

    it('forwards custom events with matching names', () => {
      const src = createEmitter<void>({ status: event<string>() });
      const dest = createEmitter<void>({ status: event<string>() });
      const listener = vi.fn();
      dest.on.status(listener);
      src.pipe(dest);
      src.emit.status('online');
      expect(listener).toHaveBeenCalledWith('online');
    });

    it('skips events that destination does not have', () => {
      const src = createEmitter<void>({ extra: event<string>() });
      const dest = createEmitter<void>();
      src.pipe(dest);
      // Should not throw — just skips 'extra'
      src.emit.extra('hello');
    });
  });

  describe('selective pipe (array of event names)', () => {
    it('only pipes listed events', () => {
      const src = createEmitter<string, string>();
      const dest = createEmitter<string, string>();
      const doneFn = vi.fn();
      const errorFn = vi.fn();
      dest.on.done(doneFn);
      dest.on.error(errorFn);
      src.pipe(dest, ['done']);
      src.emit.done('hello');
      src.emit.error('fail');
      expect(doneFn).toHaveBeenCalledWith('hello');
      expect(errorFn).not.toHaveBeenCalled();
    });
  });

  describe('mapped pipe (name mapping)', () => {
    it('maps source event to different destination event', () => {
      const src = createEmitter<void>({ received: event<string>() });
      const dest = createEmitter<void>({ data: event<string>() });
      const listener = vi.fn();
      dest.on.data(listener);
      src.pipe(dest, { received: 'data' });
      src.emit.received('payload');
      expect(listener).toHaveBeenCalledWith('payload');
    });

    it('does not pipe unmapped events', () => {
      const src = createEmitter<string>({ received: event<string>() });
      const dest = createEmitter<string>({ data: event<string>() });
      const doneFn = vi.fn();
      dest.on.done(doneFn);
      src.pipe(dest, { received: 'data' });
      src.emit.done('hello');
      expect(doneFn).not.toHaveBeenCalled();
    });
  });

  describe('pipe returns this for chaining', () => {
    it('returns the source emitter', () => {
      const src = createEmitter<string>();
      const dest = createEmitter<string>();
      const result = src.pipe(dest);
      expect(result).toBe(src);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run test/pipe.test.ts
```

Expected: PASS — pipe is implemented in emitter core (Task 4).

- [ ] **Step 3: Commit**

```bash
git add test/pipe.test.ts
git commit -m "test: add typed pipe tests"
```

---

### Task 11: Static Helpers & Promise Interop

**Files:**
- Create: `test/statics.test.ts`

- [ ] **Step 1: Write tests for static methods and promise()**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { JarvisEmitter } from '../src/emitter.js';
import { EmitterTimeoutError } from '../src/types.js';

describe('promise()', () => {
  it('resolves on done', async () => {
    const em = createEmitter<string>();
    setTimeout(() => em.emit.done('result'), 10);
    const result = await em.promise();
    expect(result).toBe('result');
  });

  it('rejects on error', async () => {
    const em = createEmitter<string, string>();
    setTimeout(() => em.emit.error('fail'), 10);
    await expect(em.promise()).rejects.toBe('fail');
  });

  it('rejects on catch', async () => {
    const em = createEmitter<string>();
    const err = new Error('exception');
    setTimeout(() => em.emit.catch(err), 10);
    await expect(em.promise()).rejects.toBe(err);
  });

  it('resolves immediately for sticky done', async () => {
    const em = createEmitter<string>();
    em.emit.done('early');
    const result = await em.promise();
    expect(result).toBe('early');
  });

  it('rejects with EmitterTimeoutError on timeout', async () => {
    const em = createEmitter<string>();
    // Never emit — let it timeout
    await expect(em.promise({ timeout: 50 })).rejects.toThrow(EmitterTimeoutError);
    await expect(em.promise({ timeout: 50 })).rejects.toThrow('50ms');
  });

  it('does not timeout if done fires in time', async () => {
    const em = createEmitter<string>();
    setTimeout(() => em.emit.done('fast'), 10);
    const result = await em.promise({ timeout: 500 });
    expect(result).toBe('fast');
  });
});

describe('JarvisEmitter.all()', () => {
  it('resolves with all results when all emitters complete', () => {
    const a = createEmitter<string>();
    const b = createEmitter<number>();
    const result = JarvisEmitter.all(a, b);
    const listener = vi.fn();
    result.on.done(listener);
    a.emit.done('hello');
    b.emit.done(42);
    expect(listener).toHaveBeenCalledWith(['hello', 42]);
  });

  it('resolves immediately for empty args', () => {
    const result = JarvisEmitter.all();
    const listener = vi.fn();
    result.on.done(listener);
    expect(listener).toHaveBeenCalledWith([]);
  });

  it('rejects if any emitter errors', () => {
    const a = createEmitter<string>();
    const b = createEmitter<number>();
    const result = JarvisEmitter.all(a, b);
    const errorFn = vi.fn();
    result.on.error(errorFn);
    a.emit.error('fail' as any);
    expect(errorFn).toHaveBeenCalledWith('fail');
  });
});

describe('JarvisEmitter.some()', () => {
  it('resolves with results and undefined for errors', () => {
    const a = createEmitter<string>();
    const b = createEmitter<number>();
    const result = JarvisEmitter.some(a, b);
    const listener = vi.fn();
    result.on.done(listener);
    a.emit.error('fail' as any);
    b.emit.done(42);
    expect(listener).toHaveBeenCalledWith([undefined, 42]);
  });

  it('resolves immediately for empty args', () => {
    const result = JarvisEmitter.some();
    const listener = vi.fn();
    result.on.done(listener);
    expect(listener).toHaveBeenCalledWith([]);
  });
});

describe('JarvisEmitter.immediate()', () => {
  it('creates an emitter with done already fired (sticky)', () => {
    const em = JarvisEmitter.immediate('cached');
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith('cached');
  });
});

describe('JarvisEmitter.emitifyFromAsync()', () => {
  it('wraps an async function — done on resolve', async () => {
    const asyncFn = async (x: number) => x * 2;
    const emitified = JarvisEmitter.emitifyFromAsync(asyncFn);
    const em = emitified(5);
    const result = await em.promise();
    expect(result).toBe(10);
  });

  it('wraps an async function — error on reject', async () => {
    const asyncFn = async () => { throw new Error('boom'); };
    const emitified = JarvisEmitter.emitifyFromAsync(asyncFn);
    const em = emitified();
    await expect(em.promise()).rejects.toThrow('boom');
  });
});

describe('JarvisEmitter.emitify() (deprecated)', () => {
  it('wraps a callback-style function', () => {
    const cbFn = (a: number, b: number, cb: (...args: any[]) => void) => {
      cb(null, a + b);
    };
    const emitified = JarvisEmitter.emitify(cbFn);
    const em = emitified(3, 4);
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith([null, 7]);
  });

  it('wraps a callback-style function with resultsAsArray=false', () => {
    const cbFn = (a: number, cb: (result: number) => void) => {
      cb(a * 2);
    };
    const emitified = JarvisEmitter.emitify(cbFn, false);
    const em = emitified(5);
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith(10);
  });
});

describe('onUnhandledException / offUnhandledException', () => {
  it('registers and fires unhandled exception callbacks', () => {
    const handler = vi.fn();
    JarvisEmitter.onUnhandledException(handler);

    const em = createEmitter<string>();
    const error = new Error('unhandled');
    em.on.catch(() => {
      throw error;
    });
    em.on.done(() => {
      throw new Error('trigger catch');
    });
    em.emit.done('hello');

    expect(handler).toHaveBeenCalled();
    JarvisEmitter.offUnhandledException(handler);
  });

  it('removes unhandled exception callback', () => {
    const handler = vi.fn();
    JarvisEmitter.onUnhandledException(handler);
    JarvisEmitter.offUnhandledException(handler);

    const em = createEmitter<string>();
    em.on.catch(() => {
      throw new Error('unhandled');
    });
    em.on.done(() => {
      throw new Error('trigger');
    });
    em.emit.done('hello');

    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run test/statics.test.ts
```

Expected: PASS — all static methods and promise() are implemented in Task 4.

- [ ] **Step 3: Commit**

```bash
git add test/statics.test.ts
git commit -m "test: add static helpers and promise interop tests"
```

---

### Task 12: Debug Registry

**Files:**
- Create: `src/registry.ts`
- Create: `test/registry.test.ts`
- Modify: `src/emitter.ts` (integrate registry)

- [ ] **Step 1: Write failing tests for registry**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { registry } from '../src/registry.js';
import { event } from '../src/roles.js';

beforeEach(() => {
  registry.enable();
  registry.clear();
});

describe('registry', () => {
  describe('list()', () => {
    it('lists registered emitters', () => {
      const em = createEmitter<string>({}, { label: 'TestEmitter' });
      const list = registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('TestEmitter');
    });

    it('includes event names', () => {
      const em = createEmitter<string>({
        status: event<string>(),
      }, { label: 'Sensor' });
      const list = registry.list();
      expect(list[0].events).toContain('done');
      expect(list[0].events).toContain('error');
      expect(list[0].events).toContain('status');
    });

    it('includes listener counts', () => {
      const em = createEmitter<string>({
        status: event<string>(),
      }, { label: 'Sensor' });
      em.on.done(() => {});
      em.on.done(() => {});
      em.on.status(() => {});
      const list = registry.list();
      expect(list[0].listeners['done']).toBe(2);
      expect(list[0].listeners['status']).toBe(1);
    });
  });

  describe('find()', () => {
    it('finds by label substring', () => {
      createEmitter<void>({}, { label: 'SensorService' });
      createEmitter<void>({}, { label: 'HttpTransport' });
      const results = registry.find('Sensor');
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('SensorService');
    });

    it('finds by event name', () => {
      createEmitter<void>({ status: event() }, { label: 'A' });
      createEmitter<void>({ data: event() }, { label: 'B' });
      const results = registry.find({ event: 'status' });
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('A');
    });
  });

  describe('onEmit()', () => {
    it('fires callback on any emission from any emitter', () => {
      const handler = vi.fn();
      registry.onEmit(handler);
      const em = createEmitter<string>({}, { label: 'Test' });
      em.emit.done('hello');
      expect(handler).toHaveBeenCalledWith({
        label: 'Test',
        event: 'done',
        data: 'hello',
      });
    });

    it('returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = registry.onEmit(handler);
      unsub();
      const em = createEmitter<string>({}, { label: 'Test' });
      em.emit.done('hello');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('auto-deregister on destroy', () => {
    it('removes emitter from list on destroy', () => {
      const em = createEmitter<void>({}, { label: 'Temp' });
      expect(registry.list()).toHaveLength(1);
      em.destroy();
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('disable()', () => {
    it('makes all methods no-ops', () => {
      registry.disable();
      createEmitter<void>({}, { label: 'Ghost' });
      expect(registry.list()).toHaveLength(0);
    });

    it('can be re-enabled', () => {
      registry.disable();
      registry.enable();
      createEmitter<void>({}, { label: 'Visible' });
      expect(registry.list()).toHaveLength(1);
    });
  });

  describe('clear()', () => {
    it('removes all entries', () => {
      createEmitter<void>({}, { label: 'A' });
      createEmitter<void>({}, { label: 'B' });
      expect(registry.list()).toHaveLength(2);
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/registry.test.ts
```

Expected: FAIL — cannot find `../src/registry.js`.

- [ ] **Step 3: Implement src/registry.ts**

```ts
import type { RegistryEntry, RegistryEmitEvent, Unsubscribe, Listener } from './types.js';

interface RegisteredEmitter {
  ref: WeakRef<any>;
  label: string;
  getEvents: () => string[];
  getListenerCounts: () => Record<string, number>;
}

class EmitterRegistry {
  private _entries: RegisteredEmitter[] = [];
  private _emitListeners: Listener<RegistryEmitEvent>[] = [];
  private _enabled = true;

  register(
    emitter: any,
    label: string,
    getEvents: () => string[],
    getListenerCounts: () => Record<string, number>,
  ): void {
    if (!this._enabled) return;
    this._entries.push({
      ref: new WeakRef(emitter),
      label,
      getEvents,
      getListenerCounts,
    });
  }

  deregister(emitter: any): void {
    this._entries = this._entries.filter((e) => e.ref.deref() !== emitter);
  }

  notifyEmit(label: string, event: string, data: unknown): void {
    if (!this._enabled) return;
    const payload: RegistryEmitEvent = { label, event, data };
    for (const listener of this._emitListeners) {
      listener(payload);
    }
  }

  list(): RegistryEntry[] {
    if (!this._enabled) return [];
    this._pruneCollected();
    return this._entries.map((e) => ({
      label: e.label,
      events: e.getEvents(),
      listeners: e.getListenerCounts(),
    }));
  }

  find(query: string | { event: string }): RegistryEntry[] {
    if (!this._enabled) return [];
    this._pruneCollected();
    if (typeof query === 'string') {
      return this.list().filter((e) => e.label.includes(query));
    }
    return this.list().filter((e) => e.events.includes(query.event));
  }

  onEmit(listener: Listener<RegistryEmitEvent>): Unsubscribe {
    this._emitListeners.push(listener);
    return () => {
      const idx = this._emitListeners.indexOf(listener);
      if (idx !== -1) {
        this._emitListeners.splice(idx, 1);
      }
    };
  }

  disable(): void {
    this._enabled = false;
  }

  enable(): void {
    this._enabled = true;
  }

  clear(): void {
    this._entries = [];
    this._emitListeners = [];
  }

  get enabled(): boolean {
    return this._enabled;
  }

  private _pruneCollected(): void {
    this._entries = this._entries.filter((e) => e.ref.deref() !== undefined);
  }
}

export const registry = new EmitterRegistry();
```

- [ ] **Step 4: Integrate registry into emitter.ts**

Add import at top of `src/emitter.ts`:

```ts
import { registry } from './registry.js';
```

Add to end of `JarvisEmitter` constructor, after building namespaces:

```ts
    // Register with debug registry
    if (registry.enabled) {
      registry.register(
        this,
        this._label,
        () => [...this._interfaces.keys()],
        () => {
          const counts: Record<string, number> = {};
          for (const [name, entry] of this._interfaces) {
            if (entry.listeners.length > 0) {
              counts[name] = entry.listeners.length;
            }
          }
          return counts;
        },
      );
    }
```

Add to `destroy()` method, before setting `this._destroyed = true`:

```ts
    registry.deregister(this);
```

Add to `_emitInternal` method, after the listener loop and auto-emits (at the very end of the method, before the closing brace):

```ts
    // Notify registry (but not for always/tap auto-emits — those are internal)
    registry.notifyEmit(this._label, name, value);
```

- [ ] **Step 5: Run registry tests**

```bash
npx vitest run test/registry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full test suite to verify no regressions**

```bash
npx vitest run
```

Expected: PASS — all test files pass.

- [ ] **Step 7: Commit**

```bash
git add src/registry.ts src/emitter.ts test/registry.test.ts
git commit -m "feat: add debug registry with auto-register, find, and onEmit"
```

---

### Task 13: Exports Barrel & Type Tests

**Files:**
- Modify: `src/index.ts`
- Modify: `test/types.test.ts` (append full API type assertions)

- [ ] **Step 1: Write src/index.ts**

```ts
// Factory
export { createEmitter, JarvisEmitter } from './emitter.js';

// Role helpers
export { event, notify } from './roles.js';

// Debug registry
export { registry } from './registry.js';

// Error types
export { EmitterTimeoutError } from './types.js';

// Type exports
export type {
  DefaultInterfaces,
  EmitterSchema,
  EmitterOptions,
  RoleConfig,
  PayloadOf,
  InterfaceMap,
  TapPayload,
  Unsubscribe,
  Listener,
  TransformFn,
  RegistryEntry,
  RegistryEmitEvent,
} from './types.js';
```

- [ ] **Step 2: Append full API type assertions to test/types.test.ts**

Append to `test/types.test.ts`:

```ts
import type { InterfaceMap, DefaultInterfaces } from '../src/types.js';

// ─── createEmitter type inference ───────────────────────────────
// These are compile-time only — they verify the TypeScript types work correctly.
// If any assertion fails, `tsc --noEmit` will report an error.

// Note: These use `import(...)` type-only references since we cannot import
// runtime values in a pure type test file that is checked with tsc --noEmit.
// The actual runtime behavior is tested in the .test.ts files.

// Verify InterfaceMap merges defaults with schema correctly
{
  type Schema = {
    status: RoleConfig<string>;
    progress: RoleConfig<number>;
  };
  type Map = InterfaceMap<boolean, Error, Schema>;

  // Default interfaces
  type _done = Assert<AssertEqual<Map['done'], boolean>>;
  type _error = Assert<AssertEqual<Map['error'], Error>>;
  type _always = Assert<AssertEqual<Map['always'], boolean | Error>>;
  type _catch = Assert<AssertEqual<Map['catch'], Error>>;

  // Schema interfaces
  type _status = Assert<AssertEqual<Map['status'], string>>;
  type _progress = Assert<AssertEqual<Map['progress'], number>>;
}

// Verify unknown defaults
{
  type Map = InterfaceMap<unknown, unknown, {}>;
  type _done = Assert<AssertEqual<Map['done'], unknown>>;
  type _error = Assert<AssertEqual<Map['error'], unknown>>;
}

// Verify void custom events (no generic on helper)
{
  type Schema = {
    stop: RoleConfig<void>;
  };
  type Map = InterfaceMap<string, Error, Schema>;
  type _stop = Assert<AssertEqual<Map['stop'], void>>;
  type _done = Assert<AssertEqual<Map['done'], string>>;
}
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Verify all runtime tests still pass**

```bash
npx vitest run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts test/types.test.ts
git commit -m "feat: add exports barrel and comprehensive type assertions"
```

---

### Task 14: Build & Publish Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

Expected: PASS — no type errors.

- [ ] **Step 2: Build the library**

```bash
npm run build
```

Expected: PASS — `dist/` created with `.js`, `.d.ts`, `.d.ts.map`, and `.js.map` files.

- [ ] **Step 3: Verify dist output structure**

```bash
ls dist/
```

Expected output includes:
```
emitter.d.ts
emitter.d.ts.map
emitter.js
emitter.js.map
index.d.ts
index.d.ts.map
index.js
index.js.map
registry.d.ts
registry.d.ts.map
registry.js
registry.js.map
roles.d.ts
roles.d.ts.map
roles.js
roles.js.map
types.d.ts
types.d.ts.map
types.js
types.js.map
```

- [ ] **Step 4: Verify package exports resolve**

```bash
node -e "import('jarvis-emitter').then(m => console.log(Object.keys(m)))" 2>/dev/null || node --input-type=module -e "import { createEmitter, event, notify, registry, JarvisEmitter } from './dist/index.js'; console.log('OK:', typeof createEmitter, typeof event, typeof notify, typeof registry, typeof JarvisEmitter);"
```

Expected: `OK: function function function object function`

- [ ] **Step 5: Dry-run npm pack**

```bash
npm pack --dry-run
```

Expected: Lists only `dist/` files + `package.json` + `LICENSE` + `README.md`. No `src/`, no `test/`, no `v3-reference/`.

- [ ] **Step 6: Run full test suite one final time**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: All tests pass, no type errors.

- [ ] **Step 7: Commit any fixes and tag**

```bash
git add -A
git status
# Only commit if there are changes
git diff --cached --quiet || git commit -m "chore: verify build and publish pipeline"
```

---

## Spec Coverage Checklist

| Spec Section | Task(s) |
|---|---|
| 1. Package Structure & Build | Task 1, Task 14 |
| 2. Core API — createEmitter & Role Helpers | Task 2, 3, 4, 5 |
| 3. Transform — Replacing Middleware | Task 8 |
| 4. Subscriptions — on, once, off, subscribe | Task 4, 7 |
| 5. Typed Pipe | Task 10 |
| 6. Debug Registry | Task 12 |
| 7. Static Helpers & Promise Interop | Task 11 |
| 8. destroy() & Lifecycle | Task 9 |
| 9. Exports | Task 13 |
| 10. Claude Code Skills | Post-implementation (separate task) |

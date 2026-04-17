# jarvis-emitter v4 — Design Spec

## Overview

Rewrite jarvis-emitter from plain JavaScript + hand-maintained `.d.ts` to a modern TypeScript ESM library. This is a major (breaking) version bump that replaces the boilerplate-heavy `extend()` chain API with a schema-first declarative approach inspired by Zod/tRPC patterns.

**Primary goals:**
- Eliminate the boilerplate that drives developers to `any`-escape the type system
- Ship pure ESM TypeScript with compiled output to npm
- Modernize the API surface while keeping the core emitter semantics
- Add debug/inspect tooling for the native-to-JS bridge

**Non-goals:**
- CJS/dual-publish support (monorepo is all TypeScript, bundler-resolved)
- Runtime schema validation (designed as opt-in hook, not built-in yet)

## Context

jarvis-emitter is used in the Jarvis monorepo (pnpm workspace) as an npm-installed package. The monorepo stack is: native part → framework → service clients → frontend (TypeScript). The emitter sits in service clients and API clients, bridging native status changes to the frontend. Consumers use webpack today, migrating to vite/esbuild. Target runtimes: Node 18/22+ and Electron.

---

## 1. Package Structure & Build

```
jarvis-emitter/
  src/
    index.ts              — main export barrel
    emitter.ts            — JarvisEmitter class
    roles.ts              — event(), notify() helpers
    types.ts              — shared type definitions
    registry.ts           — debug registry singleton
    transform.ts          — transform system (replaces middleware)
  dist/                   — tsc output (git-ignored, npm-published)
    *.js + *.d.ts + *.d.ts.map
  test/
    functionality.test.ts — rewritten in TS, vitest
    types.test.ts         — compile-time type assertions
  package.json
  tsconfig.json
```

### package.json (key fields)

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=18" }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "sourceMap": true
  }
}
```

### Build tooling

- Build: `tsc` only — no bundler needed for a library
- Tests: vitest (ESM-native, replaces mocha/chai)
- No CJS output — pure ESM

---

## 2. Core API — createEmitter & Role Helpers

### Factory function

```ts
import { createEmitter, event, notify } from 'jarvis-emitter';
```

`createEmitter<DoneType = unknown, ErrorType = unknown>(schema?, options?)` — factory function, not `new` constructor.

- `DoneType` defaults to `unknown` — compiles without a generic, but listeners receive `unknown` which forces narrowing before use (type assertions are prohibited by linter in the monorepo, so this effectively pushes developers to type upfront)
- `ErrorType` defaults to `unknown` — same rationale

### Default interfaces

Every emitter ships with `done`, `error`, `always`, `catch`, `tap` — derived automatically from `DoneType` and `ErrorType`. These are never declared in the schema.

### Role helpers

Two role helpers for custom events:

- `event<T>(options?)` — for events that occur during operation (status changes, data arrivals)
- `notify<T>(options?)` — for notifications/commands sent during operation

Options: `{ sticky?: boolean, stickyLast?: boolean }`

No generic on the helper = `void` payload.

### Usage examples

```ts
// Basic: just done/error
const req = createEmitter<AgeRangeResult>();
req.on.done((result) => result.ageRange);  // AgeRangeResult
req.emit.done({ ageRange: 18 });

// With custom error type
const req2 = createEmitter<AgeRangeResult, ServiceError>();
req2.on.error((err) => err.code);  // ServiceError

// With custom events
const sensor = createEmitter<SensorReading>({
  calibrated: event({ sticky: true }),
  status:     notify<SensorStatus>(),
});

sensor.on.done((r) => r.value);          // SensorReading
sensor.on.calibrated(() => {});           // void
sensor.on.status((s) => s.health);        // SensorStatus
```

### What's dropped from v3

- `JarvisEmitterInterfaceBuilder` class — replaced by plain schema objects
- `.extend()` chaining — replaced by schema declaration at creation
- Dynamic properties (`emitter.sensorData`, `emitter.callSensorData`) — use `on/emit/off` namespaces
- `description` field on interface properties — never used at runtime
- `observe` role — no distinct use cases found; `event`/`notify` cover all needs. Can be revisited during monorepo migration.
- `call` namespace — renamed to `emit` (standard naming)

---

## 3. Transform — Replacing Middleware

Two APIs replacing the old `middleware` namespace.

### transformError — the 90% case

Declared at creation time:

```ts
const req = createEmitter<AgeRangeResult, ServiceError>({}, {
  transformError: (raw) => stringToError(String(raw)),
});

req.on.error((err) => err.code);  // ServiceError
```

### transform namespace — per-event transforms

```ts
sensor.transform.done((raw) => normalizeReading(raw));
sensor.transform.status((raw) => raw.toUpperCase());
```

### Key differences from v3 middleware

| v3 middleware | v4 transform |
|---|---|
| `(next, value) => next(modified)` — express-style | `(value) => modified` — pure return |
| Could skip `next()` to swallow events | Always passes through |
| Side effects mixed in | Side effects belong in `on` listeners |
| Chainable via `next` callback | Composable — multiple transforms pipe sequentially |

### Composition

Multiple transforms on the same event **compose**: output of one feeds into the next, in registration order. This is predictable and matches the pipeline mental model.

Transform return types must be compatible: the output type of transform N becomes the input type of transform N+1, and the final output type is what listeners receive. TypeScript enforces this at compile time.

### Migration example

```ts
// BEFORE (v3) — middleware doing two jobs
this.middleware.removed((next, device) => {
    next(device);                                    // pass through
    this.call.changed({ device, type: "removed" });  // side effect
});

// AFTER (v4) — separated concerns
sensor.on.removed((device) => {
    sensor.emit.changed({ device, type: "removed" });
});
// No transform needed — the value wasn't being transformed
```

---

## 4. Subscriptions — on, once, off

### on — returns unsubscribe function

```ts
const unsub = sensor.on.done((reading) => {
  console.log(reading.value);
});
unsub();  // clean removal
```

Key change from v3: `on.done(cb)` returns an **unsubscribe function** instead of `this`. This eliminates the need for `off` in most cases.

### once — auto-unsubscribe after first emission

```ts
sensor.once.done((reading) => {
  console.log("first reading:", reading.value);
});
```

### off — bulk removal

Kept for the "remove all listeners" case:

```ts
sensor.off.done();           // remove all done listeners
sensor.off.done(specificCb); // remove one specific listener
```

### subscribe — bulk registration helper

```ts
const unsub = sensor.subscribe({
  done:   (reading) => handleReading(reading),
  error:  (err) => handleError(err),
  status: (s) => handleStatus(s),
});
// Returns a single unsub that removes all of them
```

Fully typed: only schema keys are valid, payload types flow through.

### Chaining

`on.done(cb)` no longer returns the emitter (returns unsub instead). Chaining like `emitter.on.done(cb).on.error(cb)` is replaced by sequential calls or `subscribe()`. This is an accepted trade-off.

---

## 5. Typed Pipe

### Basic pipe

```ts
source.pipe(destination);
// All matching event names forwarded, type-checked at compile time
```

### Selective pipe

```ts
source.pipe(destination, ['done', 'status']);
// Only listed events. Array is type-checked.
```

### Mapped pipe

```ts
raw.pipe(parsed, { received: 'data' });
// raw.emit.received(buf) → parsed.emit.data(buf)
// Payload types must be compatible
```

### Type safety rules

- Basic `pipe(dest)` — destination must have all same event names with compatible payloads. Superset on destination is OK.
- Selective `pipe(dest, keys[])` — only listed names checked for compatibility.
- Mapped `pipe(dest, mapping)` — source payload must be assignable to destination payload for each mapping.

### Constraints

- No transform during pipe — use `transform` on destination or listener+emit pattern
- Synchronous forwarding, same as v3

---

## 6. Debug Registry

### Auto-registration

```ts
import { registry } from 'jarvis-emitter';

const sensor = createEmitter<SensorReading>({
  status: event<SensorStatus>(),
}, {
  label: 'SensorService',  // optional, for identification
});
```

Emitters auto-register on creation when registry is enabled. Auto-deregister on `destroy()`.

### Inspection

```ts
registry.list();
// [
//   { label: 'SensorService', events: ['done','error','always','catch','tap','status'],
//     listeners: { done: 2, status: 1 } },
// ]

registry.find('Sensor');              // filter by label substring
registry.find({ event: 'status' });   // find by event name
```

### Global emission listener

```ts
registry.onEmit((entry) => {
  console.log(`[${entry.label}] ${entry.event} emitted`, entry.data);
});
// Single hook for logging/tracing across ALL registered emitters
```

### Lifecycle & production

- Uses **WeakRef** internally — garbage collected emitters silently disappear, no memory leaks
- `registry.disable()` — all methods become no-ops, `createEmitter` skips registration. Zero overhead in production.
- No label = auto-generated id (`emitter_1`, `emitter_2`)

---

## 7. Static Helpers & Promise Interop

### promise() with timeout

```ts
const result = await sensor.promise();                    // waits forever
const result = await sensor.promise({ timeout: 5000 });   // rejects after 5s

// Timeout rejects with EmitterTimeoutError
try {
  await sensor.promise({ timeout: 5000 });
} catch (e) {
  if (e instanceof EmitterTimeoutError) {
    console.log(`Timed out after ${e.ms}ms`);
  }
}
```

### all — tuple-typed

```ts
const result = JarvisEmitter.all(a, b, c);
result.on.done(([str, num, bool]) => {
  // str: string, num: number, bool: boolean — per-position types
});
```

Rejects if ANY emitter errors.

### some — tuple-typed with undefined

```ts
const result = JarvisEmitter.some(a, b);
result.on.done(([reading, config]) => {
  // reading: SensorReading | undefined
  // config: ConfigData | undefined
});
```

Always resolves — errors become `undefined`.

### immediate

```ts
const em = JarvisEmitter.immediate<SensorReading>(cachedReading);
em.on.done((r) => r.value);  // fires immediately, typed
```

### emitifyFromAsync — fully typed

```ts
const fetchEmitter = JarvisEmitter.emitifyFromAsync(fetchSensorData);
const em = fetchEmitter(sensorId);
em.on.done((data) => data.readings);
```

### emitify — deprecated, kept for backward compat

```ts
/**
 * @deprecated Use async/await with emitifyFromAsync instead.
 * Kept for legacy callback-style APIs (fs callbacks, meaco generator flows).
 */
static emitify(
  fn: (...args: any[]) => any,
  resultsAsArray?: boolean,
  cbIndex?: number,
): (...callArgs: any[]) => JarvisEmitter<unknown>;
```

Active usages exist in the monorepo (fs callbacks, yauzl, diskusage, setTimeout-as-delay in meaco generators). Will be removed when those files migrate from meaco to async/await.

---

## 8. destroy() & Lifecycle

```ts
sensor.destroy();
```

- Purges all listeners, transforms, sticky state
- Auto-deregisters from debug registry
- Marks emitter as destroyed — subsequent `on`/`emit`/`off` calls throw `Error`
- Same semantics as v3

---

## 9. Exports

```ts
// Main factory
export { createEmitter } from './emitter';

// Role helpers
export { event, notify } from './roles';

// Class (for static methods, instanceof checks, type usage)
export { JarvisEmitter } from './emitter';

// Debug registry
export { registry } from './registry';

// Error types
export { EmitterTimeoutError } from './emitter';

// Type exports
export type {
  DefaultInterfaces,
  EmitterSchema,
  EmitterOptions,
  RegistryEntry,
} from './types';
```

---

## 10. Claude Code Skills

### jarvis-emitter:test

Run and validate:
- Run `vitest` suite
- Run `tsc --noEmit` for type checking
- Validate that type tests pass (compile-time assertions)
- Check no `any` leaks in new code

### jarvis-emitter:build

Build and verify publishable output:
- Run `tsc` to produce `dist/`
- Verify `package.json` exports resolve correctly
- Dry-run `npm pack` to check what would be published

### jarvis-emitter:review-emitter-usage

Review emitter patterns in consuming code:
- Untyped emitters (`any` or missing generics)
- Unused subscriptions (no `unsub` captured, no `destroy`)
- `emitify` usage that could be `emitifyFromAsync`
- Missing error handlers

### jarvis-emitter:migrate-v3

Migration assistant for v3 → v4:
- `extend()` chains → schema declaration
- `middleware` → `transform`/`transformError`
- Dynamic props → `on`/`emit`/`off` namespaces
- `require()` → ESM `import`
- `call` → `emit`

---

## Migration Path

1. Publish v4 to npm
2. Update monorepo import: `import { createEmitter, event, notify } from 'jarvis-emitter'`
3. Use `jarvis-emitter:migrate-v3` skill to convert usage patterns file-by-file
4. Monorepo-wide search for remaining `emitify` usages — convert to `emitifyFromAsync` + async/await where meaco is already removed
5. Remove `emitify` in a future minor version once all usages are migrated

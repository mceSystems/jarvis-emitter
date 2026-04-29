# jarvis-emitter

A typed, schema-first event emitter with transforms, sticky events, promise interop, and a debug registry. Pure ESM, written in TypeScript.

> **v4** is a breaking rewrite of the v3 plain-JS library. The `extend()` chain API, `call` namespace, `middleware` system, and CJS output are gone — see the [v3 → v4 migration](#v3--v4-migration) section.

## Install

```bash
npm install jarvis-emitter
```

The package is published as **ESM only**. Requires Node 18+.

```ts
import { createEmitter, event, notify, doneType, errorType, registry } from 'jarvis-emitter';
```

## Quick Start

```ts
import { createEmitter, doneType, errorType } from 'jarvis-emitter';

const req = createEmitter({
  done: doneType<{ ageRange: number }>(),
  error: errorType<Error>(),
});

req.on.done((result) => console.log('Done:', result.ageRange));
req.on.error((err) => console.error('Error:', err.message));

req.emit.done({ ageRange: 18 });
```

## Core Concepts

### Schema-first design

You declare the event shape up front. All payload types flow from a single inferred schema generic — no boilerplate type arguments per emitter.

```ts
const sensor = createEmitter({
  done:       doneType<SensorReading>(),
  error:      errorType<ServiceError>(),
  calibrated: event({ sticky: true }),
  status:     notify<SensorStatus>(),
});

sensor.on.done((r) => r.value);     // SensorReading
sensor.on.status((s) => s.health);  // SensorStatus
sensor.on.calibrated(() => {});     // void
```

### Default interfaces

Every emitter ships with five built-ins:

| Name      | Payload type                           | Notes                                                  |
| --------- | -------------------------------------- | ------------------------------------------------------ |
| `done`    | from `doneType<T>()`, else `unknown`   | Sticky by default                                      |
| `error`   | from `errorType<T>()`, else `unknown`  | Sticky by default                                      |
| `always`  | `done \| error`                        | Sticky; fires after either `done` or `error`           |
| `catch`   | `Error`                                | Catches exceptions thrown inside listeners             |
| `tap`     | `{ name, role, data }`                 | Fires for every other emission (debug/tracing)         |

`always`, `catch`, and `tap` are reserved — they cannot be redeclared in a schema.

### Role helpers

| Helper             | Purpose                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| `event<T>(opts?)`  | Custom event during operation (status changes, data arrivals)                   |
| `notify<T>(opts?)` | Custom notification/command                                                     |
| `doneType<T>()`    | Phantom marker that types the default `done` payload                            |
| `errorType<T>()`   | Phantom marker that types the default `error` payload                           |

`event` / `notify` accept `{ sticky?: boolean, stickyLast?: boolean }`. No generic argument means the payload is `void`.

### Unknown by default

Omitting `doneType` / `errorType` leaves those payloads as `unknown`, nudging callers to narrow at the boundary instead of leaking `any`:

```ts
const bare = createEmitter();
bare.on.done((v) => {
  // v: unknown — narrow before use
});
```

## Subscriptions

### `on` — returns an unsubscribe

```ts
const unsub = sensor.on.done((r) => console.log(r.value));
unsub();
```

### `once` — auto-unsubscribes after first emission

```ts
sensor.once.done((r) => console.log('first reading:', r.value));
```

Sticky events replay once into `once`, then the listener detaches.

### `off` — bulk or specific removal

```ts
sensor.off.done();              // remove every done listener
sensor.off.done(specificListener); // remove one
```

### `subscribe` — bulk registration

```ts
const unsub = sensor.subscribe({
  done:   (r) => handleReading(r),
  error:  (e) => handleError(e),
  status: (s) => handleStatus(s),
});
unsub(); // detaches all of the above
```

Only schema keys are valid; payload types flow through.

## Emitting

```ts
sensor.emit.done({ value: 42 });
sensor.emit.status({ health: 'ok' });
sensor.emit.error(new ServiceError('boom'));
```

The `emit` namespace replaces v3's `call`.

## Sticky Events

Sticky events replay to late subscribers.

```ts
const em = createEmitter({ done: doneType<string>() });
em.emit.done('already resolved');
em.on.done((v) => console.log(v)); // 'already resolved'
```

`done` and `error` are sticky by default. For custom events, opt in:

```ts
const em = createEmitter({
  log:    event<string>({ sticky: true }),     // replay every emission
  status: event<string>({ stickyLast: true }), // replay only the last one
});
```

## Transforms

Transforms run before listeners and **compose** in registration order. Returns are pure — no `next()` callback.

```ts
const em = createEmitter({ done: doneType<number>() });
em.transform.done((v) => v * 2);
em.transform.done((v) => v + 1);
em.on.done((v) => console.log(v)); // emit.done(5) → 11
```

Transforms also apply to sticky replay.

### `transformError` option

Coerce raw error values into a typed error class at creation time:

```ts
class ServiceError extends Error {
  constructor(msg: string, public code: number) { super(msg); }
}

const req = createEmitter(
  {
    done:  doneType<string>(),
    error: errorType<ServiceError>(),
  },
  {
    transformError: (raw) => new ServiceError(String(raw), 500),
  },
);
```

`transformError` runs first, then any `transform.error(...)` you register.

## Pipe

Forward emissions to another emitter.

```ts
// All matching event names
src.pipe(dest);

// Selected names only
src.pipe(dest, ['done', 'status']);

// Rename: src.received → dest.data
src.pipe(dest, { received: 'data' });
```

Returns the source emitter for chaining. Forwarding is synchronous; events the destination doesn't have are silently skipped.

## Promise Interop

```ts
const result = await sensor.promise();
// or with a timeout
const result = await sensor.promise({ timeout: 5000 });
```

Resolves on `done`, rejects on `error` or `catch`. On timeout, rejects with `EmitterTimeoutError`:

```ts
import { EmitterTimeoutError } from 'jarvis-emitter';

try {
  await sensor.promise({ timeout: 5000 });
} catch (e) {
  if (e instanceof EmitterTimeoutError) {
    console.log(`Timed out after ${e.ms}ms`);
  }
}
```

## Static Helpers

```ts
import { JarvisEmitter } from 'jarvis-emitter';

// Wait for all — rejects if any errors
JarvisEmitter.all(a, b, c).on.done(([va, vb, vc]) => { /* ... */ });

// Wait for all — errors become undefined, never rejects
JarvisEmitter.some(a, b).on.done(([va, vb]) => { /* ... */ });

// Pre-resolved (sticky)
const cached = JarvisEmitter.immediate(reading);

// Wrap an async function
const fetchEm = JarvisEmitter.emitifyFromAsync(fetchSensorData);
const em = fetchEm(sensorId);
em.on.done((data) => { /* ... */ });
```

`JarvisEmitter.emitify(fn, resultsAsArray?, cbIndex?)` is **deprecated**, kept for legacy callback-style APIs. Prefer `emitifyFromAsync` with `async`/`await`.

## Lifecycle

```ts
sensor.destroy();
```

Purges all listeners, transforms, and sticky state, and deregisters from the debug registry. Subsequent calls to `on` / `emit` / `off` / `transform` / `subscribe` throw.

## Debug Registry

Every emitter auto-registers on creation. Pass a `label` for identification.

```ts
import { registry } from 'jarvis-emitter';

const sensor = createEmitter(
  { done: doneType<SensorReading>(), status: event<SensorStatus>() },
  { label: 'SensorService' },
);

registry.list();
// [{ label: 'SensorService',
//    events: ['done','error','always','catch','tap','status'],
//    listeners: { /* per-event counts */ } }]

registry.find('Sensor');            // by label substring
registry.find({ event: 'status' }); // by event name

registry.onEmit((e) => {
  console.log(`[${e.label}] ${e.event}`, e.data);
});
```

Internally uses `WeakRef` — garbage-collected emitters drop out of the list, no leaks. Call `registry.disable()` to make every method a no-op (zero overhead in production); `registry.enable()` / `registry.clear()` for tests.

## Unhandled Exceptions

If a listener on `catch` itself throws, the exception is dispatched to global handlers:

```ts
JarvisEmitter.onUnhandledException((err) => {
  console.error('unhandled in catch:', err);
});
```

Pair with `offUnhandledException` to detach.

## v3 → v4 Migration

| v3                                           | v4                                                       |
| -------------------------------------------- | -------------------------------------------------------- |
| `new JarvisEmitter().extend({ name, role })` | `createEmitter({ name: event<T>() })`                    |
| `.extend(...)` chaining                      | Single schema object at creation                         |
| `JarvisEmitter.role.event` / `.notify`       | `event()` / `notify()` helpers                           |
| `emitter.call.done(v)`                       | `emitter.emit.done(v)`                                   |
| `emitter.on.done(cb)` returning `this`       | Returns an unsubscribe function                          |
| `middleware.x((next, v) => next(v))`         | `transform.x((v) => v)` — pure return, composable        |
| `payload<T>()` / `withType<T>()`             | `event<T>()` / `doneType<T>()` / `errorType<T>()`        |
| `require('jarvis-emitter')` (CJS)            | `import { ... } from 'jarvis-emitter'` (ESM only)        |
| Dynamic props (`emitter.sensorData`)         | Use `on` / `emit` / `off` namespaces                     |
| `description` field on descriptors           | Removed                                                  |
| `observe` role                               | Removed — use `event` or `notify`                        |

## License

MIT

# jarvis-emitter

A typed, extensible event emitter with middleware support, sticky events, and promise interop.

## Install

```bash
npm install jarvis-emitter
```

The package is published as **CommonJS** (`module.exports`). Type definitions use `export =`, which matches that shape.

### Importing (JavaScript and TypeScript)

Pick one pattern:

| Style | Example |
|--------|---------|
| **CommonJS** | `const JarvisEmitter = require("jarvis-emitter");` |
| **TypeScript, no `esModuleInterop`** | `import JarvisEmitter = require("jarvis-emitter");` |
| **TypeScript / bundlers with `esModuleInterop: true`** | `import JarvisEmitter, { Role, payload, type DefaultInterfaces } from "jarvis-emitter";` |

**Types:** `Role`, `Property`, `PropertyDescriptor`, `DefaultInterfaces`, and `payload` live on the merged `JarvisEmitter` namespace in the typings. Destructured imports like `{ Role, payload }` work when `esModuleInterop` is enabled. With `import JarvisEmitter = require("jarvis-emitter")`, use `JarvisEmitter.Role`, `JarvisEmitter.payload`, and the same pattern for other names. At runtime, `JarvisEmitter.Role` and `JarvisEmitter.payload` are also available on the constructor object from JS.

## Quick Start

```js
const JarvisEmitter = require("jarvis-emitter");

const emitter = new JarvisEmitter();

emitter.on.done((result) => console.log("Done:", result));
emitter.on.error((err) => console.error("Error:", err));

emitter.call.done("success");
```

## Extending with Custom Events

```js
const emitter = new JarvisEmitter()
  .extend({ name: "progress", role: JarvisEmitter.role.event })
  .extend({ name: "status", role: JarvisEmitter.role.notify });

emitter.on.progress((pct) => console.log(`${pct}%`));
emitter.call.progress(42);
```

### TypeScript

Payload types for custom names are spelled with **`withType()`** (chain-friendly) or **`payload()`** (inline on the descriptor). The old **`extend<"name", Type>(...)`** generic style is not supported; use one of the patterns below.

**Chaining:** TypeScript only refines the emitter type from **chained** return values (e.g. `.withType<T>().extend(...).withType<U>().extend(...)`). If you assign `const em = new JarvisEmitter()` and call `em.extend(...)` several times without reassigning from the return value, the variable’s type does not pick up the new keys.

```typescript
import JarvisEmitter, { Role, payload, type DefaultInterfaces } from "jarvis-emitter";

type SensorStatus = {
	value: number;
	health: "ok" | "bad" | "error";
};

type DoneType = string;
type ErrorType = Error;

// Option 1 — withType(): separate payload type from the inferred event name (good for chains)
const emitter1 = new JarvisEmitter<DoneType, ErrorType>()
	.withType<SensorStatus>()
	.extend({ name: "changed", role: Role.event });

// Option 2 — payload(): inline emittedType without type assertions (runtime value is unused)
const emitter2 = new JarvisEmitter<DoneType, ErrorType>().extend({
	name: "changed",
	role: Role.event,
	emittedType: payload<SensorStatus>(),
});

// Option 3 — explicit interface map (best when you already model all events as one type)
interface SensorInterfaces extends DefaultInterfaces<DoneType, ErrorType> {
	changed: SensorStatus;
}

const emitter3 = new JarvisEmitter<DoneType, ErrorType, SensorInterfaces>().extend({
	name: "changed",
	role: Role.event,
});

emitter1.on.changed((pct) => {
	pct.health; // SensorStatus
});
emitter2.on.changed((pct) => {
	pct.value; // SensorStatus
});
emitter3.on.done((val) => {
	val; // string (DoneType)
});
```

New keys added with a plain descriptor (no `withType` / `payload` / interface entry) are typed as **`void`** payloads.

## Middleware

Transform emitted values before they reach listeners:

```js
emitter.middleware.done((next, val) => {
  next(val.toUpperCase());
});
```

## Sticky Events

Events that replay to late subscribers:

```js
const emitter = new JarvisEmitter();
emitter.call.done("already resolved");

// Late subscriber still receives the value
emitter.on.done((val) => console.log(val)); // "already resolved"
```

## Promise Interop

```js
const result = await emitter.promise();
```

## Static Helpers

```js
// Wait for all emitters
const all = JarvisEmitter.all(emitterA, emitterB);

// Wait for all, treating errors as undefined
const some = JarvisEmitter.some(emitterA, emitterB);

// Wrap an async function
const emitified = JarvisEmitter.emitifyFromAsync(fetchData);
```

## Default Events

Every emitter ships with: `done`, `error`, `always`, `catch`, `event`, `notify`, `tap`.

## License

MIT
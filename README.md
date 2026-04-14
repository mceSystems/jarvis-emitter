# jarvis-emitter

A typed, extensible event emitter with middleware support, sticky events, and promise interop.

## Install

```bash
npm install jarvis-emitter
```

## Quick Start

```js
const JarvisEmitter = require("jarvis-emitter");
// or ESM syntax
import JarvisEmitter, { Role, } from "jarvis-emitter";

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

```typescript
import JarvisEmitter, { Role, type DefaultInterfaces } from "jarvis-emitter";

type SensorStatus = {
	value: number;
	health: "ok" | "bad" | "error";
};

type DoneType = string;
type ErrorType = Error;

// Option #1 — infer types via .extend<K, V>(...)
const emitter1 = new JarvisEmitter<DoneType, ErrorType>().extend<"changed", SensorStatus>({
	name: "changed",
	role: Role.event,
});

// Option #2 — explicit interface (full control, best for many custom events)
interface SensorInterfaces extends DefaultInterfaces<DoneType, ErrorType> {
	changed: SensorStatus;
}

const emitter2 = new JarvisEmitter<DoneType, ErrorType, SensorInterfaces>().extend({
	name: "changed",
	role: Role.event,
});

emitter1.on.changed((pct) => {}); // pct: SensorStatus
emitter2.on.done((val) => {}); // val: string
```

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
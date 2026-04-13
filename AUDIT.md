# jarvis-emitter Audit Report

Comparison of runtime behavior (`index.js`) vs type declarations (`index.d.ts`).

---

## Critical — Type/Behavior Mismatches

### 1. `Role` enum typo: `"obsereve"` instead of `"observe"`

**d.ts line 6:**
```ts
observe = "obsereve"
```

**JS line 429:**
```js
observe: "observe"
```

Anyone comparing `Role.observe` against a runtime string will get a mismatch.

---

### 2. `Role` enum missing `start`

JS defines a `start` role:

```js
// index.js:427
static get role() {
  return {
    done: "done",
    start: "start",       // <-- missing from d.ts
    catchException: "catch",
    notify: "notify",
    event: "event",
    observe: "observe"
  };
}
```

The `Role` enum in d.ts has no `start` member. Code that uses `JarvisEmitter.role.start` has no type coverage.

---

### 3. `Property.role` is too restrictive

```ts
// index.d.ts:11
role: Role.event | Role.notify;
```

This means users can only `extend()` with `event` or `notify` roles. But JS also allows `observe` (and `start`) since only `done` and `catchException` are removed from `_allowedRoles` after construction. `Role.observe` should be included.

---

### 4. Constructor accepts an argument — d.ts says it doesn't

**JS:**
```js
constructor(interfaceDescriptor = [])
```

**d.ts:**
```ts
constructor();
```

Users can pass initial interface descriptors to the constructor, but the type says no parameters.

---

### 5. `extend()` accepts an array — d.ts says single object only

**JS:**
```js
extend(interfaceDescription = []) {
  if (!Array.isArray(interfaceDescription)) {
    interfaceDescription = [interfaceDescription];
  }
  // iterates over array...
}
```

**d.ts:**
```ts
extend<K extends string, V, T extends Property<K, V>>(interfaceProps: T): JarvisEmitter<...>;
```

The type only accepts a single `Property`. JS accepts `Property | Property[]`.

---

### 6. `Resolver` is typed as single-arg, JS is variadic

**d.ts:**
```ts
type Resolver<...> = (arg: Interfaces[K]) => J;
```

**JS:**
```js
const resolverCb = (...args) => { ... }
```

Callers can do `emitter.call.done(a, b, c)` at runtime, but the type only allows one argument. Listeners also receive `...resolveArgs` spread.

---

### 7. `Remover` returns `undefined` when called without a listener

**d.ts:**
```ts
type Remover<...> = (listener?: ...) => J;
```

Always returns `J`.

**JS:**
```js
const removerCb = (cb) => {
  if (!cb) {
    callbackArray.splice(0, callbackArray.length);
    return;       // <-- returns undefined
  }
  // ...
  return this;
};
```

When called with no argument (purge all listeners), returns `undefined` — breaks chaining.

---

### 8. `getRolesHandlers` has a second parameter not in d.ts

**d.ts:**
```ts
getRolesHandlers(role: Role): InterfaceEntry<...>[];
```

**JS:**
```js
getRolesHandlers(role, defaultsOnly) {
  if (undefined === defaultsOnly)
    return /* all */;
  if (defaultsOnly)
    return /* defaults only */;
  return /* user-created only */;
}
```

The `defaultsOnly?: boolean` parameter is untyped.

---

### 9. `DefaultInterfaces.always` type includes `Error` but `catch` never triggers `always`

```ts
always: DoneType | ErrorType | Error;
```

At runtime, `always` is only called when a handler with `role === "done"` resolves **and** the name isn't `"always"` itself:
```js
if (JarvisEmitter.role.done === property.role && "always" !== property.name) {
  this.call.always(...resolveArgs);
}
```

`catch` has role `catchException`, so it never triggers `always`. The `Error` in the union is unreachable — type should be `DoneType | ErrorType`.

---

## Moderate — Missing API Surface in d.ts

### 10. Shorthand instance accessors completely untyped

For every non-reserved interface name, JS creates direct accessors on the instance:

```js
// index.js:294-298
if (-1 === reservedInterfaceNames.indexOf(property.name)) {
  this[registerer] = registererCb;    // e.g. emitter.done(cb)
  this[remover] = removerCb;          // e.g. emitter.offDone(cb)
  this[resolver] = resolverCb;        // e.g. emitter.callDone(arg)
  this[middleware] = middlewareCb;     // e.g. emitter.middlewareDone(cb)
}
```

This means `emitter.done(cb)`, `emitter.error(cb)`, etc. work at runtime. The library's own `static all()` uses these:

```js
prom.done((result) => { ... }).error(promise.call.error);
```

None of these are in d.ts.

---

### 11. Missing static methods

| Method | JS | d.ts |
|---|---|---|
| `static immediate(result, role?, name?)` | line 505 | missing |
| `static emitify(fn, resultsAsArray?, cbIndex?)` | line 516 | missing |
| `static interfaceProperty()` | line 415 | missing |
| `static get role()` | line 423 | missing |
| `static onUnhandledException(cb)` | line 547 | missing |
| `static offUnhandledException(cb)` | line 551 | missing |

---

### 12. Missing `destroyed` instance property

JS sets `this.destroyed = false` in constructor and `this.destroyed = true` in `destroy()`. Not declared in d.ts.

---

### 13. `Property` interface missing `description` field

`JarvisEmitterInterfaceBuilder` has a `.description(desc)` method, so the built object can have a `description` field. The `Property` interface in d.ts doesn't include it.

---

## Minor — Consistency / Style Issues

### 14. `pipe()` has a duplicate guard condition

```js
// index.js:331
if (!pipedPromise || !pipedPromise) {  // same check twice
  return;   // returns undefined, d.ts says JarvisEmitter
}
```

Likely meant `!pipedPromise || !pipedPromise._nameMap` or similar. Also returns `undefined` on that branch — type says it always returns `JarvisEmitter`.

---

### 15. `JarvisEmitter.Role` (static prop) vs `static get role()` — two different role objects

```js
// static getter — line 423
static get role() {
  return { done, start, catchException, notify, event, observe };
}

// static property — line 574
JarvisEmitter.Role = { done, catchException, notify, event, observe };
// note: no "start"
```

Two role dictionaries exist at runtime with different keys. Only the `Role` enum is in d.ts.

---

### 16. `extend()` validation bug in JS

```js
// index.js:149
if (undefined === property.role && -1 !== this._allowedRoles.indexOf(property.role)) {
  continue;
}
```

This condition is `role === undefined && role IS in allowedRoles`. Since `undefined` is never in `_allowedRoles`, this branch is dead code. Likely should be `||` instead of `&&`:

```js
if (undefined === property.role || -1 === this._allowedRoles.indexOf(property.role)) {
```

---

### 17. Module export style mismatch

**JS:** `module.exports = JarvisEmitter` (CommonJS)
**d.ts:** `export default JarvisEmitter` (ES module default)

Works with `esModuleInterop: true`, but without it consumers need `import JarvisEmitter = require('jarvis-emitter')`.

---

## Summary Table

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Critical** | `Role.observe` value is `"obsereve"` (typo) |
| 2 | **Critical** | `Role` enum missing `start` |
| 3 | **Critical** | `Property.role` excludes `observe` (and `start`) |
| 4 | **Critical** | Constructor param untyped |
| 5 | **Critical** | `extend()` doesn't accept arrays |
| 6 | **Critical** | `Resolver` should be variadic |
| 7 | **Critical** | `Remover` returns `undefined` on purge-all |
| 8 | **Critical** | `getRolesHandlers` missing `defaultsOnly` param |
| 9 | **Critical** | `always` type includes unreachable `Error` |
| 10 | Moderate | Shorthand accessors (`.done()`, `.error()`, etc.) untyped |
| 11 | Moderate | 6 static methods missing from d.ts |
| 12 | Moderate | `destroyed` property missing from d.ts |
| 13 | Moderate | `Property.description` field missing |
| 14 | Minor | `pipe()` duplicate guard + returns `undefined` |
| 15 | Minor | Two different `Role` objects at runtime |
| 16 | Minor | Dead-code validation bug in `extend()` |
| 17 | Minor | CommonJS vs ES module default export |

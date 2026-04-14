# jarvis-emitter Audit Report

Comparison of runtime behavior (`index.js`) vs type declarations (`index.d.ts`).

## Resolution status (vs current tree)

| # | Status | Notes |
|---|--------|--------|
| 1 | **Fixed** | `Role.observe` is `"observe"` in `index.d.ts`. |
| 2 | **Fixed** | `Role.start` is present in `index.d.ts`. |
| 3 | **Fixed** | `Property` / `PropertyDescriptor` `role` includes `observe` and `start`. |
| 4 | **Fixed** | Constructor is `constructor(interfaceDescriptor?: Property<string, any>[]?)`. |
| 5 | **Fixed** | `extend` overloads accept `T \| T[]` / `PropertyDescriptor<K>[]`. |
| 6 | **Fixed** | `Resolver` is variadic (`...rest: unknown[]`). |
| 7 | **Fixed** | Runtime `removerCb` returns `this` when purging all; types match. |
| 8 | **Fixed** | `getRolesHandlers(role, defaultsOnly?: boolean)` is declared. |
| 9 | **Fixed** | `DefaultInterfaces.always` is `DoneType \| ErrorType` (no extra `Error`). |
| 10 | **Open** | Shorthand instance accessors still not on the class type. |
| 11 | **Open** | Several static helpers still missing from `index.d.ts` (see section). |
| 12 | **Open** | `destroyed` still not declared on the class. |
| 13 | **Open** | `Property.description` still not declared. |
| 14 | **Fixed** | `pipe`: single guard, early `return this` (aligned with d.ts). |
| 15 | **Open** | Two runtime role dictionaries (`JarvisEmitter.Role` vs `get role()`) unchanged. |
| 16 | **Open** | CJS export vs ESM-style default in typings (consumer/tsconfig concern). |

---

## Critical — Type/Behavior Mismatches

### 1. `Role` enum typo: `"obsereve"` instead of `"observe"`

**Status:** Fixed — enum member is `observe = "observe"`.

Previously in typings (wrong):

```ts
observe = "obsereve"
```

**JS line 429:**
```js
observe: "observe"
```

Anyone comparing `Role.observe` against a runtime string would have seen a mismatch before the typings were corrected.

---

### 2. `Role` enum missing `start`

**Status:** Fixed — `start` is in `Role` in `index.d.ts`.

JS defines a `start` role:

```js
// index.js:427
static get role() {
  return {
    done: "done",
    start: "start",
    catchException: "catch",
    notify: "notify",
    event: "event",
    observe: "observe"
  };
}
```

The `Role` enum in `index.d.ts` now includes `start`.

---

### 3. `Property.role` is too restrictive

**Status:** Fixed — `role` allows `event`, `notify`, `observe`, and `start`.

Previously typings were too narrow:

```ts
// index.d.ts:11
role: Role.event | Role.notify;
```

JS also allows `observe` and `start` (only `done` and `catchException` are removed from `_allowedRoles` after construction); typings now include those roles.

---

### 4. Constructor accepts an argument — d.ts says it doesn't

**Status:** Fixed — `constructor(interfaceDescriptor?: Property<string, any>[])` in `index.d.ts`.

**JS:**
```js
constructor(interfaceDescriptor = [])
```

Previously **d.ts** had `constructor();`. It now accepts an optional `Property<string, any>[]`.

---

### 5. `extend()` accepts an array — d.ts says single object only

**Status:** Fixed — overloads use `T | T[]` and `PropertyDescriptor<K> | PropertyDescriptor<K>[]`.

**JS:**
```js
extend(interfaceDescription = []) {
  if (!Array.isArray(interfaceDescription)) {
    interfaceDescription = [interfaceDescription];
  }
  // iterates over array...
}
```

Previously **d.ts** accepted only a single descriptor:

```ts
extend<...>(interfaceProps: T): JarvisEmitter<...>;
```

**d.ts** now accepts `T | T[]` (and the `PropertyDescriptor` overload accepts arrays). JS still accepts `Property | Property[]`.

---

### 6. `Resolver` is typed as single-arg, JS is variadic

**Status:** Fixed — `Resolver` includes `...rest: unknown[]`.

Previously **d.ts**:

```ts
type Resolver<...> = (arg: Interfaces[K]) => J;
```

**d.ts** now uses `(arg, ...rest: unknown[]) => JarvisEmitter<...>`.

**JS:**
```js
const resolverCb = (...args) => { ... }
```

---

### 7. `Remover` returns `undefined` when called without a listener

**Status:** Fixed — runtime returns `this` on purge-all; `Remover` return type is `JarvisEmitter<...>`.

**d.ts** types `Remover` as returning `JarvisEmitter<...>`.

**JS** (current): purge-all returns `this`:

```js
const removerCb = (cb) => {
  if (!cb) {
    callbackArray.splice(0, callbackArray.length);
    return this;
  }
  // ...
  return this;
};
```

Older versions returned bare `return` on purge-all, which broke chaining; runtime and typings are aligned now.

---

### 8. `getRolesHandlers` has a second parameter not in d.ts

**Status:** Fixed — `getRolesHandlers(role, defaultsOnly?: boolean)` is declared.

Previously **d.ts** listed only `getRolesHandlers(role: Role)`.

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

---

### 9. `DefaultInterfaces.always` type includes `Error` but `catch` never triggers `always`

**Status:** Fixed — `always` is `DoneType | ErrorType` in `index.d.ts`.

Previously:

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

**Status:** Open — still not declared on `JarvisEmitter` in `index.d.ts`.

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

**Status:** Open — `emitifyFromAsync` / `all` / `some` are declared; the table below lists helpers still missing from typings.

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

**Status:** Open — still not declared in `index.d.ts`.

JS sets `this.destroyed = false` in constructor and `this.destroyed = true` in `destroy()`. Not declared in d.ts.

---

### 13. `Property` interface missing `description` field

**Status:** Open — `description` still not on `Property` in `index.d.ts`.

`JarvisEmitterInterfaceBuilder` has a `.description(desc)` method, so the built object can have a `description` field. The `Property` interface in d.ts doesn't include it.

---

## Minor — Consistency / Style Issues

### 14. `pipe()` has a duplicate guard condition

**Status:** Fixed — `if (!pipedPromise) { return this; }`.

Previously (bug):

```js
if (!pipedPromise || !pipedPromise) {
  return;
}
```

Current `index.js` matches `pipe(): JarvisEmitter<...>` in `index.d.ts`.

---

### 15. `JarvisEmitter.Role` (static prop) vs `static get role()` — two different role objects

**Status:** Open — runtime still exposes two dictionaries with different keys.

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

### 16. Module export style mismatch

**Status:** Open — inherent CJS vs ESM interop; unchanged.

**JS:** `module.exports = JarvisEmitter` (CommonJS)
**d.ts:** `export default JarvisEmitter` (ES module default)

Works with `esModuleInterop: true`, but without it consumers need `import JarvisEmitter = require('jarvis-emitter')`.

---

## Summary Table

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | **Critical** | `Role.observe` value was `"obsereve"` (typo) | Fixed |
| 2 | **Critical** | `Role` enum missing `start` | Fixed |
| 3 | **Critical** | `Property.role` excluded `observe` (and `start`) | Fixed |
| 4 | **Critical** | Constructor param untyped | Fixed |
| 5 | **Critical** | `extend()` didn't accept arrays in typings | Fixed |
| 6 | **Critical** | `Resolver` should be variadic | Fixed |
| 7 | **Critical** | `Remover` / purge-all chaining | Fixed |
| 8 | **Critical** | `getRolesHandlers` missing `defaultsOnly` param | Fixed |
| 9 | **Critical** | `always` type included unreachable `Error` | Fixed |
| 10 | Moderate | Shorthand accessors (`.done()`, `.error()`, etc.) untyped | Open |
| 11 | Moderate | Several static methods still missing from d.ts | Open |
| 12 | Moderate | `destroyed` property missing from d.ts | Open |
| 13 | Moderate | `Property.description` field missing | Open |
| 14 | Minor | `pipe()` duplicate guard + early return | Fixed |
| 15 | Minor | Two different `Role` objects at runtime | Open |
| 16 | Minor | CommonJS vs ES module default export | Open |

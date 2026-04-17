import { describe, it } from 'vitest';
import type {
  RoleConfig,
  PayloadOf,
  InterfaceMap,
  DoneTypeOf,
  ErrorTypeOf,
} from '../src/types.js';
import type { TapPayload } from '../src/types.js';

type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
type Assert<T extends true> = T;

// PayloadOf extracts type from RoleConfig
{
  type _void = Assert<AssertEqual<PayloadOf<RoleConfig<void>>, void>>;
  type _string = Assert<AssertEqual<PayloadOf<RoleConfig<string>>, string>>;
  type _complex = Assert<AssertEqual<PayloadOf<RoleConfig<{ x: number }>>, { x: number }>>;
}

// DoneTypeOf / ErrorTypeOf extract from schema
{
  type S1 = { done: RoleConfig<string>; error: RoleConfig<Error> };
  type _d1 = Assert<AssertEqual<DoneTypeOf<S1>, string>>;
  type _e1 = Assert<AssertEqual<ErrorTypeOf<S1>, Error>>;

  type S2 = {};
  type _d2 = Assert<AssertEqual<DoneTypeOf<S2>, unknown>>;
  type _e2 = Assert<AssertEqual<ErrorTypeOf<S2>, unknown>>;

  type S3 = { status: RoleConfig<number> };
  type _d3 = Assert<AssertEqual<DoneTypeOf<S3>, unknown>>;
}

// InterfaceMap — empty schema yields unknown defaults
{
  type M = InterfaceMap<{}>;
  type _done = Assert<AssertEqual<M['done'], unknown>>;
  type _error = Assert<AssertEqual<M['error'], unknown>>;
  type _always = Assert<AssertEqual<M['always'], unknown>>;
  type _catch = Assert<AssertEqual<M['catch'], Error>>;
  type _tap = Assert<AssertEqual<M['tap'], TapPayload>>;
}

// InterfaceMap — schema overrides done/error types and adds custom events
{
  type Schema = {
    done: RoleConfig<boolean>;
    error: RoleConfig<Error>;
    status: RoleConfig<string>;
    data: RoleConfig<{ x: number }>;
  };
  type M = InterfaceMap<Schema>;
  type _done = Assert<AssertEqual<M['done'], boolean>>;
  type _error = Assert<AssertEqual<M['error'], Error>>;
  type _always = Assert<AssertEqual<M['always'], boolean | Error>>;
  type _status = Assert<AssertEqual<M['status'], string>>;
  type _data = Assert<AssertEqual<M['data'], { x: number }>>;
}

// event() and notify() carry payload type
{
  type EventConfig = RoleConfig<string>;
  type NotifyConfig = RoleConfig<{ x: number }>;
  type _eventPayload = Assert<AssertEqual<PayloadOf<EventConfig>, string>>;
  type _notifyPayload = Assert<AssertEqual<PayloadOf<NotifyConfig>, { x: number }>>;

  type VoidConfig = RoleConfig;
  type _voidPayload = Assert<AssertEqual<PayloadOf<VoidConfig>, void>>;
}

// End-to-end inference via public API
import { createEmitter, event, notify, doneType, errorType } from '../src/index.js';

{
  // No schema — all unknown
  const em = createEmitter();
  em.on.done((v) => {
    type _ = Assert<AssertEqual<typeof v, unknown>>;
  });
  em.on.error((v) => {
    type _ = Assert<AssertEqual<typeof v, unknown>>;
  });
}

{
  // doneType sets done payload type, error stays unknown
  const em = createEmitter({ done: doneType<{ value: number }>() });
  em.on.done((r) => {
    type _ = Assert<AssertEqual<typeof r, { value: number }>>;
  });
  em.on.error((v) => {
    type _ = Assert<AssertEqual<typeof v, unknown>>;
  });
  em.on.always((v) => {
    type _ = Assert<AssertEqual<typeof v, { value: number } | unknown>>;
  });
}

{
  // doneType + errorType + custom events
  const em = createEmitter({
    done: doneType<string>(),
    error: errorType<Error>(),
    status: event<number>(),
    cmd: notify<{ action: string }>(),
  });
  em.on.done((r) => {
    type _ = Assert<AssertEqual<typeof r, string>>;
  });
  em.on.error((e) => {
    type _ = Assert<AssertEqual<typeof e, Error>>;
  });
  em.on.status((s) => {
    type _ = Assert<AssertEqual<typeof s, number>>;
  });
  em.on.cmd((c) => {
    type _ = Assert<AssertEqual<typeof c, { action: string }>>;
  });
  em.emit.done('hi');
  em.emit.error(new Error('x'));
  em.emit.status(42);
  em.emit.cmd({ action: 'go' });
}

{
  // event() without a generic yields void
  const em = createEmitter({ tick: event() });
  em.on.tick((v) => {
    type _ = Assert<AssertEqual<typeof v, void>>;
  });
}

describe('compile-time type assertions', () => {
  it('compiles', () => {});
});

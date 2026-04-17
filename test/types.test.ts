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

describe('compile-time type assertions', () => {
  it('compiles', () => {});
});

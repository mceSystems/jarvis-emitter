import type { RoleConfig, PayloadOf, DefaultInterfaces, InterfaceMap, EmitterSchema } from '../src/types.js';

type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
type Assert<T extends true> = T;

// PayloadOf extracts type from RoleConfig
{
  type _void = Assert<AssertEqual<PayloadOf<RoleConfig<void>>, void>>;
  type _string = Assert<AssertEqual<PayloadOf<RoleConfig<string>>, string>>;
  type _complex = Assert<AssertEqual<PayloadOf<RoleConfig<{ x: number }>>, { x: number }>>;
}

// DefaultInterfaces types
{
  type DI = DefaultInterfaces<string, Error>;
  type _done = Assert<AssertEqual<DI['done'], string>>;
  type _error = Assert<AssertEqual<DI['error'], Error>>;
  type _always = Assert<AssertEqual<DI['always'], string | Error>>;
  type _catch = Assert<AssertEqual<DI['catch'], Error>>;
}

// InterfaceMap merges defaults with schema
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

// unknown defaults
{
  type DI = DefaultInterfaces;
  type _done = Assert<AssertEqual<DI['done'], unknown>>;
  type _error = Assert<AssertEqual<DI['error'], unknown>>;
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

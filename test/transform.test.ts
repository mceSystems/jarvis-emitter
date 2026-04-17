import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event, doneType, errorType } from '../src/roles.js';

describe('transform namespace', () => {
  it('transforms the value before it reaches listeners', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.transform.done((val) => val.toUpperCase());
    const listener = vi.fn();
    em.on.done(listener);
    em.emit.done('hello');
    expect(listener).toHaveBeenCalledWith('HELLO');
  });

  it('transforms custom events', () => {
    const em = createEmitter({
      status: event<string>(),
    });
    em.transform.status((val) => `status: ${val}`);
    const listener = vi.fn();
    em.on.status(listener);
    em.emit.status('online');
    expect(listener).toHaveBeenCalledWith('status: online');
  });

  it('composes multiple transforms in registration order', () => {
    const em = createEmitter({ done: doneType<number>() });
    em.transform.done((val) => val * 2);
    em.transform.done((val) => val + 1);
    const listener = vi.fn();
    em.on.done(listener);
    em.emit.done(5);
    expect(listener).toHaveBeenCalledWith(11);
  });

  it('transforms apply to sticky replay', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.transform.done((val) => val.toUpperCase());
    em.emit.done('hello');
    const listener = vi.fn();
    em.on.done(listener);
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

    const em = createEmitter(
      {
        done: doneType<string>(),
        error: errorType<ServiceError>(),
      },
      {
        transformError: (raw) => {
          const msg = String(raw);
          return new ServiceError(msg, 500);
        },
      },
    );
    const listener = vi.fn();
    em.on.error(listener);
    em.emit.error('server failure' as unknown as ServiceError);
    expect(listener).toHaveBeenCalledTimes(1);
    const err = listener.mock.calls[0][0];
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.message).toBe('server failure');
    expect(err.code).toBe(500);
  });

  it('transformError composes with transform.error', () => {
    const em = createEmitter(
      {
        done: doneType<string>(),
        error: errorType<string>(),
      },
      {
        transformError: (raw) => `transformed: ${raw}`,
      },
    );
    em.transform.error((val) => val.toUpperCase());
    const listener = vi.fn();
    em.on.error(listener);
    em.emit.error('fail');
    expect(listener).toHaveBeenCalledWith('TRANSFORMED: FAIL');
  });
});

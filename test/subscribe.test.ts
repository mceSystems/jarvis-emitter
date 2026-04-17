import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event, doneType, errorType } from '../src/roles.js';

describe('once', () => {
  it('fires listener only once then auto-unsubscribes', () => {
    const em = createEmitter({ done: doneType<string>() });
    const listener = vi.fn();
    em.once.done(listener);
    em.emit.done('first');
    em.emit.done('second');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('returns an unsubscribe function', () => {
    const em = createEmitter({ done: doneType<string>() });
    const listener = vi.fn();
    const unsub = em.once.done(listener);
    unsub();
    em.emit.done('hello');
    expect(listener).not.toHaveBeenCalled();
  });

  it('works with custom events', () => {
    const em = createEmitter({
      status: event<string>(),
    });
    const listener = vi.fn();
    em.once.status(listener);
    em.emit.status('first');
    em.emit.status('second');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('replays sticky once then unsubscribes', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.emit.done('early');
    const listener = vi.fn();
    em.once.done(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('early');
    em.emit.done('late');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('subscribe', () => {
  it('subscribes to multiple events at once', () => {
    const em = createEmitter({
      done: doneType<string>(),
      error: errorType<string>(),
      status: event<number>(),
    });
    const doneFn = vi.fn();
    const errorFn = vi.fn();
    const statusFn = vi.fn();
    em.subscribe({
      done: doneFn,
      error: errorFn,
      status: statusFn,
    });
    em.emit.done('result');
    em.emit.error('err');
    em.emit.status(42);
    expect(doneFn).toHaveBeenCalledWith('result');
    expect(errorFn).toHaveBeenCalledWith('err');
    expect(statusFn).toHaveBeenCalledWith(42);
  });

  it('returns a single unsub that removes all listeners', () => {
    const em = createEmitter({
      done: doneType<string>(),
      error: errorType<string>(),
    });
    const doneFn = vi.fn();
    const errorFn = vi.fn();
    const unsub = em.subscribe({
      done: doneFn,
      error: errorFn,
    });
    unsub();
    em.emit.done('result');
    em.emit.error('err');
    expect(doneFn).not.toHaveBeenCalled();
    expect(errorFn).not.toHaveBeenCalled();
  });

  it('allows partial subscription', () => {
    const em = createEmitter({
      done: doneType<string>(),
      error: errorType<string>(),
    });
    const doneFn = vi.fn();
    em.subscribe({ done: doneFn });
    em.emit.done('result');
    expect(doneFn).toHaveBeenCalledWith('result');
  });
});

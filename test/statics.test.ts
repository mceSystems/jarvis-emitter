import { describe, it, expect, vi } from 'vitest';
import { createEmitter, JarvisEmitter } from '../src/emitter.js';
import { doneType, errorType } from '../src/roles.js';
import { EmitterTimeoutError } from '../src/types.js';

describe('promise()', () => {
  it('resolves on done', async () => {
    const em = createEmitter({ done: doneType<string>() });
    setTimeout(() => em.emit.done('result'), 10);
    const result = await em.promise();
    expect(result).toBe('result');
  });

  it('rejects on error', async () => {
    const em = createEmitter({
      done: doneType<string>(),
      error: errorType<string>(),
    });
    setTimeout(() => em.emit.error('fail'), 10);
    await expect(em.promise()).rejects.toBe('fail');
  });

  it('rejects on catch', async () => {
    const em = createEmitter({ done: doneType<string>() });
    const err = new Error('exception');
    setTimeout(() => em.emit.catch(err), 10);
    await expect(em.promise()).rejects.toBe(err);
  });

  it('resolves immediately for sticky done', async () => {
    const em = createEmitter({ done: doneType<string>() });
    em.emit.done('early');
    const result = await em.promise();
    expect(result).toBe('early');
  });

  it('rejects with EmitterTimeoutError on timeout', async () => {
    const em = createEmitter({ done: doneType<string>() });
    await expect(em.promise({ timeout: 50 })).rejects.toThrow(EmitterTimeoutError);
    await expect(em.promise({ timeout: 50 })).rejects.toThrow('50ms');
  });

  it('does not timeout if done fires in time', async () => {
    const em = createEmitter({ done: doneType<string>() });
    setTimeout(() => em.emit.done('fast'), 10);
    const result = await em.promise({ timeout: 500 });
    expect(result).toBe('fast');
  });
});

describe('JarvisEmitter.all()', () => {
  it('resolves with all results when all emitters complete', () => {
    const a = createEmitter({ done: doneType<string>() });
    const b = createEmitter({ done: doneType<number>() });
    const result = JarvisEmitter.all(a, b);
    const listener = vi.fn();
    result.on.done(listener);
    a.emit.done('hello');
    b.emit.done(42);
    expect(listener).toHaveBeenCalledWith(['hello', 42]);
  });

  it('resolves immediately for empty args', () => {
    const result = JarvisEmitter.all();
    const listener = vi.fn();
    result.on.done(listener);
    expect(listener).toHaveBeenCalledWith([]);
  });

  it('rejects if any emitter errors', () => {
    const a = createEmitter({
      done: doneType<string>(),
      error: errorType<string>(),
    });
    const b = createEmitter({ done: doneType<number>() });
    const result = JarvisEmitter.all(a, b);
    const errorFn = vi.fn();
    result.on.error(errorFn);
    a.emit.error('fail');
    expect(errorFn).toHaveBeenCalledWith('fail');
  });
});

describe('JarvisEmitter.some()', () => {
  it('resolves with results and undefined for errors', () => {
    const a = createEmitter({
      done: doneType<string>(),
      error: errorType<string>(),
    });
    const b = createEmitter({ done: doneType<number>() });
    const result = JarvisEmitter.some(a, b);
    const listener = vi.fn();
    result.on.done(listener);
    a.emit.error('fail');
    b.emit.done(42);
    expect(listener).toHaveBeenCalledWith([undefined, 42]);
  });

  it('resolves immediately for empty args', () => {
    const result = JarvisEmitter.some();
    const listener = vi.fn();
    result.on.done(listener);
    expect(listener).toHaveBeenCalledWith([]);
  });
});

describe('JarvisEmitter.immediate()', () => {
  it('creates an emitter with done already fired (sticky)', () => {
    const em = JarvisEmitter.immediate('cached');
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith('cached');
  });
});

describe('JarvisEmitter.emitifyFromAsync()', () => {
  it('wraps an async function — done on resolve', async () => {
    const asyncFn = async (x: number) => x * 2;
    const emitified = JarvisEmitter.emitifyFromAsync(asyncFn);
    const em = emitified(5);
    const result = await em.promise();
    expect(result).toBe(10);
  });

  it('wraps an async function — error on reject', async () => {
    const asyncFn = async () => { throw new Error('boom'); };
    const emitified = JarvisEmitter.emitifyFromAsync(asyncFn);
    const em = emitified();
    await expect(em.promise()).rejects.toThrow('boom');
  });
});

describe('JarvisEmitter.emitify() (deprecated)', () => {
  it('wraps a callback-style function', () => {
    const cbFn = (a: number, b: number, cb: (...args: unknown[]) => void) => {
      cb(null, a + b);
    };
    const emitified = JarvisEmitter.emitify(cbFn);
    const em = emitified(3, 4);
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith([null, 7]);
  });

  it('wraps a callback-style function with resultsAsArray=false', () => {
    const cbFn = (a: number, cb: (result: number) => void) => {
      cb(a * 2);
    };
    const emitified = JarvisEmitter.emitify(cbFn, false);
    const em = emitified(5);
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith(10);
  });
});

describe('onUnhandledException / offUnhandledException', () => {
  it('registers and fires unhandled exception callbacks', () => {
    const handler = vi.fn();
    JarvisEmitter.onUnhandledException(handler);

    const em = createEmitter({ done: doneType<string>() });
    const error = new Error('unhandled');
    em.on.catch(() => {
      throw error;
    });
    em.on.done(() => {
      throw new Error('trigger catch');
    });
    em.emit.done('hello');

    expect(handler).toHaveBeenCalled();
    JarvisEmitter.offUnhandledException(handler);
  });

  it('removes unhandled exception callback', () => {
    const handler = vi.fn();
    JarvisEmitter.onUnhandledException(handler);
    JarvisEmitter.offUnhandledException(handler);

    const em = createEmitter({ done: doneType<string>() });
    em.on.catch(() => {
      throw new Error('unhandled');
    });
    em.on.done(() => {
      throw new Error('trigger');
    });
    em.emit.done('hello');

    expect(handler).not.toHaveBeenCalled();
  });
});

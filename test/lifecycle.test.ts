import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event, doneType } from '../src/roles.js';

describe('destroy', () => {
  it('purges all listeners', () => {
    const em = createEmitter({
      done: doneType<string>(),
      status: event<string>(),
    });
    const doneFn = vi.fn();
    const statusFn = vi.fn();
    em.on.done(doneFn);
    em.on.status(statusFn);
    em.destroy();
    expect(() => em.emit.done('hello')).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on emit after destroy', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.destroy();
    expect(() => em.emit.done('hello')).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on on after destroy', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.destroy();
    expect(() => em.on.done(() => {})).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on off after destroy', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.destroy();
    expect(() => em.off.done()).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on transform after destroy', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.destroy();
    expect(() => em.transform.done((v) => v)).toThrow('JarvisEmitter used after being destroyed');
  });

  it('throws on subscribe after destroy', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.destroy();
    expect(() => em.subscribe({ done: () => {} })).toThrow('JarvisEmitter used after being destroyed');
  });

  it('clears sticky state', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.emit.done('cached');
    em.destroy();
    const em2 = createEmitter({ done: doneType<string>() });
    em2.emit.done('cached');
    const listener = vi.fn();
    em2.on.done(listener);
    expect(listener).toHaveBeenCalledWith('cached');
  });
});

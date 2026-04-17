import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event, notify, doneType, errorType } from '../src/roles.js';

describe('createEmitter — default interfaces', () => {
  describe('on/emit', () => {
    it('emits done to a registered listener', () => {
      const em = createEmitter({ done: doneType<string>() });
      const listener = vi.fn();
      em.on.done(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('emits error to a registered listener', () => {
      const em = createEmitter({
        done: doneType<string>(),
        error: errorType<Error>(),
      });
      const listener = vi.fn();
      em.on.error(listener);
      const err = new Error('fail');
      em.emit.error(err);
      expect(listener).toHaveBeenCalledWith(err);
    });

    it('emits always when done is emitted', () => {
      const em = createEmitter({ done: doneType<string>() });
      const listener = vi.fn();
      em.on.always(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('emits always when error is emitted', () => {
      const em = createEmitter({
        done: doneType<string>(),
        error: errorType<string>(),
      });
      const listener = vi.fn();
      em.on.always(listener);
      em.emit.error('fail');
      expect(listener).toHaveBeenCalledWith('fail');
    });

    it('emits tap when done is emitted', () => {
      const em = createEmitter({ done: doneType<string>() });
      const listener = vi.fn();
      em.on.tap(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith({
        name: 'done',
        role: 'done',
        data: ['hello'],
      });
    });

    it('emits tap when error is emitted', () => {
      const em = createEmitter({
        done: doneType<string>(),
        error: errorType<string>(),
      });
      const listener = vi.fn();
      em.on.tap(listener);
      em.emit.error('fail');
      expect(listener).toHaveBeenCalledWith({
        name: 'error',
        role: 'done',
        data: ['fail'],
      });
    });

    it('does not emit tap for always or tap itself', () => {
      const em = createEmitter({ done: doneType<string>() });
      const listener = vi.fn();
      em.on.tap(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('supports multiple listeners on the same event', () => {
      const em = createEmitter({ done: doneType<string>() });
      const l1 = vi.fn();
      const l2 = vi.fn();
      em.on.done(l1);
      em.on.done(l2);
      em.emit.done('hello');
      expect(l1).toHaveBeenCalledWith('hello');
      expect(l2).toHaveBeenCalledWith('hello');
    });
  });

  describe('on returns unsubscribe', () => {
    it('returns a function that removes the listener', () => {
      const em = createEmitter({ done: doneType<string>() });
      const listener = vi.fn();
      const unsub = em.on.done(listener);
      unsub();
      em.emit.done('hello');
      expect(listener).not.toHaveBeenCalled();
    });

    it('only removes the specific listener', () => {
      const em = createEmitter({ done: doneType<string>() });
      const l1 = vi.fn();
      const l2 = vi.fn();
      const unsub1 = em.on.done(l1);
      em.on.done(l2);
      unsub1();
      em.emit.done('hello');
      expect(l1).not.toHaveBeenCalled();
      expect(l2).toHaveBeenCalledWith('hello');
    });
  });

  describe('off', () => {
    it('removes all listeners when called without argument', () => {
      const em = createEmitter({ done: doneType<string>() });
      const l1 = vi.fn();
      const l2 = vi.fn();
      em.on.done(l1);
      em.on.done(l2);
      em.off.done();
      em.emit.done('hello');
      expect(l1).not.toHaveBeenCalled();
      expect(l2).not.toHaveBeenCalled();
    });

    it('removes a specific listener when passed as argument', () => {
      const em = createEmitter({ done: doneType<string>() });
      const l1 = vi.fn();
      const l2 = vi.fn();
      em.on.done(l1);
      em.on.done(l2);
      em.off.done(l1);
      em.emit.done('hello');
      expect(l1).not.toHaveBeenCalled();
      expect(l2).toHaveBeenCalledWith('hello');
    });
  });

  describe('catch', () => {
    it('catches exceptions thrown in done listeners', () => {
      const em = createEmitter({ done: doneType<string>() });
      const catchListener = vi.fn();
      em.on.catch(catchListener);
      em.on.done(() => {
        throw new Error('boom');
      });
      em.emit.done('hello');
      expect(catchListener).toHaveBeenCalledTimes(1);
      expect(catchListener.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(catchListener.mock.calls[0][0].message).toBe('boom');
    });

    it('catches exceptions thrown in error listeners', () => {
      const em = createEmitter({
        done: doneType<string>(),
        error: errorType<string>(),
      });
      const catchListener = vi.fn();
      em.on.catch(catchListener);
      em.on.error(() => {
        throw new Error('boom');
      });
      em.emit.error('fail');
      expect(catchListener).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createEmitter — custom events via schema', () => {
  it('registers custom event from schema', () => {
    const em = createEmitter({
      status: event<string>(),
    });
    const listener = vi.fn();
    em.on.status(listener);
    em.emit.status('online');
    expect(listener).toHaveBeenCalledWith('online');
  });

  it('registers custom notify from schema', () => {
    const em = createEmitter({
      command: notify<{ action: string }>(),
    });
    const listener = vi.fn();
    em.on.command(listener);
    em.emit.command({ action: 'start' });
    expect(listener).toHaveBeenCalledWith({ action: 'start' });
  });

  it('supports multiple custom events', () => {
    const em = createEmitter({
      status: event<string>(),
      progress: event<number>(),
    });
    const statusListener = vi.fn();
    const progressListener = vi.fn();
    em.on.status(statusListener);
    em.on.progress(progressListener);
    em.emit.status('running');
    em.emit.progress(42);
    expect(statusListener).toHaveBeenCalledWith('running');
    expect(progressListener).toHaveBeenCalledWith(42);
  });

  it('custom events coexist with default events', () => {
    const em = createEmitter({
      done: doneType<string>(),
      status: event<number>(),
    });
    const doneListener = vi.fn();
    const statusListener = vi.fn();
    em.on.done(doneListener);
    em.on.status(statusListener);
    em.emit.done('result');
    em.emit.status(100);
    expect(doneListener).toHaveBeenCalledWith('result');
    expect(statusListener).toHaveBeenCalledWith(100);
  });

  it('tap fires for custom events', () => {
    const em = createEmitter({
      status: event<string>(),
    });
    const tapListener = vi.fn();
    em.on.tap(tapListener);
    em.emit.status('online');
    expect(tapListener).toHaveBeenCalledWith({
      name: 'status',
      role: 'event',
      data: ['online'],
    });
  });

  it('unsub works for custom events', () => {
    const em = createEmitter({
      status: event<string>(),
    });
    const listener = vi.fn();
    const unsub = em.on.status(listener);
    unsub();
    em.emit.status('online');
    expect(listener).not.toHaveBeenCalled();
  });
});

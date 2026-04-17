import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';

describe('createEmitter — default interfaces', () => {
  describe('on/emit', () => {
    it('emits done to a registered listener', () => {
      const em = createEmitter<string>();
      const listener = vi.fn();
      em.on.done(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('emits error to a registered listener', () => {
      const em = createEmitter<string, Error>();
      const listener = vi.fn();
      em.on.error(listener);
      const err = new Error('fail');
      em.emit.error(err);
      expect(listener).toHaveBeenCalledWith(err);
    });

    it('emits always when done is emitted', () => {
      const em = createEmitter<string>();
      const listener = vi.fn();
      em.on.always(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('emits always when error is emitted', () => {
      const em = createEmitter<string, string>();
      const listener = vi.fn();
      em.on.always(listener);
      em.emit.error('fail');
      expect(listener).toHaveBeenCalledWith('fail');
    });

    it('emits tap when done is emitted', () => {
      const em = createEmitter<string>();
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
      const em = createEmitter<string, string>();
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
      const em = createEmitter<string>();
      const listener = vi.fn();
      em.on.tap(listener);
      em.emit.done('hello');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('supports multiple listeners on the same event', () => {
      const em = createEmitter<string>();
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
      const em = createEmitter<string>();
      const listener = vi.fn();
      const unsub = em.on.done(listener);
      unsub();
      em.emit.done('hello');
      expect(listener).not.toHaveBeenCalled();
    });

    it('only removes the specific listener', () => {
      const em = createEmitter<string>();
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
      const em = createEmitter<string>();
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
      const em = createEmitter<string>();
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
      const em = createEmitter<string>();
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
      const em = createEmitter<string, string>();
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

import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event, doneType, errorType } from '../src/roles.js';

describe('pipe', () => {
  describe('basic pipe (all matching events)', () => {
    it('forwards done events', () => {
      const src = createEmitter({ done: doneType<string>() });
      const dest = createEmitter({ done: doneType<string>() });
      const listener = vi.fn();
      dest.on.done(listener);
      src.pipe(dest);
      src.emit.done('hello');
      expect(listener).toHaveBeenCalledWith('hello');
    });

    it('forwards error events', () => {
      const src = createEmitter({
        done: doneType<string>(),
        error: errorType<string>(),
      });
      const dest = createEmitter({
        done: doneType<string>(),
        error: errorType<string>(),
      });
      const listener = vi.fn();
      dest.on.error(listener);
      src.pipe(dest);
      src.emit.error('fail');
      expect(listener).toHaveBeenCalledWith('fail');
    });

    it('forwards custom events with matching names', () => {
      const src = createEmitter({ status: event<string>() });
      const dest = createEmitter({ status: event<string>() });
      const listener = vi.fn();
      dest.on.status(listener);
      src.pipe(dest);
      src.emit.status('online');
      expect(listener).toHaveBeenCalledWith('online');
    });

    it('skips events that destination does not have', () => {
      const src = createEmitter({ extra: event<string>() });
      const dest = createEmitter();
      src.pipe(dest);
      src.emit.extra('hello');
    });
  });

  describe('selective pipe (array of event names)', () => {
    it('only pipes listed events', () => {
      const src = createEmitter({
        done: doneType<string>(),
        error: errorType<string>(),
      });
      const dest = createEmitter({
        done: doneType<string>(),
        error: errorType<string>(),
      });
      const doneFn = vi.fn();
      const errorFn = vi.fn();
      dest.on.done(doneFn);
      dest.on.error(errorFn);
      src.pipe(dest, ['done']);
      src.emit.done('hello');
      src.emit.error('fail');
      expect(doneFn).toHaveBeenCalledWith('hello');
      expect(errorFn).not.toHaveBeenCalled();
    });
  });

  describe('mapped pipe (name mapping)', () => {
    it('maps source event to different destination event', () => {
      const src = createEmitter({ received: event<string>() });
      const dest = createEmitter({ data: event<string>() });
      const listener = vi.fn();
      dest.on.data(listener);
      src.pipe(dest, { received: 'data' });
      src.emit.received('payload');
      expect(listener).toHaveBeenCalledWith('payload');
    });

    it('does not pipe unmapped events', () => {
      const src = createEmitter({
        done: doneType<string>(),
        received: event<string>(),
      });
      const dest = createEmitter({
        done: doneType<string>(),
        data: event<string>(),
      });
      const doneFn = vi.fn();
      dest.on.done(doneFn);
      src.pipe(dest, { received: 'data' });
      src.emit.done('hello');
      expect(doneFn).not.toHaveBeenCalled();
    });
  });

  describe('pipe returns this for chaining', () => {
    it('returns the source emitter', () => {
      const src = createEmitter({ done: doneType<string>() });
      const dest = createEmitter({ done: doneType<string>() });
      const result = src.pipe(dest);
      expect(result).toBe(src);
    });
  });
});

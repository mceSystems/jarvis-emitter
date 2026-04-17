import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { event, doneType, errorType } from '../src/roles.js';

describe('sticky events', () => {
  it('done is sticky by default — late subscriber gets the value', () => {
    const em = createEmitter({ done: doneType<string>() });
    em.emit.done('early');
    const listener = vi.fn();
    em.on.done(listener);
    expect(listener).toHaveBeenCalledWith('early');
  });

  it('error is sticky by default', () => {
    const em = createEmitter({
      done: doneType<string>(),
      error: errorType<string>(),
    });
    em.emit.error('fail');
    const listener = vi.fn();
    em.on.error(listener);
    expect(listener).toHaveBeenCalledWith('fail');
  });

  it('custom event with sticky replays to late subscriber', () => {
    const em = createEmitter({
      status: event<string>({ sticky: true }),
    });
    em.emit.status('ready');
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).toHaveBeenCalledWith('ready');
  });

  it('custom event without sticky does not replay', () => {
    const em = createEmitter({
      status: event<string>(),
    });
    em.emit.status('ready');
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it('sticky replays multiple emissions', () => {
    const em = createEmitter({
      log: event<string>({ sticky: true }),
    });
    em.emit.log('first');
    em.emit.log('second');
    const listener = vi.fn();
    em.on.log(listener);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, 'first');
    expect(listener).toHaveBeenNthCalledWith(2, 'second');
  });

  it('stickyLast only replays the last emission', () => {
    const em = createEmitter({
      status: event<string>({ stickyLast: true }),
    });
    em.emit.status('first');
    em.emit.status('second');
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('second');
  });

  it('stickyLast replays to late async subscriber', async () => {
    const em = createEmitter({
      status: event<string>({ stickyLast: true }),
    });
    em.emit.status('hello');
    await new Promise((r) => setTimeout(r, 10));
    const listener = vi.fn();
    em.on.status(listener);
    expect(listener).toHaveBeenCalledWith('hello');
  });
});

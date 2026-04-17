import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmitter } from '../src/emitter.js';
import { registry } from '../src/registry.js';
import { event, doneType } from '../src/roles.js';

beforeEach(() => {
  registry.enable();
  registry.clear();
});

describe('registry', () => {
  describe('list()', () => {
    it('lists registered emitters', () => {
      createEmitter({}, { label: 'TestEmitter' });
      const list = registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('TestEmitter');
    });

    it('includes event names', () => {
      createEmitter(
        {
          done: doneType<string>(),
          status: event<string>(),
        },
        { label: 'Sensor' },
      );
      const list = registry.list();
      expect(list[0].events).toContain('done');
      expect(list[0].events).toContain('error');
      expect(list[0].events).toContain('status');
    });

    it('includes listener counts', () => {
      const em = createEmitter(
        {
          done: doneType<string>(),
          status: event<string>(),
        },
        { label: 'Sensor' },
      );
      em.on.done(() => {});
      em.on.done(() => {});
      em.on.status(() => {});
      const list = registry.list();
      expect(list[0].listeners['done']).toBe(2);
      expect(list[0].listeners['status']).toBe(1);
    });
  });

  describe('find()', () => {
    it('finds by label substring', () => {
      createEmitter({}, { label: 'SensorService' });
      createEmitter({}, { label: 'HttpTransport' });
      const results = registry.find('Sensor');
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('SensorService');
    });

    it('finds by event name', () => {
      createEmitter({ status: event() }, { label: 'A' });
      createEmitter({ data: event() }, { label: 'B' });
      const results = registry.find({ event: 'status' });
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('A');
    });
  });

  describe('onEmit()', () => {
    it('fires callback on any emission from any emitter', () => {
      const handler = vi.fn();
      registry.onEmit(handler);
      const em = createEmitter({ done: doneType<string>() }, { label: 'Test' });
      em.emit.done('hello');
      expect(handler).toHaveBeenCalledWith({
        label: 'Test',
        event: 'done',
        data: 'hello',
      });
    });

    it('returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = registry.onEmit(handler);
      unsub();
      const em = createEmitter({ done: doneType<string>() }, { label: 'Test' });
      em.emit.done('hello');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('auto-deregister on destroy', () => {
    it('removes emitter from list on destroy', () => {
      const em = createEmitter({}, { label: 'Temp' });
      expect(registry.list()).toHaveLength(1);
      em.destroy();
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('disable()', () => {
    it('makes all methods no-ops', () => {
      registry.disable();
      createEmitter({}, { label: 'Ghost' });
      expect(registry.list()).toHaveLength(0);
    });

    it('can be re-enabled', () => {
      registry.disable();
      registry.enable();
      createEmitter({}, { label: 'Visible' });
      expect(registry.list()).toHaveLength(1);
    });
  });

  describe('clear()', () => {
    it('removes all entries', () => {
      createEmitter({}, { label: 'A' });
      createEmitter({}, { label: 'B' });
      expect(registry.list()).toHaveLength(2);
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });
  });
});

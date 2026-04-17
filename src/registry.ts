import type { RegistryEntry, RegistryEmitEvent, Unsubscribe, Listener } from './types.js';

interface RegisteredEmitter {
  ref: WeakRef<object>;
  label: string;
  getEvents: () => string[];
  getListenerCounts: () => Record<string, number>;
}

class EmitterRegistry {
  private _entries: RegisteredEmitter[] = [];
  private _emitListeners: Listener<RegistryEmitEvent>[] = [];
  private _enabled = true;

  register(
    emitter: object,
    label: string,
    getEvents: () => string[],
    getListenerCounts: () => Record<string, number>,
  ): void {
    if (!this._enabled) return;
    this._entries.push({
      ref: new WeakRef(emitter),
      label,
      getEvents,
      getListenerCounts,
    });
  }

  deregister(emitter: object): void {
    this._entries = this._entries.filter((e) => e.ref.deref() !== emitter);
  }

  notifyEmit(label: string, event: string, data: unknown): void {
    if (!this._enabled) return;
    const payload: RegistryEmitEvent = { label, event, data };
    for (const listener of this._emitListeners) {
      listener(payload);
    }
  }

  list(): RegistryEntry[] {
    if (!this._enabled) return [];
    this._pruneCollected();
    return this._entries.map((e) => ({
      label: e.label,
      events: e.getEvents(),
      listeners: e.getListenerCounts(),
    }));
  }

  find(query: string | { event: string }): RegistryEntry[] {
    if (!this._enabled) return [];
    this._pruneCollected();
    if (typeof query === 'string') {
      return this.list().filter((e) => e.label.includes(query));
    }
    return this.list().filter((e) => e.events.includes(query.event));
  }

  onEmit(listener: Listener<RegistryEmitEvent>): Unsubscribe {
    this._emitListeners.push(listener);
    return () => {
      const idx = this._emitListeners.indexOf(listener);
      if (idx !== -1) {
        this._emitListeners.splice(idx, 1);
      }
    };
  }

  disable(): void {
    this._enabled = false;
  }

  enable(): void {
    this._enabled = true;
  }

  clear(): void {
    this._entries = [];
    this._emitListeners = [];
  }

  get enabled(): boolean {
    return this._enabled;
  }

  private _pruneCollected(): void {
    this._entries = this._entries.filter((e) => e.ref.deref() !== undefined);
  }
}

export const registry = new EmitterRegistry();

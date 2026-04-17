import { describe, it, expect } from 'vitest';
import { event, notify } from '../src/roles.js';

describe('event()', () => {
  it('returns a config with role "event"', () => {
    const config = event();
    expect(config.role).toBe('event');
  });

  it('defaults to no sticky', () => {
    const config = event();
    expect(config.sticky).toBeUndefined();
    expect(config.stickyLast).toBeUndefined();
  });

  it('accepts sticky option', () => {
    const config = event({ sticky: true });
    expect(config.sticky).toBe(true);
  });

  it('accepts stickyLast option', () => {
    const config = event({ stickyLast: true });
    expect(config.stickyLast).toBe(true);
  });
});

describe('notify()', () => {
  it('returns a config with role "notify"', () => {
    const config = notify();
    expect(config.role).toBe('notify');
  });

  it('defaults to no sticky', () => {
    const config = notify();
    expect(config.sticky).toBeUndefined();
    expect(config.stickyLast).toBeUndefined();
  });

  it('accepts sticky option', () => {
    const config = notify({ sticky: true });
    expect(config.sticky).toBe(true);
  });
});

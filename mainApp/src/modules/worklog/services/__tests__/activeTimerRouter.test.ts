/**
 * Integration test for stopActiveTimer(): it must route the in-flight session to
 * the correct backend based on its kind (work → api.sessions, personal →
 * api.personalSessions). We mock `api` and let the real stores run so the routing
 * through timerEngine → the owning store → its session endpoint is exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  sessions: {
    start: vi.fn(async () => ({ _id: 'ws' })),
    pause: vi.fn(async () => ({})),
    resume: vi.fn(async () => ({})),
    stop: vi.fn(async () => ({})),
  },
  personalSessions: {
    start: vi.fn(async () => ({ _id: 'ps' })),
    pause: vi.fn(async () => ({})),
    resume: vi.fn(async () => ({})),
    stop: vi.fn(async () => ({})),
  },
}));

vi.mock('../api', () => ({
  api: { sessions: h.sessions, personalSessions: h.personalSessions },
}));

import { timerEngine } from '../timerEngine';
import { stopActiveTimer } from '../activeTimerRouter';

describe('activeTimerRouter', () => {
  beforeEach(() => {
    timerEngine.hydrate(null);
    vi.clearAllMocks();
  });

  it('routes a personal session stop to api.personalSessions', async () => {
    await timerEngine.start('p-task', 'p-sess', 1000, 0, 'personal');
    await stopActiveTimer();

    expect(h.personalSessions.stop).toHaveBeenCalledTimes(1);
    expect(h.sessions.stop).not.toHaveBeenCalled();
    // Engine released.
    expect(timerEngine.getState()).toBe('idle');
  });

  it('routes a work session stop to api.sessions', async () => {
    await timerEngine.start('w-task', 'w-sess', 1000, 0, 'work');
    await stopActiveTimer();

    expect(h.sessions.stop).toHaveBeenCalledTimes(1);
    expect(h.personalSessions.stop).not.toHaveBeenCalled();
    expect(timerEngine.getState()).toBe('idle');
  });

  it('is a no-op when the engine is idle', async () => {
    await stopActiveTimer();
    expect(h.sessions.stop).not.toHaveBeenCalled();
    expect(h.personalSessions.stop).not.toHaveBeenCalled();
  });
});

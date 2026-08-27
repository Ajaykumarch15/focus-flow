/**
 * Runtime smoke test of the work↔personal timer split using the REAL stores,
 * router and engine (api is mocked so no network). Mirrors the actual UI flow:
 *   start work timer → switch to personal → start personal → switch back →
 *   simulate a page refresh while a personal timer is running.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const makeNs = (): Record<string, any> => {
    const fns: Record<string, any> = {};
    return new Proxy({}, {
      get(_t, prop: string) {
        if (!fns[prop]) {
          fns[prop] = vi.fn(async () => (/list/i.test(prop) ? [] : {}));
        }
        return fns[prop];
      },
    }) as Record<string, any>;
  };
  return {
    api: {
      sessions: makeNs(),
      personalSessions: makeNs(),
      tasks: makeNs(),
      personalTasks: makeNs(),
      profile: makeNs(),
      workLogs: makeNs(),
    },
  };
});

vi.mock('../api', () => ({ api: h.api }));

// Keep heartbeats from scheduling real intervals (open handles).
beforeAll(() => {
  vi.spyOn(globalThis, 'setInterval').mockReturnValue(0 as unknown as NodeJS.Timeout);
  vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
});

import { timerEngine } from '../timerEngine';
import { useStore } from '../../store/useStore';
import { usePersonalTaskStore } from '../../store/usePersonalTaskStore';
import { startTimerHeartbeat, stopTimerHeartbeat } from '../timerHeartbeat';

describe('timer smoke · work/personal split', () => {
  beforeEach(() => {
    timerEngine.hydrate(null);
    vi.clearAllMocks();
    h.api.sessions.start.mockResolvedValue({ _id: 'sess-work' });
    h.api.personalSessions.start.mockResolvedValue({ _id: 'sess-pers' });
  });

  afterEach(() => {
    stopTimerHeartbeat();
  });

  it('switches work → personal without orphaning the work session', async () => {
    await useStore.getState().startTimer('work-1');
    expect(h.api.sessions.start).toHaveBeenCalledWith('work-1', expect.any(Number), expect.any(String));
    expect(timerEngine.getSessionKind()).toBe('work');

    await usePersonalTaskStore.getState().startTimer('personal-1');

    // Work session is closed on the WORK endpoint (not leaked to personal).
    expect(h.api.sessions.stop).toHaveBeenCalledTimes(1);
    // Personal session is opened on the PERSONAL endpoint.
    expect(h.api.personalSessions.start).toHaveBeenCalledWith('personal-1', expect.any(Number), expect.any(String));
    // Engine now owns a personal session.
    expect(timerEngine.getSessionKind()).toBe('personal');
    expect(timerEngine.getActiveTaskId()).toBe('personal-1');
  });

  it('switches personal → work, closing the personal session on its own endpoint', async () => {
    await usePersonalTaskStore.getState().startTimer('personal-1');
    expect(timerEngine.getSessionKind()).toBe('personal');

    await useStore.getState().startTimer('work-2');

    expect(h.api.personalSessions.stop).toHaveBeenCalledTimes(1);
    expect(h.api.sessions.start).toHaveBeenCalledTimes(1); // only work-2 in this test (history cleared)
    expect(timerEngine.getSessionKind()).toBe('work');
    expect(timerEngine.getActiveTaskId()).toBe('work-2');
  });

  it('persists the personal kind and rehydrates after a refresh', async () => {
    await usePersonalTaskStore.getState().startTimer('personal-1');
    expect(timerEngine.getSessionKind()).toBe('personal');

    // The kind must be written to localStorage so a refresh restores it.
    const raw = localStorage.getItem('ff_active_timer');
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!);
    expect(persisted.sessionKind).toBe('personal');

    // Simulate a page refresh: engine torn down, then rehydrated from backend list.
    timerEngine.hydrate(null);
    expect(timerEngine.getState()).toBe('idle');

    h.api.personalSessions.list.mockResolvedValue([
      { _id: 'sess-pers', personalTaskId: 'personal-1', isActive: true, startTime: Date.now() - 5000, pauseLog: [] },
    ]);
    await usePersonalTaskStore.getState().rehydratePersonalTimer();

    expect(timerEngine.getState()).toBe('running');
    expect(timerEngine.getSessionKind()).toBe('personal');
    expect(timerEngine.getActiveTaskId()).toBe('personal-1');
  });

  it('personal timer survives a work-endpoint 404 heartbeat after refresh', async () => {
    // Before this fix, useStore.loadAll started a work-endpoint heartbeat for the
    // restored personal session id; the server 404'd it and cleared the timer.
    vi.useFakeTimers();
    await usePersonalTaskStore.getState().startTimer('personal-1');

    // Simulate loadAll having started the (now kind-aware) heartbeat, while the
    // WORK endpoint is down/404 and the PERSONAL endpoint is healthy.
    h.api.sessions.heartbeat.mockRejectedValue(new Error('404 not found'));
    h.api.personalSessions.heartbeat.mockResolvedValue({ lastHeartbeat: Date.now() });

    startTimerHeartbeat(() => timerEngine.hydrate(null));

    vi.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(timerEngine.getState()).toBe('running');
    expect(timerEngine.getSessionKind()).toBe('personal');
    expect(h.api.personalSessions.heartbeat).toHaveBeenCalled();
    expect(h.api.sessions.heartbeat).not.toHaveBeenCalled(); // proves correct routing

    stopTimerHeartbeat();
    vi.useRealTimers();
  });
});

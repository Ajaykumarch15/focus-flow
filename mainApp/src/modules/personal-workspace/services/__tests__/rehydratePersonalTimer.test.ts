import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  api: {
    personalSessions: { list: vi.fn() },
    personalTasks: { list: vi.fn(), addSubtask: vi.fn() },
  },
}));

vi.mock('@shared/utils/api', () => ({ api: h.api }));
vi.mock('@worklog/services/timerHeartbeat', () => ({
  startTimerHeartbeat: () => {},
  stopTimerHeartbeat: () => {},
}));

import { usePersonalTaskStore } from '../usePersonalTaskStore';
import { timerEngine } from '@worklog/services/timerEngine';

const PERSONAL_SESSION = {
  _id: 'ps2',
  personalTaskId: 'pt2',
  isActive: true,
  startTime: Date.now() - 45000,
  totalPauseDuration: 0,
  pauseLog: [],
};

describe('rehydratePersonalTimer (refresh path)', () => {
  beforeEach(() => {
    localStorage.clear();
    timerEngine.hydrate(null);
    vi.clearAllMocks();
  });

  it('restores an active personal session from the server after a refresh', async () => {
    // No local snapshot this time — the session lives only on the backend.
    h.api.personalSessions.list.mockResolvedValue([PERSONAL_SESSION]);

    await usePersonalTaskStore.getState().rehydratePersonalTimer();

    expect(timerEngine.getSessionKind()).toBe('personal');
    expect(timerEngine.getSnapshot().taskId).toBe('pt2');
    expect(timerEngine.getSnapshot().sessionId).toBe('ps2');
    expect(timerEngine.getState()).toBe('running');
  });

  it('does not clobber an already-active engine session', async () => {
    // Simulate a work session already rehydrated by useStore.loadAll.
    timerEngine.hydrate({
      taskId: 't-work',
      sessionId: 's-work',
      timerState: 'running',
      sessionStartTime: Date.now() - 10000,
      totalPauseDuration: 0,
      baseElapsedMs: 0,
      sessionKind: 'work',
    });

    await usePersonalTaskStore.getState().rehydratePersonalTimer();

    // Engine untouched by the personal rehydrate.
    expect(timerEngine.getSessionKind()).toBe('work');
    expect(timerEngine.getSnapshot().taskId).toBe('t-work');
    expect(h.api.personalSessions.list).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  api: {
    tasks: { list: vi.fn() },
    journals: { list: vi.fn() },
    profile: { get: vi.fn() },
    sessions: { list: vi.fn() },
  },
}));

vi.mock('../../utils/api', () => ({ api: h.api }));
vi.mock('../../utils/timerHeartbeat', () => ({
  startTimerHeartbeat: () => {},
  stopTimerHeartbeat: () => {},
}));

import { useStore } from '../useStore';
import { timerEngine } from '../../utils/timerEngine';
import { toast } from '../useToastStore';

const WORK_TASK = {
  _id: 't1',
  title: 'Work Task',
  status: 'todo',
  totalTime: 120000,
  priority: 'high',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const WORK_SESSION = {
  _id: 's1',
  taskId: 't1',
  isActive: true,
  startTime: Date.now() - 60000,
  totalPauseDuration: 0,
  pauseLog: [],
};

describe('useStore.loadAll timer rehydration', () => {
  beforeEach(() => {
    localStorage.clear();
    timerEngine.hydrate(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    timerEngine.hydrate(null);
    vi.restoreAllMocks();
  });

  it('restores an active work session from the backend into the engine and UI state', async () => {
    h.api.tasks.list.mockResolvedValue([WORK_TASK]);
    h.api.journals.list.mockResolvedValue([]);
    h.api.profile.get.mockResolvedValue({ name: 'Tester', settings: {} });
    h.api.sessions.list.mockResolvedValue([WORK_SESSION]);

    await useStore.getState().loadAll();

    expect(timerEngine.getSessionKind()).toBe('work');
    expect(timerEngine.getSnapshot().taskId).toBe('t1');
    expect(useStore.getState().activeTaskId).toBe('t1');
    expect(useStore.getState().activeSessionId).toBe('s1');
    expect(useStore.getState().activeTimerState).toBe('running');
    expect(useStore.getState().tasks).toHaveLength(1);
  });

  it('keeps a locally-persisted PERSONAL timer when a backend work session is also active', async () => {
    const warnSpy = vi.spyOn(toast, 'warning');
    localStorage.setItem(
      'ff_active_timer',
      JSON.stringify({
        taskId: 'pt1',
        sessionId: 'ps1',
        timerState: 'running',
        sessionStartTime: Date.now() - 30000,
        totalPauseDuration: 0,
        pauseStart: undefined,
        baseElapsedMs: 0,
        sessionKind: 'personal',
      }),
    );

    h.api.tasks.list.mockResolvedValue([WORK_TASK]);
    h.api.journals.list.mockResolvedValue([]);
    h.api.profile.get.mockResolvedValue({ name: 'Tester', settings: {} });
    h.api.sessions.list.mockResolvedValue([WORK_SESSION]);

    await useStore.getState().loadAll();

    // Personal local timer wins; backend work session is reported, not hydrated.
    expect(timerEngine.getSessionKind()).toBe('personal');
    expect(timerEngine.getSnapshot().taskId).toBe('pt1');
    expect(warnSpy).toHaveBeenCalled();
  });
});

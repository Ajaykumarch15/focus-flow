/**
 * Verifies that offline-queued timer ops are replayed against the correct backend
 * endpoint based on their `kind` (work → api.sessions, personal →
 * api.personalSessions). Previously all ops hard-coded api.sessions, so personal
 * session stops could never replay to the right endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const sessions = { start: vi.fn(), pause: vi.fn(), resume: vi.fn(), stop: vi.fn() };
  const personalSessions = { start: vi.fn(), pause: vi.fn(), resume: vi.fn(), stop: vi.fn() };
  return { sessions, personalSessions };
});

vi.mock('../api', () => ({
  api: { sessions: h.sessions, personalSessions: h.personalSessions },
}));

import { offlineQueue } from '../offlineQueue';

describe('OfflineQueue kind routing', () => {
  beforeEach(() => {
    offlineQueue.clear();
    vi.clearAllMocks();
  });

  it('routes a personal STOP_SESSION to api.personalSessions', async () => {
    offlineQueue.enqueue('STOP_SESSION', 'task-1', 'sess-1', { endTime: 100 }, 'op-1', 'personal');
    await offlineQueue.processQueue();

    expect(h.personalSessions.stop).toHaveBeenCalledTimes(1);
    expect(h.sessions.stop).not.toHaveBeenCalled();
    expect(h.personalSessions.stop.mock.calls[0][0]).toBe('sess-1');
  });

  it('routes a work STOP_SESSION to api.sessions', async () => {
    offlineQueue.enqueue('STOP_SESSION', 'task-1', 'sess-1', { endTime: 100 }, 'op-2', 'work');
    await offlineQueue.processQueue();

    expect(h.sessions.stop).toHaveBeenCalledTimes(1);
    expect(h.personalSessions.stop).not.toHaveBeenCalled();
  });

  it('defaults to api.sessions when kind is omitted', async () => {
    offlineQueue.enqueue('STOP_SESSION', 'task-1', 'sess-1', { endTime: 100 }, 'op-3');
    await offlineQueue.processQueue();

    expect(h.sessions.stop).toHaveBeenCalledTimes(1);
    expect(h.personalSessions.stop).not.toHaveBeenCalled();
  });

  it('routes START_SESSION by kind', async () => {
    offlineQueue.enqueue('START_SESSION', 'task-1', undefined, { startTime: 100 }, 'op-4', 'personal');
    await offlineQueue.processQueue();

    expect(h.personalSessions.start).toHaveBeenCalledTimes(1);
    expect(h.sessions.start).not.toHaveBeenCalled();
  });
});

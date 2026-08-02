import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { offlineQueue, type OfflineOpType } from '../offlineQueue';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    sessions: {
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    },
  },
}));

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
}

describe('offlineQueue', () => {
  const sessions = api.sessions;

  beforeEach(() => {
    offlineQueue.clear();
    setOnline(false);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(sessions.start).mockReset();
    vi.mocked(sessions.pause).mockReset();
    vi.mocked(sessions.resume).mockReset();
    vi.mocked(sessions.stop).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setOnline(true);
  });

  it('enqueues operations, persists them to localStorage, and reports the count', () => {
    const op = offlineQueue.enqueue('START_SESSION', 'task-1');
    expect(op.type).toBe('START_SESSION');
    expect(op.taskId).toBe('task-1');
    expect(op.attempts).toBe(0);
    expect(offlineQueue.getPendingCount()).toBe(1);
    const raw = localStorage.getItem('ff_offline_timer_queue');
    expect(raw).toContain('task-1');
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it('replays queued ops in order and dequeues them on success', async () => {
    offlineQueue.enqueue('START_SESSION', 'task-1');
    offlineQueue.enqueue('PAUSE_SESSION', 'task-1', 'sess-1');
    offlineQueue.enqueue('RESUME_SESSION', 'task-1', 'sess-1');
    offlineQueue.enqueue('STOP_SESSION', 'task-1', 'sess-1');

    vi.mocked(sessions.start).mockResolvedValue({} as never);
    vi.mocked(sessions.pause).mockResolvedValue({} as never);
    vi.mocked(sessions.resume).mockResolvedValue({} as never);
    vi.mocked(sessions.stop).mockResolvedValue({} as never);

    setOnline(true);
    await offlineQueue.processQueue();

    expect(sessions.start).toHaveBeenCalledWith('task-1', expect.any(Number));
    expect(sessions.pause).toHaveBeenCalledWith('sess-1', expect.any(Number));
    expect(sessions.resume).toHaveBeenCalledWith('sess-1', expect.any(Number));
    expect(sessions.stop).toHaveBeenCalledWith('sess-1', expect.any(Number));
    expect(offlineQueue.getPendingCount()).toBe(0);
    expect(localStorage.getItem('ff_offline_timer_queue')).toBe(JSON.stringify([]));
  });

  it('keeps an op queued when the network is lost mid-replay', async () => {
    offlineQueue.enqueue('START_SESSION', 'task-1');
    vi.mocked(sessions.start).mockRejectedValue(new Error('offline'));

    setOnline(true);
    await offlineQueue.processQueue();

    expect(sessions.start).toHaveBeenCalledTimes(1);
    expect(offlineQueue.getPendingCount()).toBe(1);
  });

  it('drops an op that keeps failing after the retry budget', async () => {
    offlineQueue.enqueue('START_SESSION', 'task-1');
    vi.mocked(sessions.start).mockRejectedValue(new Error('flaky'));

    setOnline(true);
    await offlineQueue.processQueue(); // attempt 1 → break (attempts < 3)
    await offlineQueue.processQueue(); // attempt 2 → break
    await offlineQueue.processQueue(); // attempt 3 → dequeue

    expect(sessions.start).toHaveBeenCalledTimes(3);
    expect(offlineQueue.getPendingCount()).toBe(0);
  });

  it('does not auto-process while offline', async () => {
    setOnline(false);
    offlineQueue.enqueue('START_SESSION', 'task-1');
    expect(sessions.start).not.toHaveBeenCalled();
    expect(offlineQueue.getPendingCount()).toBe(1);
  });

  it('uses the payload timestamp when provided', async () => {
    vi.mocked(sessions.start).mockResolvedValue({} as never);
    offlineQueue.enqueue('START_SESSION', 'task-1', undefined, { startTime: 1234 });
    setOnline(true);
    await offlineQueue.processQueue();
    expect(sessions.start).toHaveBeenCalledWith('task-1', 1234);
  });

  it('clear() empties the queue and storage', () => {
    offlineQueue.enqueue('START_SESSION', 'task-1');
    offlineQueue.enqueue('STOP_SESSION', 'task-1', 'sess-1');
    offlineQueue.clear();
    expect(offlineQueue.getPendingCount()).toBe(0);
    expect(localStorage.getItem('ff_offline_timer_queue')).toBe(JSON.stringify([]));
  });

  it('queues all four timer op types', () => {
    const types: OfflineOpType[] = ['START_SESSION', 'PAUSE_SESSION', 'RESUME_SESSION', 'STOP_SESSION'];
    for (const type of types) {
      offlineQueue.enqueue(type, 'task-1', type === 'START_SESSION' ? undefined : 'sess-1');
    }
    expect(offlineQueue.getPendingCount()).toBe(4);
  });
});

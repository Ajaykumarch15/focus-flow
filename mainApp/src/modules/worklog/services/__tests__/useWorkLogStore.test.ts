import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkLogStore } from '../useWorkLogStore';

// IES-P1-20: `loadToday` must not fall back to an arbitrary (e.g. yesterday's)
// active log — when no log has a work entry for today, `todayLog` is null so the
// UI can render a real empty state.
vi.mock('@shared/utils/api', () => ({
  api: {
    workLogs: { list: vi.fn() },
  },
}));

import { api } from '@shared/utils/api';

const listMock = vi.mocked(api.workLogs.list);

function log(_id: string, title: string, date?: string) {
  return { _id, title, workEntries: date ? [{ _id: `e-${_id}`, date, what: 'work' }] : [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  useWorkLogStore.setState({
    activeLogs: [],
    closedLogs: [],
    todayLog: null,
    selectedLogId: null,
    loading: false,
    error: null,
  });
});

afterEach(() => {
  useWorkLogStore.setState({
    activeLogs: [],
    closedLogs: [],
    todayLog: null,
    selectedLogId: null,
    loading: false,
    error: null,
  });
});

describe('useWorkLogStore.loadToday (IES-P1-20)', () => {
  it('returns null todayLog when no active log has a today work entry', async () => {
    listMock.mockResolvedValue([
      log('y1', 'Yesterday', new Date(Date.now() - 86400000).toISOString()),
      log('y2', 'Older'),
    ] as any);

    await useWorkLogStore.getState().loadToday();

    expect(useWorkLogStore.getState().activeLogs).toHaveLength(2);
    expect(useWorkLogStore.getState().todayLog).toBeNull();
    expect(useWorkLogStore.getState().selectedLogId).toBeNull();
  });

  it('sets todayLog to the log that actually has a today work entry', async () => {
    listMock.mockResolvedValue([
      log('y1', 'Yesterday', new Date(Date.now() - 86400000).toISOString()),
      log('t1', 'Today', new Date().toISOString()),
    ] as any);

    await useWorkLogStore.getState().loadToday();

    expect(useWorkLogStore.getState().todayLog?._id).toBe('t1');
    expect(useWorkLogStore.getState().selectedLogId).toBe('t1');
  });

  it('does not pick the newest active log when no entry is from today', async () => {
    listMock.mockResolvedValue([
      log('oldest', 'Oldest', new Date(Date.now() - 3 * 86400000).toISOString()),
      log('fresh', 'Newest active log', new Date(Date.now() - 2 * 86400000).toISOString()),
    ] as any);

    await useWorkLogStore.getState().loadToday();

    expect(useWorkLogStore.getState().todayLog).toBeNull();
  });
});

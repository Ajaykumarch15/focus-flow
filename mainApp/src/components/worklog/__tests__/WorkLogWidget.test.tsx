import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { WorkLogWidget } from '../WorkLogWidget';
import { useWorkLogStore } from '../../../store/useWorkLogStore';
import { mapLog } from '../../../lib/dataMapper';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<MemoryRouter>{node}</MemoryRouter>); });
  return { container, root };
}

describe('WorkLogWidget (no mount-only stale reads)', () => {
  const original = useWorkLogStore.getState();
  const loadTodaySpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    loadTodaySpy.mockClear();
    useWorkLogStore.setState({
      todayLog: null,
      loading: false,
      loadToday: loadTodaySpy,
    });
  });

  afterEach(() => {
    useWorkLogStore.setState({
      todayLog: original.todayLog,
      loading: original.loading,
      loadToday: original.loadToday,
    });
  });

  it('refetches todayLog when it becomes null after mount (no stale closure)', () => {
    render(<WorkLogWidget />);
    expect(loadTodaySpy).toHaveBeenCalledTimes(1);

    // A loaded log should not trigger a refetch.
    act(() => {
      useWorkLogStore.setState({ todayLog: mapLog({ _id: 't1', title: 'Test' }) });
    });
    expect(loadTodaySpy).toHaveBeenCalledTimes(1);

    // Clearing the log (e.g. after a day rollover) must refetch.
    act(() => {
      useWorkLogStore.setState({ todayLog: null });
    });
    expect(loadTodaySpy).toHaveBeenCalledTimes(2);
  });
});

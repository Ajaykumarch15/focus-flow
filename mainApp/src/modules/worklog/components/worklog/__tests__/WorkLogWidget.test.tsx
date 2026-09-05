import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { WorkLogWidget } from '../WorkLogWidget';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { mapLog } from '@shared/utils/dataMapper';

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

  it('renders an empty state when there is no today log (no fabricated data)', () => {
    const { container } = render(<WorkLogWidget />);
    expect(container.textContent).toContain("Start today's work log");
    expect(container.textContent).not.toMatch(/completed today/);
  });

  it('renders the real today log summary when one exists', () => {
    act(() => {
      useWorkLogStore.setState({
        todayLog: mapLog({
          _id: 't1',
          title: 'Test',
          status: 'in-progress',
          currentWork: 'Building the reports page',
          completedItems: [{ _id: 'c1', text: 'Ship widgets', done: true, completedAt: Date.now(), createdAt: Date.now() }],
        }),
      });
    });
    const { container } = render(<WorkLogWidget />);
    expect(container.textContent).toContain('1 thing completed today');
    expect(container.textContent).not.toContain("Start today's work log");
  });
});

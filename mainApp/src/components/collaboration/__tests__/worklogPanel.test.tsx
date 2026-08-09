import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { WorklogPanel } from '../WorklogPanel';
import { timerEngine } from '../../../utils/timerEngine';

// EEP2-P5.4.1 (s2): the panel renders a task's PERSISTED worklog rows fetched
// from GET /api/worklogs/by-task/:taskId — the acceptance is "Mock->persisted":
// nothing here is client-generated mock time.
const byTask = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/api', () => ({
  api: { workLogs: { byTask } },
}));

async function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(node); });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

const log = (overrides: Record<string, unknown> = {}) => ({
  _id: 'wl-1',
  title: 'Board task worklog',
  totalActiveMs: 5_400_000,
  workEntries: [
    { _id: 'e-1', date: '2026-08-02T00:00:00.000Z', what: 'Shipped the board', activeMs: 3_600_000 },
    { _id: 'e-2', date: '2026-08-03T00:00:00.000Z', what: '', activeMs: 1_800_000 },
  ],
  ...overrides,
});

describe('WorklogPanel (EEP2-P5.4.1)', () => {
  beforeEach(() => {
    byTask.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('loads the task\'s persisted worklog rows on mount', async () => {
    byTask.mockResolvedValue([log()]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    expect(byTask).toHaveBeenCalledWith('t-1');
    const text = container.textContent ?? '';
    expect(text).toContain('Worklog');
    act(() => root.unmount());
  });

  it('renders the rollup total and per-day durations from persisted data', async () => {
    byTask.mockResolvedValue([log()]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    // Rollup: 5400000 ms → 1h 30m; entries: 1h + 30m.
    expect(text).toContain('1h 30m');
    expect(text).toContain('1h');
    expect(text).toContain('30m');
    expect(text).toContain('Shipped the board');
    act(() => root.unmount());
  });

  it('sums the rollup across multiple linked logs', async () => {
    byTask.mockResolvedValue([
      log({ _id: 'wl-1', totalActiveMs: 3_600_000, workEntries: [{ _id: 'a', date: '2026-08-02T00:00:00.000Z', what: 'A', activeMs: 3_600_000 }] }),
      log({ _id: 'wl-2', totalActiveMs: 900_000, workEntries: [{ _id: 'b', date: '2026-08-03T00:00:00.000Z', what: 'B', activeMs: 900_000 }] }),
    ]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('1h 15m'); // 3600000 + 900000
    act(() => root.unmount());
  });

  it('shows an honest empty state before any time is logged', async () => {
    byTask.mockResolvedValue([]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    expect(container.textContent).toContain('No time logged yet.');
    act(() => root.unmount());
  });

  it('shows a retry affordance when the load fails', async () => {
    byTask.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([log()]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    expect(container.textContent).toContain("Couldn't load the worklog.");
    const retry = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Retry'));
    await act(async () => { retry!.click(); });
    expect(byTask).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('1h 30m');
    act(() => root.unmount());
  });

  // EEP2-P5.4.2 (s2): acceptance is "Stop timer -> worklog row". While the
  // panel is open, stopping the engine on THIS task (engine transitions to
  // idle) must refetch so the newly-persisted row appears without a manual
  // refresh. Starting the task again must not cause another fetch on its own.
  it('auto-refreshes the rows when the timer stops on this task', async () => {
    byTask.mockResolvedValueOnce([]).mockResolvedValue([log()]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    expect(container.textContent).toContain('No time logged yet.');
    expect(byTask).toHaveBeenCalledTimes(1);

    await act(async () => { await timerEngine.start('t-1', undefined, Date.now()); });
    expect(byTask).toHaveBeenCalledTimes(1);

    await act(async () => { await timerEngine.stop('t-1', Date.now()); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(byTask).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('1h 30m');
    act(() => root.unmount());
  });

  it('does not refetch when a different task stops', async () => {
    byTask.mockResolvedValue([]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    expect(byTask).toHaveBeenCalledTimes(1);

    await act(async () => { await timerEngine.start('t-2', undefined, Date.now()); });
    await act(async () => { await timerEngine.stop('t-2', Date.now()); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(byTask).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('No time logged yet.');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations', async () => {
    byTask.mockResolvedValue([log()]);
    const { container, root } = await render(<WorklogPanel taskId="t-1" />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});

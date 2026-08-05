import { describe, it, expect, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { WorkLogDetailPanel } from '../WorkLogDetailPanel';
import { mapLog } from '../../../lib/dataMapper';
import type { WorkLog } from '../../../store/useWorkLogStore';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<MemoryRouter>{node}</MemoryRouter>); });
  return { container, root };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
}

function activeTab(container: HTMLElement): string {
  const tab = container.querySelector('[role="tab"][aria-selected="true"]');
  return tab?.textContent ?? '';
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function mkLog(overrides: Record<string, unknown> = {}): WorkLog {
  return mapLog({
    _id: 'wl-1',
    title: 'Ship notifications UI',
    status: 'in-progress',
    isActive: true,
    mood: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    totalActiveMs: 9_000_000, // 2h 30m
    workEntries: [{ _id: 'we-1', date: '2026-01-01', what: 'Built the banner', activeMs: 9_000_000 }],
    gitBranch: 'feature/notifications',
    taskRef: { _id: 't-1', title: 'Notifications UI', color: '#0ea5e9', category: 'Work', totalTime: 12_000_000 },
    projectRef: { _id: 'p-1', name: 'FocusFlow' },
    problem: 'Users miss replies without notifications.',
    currentWork: 'Banner + sound toggle.',
    plan: '1. Banner\n2. Settings',
    completedItems: [
      { _id: 'c-1', text: 'Banner component', done: true, createdAt: 1_000_000_000_000, completedAt: 1_050_000_000_000 },
    ],
    links: [{ _id: 'l-1', label: 'PR #42', url: 'https://example.com', category: 'General' }],
    timelineEntries: [
      { _id: 'tl-1', type: 'note', timestamp: 1_000_000_000_000, title: 'Wired up the sound toggle', description: 'audio.play on toast', category: 'Feature' },
      { _id: 'tl-2', type: 'completed_item', timestamp: 1_100_000_000_000, title: 'Ship banner variants', description: 'merged to main', category: 'Feature' },
    ],
    ...overrides,
  });
}

describe('WorkLogDetailPanel (S3-T1 detail surface)', () => {
  it('renders the hero: title, status, mood, task, project, branch', () => {
    const { container, root } = render(<WorkLogDetailPanel workLog={mkLog()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Ship notifications UI');
    expect(text).toContain('In Progress');
    expect(text).toContain('Notifications UI');
    expect(text).toContain('FocusFlow');
    expect(text).toContain('feature/notifications');
    act(() => root.unmount());
  });

  it('renders the stats row from real log data', () => {
    const { container, root } = render(<WorkLogDetailPanel workLog={mkLog()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('2h 30m');   // formatMs(totalActiveMs)
    expect(text).toContain('2.5h');     // avg / day
    expect(text).toContain('1/1');      // completedCount / totalItemsCount
    act(() => root.unmount());
  });

  it('highlights "Where I stopped" with the newest timeline node', () => {
    const { container, root } = render(<WorkLogDetailPanel workLog={mkLog()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Where I stopped');
    expect(text).toContain('Ship banner variants');
    expect(text).toContain('Completed item');
    expect(text).toContain('merged to main');
    act(() => root.unmount());
  });

  it('shows the honest empty state when the log has no activity events', () => {
    const { container, root } = render(
      <WorkLogDetailPanel workLog={mkLog({ timelineEntries: [], completedItems: [], decisions: [], blockerList: [], progressSnapshots: [] })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Where I stopped');
    expect(text).toContain('No activity captured on this work log yet.');
    act(() => root.unmount());
  });

  it('"View timeline →" jumps from the highlighted node to the timeline tab', () => {
    const { container, root } = render(<WorkLogDetailPanel workLog={mkLog()} />);
    expect(activeTab(container)).toContain('Overview');
    act(() => buttonByText(container, 'View timeline')!.click());
    expect(activeTab(container)).toContain('Timeline');
    act(() => root.unmount());
  });

  it('switches tabs from the tab bar and back', () => {
    const { container, root } = render(<WorkLogDetailPanel workLog={mkLog()} />);
    act(() => buttonByText(container, 'Decisions')!.click());
    expect(activeTab(container)).toContain('Decisions');
    act(() => buttonByText(container, 'Overview')!.click());
    expect(activeTab(container)).toContain('Overview');
    act(() => root.unmount());
  });

  it('calls onBack from the back button', () => {
    const onBack = vi.fn();
    const { container, root } = render(<WorkLogDetailPanel workLog={mkLog()} onBack={onBack} />);
    act(() => buttonByText(container, 'Back to Work Logs')!.click());
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on the detail surface', async () => {
    const { container, root } = render(<WorkLogDetailPanel workLog={mkLog()} />);
    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});

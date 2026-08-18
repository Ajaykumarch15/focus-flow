import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { FocusMode } from '../FocusMode';
import { useStore } from '../../store/useStore';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { Task } from '../../types';

// Both panels must mount without network/timer surprises: the left column reads
// the live timer hook (stubbed deterministically) and the right column fetches
// server session docs through the existing api layer (stubbed).
const timerMock = vi.hoisted(() => ({
  activeTaskId: null as string | null,
  activeSessionId: null as string | null,
  activeTimerState: 'idle' as 'idle' | 'running' | 'paused',
  activeTask: null as Task | null,
  display: '01:00:00',
  elapsedMs: 0,
  baseElapsedMs: 0,
  sessionStartTime: 0,
  totalPauseDuration: 0,
}));

vi.mock('../../hooks/useActiveTimer', () => ({
  useActiveTimer: () => timerMock,
}));

const apiMock = vi.hoisted(() => ({
  sessions: {
    list: vi.fn(async () => [] as any[]),
  },
}));

vi.mock('../../utils/api', () => ({ api: apiMock }));

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/focus']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

async function flush() {
  await act(async () => {});
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('FocusMode page (S1-T6)', () => {
  beforeEach(() => {
    Object.assign(timerMock, {
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
      activeTask: null,
      display: '01:00:00',
      elapsedMs: 0,
      baseElapsedMs: 0,
      sessionStartTime: 0,
      totalPauseDuration: 0,
    });
    apiMock.sessions.list.mockReset();
    apiMock.sessions.list.mockResolvedValue([]);

    useStore.setState({
      dataLoading: false,
      dataError: null,
      tasks: [],
      journals: [],
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
      loadAll: vi.fn(async () => {}),
      addJournal: vi.fn(async () => {}),
      startTimer: vi.fn(async () => {}),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      stopTimer: vi.fn(async () => {}),
      toggleSubtask: vi.fn(async () => {}),
      getTodayTime: () => 0,
    });
    useWorkLogStore.setState({ activeLogs: [], closedLogs: [] });
    useCollaborationStore.setState({
      workspaces: [],
      activeWorkspaceId: 'ws-1',
      projects: [],
      sprints: [],
      features: [],
      tasks: [],
      blockers: [],
    });
  });

  it('renders a responsive grid that stacks on mobile and splits on xl', async () => {
    const { container, root } = render(<FocusMode />);
    await flush();

    const grid = container.firstElementChild as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('xl:grid-cols-');
    expect(grid.className).toContain('gap-5');

    expect(grid.children.length).toBe(2);
    act(() => root.unmount());
  });

  it('mounts both the focus session panel and the engineering memory panel', async () => {
    const { container, root } = render(<FocusMode />);
    await flush();

    const grid = container.firstElementChild as HTMLElement;
    const left = grid.children[0] as HTMLElement;
    const right = grid.children[1] as HTMLElement;

    expect(left.textContent).toContain('Nothing focused yet');
    expect(left.textContent).toContain('No unfinished tasks right now');
    expect(right.textContent).toContain('Engineering Memory');
    expect(right.textContent).toContain('No memory yet');
    expect(apiMock.sessions.list).toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('keeps both columns readable when a focus task is selected', async () => {
    useStore.setState({
      tasks: [{ id: 't-1', title: 'Build the focus workspace', description: '', priority: 'medium', status: 'todo', category: 'Work', color: '#0ea5e9', tags: [], subtasks: [], sessions: [], totalTime: 1_800_000, order: 0, createdAt: Date.now() - 60_000, updatedAt: Date.now() - 60_000 }],
      activeTaskId: 't-1',
    });
    const { container, root } = render(<FocusMode />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Build the focus workspace');
    expect(text).toContain('Start Focus Session');
    expect(text).toContain('Engineering Memory');
    expect(text).toContain('Total time on task');
    act(() => root.unmount());
  });

  it('passes accessibility checks for the stacked page', async () => {
    const { container, root } = render(<FocusMode />);
    await flush();
    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});

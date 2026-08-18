import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { PersonalActivityTimeline } from '../PersonalActivityTimeline';
import { useStore } from '../../../store/useStore';
import { useWorkLogStore } from '../../../store/useWorkLogStore';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import { useAuthStore } from '../../../store/useAuthStore';
import type { Task, JournalEntry } from '../../../types';
import type { WorkLog } from '../../../store/useWorkLogStore';

function atLocalDaysAgo(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + 60_000; // just after that day's local midnight
}

function mkTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'Work',
    color: '#0ea5e9',
    tags: [],
    subtasks: [],
    sessions: [],
    totalTime: 0,
    order: 0,
    createdAt: atLocalDaysAgo(5),
    updatedAt: atLocalDaysAgo(5),
    ...overrides,
  };
}

function mkJournal(id: string, content: string, createdAt: number): JournalEntry {
  return {
    id, taskId: 't-1', content, mood: 4, focusRating: 3,
    createdAt, updatedAt: createdAt,
  };
}

function mkLog(id: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    updatedAt: '2026-08-01T10:00:00.000Z',
    timelineEntries: [],
    completedItems: [],
    decisions: [],
    blockerList: [],
    workEntries: [],
    currentWork: '',
    plan: '',
    ...overrides,
  } as WorkLog;
}

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/activity']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

async function flush() {
  await act(async () => {});
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function seedEmptyStores() {
  useStore.setState({
    dataLoading: false,
    dataError: null,
    tasks: [],
    journals: [],
    loadAll: vi.fn(async () => {}),
    startTimer: vi.fn(async () => {}),
  });
  useWorkLogStore.setState({ activeLogs: [], closedLogs: [] });
  useCollaborationStore.setState({
    blockers: [],
    features: [],
    workspaces: [],
    activeWorkspaceId: 'ws-1',
    projects: [],
    sprints: [],
    tasks: [],
  });
  useAuthStore.setState({ user: null });
}

describe('PersonalActivityTimeline (S1-T7)', () => {
  beforeEach(() => {
    seedEmptyStores();
  });

  it('renders a responsive layout header with the page title', () => {
    useStore.setState({ tasks: [mkTask('t-1', { createdAt: atLocalDaysAgo(0) })] });
    const { container, root } = render(<PersonalActivityTimeline />);

    const text = container.textContent ?? '';
    expect(text).toContain('Personal Activity');
    expect(text).toContain('Task t-1');
    expect(container.firstElementChild?.className).toContain('p-6 lg:p-8');
    act(() => root.unmount());
  });

  it('groups events into Today / Yesterday / This Week / Earlier', () => {
    useStore.setState({
      journals: [
        mkJournal('j-today', 'today note', atLocalDaysAgo(0)),
        mkJournal('j-week', 'week note', atLocalDaysAgo(3)),
        mkJournal('j-early', 'early note', atLocalDaysAgo(10)),
      ],
      tasks: [mkTask('t-y', { createdAt: atLocalDaysAgo(1) })],
    });
    const { container, root } = render(<PersonalActivityTimeline />);

    const text = container.textContent ?? '';
    expect(text).toContain('Today');
    expect(text).toContain('Yesterday');
    expect(text).toContain('This Week');
    expect(text).toContain('Earlier');
    expect(text).toContain('today note');
    expect(text).toContain('Task t-y');
    expect(text).toContain('week note');
    expect(text).toContain('early note');
    act(() => root.unmount());
  });

  it('renders mixed event types with their kind labels', () => {
    useWorkLogStore.setState({
      activeLogs: [mkLog('wl-1', {
        timelineEntries: [
          { _id: 'e-1', type: 'timer_start', timestamp: atLocalDaysAgo(0), title: 'Timer started', description: '', category: '' },
          { _id: 'e-2', type: 'decision', timestamp: atLocalDaysAgo(0), title: 'Zustand over Redux', description: 'Adopted Zustand.', category: 'Architecture' },
          { _id: 'e-3', type: 'blocker', timestamp: atLocalDaysAgo(0), title: 'Mongo down', description: 'Restart needed', category: '' },
          { _id: 'e-4', type: 'completed_item', timestamp: atLocalDaysAgo(0), title: 'Shipped the parser', description: '', category: 'feature' },
        ],
      })],
    });
    const { container, root } = render(<PersonalActivityTimeline />);

    const text = container.textContent ?? '';
    expect(text).toContain('Timer started');
    expect(text).toContain('Decision');
    expect(text).toContain('Zustand over Redux');
    expect(text).toContain('Blocker reported');
    expect(text).toContain('Mongo down');
    expect(text).toContain('Completed item');
    expect(text).toContain('Shipped the parser');
    act(() => root.unmount());
  });

  it('shows the honest brand-new user empty state', () => {
    const { container, root } = render(<PersonalActivityTimeline />);
    const text = container.textContent ?? '';
    expect(text).toContain('Nothing here yet');
    expect(text).toContain('this timeline will build itself');
    act(() => root.unmount());
  });

  it('applies the Today range filter', () => {
    useStore.setState({
      journals: [
        mkJournal('j-today', 'today note', atLocalDaysAgo(0)),
        mkJournal('j-yesterday', 'yesterday note', atLocalDaysAgo(1)),
      ],
    });
    const { container, root } = render(<PersonalActivityTimeline />);
    const textBefore = container.textContent ?? '';
    expect(textBefore).toContain('yesterday note');

    const group = container.querySelector('[role="group"][aria-label="Time range"]');
    const todayButton = Array.from(group!.querySelectorAll('button')).find((b) => b.textContent === 'Today');
    act(() => todayButton!.click());

    const textAfter = container.textContent ?? '';
    expect(textAfter).toContain('today note');
    expect(textAfter).not.toContain('yesterday note');
    act(() => root.unmount());
  });

  it('filters by event type', () => {
    useStore.setState({
      journals: [mkJournal('j-1', 'journal note', atLocalDaysAgo(0))],
      tasks: [mkTask('t-1', { createdAt: atLocalDaysAgo(0) })],
    });
    const { container, root } = render(<PersonalActivityTimeline />);
    expect(container.textContent).toContain('journal note');

    const select = container.querySelector('select[aria-label="Filter by event type"]') as HTMLSelectElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, 'journal');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('journal note');
    expect(text).not.toContain('Task t-1');
    act(() => root.unmount());
  });

  it('shows a filter-miss empty state with a working Clear filters action', () => {
    useStore.setState({ journals: [mkJournal('j-1', 'journal note', atLocalDaysAgo(0))] });
    const { container, root } = render(<PersonalActivityTimeline />);

    const select = container.querySelector('select[aria-label="Filter by event type"]') as HTMLSelectElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, 'session_start');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('No activity matches these filters');

    act(() => buttonByText(container, 'Clear filters')!.click());
    expect(container.textContent).toContain('journal note');
    act(() => root.unmount());
  });

  it('resumes an unfinished task from a session-start event', async () => {
    const startTimer = vi.fn(async () => {});
    useStore.setState({
      tasks: [mkTask('t-1', { createdAt: atLocalDaysAgo(0), sessions: [{ id: 's-1', startTime: atLocalDaysAgo(0), activeTime: 1_800_000, totalPauseDuration: 0 }] })],
      startTimer,
    });
    const { container, root } = render(<PersonalActivityTimeline />);
    await flush();

    act(() => buttonByText(container, 'Resume')!.click());
    await flush();

    expect(startTimer).toHaveBeenCalledWith('t-1');
    act(() => root.unmount());
  });

  it('opens a task instead of resuming when the task is already completed', () => {
    useStore.setState({
      tasks: [mkTask('t-1', { status: 'completed', createdAt: atLocalDaysAgo(0) })],
    });
    const { container, root } = render(<PersonalActivityTimeline />);

    expect(buttonByText(container, 'Resume')).toBeNull();
    expect(buttonByText(container, 'Open Task')).not.toBeNull();
    act(() => root.unmount());
  });

  it('links work-log events to the work log', () => {
    useWorkLogStore.setState({
      activeLogs: [mkLog('wl-1', {
        timelineEntries: [
          { _id: 'e-1', type: 'note', timestamp: atLocalDaysAgo(0), title: 'Investigated latency', description: '', category: '' },
        ],
      })],
    });
    const { container, root } = render(<PersonalActivityTimeline />);
    expect(buttonByText(container, 'Open Work Log')).not.toBeNull();
    act(() => root.unmount());
  });

  it('shows a loading skeleton while initial data is still fetching', () => {
    useStore.setState({ dataLoading: true, tasks: [] });
    const { container, root } = render(<PersonalActivityTimeline />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    act(() => root.unmount());
  });

  it('surfaces a data error with a working retry', async () => {
    useStore.setState({
      dataError: 'Timeline data failed to load',
      loadAll: vi.fn(async () => {
        useStore.setState({ dataError: null });
      }),
    });
    const { container, root } = render(<PersonalActivityTimeline />);

    expect(container.textContent).toContain('Timeline data failed to load');
    const retry = buttonByText(container, 'Retry');
    expect(retry).not.toBeNull();

    act(() => retry!.click());
    await flush();
    expect(container.textContent).not.toContain('Timeline data failed to load');
    act(() => root.unmount());
  });

  it('passes accessibility checks with populated activity', async () => {
    useStore.setState({
      tasks: [mkTask('t-1', {
        createdAt: atLocalDaysAgo(0),
        sessions: [{ id: 's-1', startTime: atLocalDaysAgo(0), activeTime: 900_000, totalPauseDuration: 0 }],
      })],
      journals: [mkJournal('j-1', 'Shipped the engine.', atLocalDaysAgo(0))],
    });
    useWorkLogStore.setState({
      activeLogs: [mkLog('wl-1', {
        timelineEntries: [
          { _id: 'e-1', type: 'decision', timestamp: atLocalDaysAgo(0), title: 'Chose vite', description: 'Bundler decided.', category: 'Architecture' },
        ],
      })],
    });
    const { container, root } = render(<PersonalActivityTimeline />);
    await flush();

    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});

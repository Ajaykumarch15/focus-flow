import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { InsightsPage } from '../InsightsPage';
import { useStore } from '../../store/useStore';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { startOfDay, startOfIsoWeekInTz } from '../../utils/time';
import type { Task, JournalEntry } from '../../types';
import type { WorkLog } from '../../store/useWorkLogStore';

// The page reads session docs through the existing api layer; the module is
// stubbed so history is deterministic and the network is never touched.
const apiMock = vi.hoisted(() => ({
  sessions: {
    list: vi.fn(async () => [] as any[]),
  },
}));

vi.mock('../../utils/api', () => ({ api: apiMock }));

const HOUR = 3600000;
const DAY_START = startOfDay(Date.now());

function sessionDoc(id: string, overrides: Record<string, any> = {}): Record<string, any> {
  const startTime = DAY_START + 9 * HOUR;
  return {
    _id: id,
    taskId: 't-1',
    startTime,
    endTime: startTime + 30 * 60 * 1000,
    activeTime: 30 * 60 * 1000,
    totalPauseDuration: 0,
    pauseCount: 0,
    isActive: false,
    focusScore: 84,
    pauseLog: [],
    ...overrides,
  };
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
    createdAt: DAY_START - 2 * 86400000,
    updatedAt: DAY_START,
    subtasks: [],
    sessions: [],
    totalTime: 0,
    tags: [],
    ...overrides,
  };
}

function mkJournal(id: string, createdAt: number): JournalEntry {
  return { id, taskId: 't-1', content: 'Reflection', mood: 4, focusRating: 3, createdAt, updatedAt: createdAt };
}

function mkLog(id: string, completedAt: number): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    updatedAt: new Date(DAY_START + 10 * HOUR).toISOString(),
    blockerList: [],
    workEntries: [],
    completedItems: [{ _id: 'c-1', text: 'Shipped export', category: 'feature' as const, done: true, completedAt, createdAt: completedAt }],
    currentWork: '',
    plan: '',
  } as unknown as WorkLog;
}

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/insights']}>{node}</MemoryRouter>);
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

function seededStore() {
  useStore.setState({
    dataLoading: false,
    dataError: null,
    tasks: [
      mkTask('t-1', { status: 'completed', updatedAt: DAY_START + 11 * HOUR }),
      mkTask('t-2', { status: 'active' }),
    ],
    journals: [mkJournal('j-1', DAY_START + 10 * HOUR)],
    activeTaskId: null,
    activeSessionId: null,
    activeTimerState: 'idle',
    currentSessionStart: undefined,
    currentPauseStart: undefined,
    profile: {
      name: 'Ada',
      dailyGoal: 8 * HOUR,
      pomodoroWork: 25,
      pomodoroBreak: 5,
      timezone: 'UTC',
      streak: { current: 0, best: 0, lastDate: '' },
      totalPoints: 0,
      leaderboardOptIn: false,
    },
    theme: {
      mode: 'dark',
      accentColor: '#0ea5e9',
      fontSize: 'md',
      glassmorphism: false,
      animatedBackground: false,
      reducedMotion: false,
    },
  });
  useWorkLogStore.setState({
    todayLog: null,
    activeLogs: [mkLog('l-1', DAY_START + 9 * HOUR)],
    closedLogs: [],
    loadActive: vi.fn(async () => {}),
    loadClosed: vi.fn(async () => {}),
    loadToday: vi.fn(async () => {}),
  });
}

describe('InsightsPage (PI-1.1)', () => {
  const originalStore = useStore.getState();
  const originalWorkLogs = useWorkLogStore.getState();

  beforeEach(() => {
    apiMock.sessions.list.mockReset();
    apiMock.sessions.list.mockResolvedValue([]);
    seededStore();
  });

  afterEach(() => {
    useStore.setState(originalStore);
    useWorkLogStore.setState(originalWorkLogs);
  });

  it('renders the featured Most Important insight and the Today grid from tracked data', async () => {
    apiMock.sessions.list.mockResolvedValue([
      sessionDoc('s-1', { taskId: 't-1', pauseCount: 2, totalPauseDuration: 10 * 60 * 1000 }),
      sessionDoc('s-2', { taskId: 't-2', startTime: DAY_START + 10 * HOUR, activeTime: 15 * 60 * 1000, pauseCount: 1 }),
    ]);
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Personal Insights');
    expect(text).toContain('Most Important');
    expect(text).toContain('daily focus goal');
    expect(text).toContain("Today's Insights");
    expect(text).toContain('Focus time today');
    expect(text).toContain('Interruptions');
    expect(text).toContain('Tasks completed');
    expect(text).toContain('Work-log completions');
    expect(text).toContain('Journal reflection');
    expect(text).toContain('high confidence');
    expect(text).toContain('Today ·');
    expect(text).toContain('Supporting metrics');
    act(() => root.unmount());
  });

  it('shows an honest empty state when the day has no data yet', async () => {
    useStore.setState({ tasks: [], journals: [], profile: useStore.getState().profile });
    useWorkLogStore.setState({ todayLog: null, activeLogs: [], closedLogs: [] });
    apiMock.sessions.list.mockResolvedValue([]);
    const { container, root } = render(<InsightsPage />);
    await flush();
    expect(container.textContent).toContain('Not enough data yet.');
    expect(container.textContent).toContain('nothing is guessed');
    act(() => root.unmount());
  });

  it('renders skeletons while session history loads', () => {
    apiMock.sessions.list.mockReturnValue(new Promise(() => {}));
    const { container, root } = render(<InsightsPage />);
    expect(container.querySelector('[aria-label="Loading insights"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('lays out Today insights in a responsive grid', async () => {
    apiMock.sessions.list.mockResolvedValue([sessionDoc('s-1')]);
    const { container, root } = render(<InsightsPage />);
    await flush();
    const grid = Array.from(container.querySelectorAll('div')).find((el) =>
      el.className.includes('grid-cols-1') && el.className.includes('md:grid-cols-2') && el.className.includes('xl:grid-cols-3'),
    );
    expect(grid).toBeTruthy();
    act(() => root.unmount());
  });

  it('renders the This Week section alongside Today from tracked data', async () => {
    const weekStart = startOfIsoWeekInTz(Date.now(), 'UTC');
    apiMock.sessions.list.mockResolvedValue([
      sessionDoc('s-today', { taskId: 't-1', pauseCount: 2, totalPauseDuration: 10 * 60 * 1000 }),
      sessionDoc('w-mon', { taskId: 't-2', startTime: weekStart + 9 * HOUR, activeTime: 2 * HOUR }),
      sessionDoc('w-tue', { taskId: 't-1', startTime: weekStart + 33 * HOUR, activeTime: 90 * 60 * 1000 }),
    ]);
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain("Today's Insights");
    expect(text).toContain("This Week's Insights");
    expect(text).toContain('Focus time this week');
    expect(text).toContain('Active days this week');
    expect(text).toContain('Weekly Focus');
    expect(text).toContain('Week ·');
    act(() => root.unmount());
  });

  it('shows the weekly section when today has no data yet', async () => {
    const weekStart = startOfIsoWeekInTz(Date.now(), 'UTC');
    apiMock.sessions.list.mockResolvedValue([
      sessionDoc('w-mon', { taskId: 't-1', startTime: weekStart + 9 * HOUR, activeTime: 2 * HOUR }),
    ]);
    useStore.setState({ tasks: [], journals: [], profile: useStore.getState().profile });
    useWorkLogStore.setState({ todayLog: null, activeLogs: [], closedLogs: [] });
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain("This Week's Insights");
    expect(text).toContain('Focus time this week');
    expect(text).toContain('Weekly Focus');
    expect(text).not.toContain('Not enough data yet.');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    apiMock.sessions.list.mockResolvedValue([
      sessionDoc('s-1', { pauseCount: 2, totalPauseDuration: 10 * 60 * 1000 }),
      sessionDoc('s-2', { taskId: 't-2', startTime: DAY_START + 10 * HOUR, activeTime: 15 * 60 * 1000, pauseCount: 1 }),
    ]);
    const { container, root } = render(<InsightsPage />);
    await flush();
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});

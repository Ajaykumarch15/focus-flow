import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { InsightsPage } from '../InsightsPage';
import { useStore } from '../../store/useStore';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { startOfDay, startOfIsoWeekInTz } from '../../utils/time';
import type { Task, JournalEntry } from '../../types';
import type { KnowledgeDoc } from '../../types/collaboration';
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
    order: 0,
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
      ...patternSessions(),
    ]);
    const { container, root } = render(<InsightsPage />);
    await flush();
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});

// ── PI-1.3: Work Pattern layer on the /insights page ──────────────────────────
// Sessions are placed only in prior ISO weeks so the daily and weekly sections
// stay quiet while the trailing 4-week window powers the pattern section.

function patternSessions(): Record<string, any>[] {
  const weekStart = startOfIsoWeekInTz(Date.now(), 'UTC');
  const docs: Record<string, any>[] = [];
  for (let w = 1; w <= 3; w++) {
    const base = weekStart - w * 7 * 86400000;
    for (const day of [0, 1, 2, 3]) {
      docs.push(sessionDoc(`pm-${w}-${day}`, {
        taskId: 't-1',
        startTime: base + day * 86400000 + 9 * HOUR,
        activeTime: 30 * 60 * 1000,
      }));
    }
    docs.push(sessionDoc(`pa-${w}`, {
      taskId: 't-2',
      startTime: base + 4 * 86400000 + 14 * HOUR,
      activeTime: 30 * 60 * 1000,
    }));
  }
  docs.push(sessionDoc('pa-extra', {
    taskId: 't-1',
    startTime: weekStart - 7 * 86400000 + 4 * 86400000 + 14 * HOUR,
    activeTime: 30 * 60 * 1000,
  }));
  return docs;
}

describe('InsightsPage (PI-1.3)', () => {
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

  it('renders the Work Pattern section with a featured Pattern Focus card', async () => {
    apiMock.sessions.list.mockResolvedValue(patternSessions());
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Work Pattern Insights');
    expect(text).toContain('Pattern Focus');
    expect(text).toContain('Peak focus window');
    expect(text).toContain('Protect this window');
    expect(text).toContain('Last 4 weeks ·');
    expect(container.querySelector('#insights-pattern-heading')).toBeTruthy();
    act(() => root.unmount());
  });

  it('shows the Work Pattern section alone when daily and weekly have no data', async () => {
    apiMock.sessions.list.mockResolvedValue(patternSessions());
    useStore.setState({ tasks: [], journals: [], profile: useStore.getState().profile });
    useWorkLogStore.setState({ todayLog: null, activeLogs: [], closedLogs: [] });
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Work Pattern Insights');
    expect(text).not.toContain("Today's Insights");
    expect(text).not.toContain("This Week's Insights");
    expect(text).not.toContain('Not enough data yet.');
    act(() => root.unmount());
  });

  it('places the Work Pattern section below the weekly section', async () => {
    const weekStart = startOfIsoWeekInTz(Date.now(), 'UTC');
    apiMock.sessions.list.mockResolvedValue([
      sessionDoc('w-mon', { taskId: 't-1', startTime: weekStart + 9 * HOUR, activeTime: 2 * HOUR }),
      ...patternSessions(),
    ]);
    const { container, root } = render(<InsightsPage />);
    await flush();

    const weekHeading = container.querySelector('#insights-week-heading');
    const patternHeading = container.querySelector('#insights-pattern-heading');
    expect(weekHeading).toBeTruthy();
    expect(patternHeading).toBeTruthy();
    expect(weekHeading!.compareDocumentPosition(patternHeading!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => root.unmount());
  });
});

// ── PI-1.4: Task layer on the /insights page ──────────────────────────────────
// The Task section reads the open task list as-of now. Deadlines use Date.now()
// so the live snapshot rules (today = Aug 5-like anchor, overdue = any day key
// before today) apply without freezing a clock.

describe('InsightsPage (PI-1.4)', () => {
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

  it('renders the Task Insights section with a featured Task Focus card for overdue work', async () => {
    const now = Date.now();
    useStore.setState({
      tasks: [
        mkTask('t-over', { deadline: now - 2 * 86400000 }),
        mkTask('t-future', { deadline: now + 3 * 86400000 }),
      ],
      journals: [],
    });
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Task Insights');
    expect(text).toContain('Task Focus');
    expect(text).toContain('Overdue tasks');
    expect(text).toContain('1 task past their deadline');
    expect(text).toContain('open tasks');
    expect(container.querySelector('#insights-task-heading')).toBeTruthy();
    act(() => root.unmount());
  });

  it('keeps the Task section hidden when there are no open tasks', async () => {
    useStore.setState({ tasks: [], journals: [] });
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).not.toContain('Task Insights');
    expect(text).not.toContain('Task Focus');
    expect(text).not.toContain('Overdue tasks');
    act(() => root.unmount());
  });
});

// ── PI-1.5: Knowledge layer on the /insights page ─────────────────────────────
// The Knowledge section reuses the collaboration store's docs plus work-log
// decisions/lessons/links. An empty base keeps the section honest and hidden.

function mkDoc(id: string): KnowledgeDoc {
  return {
    id,
    workspaceId: 'ws-1',
    title: `Doc ${id}`,
    category: 'Architecture',
    content: '# Notes',
    authorId: 'u-1',
    version: 1,
    tags: [],
    createdAt: new Date(DAY_START - 5 * 86400000).toISOString(),
    updatedAt: new Date(DAY_START - 5 * 86400000).toISOString(),
  };
}

function seedLog(id: string): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'done',
    isActive: false,
    createdAt: new Date(DAY_START + 8 * HOUR).toISOString(),
    updatedAt: new Date(DAY_START + 10 * HOUR).toISOString(),
    blockerList: [],
    workEntries: [],
    completedItems: [],
    currentWork: '',
    plan: '',
    decisions: [{
      _id: 'dec-1', title: 'Use Postgres', context: '', decision: 'switch', alternatives: '',
      rationale: 'consistency', timestamp: DAY_START + 5 * HOUR,
    }],
    problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: 'Ship smaller batches' },
    links: [{ _id: 'lk-1', label: 'RFC', url: 'https://rfc.example', category: 'GitHub' }],
  } as unknown as WorkLog;
}

describe('InsightsPage (PI-1.5)', () => {
  const originalStore = useStore.getState();
  const originalWorkLogs = useWorkLogStore.getState();
  const originalCollab = useCollaborationStore.getState();

  beforeEach(() => {
    apiMock.sessions.list.mockReset();
    apiMock.sessions.list.mockResolvedValue([]);
    seededStore();
    useCollaborationStore.setState({ docs: [mkDoc('d-1')] });
    useWorkLogStore.setState({ closedLogs: [seedLog('l-1')] });
  });

  afterEach(() => {
    useStore.setState(originalStore);
    useWorkLogStore.setState(originalWorkLogs);
    useCollaborationStore.setState(originalCollab);
  });

  it('renders the Knowledge Insights section with a featured Knowledge Focus card', async () => {
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Knowledge Insights');
    expect(text).toContain('Knowledge Focus');
    expect(text).toContain('Knowledge base');
    expect(text).toContain('Knowledge docs');
    expect(container.querySelector('#insights-knowledge-heading')).toBeTruthy();
    act(() => root.unmount());
  });

  it('keeps the Knowledge section hidden without docs or decision-bearing logs', async () => {
    useCollaborationStore.setState({ docs: [] });
    useWorkLogStore.setState({ closedLogs: [] });
    useStore.setState({ tasks: [], journals: [] });
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).not.toContain('Knowledge Insights');
    expect(text).not.toContain('Knowledge Focus');
    expect(text).not.toContain('Knowledge base');
    act(() => root.unmount());
  });

  it('shows the five-way empty state when every insights layer has no data', async () => {
    useCollaborationStore.setState({ docs: [] });
    useWorkLogStore.setState({ todayLog: null, activeLogs: [], closedLogs: [] });
    useStore.setState({ tasks: [], journals: [] });
    const { container, root } = render(<InsightsPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Not enough data yet.');
    expect(text).toContain('daily, weekly, work-pattern, task, and knowledge insights');
    expect(text).not.toContain('Task Insights');
    expect(text).not.toContain('Knowledge Insights');
    expect(text).not.toContain("Today's Insights");
    act(() => root.unmount());
  });
});

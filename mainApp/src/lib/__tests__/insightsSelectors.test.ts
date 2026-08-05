import { describe, it, expect } from 'vitest';
import { selectDailyInsights, type DailyInsight } from '../insightsSelectors';
import type { MemorySession } from '../memorySelectors';
import type { Task, JournalEntry } from '../../types';
import type { WorkLog } from '../../store/useWorkLogStore';

// ── PI-1.1: pure Daily Insights selector tests (Phase PI) ─────────────────────
// Every insight must be deterministic, traceable to its supporting metrics, and
// absent when the day's data is too thin — no fabricated observations.

const NOW = Date.UTC(2026, 7, 5, 12, 0, 0); // Wed, Aug 5 2026 · noon UTC
const DAY_START = Date.UTC(2026, 7, 5, 0, 0, 0);
const DAY_END = DAY_START + 86400000 - 1;
const MIN = 60 * 1000;
const HOUR = 3600000;
const TZ = 'UTC';
const GOAL = 8 * HOUR;

function session(id: string, overrides: Partial<MemorySession> = {}): MemorySession {
  return {
    id,
    taskId: 't-1',
    startTime: DAY_START + 9 * HOUR,
    endTime: DAY_START + 9 * HOUR + 30 * MIN,
    activeTime: 30 * MIN,
    totalPauseDuration: 0,
    pauseCount: 0,
    isActive: false,
    focusScore: 80,
    pauseLog: [],
    ...overrides,
  };
}

function task(id: string, overrides: Partial<Task> = {}): Task {
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

function journal(id: string, createdAt: number, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id,
    taskId: 't-1',
    content: 'Reflection',
    mood: 4,
    focusRating: 3,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function log(id: string, items: { completedAt: number; text: string }[]): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    updatedAt: '2026-08-05T10:00:00.000Z',
    blockerList: [],
    workEntries: [],
    completedItems: items.map((item) => ({
      _id: `c-${item.completedAt}`,
      text: item.text,
      category: 'feature' as const,
      done: true,
      completedAt: item.completedAt,
      createdAt: item.completedAt,
    })),
    currentWork: '',
    plan: '',
  } as unknown as WorkLog;
}

function base() {
  return {
    sessions: [session('s-1')],
    tasks: [task('t-1', { status: 'completed', updatedAt: DAY_START + 11 * HOUR })],
    journals: [journal('j-1', DAY_START + 10 * HOUR)],
    workLogs: [log('l-1', [{ completedAt: DAY_START + 9 * HOUR, text: 'Shipped export' }])],
    dailyGoalMs: GOAL,
    now: NOW,
    timeZone: TZ,
  };
}

function findById(list: DailyInsight[], id: string): DailyInsight {
  const found = list.find((i) => i.id === id);
  expect(found).toBeDefined();
  return found as DailyInsight;
}

describe('selectDailyInsights (PI-1.1)', () => {
  it('labels the time period for today', () => {
    const view = selectDailyInsights(base());
    expect(view.periodLabel).toBe('Today · Wed, Aug 5');
    expect(view.sessionCount).toBe(1);
  });

  it('features the daily-goal shortfall as Most Important when a goal is set', () => {
    const view = selectDailyInsights(base());
    expect(view.mostImportant?.id).toBe('daily-goal');
    expect(view.mostImportant?.observation).toContain('short of your 8.0h daily focus goal');
    expect(view.mostImportant?.action?.label).toBe('Reach the goal');
    expect(view.mostImportant?.metrics.map((m) => m.label)).toEqual(['Focused', 'Daily goal', 'Progress']);
    expect(view.todays.map((i) => i.id)).not.toContain('daily-goal');
  });

  it('celebrates reaching the daily goal with no action', () => {
    const view = selectDailyInsights({
      ...base(),
      sessions: [session('s-1', { activeTime: 9 * HOUR })],
    });
    expect(view.mostImportant?.id).toBe('daily-goal');
    expect(view.mostImportant?.observation).toContain('reached your daily focus goal');
    expect(view.mostImportant?.action).toBeUndefined();
  });

  it('falls back to completed tasks when no goal is set', () => {
    const view = selectDailyInsights({ ...base(), dailyGoalMs: 0 });
    expect(view.mostImportant?.id).toBe('completed-today');
    expect(view.todays.map((i) => i.id)).not.toContain('completed-today');
  });

  it('falls back to the longest session when no goal and nothing completed', () => {
    const view = selectDailyInsights({
      ...base(),
      dailyGoalMs: 0,
      tasks: [task('t-1', { status: 'active' })],
    });
    expect(view.mostImportant?.id).toBe('longest-focus');
  });

  it('reports focus time, sessions and avg focus quality', () => {
    const view = selectDailyInsights(base());
    const insight = findById(view.todays, 'focus-today');
    expect(insight.observation).toContain('You focused 30m today');
    expect(insight.metrics).toContainEqual({ label: 'Sessions', value: '1' });
    expect(insight.metrics).toContainEqual({ label: 'Avg focus quality', value: '80%' });
  });

  it('surfaces deep work only for 25+ minute sessions', () => {
    const deep = selectDailyInsights(base());
    expect(deep.todays.find((i) => i.id === 'deep-work')?.observation).toContain('1 deep-work session');

    const shallow = selectDailyInsights({
      ...base(),
      sessions: [session('s-1', { activeTime: 15 * MIN })],
    });
    expect(shallow.todays.find((i) => i.id === 'deep-work')).toBeUndefined();
  });

  it('counts interruptions from session pause counts', () => {
    const view = selectDailyInsights({
      ...base(),
      sessions: [
        session('s-1', { pauseCount: 3, totalPauseDuration: 20 * MIN }),
        session('s-2', { pauseCount: 1, taskId: 't-2' }),
      ],
    });
    const insight = findById(view.todays, 'interruptions');
    expect(insight.observation).toContain('4 times');
    expect(insight.action?.label).toBe('Batch interruptions');
  });

  it('counts context switches across distinct tasks', () => {
    const view = selectDailyInsights({
      ...base(),
      sessions: [
        session('s-1', { taskId: 't-1' }),
        session('s-2', { taskId: 't-2' }),
        session('s-3', { taskId: 't-1' }),
      ],
    });
    const insight = findById(view.todays, 'context-switches');
    expect(insight.observation).toContain('2 different tasks');
  });

  it('does not emit a context-switch insight for a single task', () => {
    const view = selectDailyInsights(base());
    expect(view.todays.find((i) => i.id === 'context-switches')).toBeUndefined();
  });

  it('counts tasks completed today via the analytics layer', () => {
    const view = selectDailyInsights({
      ...base(),
      dailyGoalMs: 0,
      tasks: [
        task('t-1', { status: 'completed', updatedAt: DAY_START + 11 * HOUR }),
        task('t-old', { status: 'completed', updatedAt: DAY_START - 86400000 }),
      ],
    });
    expect(view.mostImportant?.id).toBe('completed-today');
    expect(view.mostImportant?.observation).toContain('1 task');
  });

  it('counts carry-over tasks created before today', () => {
    const view = selectDailyInsights({
      ...base(),
      tasks: [
        task('t-old', { createdAt: DAY_START - 2 * 86400000, status: 'active' }),
        task('t-new', { createdAt: DAY_START + 1 * HOUR, status: 'todo' }),
      ],
    });
    const insight = findById(view.todays, 'carry-over');
    expect(insight.observation).toContain('1 task');
    expect(insight.action?.label).toBe('Clear one backlog item');
  });

  it('counts completed items logged on work logs today only', () => {
    const view = selectDailyInsights({
      ...base(),
      workLogs: [log('l-1', [
        { completedAt: DAY_START + 9 * HOUR, text: 'Shipped export' },
        { completedAt: DAY_END - 1, text: 'Closed PR' },
        { completedAt: DAY_START - 3600000, text: 'Old item' },
      ])],
    });
    const insight = findById(view.todays, 'worklog-completions');
    expect(insight.observation).toContain('2 completed items');
    expect(insight.metrics).toContainEqual({ label: 'Work logs touched', value: '1' });
  });

  it('reports today journal reflections with averages', () => {
    const view = selectDailyInsights({
      ...base(),
      journals: [
        journal('j-1', DAY_START + 9 * HOUR, { mood: 4, focusRating: 3 }),
        journal('j-2', DAY_START + 10 * HOUR, { mood: 5, focusRating: 4 }),
        journal('j-old', DAY_START - 3600000, { mood: 2, focusRating: 1 }),
      ],
    });
    const insight = findById(view.todays, 'journal-entry');
    expect(insight.observation).toContain('2 journal entries');
    expect(insight.metrics).toContainEqual({ label: 'Avg mood', value: '5/5' });
    expect(insight.metrics).toContainEqual({ label: 'Avg focus', value: '4/5' });
  });

  it('scales confidence with the volume of today data', () => {
    const one = selectDailyInsights(base());
    expect(findById(one.todays, 'focus-today').confidence).toBe('medium');

    const three = selectDailyInsights({
      ...base(),
      sessions: [
        session('s-1'),
        session('s-2', { taskId: 't-2' }),
        session('s-3', { taskId: 't-1' }),
      ],
    });
    expect(findById(three.todays, 'focus-today').confidence).toBe('high');
  });

  it('emits no insight and no fabrication when the day has no data', () => {
    const view = selectDailyInsights({
      sessions: [],
      tasks: [],
      journals: [],
      workLogs: [],
      dailyGoalMs: GOAL,
      now: NOW,
      timeZone: TZ,
    });
    expect(view.hasData).toBe(false);
    expect(view.mostImportant).toBeNull();
    expect(view.todays).toEqual([]);
    expect(view.periodLabel).toBe('Today · Wed, Aug 5');
  });

  it('excludes yesterday sessions from every daily metric', () => {
    const view = selectDailyInsights({
      sessions: [
        session('s-today', { startTime: DAY_START + 9 * HOUR }),
        session('s-yesterday', { startTime: DAY_START - 86400000 + 9 * HOUR, pauseCount: 5 }),
      ],
      tasks: [],
      journals: [],
      workLogs: [],
      dailyGoalMs: 0,
      now: NOW,
      timeZone: TZ,
    });
    expect(view.sessionCount).toBe(1);
    expect(view.todays.find((i) => i.id === 'interruptions')).toBeUndefined();
  });
});

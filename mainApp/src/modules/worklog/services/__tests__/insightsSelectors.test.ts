import { describe, it, expect } from 'vitest';
import {
  selectDailyInsights,
  selectWeeklyInsights,
  selectWorkPatternInsights,
  selectTaskInsights,
  selectKnowledgeInsights,
  type DailyInsight,
} from '../insightsSelectors';
import type { MemorySession } from '@personal/services/memorySelectors';
import type { Task, JournalEntry } from '@shared/types';
import type { KnowledgeDoc } from '@collab/types/collaboration';
import type { WorkLog } from '@worklog/services/useWorkLogStore';

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
    order: 0,
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

// ── PI-1.2: pure Weekly Insights selector tests (Phase PI) ────────────────────
// The weekly layer must be deterministic, reuse the shared analytics layer, and
// compare against last week only when that baseline actually has focus data.

const WEEK_START = Date.UTC(2026, 7, 3); // Mon Aug 3 2026 (ISO week of NOW)
const WEEK_END = Date.UTC(2026, 7, 9, 23, 59, 59, 999); // Sun Aug 9 2026
const PREV_START = WEEK_START - 7 * 86400000; // Mon Jul 27 2026
const PREV_END = WEEK_START - 1; // Sun Aug 2 2026
const MS_PER_DAY_WEEK = 86400000;

function weekBase() {
  return {
    sessions: [
      session('w-1', { startTime: WEEK_START + 9 * HOUR, activeTime: 2 * HOUR }),
      session('w-2', { startTime: WEEK_START + MS_PER_DAY_WEEK + 9 * HOUR, activeTime: 3 * HOUR }),
    ],
    tasks: [task('t-1', { status: 'completed', updatedAt: WEEK_START + 2 * MS_PER_DAY_WEEK + 11 * HOUR })],
    journals: [journal('j-1', WEEK_START + MS_PER_DAY_WEEK + 10 * HOUR)],
    workLogs: [log('l-1', [{ completedAt: WEEK_START + 9 * HOUR, text: 'Shipped export' }])],
    dailyGoalMs: GOAL,
    now: NOW,
    timeZone: TZ,
  };
}

describe('selectWeeklyInsights (PI-1.2)', () => {
  it('labels the current ISO week (Monday–Sunday)', () => {
    const view = selectWeeklyInsights(weekBase());
    expect(view.periodLabel).toBe('Week · Mon, Aug 3 – Sun, Aug 9');
    expect(view.sessionCount).toBe(2);
  });

  it('reports weekly focus time across the week, not just today', () => {
    const view = selectWeeklyInsights(weekBase());
    const insight = findById(view.weekly, 'weekly-focus');
    expect(insight.observation).toContain('You focused 5.0h this week across 2 sessions');
    expect(insight.metrics).toContainEqual({ label: 'Sessions', value: '2' });
    expect(insight.metrics).toContainEqual({ label: 'Avg focus quality', value: '80%' });
  });

  it('compares against last week only when that baseline has focus data', () => {
    const withBaseline = selectWeeklyInsights({
      ...weekBase(),
      sessions: [
        session('w-1', { startTime: WEEK_START + 9 * HOUR, activeTime: 4 * HOUR }),
        session('w-prev', { startTime: PREV_START + 9 * HOUR, activeTime: 3 * HOUR }),
      ],
    });
    expect(withBaseline.mostImportant?.id).toBe('weekly-trend');
    expect(withBaseline.mostImportant?.observation).toContain('33% more than last week');
    expect(withBaseline.mostImportant?.metrics).toContainEqual({ label: 'Change', value: '+33%' });

    const noBaseline = selectWeeklyInsights(weekBase());
    expect(noBaseline.weekly.find((i) => i.id === 'weekly-trend')).toBeUndefined();
    expect(noBaseline.mostImportant).not.toBeNull();
  });

  it('stays silent on the trend when the current week has no focus', () => {
    const view = selectWeeklyInsights({
      ...weekBase(),
      sessions: [session('w-prev', { startTime: PREV_START + 9 * HOUR, activeTime: 3 * HOUR })],
      tasks: [],
      journals: [],
      workLogs: [],
    });
    expect(view.weekly.find((i) => i.id === 'weekly-trend')).toBeUndefined();
    expect(view.hasData).toBe(false);
    expect(view.activeDays).toBe(0);
  });

  it('treats an equal week as matching, not as zero change', () => {
    const view = selectWeeklyInsights({
      ...weekBase(),
      sessions: [
        session('w-1', { startTime: WEEK_START + 9 * HOUR, activeTime: 4 * HOUR }),
        session('w-prev', { startTime: PREV_START + 9 * HOUR, activeTime: 4 * HOUR }),
      ],
    });
    expect(view.mostImportant?.id).toBe('weekly-trend');
    expect(view.mostImportant?.observation).toContain('matching last week');
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Change', value: '+0%' });
  });

  it('surfaces weekly deep work from 25+ minute sessions', () => {
    const deep = selectWeeklyInsights({
      ...weekBase(),
      sessions: [
        session('w-1', { startTime: WEEK_START + 9 * HOUR, activeTime: 40 * MIN }),
        session('w-2', { startTime: WEEK_START + MS_PER_DAY_WEEK + 9 * HOUR, activeTime: 15 * MIN }),
      ],
    });
    expect(deep.weekly.find((i) => i.id === 'weekly-deep-work')?.observation).toContain('1 deep-work session');
  });

  it('counts active days across the week', () => {
    const view = selectWeeklyInsights(weekBase());
    const insight = findById(view.weekly, 'weekly-consistency');
    expect(insight.observation).toContain('You focused on 2 of 7 days this week');
    expect(insight.action?.label).toBe('Protect a block each day');
    expect(view.activeDays).toBe(2);
  });

  it('does not emit an active-days insight for a single active day', () => {
    const view = selectWeeklyInsights({
      ...weekBase(),
      sessions: [session('w-1', { startTime: WEEK_START + 9 * HOUR })],
    });
    expect(view.weekly.find((i) => i.id === 'weekly-consistency')).toBeUndefined();
  });

  it('counts tasks completed within the week via the analytics layer', () => {
    const view = selectWeeklyInsights({
      ...weekBase(),
      tasks: [
        task('t-1', { status: 'completed', updatedAt: WEEK_START + 2 * MS_PER_DAY_WEEK + 11 * HOUR }),
        task('t-old', { status: 'completed', updatedAt: PREV_END - 3600000 }),
      ],
    });
    expect(view.mostImportant?.id).toBe('weekly-completed');
    expect(view.mostImportant?.observation).toContain('1 task');
    expect(view.weekly.find((i) => i.id === 'weekly-completed')).toBeUndefined();
  });

  it('counts work-log completions within the week only', () => {
    const view = selectWeeklyInsights({
      ...weekBase(),
      workLogs: [log('l-1', [
        { completedAt: WEEK_START + 9 * HOUR, text: 'Shipped export' },
        { completedAt: WEEK_END - 1, text: 'Closed PR' },
        { completedAt: PREV_END - 3600000, text: 'Old item' },
      ])],
    });
    const insight = findById(view.weekly, 'weekly-worklog');
    expect(insight.observation).toContain('2 completed items');
  });

  it('reports weekly journal reflections with averages', () => {
    const view = selectWeeklyInsights({
      ...weekBase(),
      journals: [
        journal('j-1', WEEK_START + 9 * HOUR, { mood: 4, focusRating: 3 }),
        journal('j-2', WEEK_START + MS_PER_DAY_WEEK + 10 * HOUR, { mood: 5, focusRating: 4 }),
        journal('j-old', PREV_END - 3600000, { mood: 2, focusRating: 1 }),
      ],
    });
    const insight = findById(view.weekly, 'weekly-journal');
    expect(insight.observation).toContain('2 journal entries');
    expect(insight.metrics).toContainEqual({ label: 'Avg mood', value: '5/5' });
    expect(insight.metrics).toContainEqual({ label: 'Avg focus', value: '4/5' });
  });

  it('features the trend, then completed tasks, then focus as weekly Most Important', () => {
    const withTrend = selectWeeklyInsights({
      ...weekBase(),
      sessions: [
        session('w-1', { startTime: WEEK_START + 9 * HOUR, activeTime: 4 * HOUR }),
        session('w-prev', { startTime: PREV_START + 9 * HOUR, activeTime: 3 * HOUR }),
      ],
    });
    expect(withTrend.mostImportant?.id).toBe('weekly-trend');
    expect(withTrend.weekly.map((i) => i.id)).not.toContain('weekly-trend');

    const noTrend = selectWeeklyInsights({ ...weekBase(), sessions: [session('w-1', { startTime: WEEK_START + 9 * HOUR })] });
    expect(noTrend.mostImportant?.id).toBe('weekly-completed');

    const focusOnly = selectWeeklyInsights({
      ...weekBase(),
      sessions: [session('w-1', { startTime: WEEK_START + 9 * HOUR })],
      tasks: [],
      journals: [],
      workLogs: [],
    });
    expect(focusOnly.mostImportant?.id).toBe('weekly-focus');
  });

  it('excludes last week sessions from every weekly metric', () => {
    const view = selectWeeklyInsights({
      sessions: [
        session('w-1', { startTime: WEEK_START + 9 * HOUR, activeTime: 2 * HOUR }),
        session('w-prev', { startTime: PREV_START + 9 * HOUR, activeTime: 6 * HOUR, pauseCount: 5 }),
      ],
      tasks: [],
      journals: [],
      workLogs: [],
      dailyGoalMs: 0,
      now: NOW,
      timeZone: TZ,
    });
    expect(view.sessionCount).toBe(1);
    expect(view.activeDays).toBe(1);
    expect(view.weekly.find((i) => i.id === 'weekly-consistency')).toBeUndefined();
  });

  it('scales weekly confidence with session volume', () => {
    const sparse = selectWeeklyInsights(weekBase());
    expect(findById(sparse.weekly, 'weekly-focus').confidence).toBe('medium');

    const busy = selectWeeklyInsights({
      ...weekBase(),
      sessions: Array.from({ length: 7 }, (_, i) => session(`w-${i}`, {
        startTime: WEEK_START + i * 86400000 + 9 * HOUR,
        activeTime: 2 * HOUR,
      })),
    });
    expect(findById(busy.weekly, 'weekly-focus').confidence).toBe('high');
  });

  it('emits no insight and no fabrication when the week has no data', () => {
    const view = selectWeeklyInsights({
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
    expect(view.weekly).toEqual([]);
    expect(view.activeDays).toBe(0);
    expect(view.periodLabel).toBe('Week · Mon, Aug 3 – Sun, Aug 9');
  });
});

// ── PI-1.3: pure Work Pattern selector tests (Phase PI) ───────────────────────
// Patterns must be volume-gated and dominance-gated so a claim is only emitted
// when the trailing 4-week window actually supports it.

const PATTERN_START = WEEK_START - 21 * 86400000; // Mon Jul 13 2026

function patternSession(id: string, dayOffset: number, hourUtc: number, activeMs: number, overrides: Partial<MemorySession> = {}): MemorySession {
  return session(id, { startTime: PATTERN_START + dayOffset * MS_PER_DAY_WEEK + hourUtc * HOUR, activeTime: activeMs, ...overrides });
}

function patternBase(sessions: MemorySession[]) {
  return { sessions, tasks: [], journals: [], workLogs: [], dailyGoalMs: 0, now: NOW, timeZone: TZ };
}

describe('selectWorkPatternInsights (PI-1.3)', () => {
  it('labels the trailing 4-week window and stays empty without data', () => {
    const view = selectWorkPatternInsights(patternBase([]));
    expect(view.periodLabel).toBe('Last 4 weeks · Mon, Jul 13 – Sun, Aug 9');
    expect(view.hasData).toBe(false);
    expect(view.mostImportant).toBeNull();
    expect(view.patterns).toEqual([]);
    expect(view.sessionCount).toBe(0);
    expect(view.focusedMs).toBe(0);
  });

  it('names the dominant time-of-day window with a clear lead', () => {
    const sessions = [
      ...Array.from({ length: 12 }, (_, i) => patternSession(`m-${i}`, i, 9, 30 * MIN)),
      ...Array.from({ length: 4 }, (_, i) => patternSession(`a-${i}`, 12 + i, 14, 30 * MIN)),
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    expect(view.mostImportant?.id).toBe('pattern-time-of-day');
    expect(view.mostImportant?.observation).toContain('morning');
    expect(view.mostImportant?.observation).toContain('75%');
    expect(view.mostImportant?.confidence).toBe('high');
    expect(view.mostImportant?.action?.label).toBe('Protect this window');
    expect(view.patterns.map((i) => i.id)).not.toContain('pattern-time-of-day');
    expect(view.patterns.find((i) => i.id === 'pattern-session-length')).toBeDefined();
  });

  it('stays silent on a peak window when focus is spread evenly', () => {
    const sessions = [
      ...Array.from({ length: 5 }, (_, i) => patternSession(`m-${i}`, i, 9, 30 * MIN)),
      ...Array.from({ length: 5 }, (_, i) => patternSession(`a-${i}`, 5 + i, 14, 30 * MIN)),
      ...Array.from({ length: 5 }, (_, i) => patternSession(`e-${i}`, 10 + i, 18, 30 * MIN)),
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    expect(view.mostImportant?.id).toBe('pattern-session-length');
    expect(view.patterns.find((i) => i.id === 'pattern-time-of-day')).toBeUndefined();
  });

  it('stays silent on a peak window with too few sessions', () => {
    const sessions = [
      patternSession('m-1', 0, 9, 30 * MIN),
      patternSession('m-2', 1, 9, 30 * MIN),
      patternSession('m-3', 2, 9, 30 * MIN),
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    expect(view.hasData).toBe(false);
    expect(view.mostImportant).toBeNull();
    expect(view.patterns).toEqual([]);
  });

  it('names the most focused weekday when it repeats across at least three weeks', () => {
    const sessions = [
      patternSession('tue-1', 1, 10, 2 * HOUR), // Tue Jul 14
      patternSession('tue-2', 8, 10, 2 * HOUR), // Tue Jul 21
      patternSession('tue-3', 15, 10, 2 * HOUR), // Tue Jul 28
      patternSession('mon-1', 0, 15, 1 * HOUR), // Mon Jul 13
      patternSession('mon-2', 7, 15, 1 * HOUR), // Mon Jul 20
      patternSession('mon-3', 14, 15, 1 * HOUR), // Mon Jul 27
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    expect(view.mostImportant?.id).toBe('pattern-weekday');
    expect(view.mostImportant?.observation).toContain('Tuesdays');
    expect(view.mostImportant?.observation).toContain('67%');
    expect(view.mostImportant?.confidence).toBe('high');
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Top day', value: 'Tuesdays' });
  });

  it('stays silent on a weekday pattern seen in only one week', () => {
    const sessions = [
      patternSession('tue', 22, 10, 4 * HOUR), // Tue Aug 4 (current week only)
      patternSession('mon', 21, 9, 1 * HOUR),
      patternSession('wed', 23, 9, 1 * HOUR),
      patternSession('thu', 24, 9, 1 * HOUR),
      patternSession('fri', 25, 9, 1 * HOUR),
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    expect(view.patterns.find((i) => i.id === 'pattern-weekday')).toBeUndefined();
  });

  it('reports the average focus block length and deep split', () => {
    const sessions = [
      ...Array.from({ length: 6 }, (_, i) => patternSession(`s-${i}`, i, 9, 20 * MIN)),
      ...Array.from({ length: 2 }, (_, i) => patternSession(`d-${i}`, 10 + i, 9, 50 * MIN)),
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    const insight = view.patterns.find((i) => i.id === 'pattern-session-length') ?? view.mostImportant;
    expect(insight?.observation).toContain('focus blocks average 27m');
    expect(insight?.metrics).toContainEqual({ label: 'Deep blocks', value: '2' });
    expect(insight?.metrics).toContainEqual({ label: 'Deep share', value: '45%' });
  });

  it('ignores sessions outside the 4-week window', () => {
    const sessions = [
      ...Array.from({ length: 8 }, (_, i) => patternSession(`in-${i}`, i, 9, 30 * MIN)),
      patternSession('out-old', -7, 9, 6 * HOUR),
      patternSession('out-future', 28, 9, 6 * HOUR),
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    expect(view.sessionCount).toBe(8);
    expect(view.focusedMs).toBe(4 * HOUR);
  });

  it('includes sessions exactly at the window edges', () => {
    const sessions = [
      patternSession('first', 0, 0, 30 * MIN), // Jul 13 00:00
      patternSession('last', 27, 23, 30 * MIN), // Aug 9 23:00
    ];
    const view = selectWorkPatternInsights(patternBase(sessions));
    expect(view.sessionCount).toBe(2);
  });
});

// ── PI-1.4: pure Task Insights selector tests (Phase PI) ──────────────────────
// Task insights read the task list as-of now: deadline pressure, stale tasks,
// subtask progress, and priority load. They must be absent when the list does
// not support them and honest when it does.

function taskInsightsBase(tasks: Task[]) {
  return { sessions: [], tasks, journals: [], workLogs: [], dailyGoalMs: 0, now: NOW, timeZone: TZ };
}

describe('selectTaskInsights (PI-1.4)', () => {
  it('labels the snapshot and stays empty without open tasks', () => {
    const view = selectTaskInsights(taskInsightsBase([]));
    expect(view.periodLabel).toBe('Open tasks · Wed, Aug 5');
    expect(view.hasData).toBe(false);
    expect(view.mostImportant).toBeNull();
    expect(view.tasks).toEqual([]);
    expect(view.openCount).toBe(0);
  });

  it('features past-deadline tasks as Most Important with honest metrics', () => {
    const view = selectTaskInsights(taskInsightsBase([
      task('t-1', { status: 'todo', deadline: DAY_START - 2 * 86400000 }), // overdue by 2 days
      task('t-2', { status: 'todo', deadline: DAY_START + 5 * 86400000 }), // future deadline
      task('t-3', { status: 'completed', deadline: DAY_START - 10 * 86400000 }), // completed → ignored
    ]));
    expect(view.mostImportant?.id).toBe('task-overdue');
    expect(view.mostImportant?.observation).toContain('1 task past their deadline');
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Overdue', value: '1' });
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Oldest overdue', value: '2d' });
    expect(view.mostImportant?.action).toBeUndefined();
    expect(view.tasks.map((i) => i.id)).not.toContain('task-overdue');
    expect(view.openCount).toBe(2);
  });

  it('suggests rescheduling once three or more tasks are overdue', () => {
    const view = selectTaskInsights(taskInsightsBase([
      task('t-1', { deadline: DAY_START - 1 * 86400000 }),
      task('t-2', { deadline: DAY_START - 2 * 86400000 }),
      task('t-3', { deadline: DAY_START - 3 * 86400000 }),
    ]));
    expect(view.mostImportant?.id).toBe('task-overdue');
    expect(view.mostImportant?.action?.label).toBe('Reschedule the oldest first');
  });

  it('emits nothing about deadlines when none have passed', () => {
    const view = selectTaskInsights(taskInsightsBase([
      task('t-1', { deadline: DAY_START + 1 * 86400000 }),
      task('t-2', { deadline: DAY_START + 2 * 86400000 }),
    ]));
    expect(view.tasks.find((i) => i.id === 'task-overdue')).toBeUndefined();
    expect(view.mostImportant?.id).not.toBe('task-overdue');
  });

  it('reports stale tasks once at least two open tasks went quiet', () => {
    const view = selectTaskInsights(taskInsightsBase([
      task('t-1', { status: 'todo', updatedAt: NOW - 8 * 86400000 }),
      task('t-2', { status: 'paused', updatedAt: NOW - 12 * 86400000 }),
      task('t-3', { status: 'active', updatedAt: NOW - 20 * 86400000 }), // in progress → not stale
    ]));
    expect(view.mostImportant?.id).toBe('task-stale');
    expect(view.mostImportant?.observation).toContain('2 open tasks have not been touched in 7+ days');
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Stale', value: '2' });
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Oldest', value: '12d' });
  });

  it('stays silent on staleness for a single quiet task', () => {
    const view = selectTaskInsights(taskInsightsBase([
      task('t-1', { status: 'todo', updatedAt: NOW - 9 * 86400000 }),
    ]));
    expect(view.tasks.find((i) => i.id === 'task-stale')).toBeUndefined();
  });

  it('summarizes open high-priority work with an action when anything is urgent', () => {
    const view = selectTaskInsights(taskInsightsBase([
      task('t-1', { priority: 'urgent', status: 'todo' }),
      task('t-2', { priority: 'high', status: 'todo' }),
      task('t-3', { priority: 'medium', status: 'todo' }),
    ]));
    expect(view.mostImportant?.id).toBe('task-priority');
    expect(view.mostImportant?.observation).toContain('1 urgent and 1 high-priority open tasks');
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Urgent', value: '1' });
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'High', value: '1' });
    expect(view.mostImportant?.action?.label).toBe('Clear the urgent item');
  });

  it('reports subtask completion across open tasks with subtasks', () => {
    const view = selectTaskInsights(taskInsightsBase([
      task('t-1', { status: 'todo', subtasks: [
        { id: 's-1', title: 'A', completed: true, createdAt: DAY_START },
        { id: 's-2', title: 'B', completed: false, createdAt: DAY_START },
      ] }),
      task('t-2', { status: 'todo', subtasks: [
        { id: 's-3', title: 'C', completed: true, createdAt: DAY_START },
        { id: 's-4', title: 'D', completed: false, createdAt: DAY_START },
      ] }),
    ]));
    expect(view.mostImportant?.id).toBe('task-subtasks');
    expect(view.mostImportant?.observation).toContain('50% of 4 subtasks are done');
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Subtasks done', value: '2/4' });
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Tasks tracked', value: '2' });
  });

  it('orders Most Important as overdue → stale → priority → subtasks', () => {
    const withAll = selectTaskInsights(taskInsightsBase([
      task('t-1', { status: 'todo', deadline: DAY_START - 1 * 86400000, priority: 'urgent' }),
      task('t-2', { status: 'todo', updatedAt: NOW - 8 * 86400000 }),
      task('t-3', { status: 'todo', priority: 'high' }),
    ]));
    expect(withAll.mostImportant?.id).toBe('task-overdue');
    expect(withAll.tasks.map((i) => i.id)).not.toContain('task-overdue');

    const staleFirst = selectTaskInsights(taskInsightsBase([
      task('t-1', { status: 'todo', updatedAt: NOW - 9 * 86400000 }),
      task('t-2', { status: 'todo', updatedAt: NOW - 8 * 86400000, priority: 'urgent' }),
    ]));
    expect(staleFirst.mostImportant?.id).toBe('task-stale');
  });
});

// ── PI-1.5: pure Knowledge Insights selector tests (Phase PI) ─────────────────
// Knowledge insights reuse selectKnowledge over docs + work logs + journals; the
// base is cumulative ("all time") and an empty base stays honestly empty.

function kDoc(id: string, overrides: Partial<KnowledgeDoc> = {}): KnowledgeDoc {
  return {
    id,
    workspaceId: 'ws-1',
    title: `Doc ${id}`,
    category: 'Architecture',
    content: '# Notes',
    authorId: 'u-1',
    version: 1,
    tags: [],
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
    ...overrides,
  };
}

function knowledgeLog(id: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'done',
    isActive: false,
    updatedAt: '2026-08-04T10:00:00.000Z',
    blockerList: [],
    workEntries: [],
    completedItems: [],
    currentWork: '',
    plan: '',
    decisions: [],
    lessonsLearned: [],
    problemFlow: { lessonsLearned: '', problem: '', resolution: '' },
    links: [],
    ...overrides,
  } as unknown as WorkLog;
}

describe('selectKnowledgeInsights (PI-1.5)', () => {
  it('labels the cumulative period and stays empty without knowledge', () => {
    const view = selectKnowledgeInsights({
      docs: [], workLogs: [], journals: [journal('j-1', DAY_START + 10 * HOUR)],
      now: NOW, timeZone: TZ,
    });
    expect(view.periodLabel).toBe('All time · Wed, Aug 5');
    expect(view.hasData).toBe(false);
    expect(view.mostImportant).toBeNull();
    expect(view.knowledge).toEqual([]);
    expect(view.total).toBe(0);
  });

  it('features the cumulative base and fills the grid with each type', () => {
    const view = selectKnowledgeInsights({
      docs: [
        kDoc('d-1'),
        kDoc('d-2', { category: 'Coding Standards' }),
        kDoc('d-3', { category: 'Coding Standards' }),
      ],
      workLogs: [
        knowledgeLog('l-1', {
          decisions: [{
            _id: 'dec-1', title: 'Use Postgres', context: '', decision: 'switch', alternatives: '', rationale: 'consistency',
            timestamp: NOW - 2 * 86400000,
          }],
          problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: 'Test migrations first' },
          links: [{ _id: 'lk-1', label: 'RFC', url: 'https://rfc', category: 'GitHub' }],
        }),
      ],
      journals: [],
      now: NOW, timeZone: TZ,
    });

    expect(view.mostImportant?.id).toBe('knowledge-base');
    expect(view.mostImportant?.observation).toContain('6 knowledge items');
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Docs', value: '3' });
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Decisions', value: '1' });
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Lessons', value: '1' });
    expect(view.mostImportant?.metrics).toContainEqual({ label: 'Links', value: '1' });
    expect(view.knowledge.map((i) => i.id)).not.toContain('knowledge-base');

    const decisions = findById(view.knowledge, 'knowledge-decisions');
    expect(decisions.metrics).toContainEqual({ label: 'Decisions', value: '1' });
    expect(decisions.metrics).toContainEqual({ label: 'Latest', value: '2d ago' });

    const lessons = findById(view.knowledge, 'knowledge-lessons');
    expect(lessons.metrics).toContainEqual({ label: 'Lessons', value: '1' });

    const links = findById(view.knowledge, 'knowledge-links');
    expect(links.metrics).toContainEqual({ label: 'Top category', value: 'GitHub' });

    const docs = findById(view.knowledge, 'knowledge-docs');
    expect(docs.metrics).toContainEqual({ label: 'Docs', value: '3' });
    expect(docs.metrics).toContainEqual({ label: 'Top category', value: 'Coding Standards' });
  });

  it('keeps journals out of the knowledge total', () => {
    const view = selectKnowledgeInsights({
      docs: [], workLogs: [],
      journals: [journal('j-1', DAY_START + 10 * HOUR), journal('j-2', DAY_START + 11 * HOUR)],
      now: NOW, timeZone: TZ,
    });
    expect(view.hasData).toBe(false);
    expect(view.total).toBe(0);
  });

  it('scales confidence with the size of the base', () => {
    const manyDocs = Array.from({ length: 10 }, (_, i) => kDoc(`d-${i}`));
    const view = selectKnowledgeInsights({ docs: manyDocs, workLogs: [], journals: [], now: NOW, timeZone: TZ });
    expect(view.mostImportant?.confidence).toBe('high');
  });

  it('reads lessons from the log problem flow', () => {
    const view = selectKnowledgeInsights({
      docs: [],
      workLogs: [
        knowledgeLog('l-1', { problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: 'Rehearse the demo' } }),
      ],
      journals: [], now: NOW, timeZone: TZ,
    });
    expect(view.mostImportant?.id).toBe('knowledge-base');
    expect(findById(view.knowledge, 'knowledge-lessons').metrics).toContainEqual({ label: 'Lessons', value: '1' });
  });
});

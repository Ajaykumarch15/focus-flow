import { describe, it, expect } from 'vitest';
import {
  computeRangeStats,
  computeCategoryBreakdown,
  computeTopTasks,
  computeDailySeries,
  getComparisonDelta,
  type SessionLike,
  type TaskLike,
} from '../reportsSelectors';

const DAY = 86400000;
const HOUR = 3600000;

const start = new Date('2026-08-01T00:00:00').getTime();

function session(overrides: Partial<SessionLike>): SessionLike {
  return {
    id: 's1',
    taskId: 'task-1',
    startTime: start + DAY,
    activeTime: HOUR,
    totalPauseDuration: 0,
    ...overrides,
  };
}

function task(overrides: Partial<TaskLike>): TaskLike {
  return {
    id: 'task-1',
    title: 'Ship reports',
    color: '#0ea5e9',
    category: 'Work',
    status: 'in-progress',
    createdAt: start,
    updatedAt: start + DAY,
    ...overrides,
  };
}

describe('computeRangeStats', () => {
  const t1 = task({ id: 'task-1' });
  const t2 = task({ id: 'task-2', title: 'Focus deep work', category: 'Deep Work' });
  const tDone = task({ id: 'task-done', status: 'completed', updatedAt: start + 2 * DAY });
  const tOutside = task({ id: 'task-out', status: 'completed', updatedAt: start + 30 * DAY });

  const sessions = [
    session({ id: 'in-1', taskId: 'task-1', startTime: start + DAY, activeTime: 2 * HOUR, totalPauseDuration: 30 * 60000, focusScore: 80 }),
    session({ id: 'in-2', taskId: 'task-2', startTime: start + 2 * DAY, activeTime: HOUR, focusScore: 90 }),
    session({ id: 'in-3', taskId: 'task-1', startTime: start + 2 * DAY, activeTime: 30 * 60000 }),
    session({ id: 'out', taskId: 'task-1', startTime: start + 30 * DAY, activeTime: 5 * HOUR }),
  ];

  const end = start + 6 * DAY;

  it('filters sessions to the inclusive range only', () => {
    const stats = computeRangeStats(sessions, [t1, t2, tDone, tOutside], start, end);
    expect(stats.sessionCount).toBe(3);
    expect(stats.focusedMs).toBe(2 * HOUR + HOUR + 30 * 60000);
    expect(stats.pausedMs).toBe(30 * 60000);
  });

  it('averages focus scores from scored in-range sessions only', () => {
    const stats = computeRangeStats(sessions, [], start, end);
    expect(stats.focusScore).toBe(85);
  });

  it('reports focus score 0 when no session has a score', () => {
    const unscored = sessions.map(s => ({ ...s, focusScore: undefined }));
    expect(computeRangeStats(unscored, [], start, end).focusScore).toBe(0);
  });

  it('counts completed tasks whose updatedAt falls inside the range', () => {
    const stats = computeRangeStats(sessions, [t1, t2, tDone, tOutside], start, end);
    expect(stats.completedTasks).toBe(1);
  });

  it('computes completion rate against the tasks active in the range', () => {
    const stats = computeRangeStats(sessions, [t1, t2, tDone, tOutside], start, end);
    expect(stats.totalTasks).toBe(4);
    expect(stats.completionRate).toBe(25);
  });

  it('returns completion rate 0 when no tasks exist in the range', () => {
    const stats = computeRangeStats(sessions, [], start, end);
    expect(stats.totalTasks).toBe(0);
    expect(stats.completionRate).toBe(0);
  });
});

describe('getComparisonDelta', () => {
  it('returns neutral delta when there is no previous baseline', () => {
    expect(getComparisonDelta(5, 0)).toEqual({ pct: 0, up: true });
  });

  it('reports an increase as up', () => {
    expect(getComparisonDelta(120, 80)).toEqual({ pct: 50, up: true });
  });

  it('reports a decrease as down with an absolute percentage', () => {
    expect(getComparisonDelta(40, 100)).toEqual({ pct: 60, up: false });
  });

  it('reports no change as zero', () => {
    expect(getComparisonDelta(10, 10)).toEqual({ pct: 0, up: true });
  });
});

describe('computeCategoryBreakdown', () => {
  const t1 = task({ id: 'task-1', category: 'Work' });
  const t2 = task({ id: 'task-2', category: 'Deep Work' });

  it('groups active time by task category, sorted descending', () => {
    const sessions = [
      session({ taskId: 'task-1', startTime: start + DAY, activeTime: 2 * HOUR }),
      session({ taskId: 'task-2', startTime: start + DAY, activeTime: HOUR }),
    ];
    const breakdown = computeCategoryBreakdown(sessions, [t1, t2], start, start + 6 * DAY);
    expect(breakdown).toEqual([
      { name: 'Work', hours: 2 },
      { name: 'Deep Work', hours: 1 },
    ]);
  });

  it('falls back to "Other" for unknown tasks', () => {
    const breakdown = computeCategoryBreakdown([session({ taskId: 'task-unknown' })], [t1, t2], start, start + 6 * DAY);
    expect(breakdown[0].name).toBe('Other');
  });

  it('ignores sessions outside the range', () => {
    const breakdown = computeCategoryBreakdown(
      [session({ startTime: start + 30 * DAY, activeTime: 9 * HOUR })],
      [t1],
      start,
      start + 6 * DAY,
    );
    expect(breakdown).toEqual([]);
  });
});

describe('computeTopTasks', () => {
  const t1 = task({ id: 'task-1', title: 'Alpha', color: '#111', category: 'Work' });
  const t2 = task({ id: 'task-2', title: 'Beta', color: '#222', category: 'Deep' });
  const t3 = task({ id: 'task-3', title: 'Gamma', color: '#333', category: 'Work' });

  it('returns the top 5 ranked tasks with metadata, range-scoped', () => {
    const sessions = [
      session({ taskId: 'task-2', startTime: start + DAY, activeTime: 4 * HOUR }),
      session({ taskId: 'task-1', startTime: start + DAY, activeTime: 2 * HOUR }),
      session({ taskId: 'task-3', startTime: start + DAY, activeTime: HOUR }),
      session({ taskId: 'task-2', startTime: start + 30 * DAY, activeTime: 10 * HOUR }),
    ];
    const top = computeTopTasks(sessions, [t1, t2, t3], start, start + 6 * DAY);
    expect(top).toHaveLength(3);
    expect(top[0]).toEqual({ taskId: 'task-2', title: 'Beta', color: '#222', category: 'Deep', analyticsMs: 4 * HOUR });
    expect(top.map(t => t.taskId)).toEqual(['task-2', 'task-1', 'task-3']);
  });

  it('omits tasks with no tracked time and caps the list at five', () => {
    const many = Array.from({ length: 8 }, (_, i) => task({ id: `t${i}`, title: `Task ${i}` }));
    const sessions = many.map(t => session({ taskId: t.id, startTime: start + DAY, activeTime: HOUR }));
    const top = computeTopTasks(sessions, many, start, start + 6 * DAY);
    expect(top).toHaveLength(5);
  });
});

describe('computeDailySeries', () => {
  it('produces one bucket per day across the range', () => {
    const series = computeDailySeries([], start, start + 3 * DAY);
    expect(series).toHaveLength(3);
  });

  it('buckets productive and paused hours per day, rounded', () => {
    const sessions = [
      session({ startTime: start + 2 * HOUR, activeTime: HOUR, totalPauseDuration: 30 * 60000 }),
      session({ startTime: start + DAY + 2 * HOUR, activeTime: 30 * 60000 }),
    ];
    const series = computeDailySeries(sessions, start, start + 2 * DAY);
    expect(series).toHaveLength(2);
    const dayOne = series[0];
    expect(dayOne.productive).toBe(1);
    expect(dayOne.paused).toBe(0.5);
    expect(dayOne.total).toBe(1.5);
    expect(series[1].productive).toBe(0.5);
  });

  it('uses weekday labels for short ranges and date labels for long ranges', () => {
    const week = computeDailySeries([], start, start + DAY);
    expect(week[0].day).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);

    const long = computeDailySeries([], start, start + 20 * DAY);
    expect(long[0].day).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/);
  });
});

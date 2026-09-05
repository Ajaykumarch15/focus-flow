import { describe, it, expect } from 'vitest';
import {
  selectTaskDependencies,
  selectBlockedTasks,
  isTaskBlocked,
  selectTaskStatusCounts,
  selectOverdueTasks,
  selectDueTodayTasks,
  selectTasksWithWorklog,
} from '../taskSelectors';
import type { CollaborativeTask } from '@collab/types/collaboration';

// EEP2-P5.2.2 (DDS §4.9): pure dependency selectors — resolve `dependencies`
// to task objects and derive the board's blocked set. No store, no Date.now().

const task = (overrides: Partial<CollaborativeTask>): CollaborativeTask => ({
  id: 't1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  title: 'Task',
  description: '',
  sprintStatus: 'backlog',
  priority: 'medium',
  ownerId: 'm1',
  followerIds: [],
  labels: [],
  dependencies: [],
  estimatedHours: 4,
  actualHours: 0,
  subtasks: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
});

describe('selectTaskDependencies (P5.2.2)', () => {
  it('resolves the dependency ids to task objects in the listed order', () => {
    const a = task({ id: 'tA', title: 'Auth' });
    const b = task({ id: 'tB', title: 'DB seed' });
    const parent = task({ id: 't1', dependencies: ['tB', 'tA'] });
    const tasks = [parent, a, b];
    expect(selectTaskDependencies('t1', tasks).map((d) => d.title)).toEqual(['DB seed', 'Auth']);
  });

  it('drops dangling ids (deleted tasks) without crashing', () => {
    const parent = task({ id: 't1', dependencies: ['tA', 'ghost'] });
    const a = task({ id: 'tA', title: 'Auth' });
    expect(selectTaskDependencies('t1', [parent, a]).map((d) => d.id)).toEqual(['tA']);
  });

  it('returns [] for an unknown parent id', () => {
    const a = task({ id: 'tA' });
    expect(selectTaskDependencies('missing', [a])).toEqual([]);
  });

  it('returns [] when a task has no dependencies', () => {
    expect(selectTaskDependencies('t1', [task({})])).toEqual([]);
  });
});

describe('isTaskBlocked / selectBlockedTasks (P5.2.2)', () => {
  it('is not blocked when every dependency is done', () => {
    const done = task({ id: 'tB', sprintStatus: 'done' });
    const parent = task({ id: 't1', dependencies: ['tB'] });
    const tasks = [parent, done];
    expect(isTaskBlocked(parent, tasks)).toBe(false);
    expect(selectBlockedTasks(tasks)).toEqual([]);
  });

  it('is blocked while any dependency is not done', () => {
    const done = task({ id: 'tB', sprintStatus: 'done' });
    const wip = task({ id: 'tC', sprintStatus: 'in_progress' });
    const parent = task({ id: 't1', dependencies: ['tB', 'tC'] });
    const tasks = [parent, done, wip];
    expect(isTaskBlocked(parent, tasks)).toBe(true);
    expect(selectBlockedTasks(tasks).map((t) => t.id)).toEqual(['t1']);
  });

  it('ignores dependencies whose tasks are absent from the list', () => {
    const parent = task({ id: 't1', dependencies: ['ghost'] });
    const tasks = [parent];
    expect(isTaskBlocked(parent, tasks)).toBe(false);
  });

  it('is never blocked with no dependencies', () => {
    const solo = task({ id: 't1' });
    expect(selectBlockedTasks([solo])).toEqual([]);
  });
});

// EEP2-P5.5.1 (s2): pure execution-view selectors — counts, due (overdue / due
// today), and worklog. `now` is injected so the outputs are deterministic.
describe('taskSelectors P5.5.1', () => {
  const NOW = new Date('2026-07-10T12:00:00.000Z').getTime();
  // Deadline encoding: a tz-midnight instant; dayKey() round-trips the calendar
  // date, so '2026-07-10' is "due today" and '2026-07-09' is overdue.
  const due = (deadline: string) => task({ deadline });

  it('counts tasks per status, always returning every status key', () => {
    const tasks = [
      task({ id: 'a', sprintStatus: 'backlog' }),
      task({ id: 'b', sprintStatus: 'in_progress' }),
      task({ id: 'c', sprintStatus: 'in_progress' }),
      task({ id: 'd', sprintStatus: 'done' }),
      task({ id: 'e', sprintStatus: 'done' }),
      task({ id: 'f', sprintStatus: 'done' }),
    ];
    expect(selectTaskStatusCounts(tasks)).toEqual({
      backlog: 1, ready: 0, in_progress: 2, review: 0, done: 3,
    });
  });

  it('returns all-zero counts for an empty list', () => {
    expect(selectTaskStatusCounts([])).toEqual({
      backlog: 0, ready: 0, in_progress: 0, review: 0, done: 0,
    });
  });

  it('flags overdue tasks with a deadline before today, excluding done ones', () => {
    const tasks = [
      due('2026-07-09T00:00:00.000Z'),
      task({ id: 'done', deadline: '2026-07-01T00:00:00.000Z', sprintStatus: 'done' }),
      due('2026-07-10T00:00:00.000Z'),
      due('2026-07-15T00:00:00.000Z'),
      task({ id: 'nodl' }),
    ];
    expect(selectOverdueTasks(tasks, NOW).map((t) => t.id)).toEqual(['t1']);
  });

  it('flags tasks whose deadline is today, excluding done ones', () => {
    const tasks = [
      due('2026-07-10T00:00:00.000Z'),
      task({ id: 'done', deadline: '2026-07-10T00:00:00.000Z', sprintStatus: 'done' }),
      due('2026-07-09T00:00:00.000Z'),
      task({ id: 'nodl' }),
    ];
    expect(selectDueTodayTasks(tasks, NOW).map((t) => t.id)).toEqual(['t1']);
  });

  it('treats a missing deadline honestly (never overdue / never due today)', () => {
    const tasks = [task({ id: 'no-deadline' })];
    expect(selectOverdueTasks(tasks, NOW)).toEqual([]);
    expect(selectDueTodayTasks(tasks, NOW)).toEqual([]);
  });

  it('selects tasks with logged time from totalTime or actualHours', () => {
    const tasks = [
      task({ id: 'ms', totalTime: 3_600_000 }),
      task({ id: 'hrs', actualHours: 2.5 }),
      task({ id: 'both', totalTime: 1_800_000, actualHours: 1 }),
      task({ id: 'none' }),
    ];
    expect(selectTasksWithWorklog(tasks).map((t) => t.id)).toEqual(['ms', 'hrs', 'both']);
  });
});

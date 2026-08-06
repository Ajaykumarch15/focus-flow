import { describe, it, expect } from 'vitest';
import {
  selectTaskDependencies,
  selectBlockedTasks,
  isTaskBlocked,
} from '../taskSelectors';
import type { CollaborativeTask } from '../../types/collaboration';

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

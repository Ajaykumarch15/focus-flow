import { describe, it, expect } from 'vitest';
import type { Task } from '../../types';
import type { WorkLog } from '../../store/useWorkLogStore';
import type { CentralBlocker, CollaborativeTask } from '../../types/collaboration';
import {
  selectContinue, selectDoNow, selectAttention, selectToday,
} from '../todaySelectors';

// Deterministic clock: Tue Aug 4 2026, 12:00 local.
const NOW = new Date(2026, 7, 4, 12, 0, 0).getTime();

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'Work',
    createdAt: new Date(2026, 7, 1).getTime(),
    updatedAt: new Date(2026, 7, 1).getTime(),
    subtasks: [],
    sessions: [],
    totalTime: 0,
    tags: [],
    color: '#0ea5e9',
    order: 0,
    ...overrides,
  };
}

function makeWorkLog(overrides: Partial<WorkLog> & { _id: string }): WorkLog {
  return {
    title: 'Work log',
    problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: '' },
    problem: '',
    gitBranch: '',
    currentWork: '',
    plan: '',
    designNotes: '',
    blockers: '',
    gitRef: { repository: '', branch: '', commitIds: [], prNumber: '', issueNumber: '' },
    timelineEntries: [],
    decisions: [],
    blockerList: [],
    progressSnapshots: [],
    completedItems: [],
    links: [],
    attachments: [],
    workEntries: [],
    tomorrowPlan: { topPriority: '', unfinishedItems: [], attentionRequired: '' },
    reflection: { wentWell: '', slowedDown: '', learned: '', improvement: '', rating: 0 },
    moodMetrics: { energy: 0, focus: 0, stress: 0, confidence: 0, motivation: 0 },
    status: 'in-progress',
    isActive: true,
    mood: 3,
    tags: [],
    totalActiveMs: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  };
}

function makeBlocker(overrides: Partial<CentralBlocker> & { id: string }): CentralBlocker {
  return {
    workspaceId: 'ws1',
    title: 'Blocked on design',
    severity: 'high',
    ownerId: 'u1',
    reporterId: 'u2',
    status: 'open',
    impactDescription: 'Cannot ship',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeReview(overrides: Partial<CollaborativeTask> & { id: string }): CollaborativeTask {
  return {
    workspaceId: 'ws1',
    projectId: 'p1',
    title: 'Review auth',
    description: '',
    sprintStatus: 'review',
    priority: 'medium',
    ownerId: 'u1',
    followerIds: [],
    labels: [],
    dependencies: [],
    estimatedHours: 0,
    actualHours: 0,
    subtasks: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectContinue', () => {
  it('ranks the open session task first and flags the active session', () => {
    const running = makeTask({ id: 't-running', status: 'active', updatedAt: new Date(2026, 7, 4, 9).getTime() });
    const result = selectContinue([running], 't-running', 'sess-1', [], 5);
    expect(result.map((i) => i.taskId)).toEqual(['t-running']);
    expect(result[0]).toMatchObject({ source: 'active', status: 'active', hasActiveSession: true });
  });

  it('sorts paused tasks above worklog-linked and history items', () => {
    const active = makeTask({ id: 't-active', status: 'active', updatedAt: new Date(2026, 7, 4, 10).getTime() });
    const paused = makeTask({ id: 't-paused', status: 'paused', updatedAt: new Date(2026, 7, 4, 8).getTime() });
    const history = makeTask({ id: 't-history', status: 'todo', totalTime: 5_000, updatedAt: new Date(2026, 7, 3, 9).getTime() });
    const log = makeWorkLog({ _id: 'log1', taskRef: { _id: 't-logged', title: 'Logged', color: '#fff', category: 'Work', totalTime: 0 }, updatedAt: '2026-08-02T10:00:00.000Z' });
    const result = selectContinue([active, paused, history], 't-active', 'sess-1', [log], 5);
    expect(result.map((i) => i.taskId)).toEqual(['t-active', 't-paused', 't-logged', 't-history']);
    expect(result.map((i) => i.source)).toEqual(['active', 'paused', 'worklog', 'history']);
  });

  it('orders worklog-linked tasks by most recent log first and dedupes the active task', () => {
    const active = makeTask({ id: 't-active', status: 'active', updatedAt: new Date(2026, 7, 4, 10).getTime() });
    const logA = makeWorkLog({ _id: 'log-a', taskRef: { _id: 't-a', title: 'A', color: '#fff', category: 'Work', totalTime: 0 }, updatedAt: '2026-08-03T08:00:00.000Z' });
    const logB = makeWorkLog({ _id: 'log-b', taskRef: { _id: 't-b', title: 'B', color: '#fff', category: 'Work', totalTime: 0 }, updatedAt: '2026-08-02T08:00:00.000Z' });
    const logActive = makeWorkLog({ _id: 'log-active', taskRef: { _id: 't-active', title: 'Active', color: '#fff', category: 'Work', totalTime: 0 }, updatedAt: '2026-08-04T08:00:00.000Z' });
    const result = selectContinue([active], 't-active', 'sess-1', [logB, logA, logActive], 5);
    expect(result.map((i) => i.taskId)).toEqual(['t-active', 't-a', 't-b']);
  });

  it('excludes completed tasks and completed work logs', () => {
    const done = makeTask({ id: 't-done', status: 'completed', totalTime: 100 });
    const doneLog = makeWorkLog({ _id: 'log-done', status: 'done', taskRef: { _id: 't-logged', title: 'Logged', color: '#fff', category: 'Work', totalTime: 0 } });
    const result = selectContinue([done], null, null, [doneLog], 5);
    expect(result).toEqual([]);
  });

  it('keeps paused active-session tasks as source active with paused status', () => {
    const paused = makeTask({ id: 't-paused', status: 'paused' });
    const result = selectContinue([paused], 't-paused', 'sess-1', [], 5);
    expect(result[0]).toMatchObject({ source: 'active', status: 'paused', hasActiveSession: true });
  });

  it('respects the limit and returns [] on empty input', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask({ id: `t-${i}`, status: 'todo', totalTime: 100 }));
    expect(selectContinue(tasks, null, null, [], 3)).toHaveLength(3);
    expect(selectContinue([], null, null, [], 5)).toEqual([]);
  });
});

describe('selectDoNow', () => {
  it('returns only untouched todo tasks, excluding the active task and accumulated work', () => {
    const fresh = makeTask({ id: 't-fresh' });
    const active = makeTask({ id: 't-active', status: 'active' });
    const paused = makeTask({ id: 't-paused', status: 'paused' });
    const started = makeTask({ id: 't-started', status: 'todo', totalTime: 3_000 });
    const done = makeTask({ id: 't-done', status: 'completed' });
    const result = selectDoNow([fresh, active, paused, started, done], 't-active', NOW, 5);
    expect(result.map((i) => i.task.id)).toEqual(['t-fresh']);
  });

  it('ranks priority before deadline urgency', () => {
    const urgentFar = makeTask({ id: 't-urgent', priority: 'urgent', deadline: new Date(2026, 8, 1).getTime() });
    const mediumOverdue = makeTask({ id: 't-overdue', priority: 'medium', deadline: new Date(2026, 7, 2).getTime() });
    const result = selectDoNow([urgentFar, mediumOverdue], null, NOW, 5);
    expect(result.map((i) => i.task.id)).toEqual(['t-urgent', 't-overdue']);
  });

  it('breaks ties within a priority by deadline urgency, then recency', () => {
    const dueToday = makeTask({ id: 't-today', priority: 'high', deadline: new Date(2026, 7, 4).getTime() });
    const inTwoDays = makeTask({ id: 't-soon', priority: 'high', deadline: new Date(2026, 7, 6).getTime() });
    const noDeadline = makeTask({ id: 't-none', priority: 'high' });
    const result = selectDoNow([noDeadline, inTwoDays, dueToday], null, NOW, 5);
    expect(result.map((i) => i.task.id)).toEqual(['t-today', 't-soon', 't-none']);
  });

  it('derives honest reasons and deadline statuses', () => {
    const overdue = makeTask({ id: 't-overdue', deadline: new Date(2026, 7, 2).getTime() });
    const today = makeTask({ id: 't-today', deadline: new Date(2026, 7, 4).getTime() });
    const tomorrow = makeTask({ id: 't-tomorrow', deadline: new Date(2026, 7, 5).getTime() });
    const urgent = makeTask({ id: 't-urgent', priority: 'urgent' });
    const ready = makeTask({ id: 't-ready' });
    const result = selectDoNow([overdue, today, tomorrow, urgent, ready], null, NOW, 5);
    expect(result.find((i) => i.task.id === 't-overdue')).toMatchObject({ reason: 'Overdue by 2 days', deadlineStatus: 'overdue' });
    expect(result.find((i) => i.task.id === 't-today')).toMatchObject({ reason: 'Due today', deadlineStatus: 'due-today' });
    expect(result.find((i) => i.task.id === 't-tomorrow')).toMatchObject({ reason: 'Due tomorrow', deadlineStatus: 'due-soon' });
    expect(result.find((i) => i.task.id === 't-urgent')).toMatchObject({ reason: 'Urgent priority' });
    expect(result.find((i) => i.task.id === 't-ready')).toMatchObject({ reason: 'Ready to start', deadlineStatus: null });
  });

  it('reports subtask progress or null when there are no subtasks', () => {
    const partial = makeTask({
      id: 't-partial',
      subtasks: [
        { id: 's1', title: 'a', completed: true, createdAt: 1 },
        { id: 's2', title: 'b', completed: false, createdAt: 1 },
      ],
    });
    const none = makeTask({ id: 't-none' });
    const result = selectDoNow([none, partial], null, NOW, 5);
    expect(result.find((i) => i.task.id === 't-partial')?.subtaskProgress).toEqual({ done: 1, total: 2, pct: 50 });
    expect(result.find((i) => i.task.id === 't-none')?.subtaskProgress).toBeNull();
  });

  it('respects the limit', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask({ id: `t-${i}` }));
    expect(selectDoNow(tasks, null, NOW, 2)).toHaveLength(2);
  });
});

describe('selectAttention', () => {
  it('tiers overdue tasks above blockers, reviews and deadlines', () => {
    const overdue = makeTask({ id: 't-overdue', deadline: new Date(2026, 7, 2).getTime() });
    const blocker = makeBlocker({ id: 'b1', severity: 'critical' });
    const review = makeReview({ id: 'r1' });
    const deadline = { id: 'd1', title: 'Sprint end', dueDate: '2026-08-08' };
    const result = selectAttention([overdue], [blocker], [review], [deadline], NOW, 7, 8);
    expect(result[0]).toMatchObject({ kind: 'overdue', taskId: 't-overdue' });
    expect(result[1]).toMatchObject({ kind: 'blocker' });
    expect(result[2]).toMatchObject({ kind: 'review' });
    expect(result[3]).toMatchObject({ kind: 'deadline' });
  });

  it('sorts overdue by priority and blockers by severity', () => {
    const lowOverdue = makeTask({ id: 't-low', priority: 'low', deadline: new Date(2026, 7, 2).getTime() });
    const urgentOverdue = makeTask({ id: 't-urgent', priority: 'urgent', deadline: new Date(2026, 7, 2).getTime() });
    const mediumBlocker = makeBlocker({ id: 'b-medium', severity: 'medium' });
    const criticalBlocker = makeBlocker({ id: 'b-critical', severity: 'critical' });
    const result = selectAttention([lowOverdue, urgentOverdue], [mediumBlocker, criticalBlocker], [], [], NOW, 7, 8);
    expect(result.map((i) => i.id)).toEqual(['task-t-urgent', 'task-t-low', 'blocker-b-critical', 'blocker-b-medium']);
  });

  it('flags due-today tasks and skips resolved blockers', () => {
    const dueToday = makeTask({ id: 't-today', deadline: new Date(2026, 7, 4).getTime() });
    const resolved = makeBlocker({ id: 'b-resolved', status: 'resolved' });
    const result = selectAttention([dueToday], [resolved], [], [], NOW, 7, 8);
    expect(result.map((i) => i.kind)).toEqual(['due-today']);
  });

  it('includes only deadlines inside the horizon and orders soonest first', () => {
    const today = { id: 'd-today', title: 'Due today', dueDate: '2026-08-04' };
    const far = { id: 'd-far', title: 'Sprint end', dueDate: '2026-08-08' };
    const past = { id: 'd-past', title: 'Past', dueDate: '2026-07-01' };
    const result = selectAttention([], [], [], [far, today, past], NOW, 7, 8);
    expect(result.map((i) => i.id)).toEqual(['deadline-d-today', 'deadline-d-far']);
  });

  it('maps urgent priority to critical severity', () => {
    const urgentReview = makeReview({ id: 'r-urgent', priority: 'urgent' });
    const result = selectAttention([], [], [urgentReview], [], NOW, 7, 8);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'review', severity: 'critical' });
  });

  it('respects the limit', () => {
    const items = Array.from({ length: 10 }, (_, i) => makeBlocker({ id: `b-${i}`, severity: 'low' }));
    expect(selectAttention([], items, [], [], NOW, 7, 4)).toHaveLength(4);
  });

  it('returns [] for empty input', () => {
    expect(selectAttention([], [], [], [], NOW, 7, 8)).toEqual([]);
  });
});

describe('selectToday', () => {
  it('composes continue, doNow and attention from the same inputs', () => {
    const running = makeTask({ id: 't-running', status: 'active', updatedAt: new Date(2026, 7, 4, 9).getTime() });
    const fresh = makeTask({ id: 't-fresh', priority: 'high' });
    const overdue = makeTask({ id: 't-overdue', deadline: new Date(2026, 7, 2).getTime() });
    const log = makeWorkLog({ _id: 'log1', taskRef: { _id: 't-running', title: 'Running', color: '#fff', category: 'Work', totalTime: 0 } });
    const view = selectToday({
      tasks: [running, fresh, overdue],
      activeTaskId: 't-running',
      activeSessionId: 'sess-1',
      workLogs: [log],
      blockers: [],
      reviews: [],
      deadlines: [],
      todayMs: 45 * 60 * 1000,
      weekMs: 2 * 3600 * 1000,
      dailyGoalMs: 8 * 3600 * 1000,
      now: NOW,
    });
    expect(view.continue.map((i) => i.taskId)).toEqual(['t-running']);
    expect(view.doNow.map((i) => i.task.id)).toEqual(['t-fresh', 't-overdue']);
    expect(view.attention.map((i) => i.taskId)).toEqual(['t-overdue']);
  });

  it('computes stats honestly, clamping progress at 100', () => {
    const view = selectToday({
      tasks: [],
      activeTaskId: null,
      activeSessionId: null,
      workLogs: [],
      blockers: [],
      reviews: [],
      deadlines: [],
      todayMs: 9 * 3600 * 1000,
      weekMs: 12 * 3600 * 1000,
      dailyGoalMs: 8 * 3600 * 1000,
      now: NOW,
    });
    expect(view.stats.progressPct).toBe(100);
    expect(view.stats.todayMs).toBe(9 * 3600 * 1000);
    expect(view.stats.weekMs).toBe(12 * 3600 * 1000);
    expect(view.stats.dailyGoalMs).toBe(8 * 3600 * 1000);
  });

  it('returns null progress when the daily goal is zero (honest —)', () => {
    const view = selectToday({
      tasks: [], activeTaskId: null, activeSessionId: null, workLogs: [],
      blockers: [], reviews: [], deadlines: [],
      todayMs: 1000, weekMs: 0, dailyGoalMs: 0, now: NOW,
    });
    expect(view.stats.progressPct).toBeNull();
  });

  it('counts today completions and overdue tasks against the injected clock', () => {
    const doneToday = makeTask({ id: 't-done', status: 'completed', updatedAt: new Date(2026, 7, 4, 9).getTime() });
    const doneBefore = makeTask({ id: 't-before', status: 'completed', updatedAt: new Date(2026, 7, 2, 9).getTime() });
    const overdue = makeTask({ id: 't-overdue', deadline: new Date(2026, 7, 1).getTime() });
    const open = makeTask({ id: 't-open' });
    const view = selectToday({
      tasks: [doneToday, doneBefore, overdue, open],
      activeTaskId: null, activeSessionId: null, workLogs: [],
      blockers: [], reviews: [], deadlines: [],
      todayMs: 0, weekMs: 0, dailyGoalMs: 8 * 3600 * 1000, now: NOW,
    });
    expect(view.stats.completedToday).toBe(1);
    expect(view.stats.overdueCount).toBe(1);
    expect(view.stats.activeCount).toBe(2);
  });

  it('is pure: identical input produces identical output and mutates nothing', () => {
    const tasks = [makeTask({ id: 't-1', deadline: new Date(2026, 7, 2).getTime() })];
    const snapshot = JSON.stringify(tasks);
    const input = {
      tasks,
      activeTaskId: null,
      activeSessionId: null,
      workLogs: [],
      blockers: [],
      reviews: [],
      deadlines: [],
      todayMs: 1000,
      weekMs: 0,
      dailyGoalMs: 8 * 3600 * 1000,
      now: NOW,
    };
    const a = selectToday(input);
    const b = selectToday(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(tasks)).toBe(snapshot);
  });
});

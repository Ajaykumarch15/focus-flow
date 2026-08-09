import type { CollaborativeTask, SprintStatus } from '../types/collaboration';
import { dayKey } from '../utils/time';

// EEP2-P5.2.2 (DDS §4.9): pure dependency selectors — same contract as the rest
// of `lib/*Selectors`: no store access, no Date.now(), deterministic output.
// The board's "blocked" styling derives from `selectBlockedTasks` so the cards
// never re-implement scope logic. The P5.5.1 family (status counts, due,
// worklog) lands with Epic 5.5 for the project execution view.

// The tasks `taskId` depends on, resolved to task objects in `tasks` order.
// A dangling id (deleted task, stale local state) is dropped rather than
// crashing the board.
export function selectTaskDependencies(taskId: string, tasks: CollaborativeTask[]): CollaborativeTask[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return [];
  return task.dependencies
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is CollaborativeTask => Boolean(t));
}

// A task is blocked while any of its dependencies is not done.
export function isTaskBlocked(task: CollaborativeTask, tasks: CollaborativeTask[]): boolean {
  return selectTaskDependencies(task.id, tasks).some((d) => d.sprintStatus !== 'done');
}

// All tasks currently blocked by at least one unfinished dependency.
export function selectBlockedTasks(tasks: CollaborativeTask[]): CollaborativeTask[] {
  return tasks.filter((t) => isTaskBlocked(t, tasks));
}

// ── EEP2-P5.5.1: counts / due / worklog (pure, `now` injected for determinism) ──

// Per-status counts for a task list — the execution view's summary strip.
// Always returns every status key so consumers can render 0s honestly.
export function selectTaskStatusCounts(tasks: CollaborativeTask[]): Record<SprintStatus, number> {
  const counts: Record<SprintStatus, number> = {
    backlog: 0, ready: 0, in_progress: 0, review: 0, done: 0,
  };
  for (const t of tasks) {
    if (t.sprintStatus in counts) counts[t.sprintStatus] += 1;
  }
  return counts;
}

// A task has a usable deadline (completing it clears any overdue/due state).
function hasDeadline(t: CollaborativeTask): t is CollaborativeTask & { deadline: string } {
  return typeof t.deadline === 'string' && t.deadline.length > 0;
}

// Tasks whose deadline day is strictly before today's day. Completed tasks are
// never overdue — the deadline is a live-execution concern.
export function selectOverdueTasks(tasks: CollaborativeTask[], now: number): CollaborativeTask[] {
  const today = dayKey(now);
  return tasks.filter(
    (t) => hasDeadline(t) && t.sprintStatus !== 'done' && dayKey(new Date(t.deadline).getTime()) < today,
  );
}

// Tasks whose deadline falls on today's calendar day (still open).
export function selectDueTodayTasks(tasks: CollaborativeTask[], now: number): CollaborativeTask[] {
  const today = dayKey(now);
  return tasks.filter(
    (t) => hasDeadline(t) && t.sprintStatus !== 'done' && dayKey(new Date(t.deadline).getTime()) === today,
  );
}

// Tasks that have logged focus time (P5.4.2 `totalTime` ms or legacy `actualHours`).
export function selectTasksWithWorklog(tasks: CollaborativeTask[]): CollaborativeTask[] {
  return tasks.filter((t) => (t.totalTime ?? 0) > 0 || (t.actualHours ?? 0) > 0);
}

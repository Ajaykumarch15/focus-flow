import type { CollaborativeTask } from '../types/collaboration';

// EEP2-P5.2.2 (DDS §4.9): pure dependency selectors — same contract as the rest
// of `lib/*Selectors`: no store access, no Date.now(), deterministic output.
// The board's "blocked" styling derives from `selectBlockedTasks` so the cards
// never re-implement scope logic. The rest of the P5.5.1 family (status counts,
// due-today, worklog) lands with Epic 5.5.

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

import type { Task } from '@shared/types';

export type ScheduledState = 'completed' | 'today' | 'missed' | 'upcoming' | 'unscheduled';

/**
 * Derive the display state for a task based on its scheduledDate and status.
 * States are never stored — they're computed on every render.
 */
export function getScheduledState(
  task: { status: string; scheduledDate?: number },
  now?: Date,
): ScheduledState {
  if (task.status === 'completed') return 'completed';
  if (!task.scheduledDate) return 'unscheduled';

  const today = startOfDay(now ?? new Date());
  const scheduled = startOfDay(new Date(task.scheduledDate));

  if (scheduled.getTime() === today.getTime()) return 'today';
  if (scheduled.getTime() < today.getTime()) return 'missed';
  return 'upcoming';
}

/** Check if a task is scheduled for today. */
export function isScheduledToday(task: { scheduledDate?: number }, now?: Date): boolean {
  if (!task.scheduledDate) return false;
  const today = startOfDay(now ?? new Date());
  const scheduled = startOfDay(new Date(task.scheduledDate));
  return scheduled.getTime() === today.getTime();
}

/** Check if a task is missed (scheduled before today, not completed). */
export function isMissed(task: { status: string; scheduledDate?: number }, now?: Date): boolean {
  if (task.status === 'completed' || !task.scheduledDate) return false;
  const today = startOfDay(now ?? new Date());
  const scheduled = startOfDay(new Date(task.scheduledDate));
  return scheduled.getTime() < today.getTime();
}

/** Filter tasks to those scheduled for today (not completed). */
export function getTodayTasks(tasks: Task[], now?: Date): Task[] {
  return tasks.filter(t => isScheduledToday(t, now) && t.status !== 'completed');
}

/** Filter tasks to missed tasks (scheduled before today, not completed). */
export function getMissedTasks(tasks: Task[], now?: Date): Task[] {
  return tasks.filter(t => isMissed(t, now));
}

/** Filter tasks to upcoming (scheduled after today, not completed). */
export function getUpcomingTasks(tasks: Task[], now?: Date): Task[] {
  const today = startOfDay(now ?? new Date());
  return tasks.filter(t => {
    if (t.status === 'completed' || !t.scheduledDate) return false;
    const scheduled = startOfDay(new Date(t.scheduledDate));
    return scheduled.getTime() > today.getTime();
  });
}

/** Get scheduled tasks sorted by date (ascending). */
export function getScheduledTasks(tasks: Task[]): Task[] {
  return tasks
    .filter(t => t.scheduledDate)
    .sort((a, b) => (a.scheduledDate ?? Infinity) - (b.scheduledDate ?? Infinity));
}

/** Format a scheduled date for display. */
export function formatScheduledDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format a scheduled date with year. */
export function formatScheduledDateFull(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Get today's date key (YYYY-MM-DD) in local timezone. */
export function todayKey(now?: Date): string {
  const d = now ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Start of day (00:00:00.000) for a given date. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Badge color class for a scheduled state. */
export function scheduledStateColor(state: ScheduledState): string {
  switch (state) {
    case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'today': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'missed': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'upcoming': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'unscheduled': return '';
  }
}

/** Badge label for a scheduled state. */
export function scheduledStateLabel(state: ScheduledState): string {
  switch (state) {
    case 'completed': return 'Completed';
    case 'today': return 'Today';
    case 'missed': return 'Missed';
    case 'upcoming': return 'Upcoming';
    case 'unscheduled': return '';
  }
}

/** Get tasks scheduled for a specific date (not completed). */
export function getTasksForDate(tasks: Task[], date: Date): Task[] {
  const target = startOfDay(date);
  return tasks.filter(t => {
    if (t.status === 'completed' || !t.scheduledDate) return false;
    return startOfDay(new Date(t.scheduledDate)).getTime() === target.getTime();
  });
}

/** Get array of 7 Date objects for a week (Mon–Sun) given a week offset. */
export function getWeekDates(offset: number = 0): Date[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun 1=Mon …
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Format a date as "Mon 28" for week-view headers. */
export function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

/** Check if two calendar dates are the same day. */
export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

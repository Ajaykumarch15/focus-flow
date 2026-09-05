/**
 * Pure range-driven selectors for Personal Reports.
 *
 * Single computed source for every KPI shown by the merged Reports page.
 * Every helper filters sessions/tasks by an inclusive [start, end] window,
 * so the same range filter drives both the time retrospective and the
 * focus/analytics view with no duplicated computations.
 */

export interface SessionLike {
  id: string;
  taskId: string;
  startTime: number;
  activeTime: number;
  totalPauseDuration: number;
  focusScore?: number;
}

export interface TaskLike {
  id: string;
  title: string;
  color: string;
  category: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface RangeStats {
  focusedMs: number;
  pausedMs: number;
  sessionCount: number;
  focusScore: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
}

export interface CategorySlice {
  name: string;
  hours: number;
}

export interface TopTask {
  taskId: string;
  title: string;
  color: string;
  category: string;
  analyticsMs: number;
}

export interface DailyPoint {
  day: string;
  productive: number;
  paused: number;
  total: number;
}

export interface Delta {
  pct: number;
  up: boolean;
}

const MS_PER_DAY = 86400000;

function roundHours(ms: number): number {
  return Math.round((ms / 3600000) * 10) / 10;
}

export function computeRangeStats(sessions: SessionLike[], tasks: TaskLike[], start: number, end: number): RangeStats {
  const inRange = sessions.filter(s => s.startTime >= start && s.startTime <= end);
  const focusedMs = inRange.reduce((acc, s) => acc + s.activeTime, 0);
  const pausedMs = inRange.reduce((acc, s) => acc + s.totalPauseDuration, 0);
  const scored = inRange.filter(s => s.focusScore !== undefined);
  const focusScore = scored.length > 0
    ? Math.round(scored.reduce((acc, s) => acc + (s.focusScore || 0), 0) / scored.length)
    : 0;
  const completedTasks = tasks.filter(t =>
    t.status === 'completed' && t.updatedAt >= start && t.updatedAt <= end,
  ).length;
  const totalTasks = tasks.filter(t =>
    t.createdAt <= end && (t.status !== 'completed' || t.updatedAt >= start),
  ).length;
  return {
    focusedMs,
    pausedMs,
    sessionCount: inRange.length,
    focusScore,
    completedTasks,
    totalTasks,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

export function getComparisonDelta(current: number, prev: number): Delta {
  if (prev <= 0) return { pct: 0, up: true };
  const pct = Math.round(((current - prev) / prev) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

export function computeCategoryBreakdown(sessions: SessionLike[], tasks: TaskLike[], start: number, end: number): CategorySlice[] {
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const totals: Record<string, number> = {};
  for (const session of sessions) {
    if (session.startTime < start || session.startTime > end) continue;
    const task = taskById.get(session.taskId);
    const category = task?.category || 'Other';
    totals[category] = (totals[category] || 0) + session.activeTime;
  }
  return Object.entries(totals)
    .map(([name, ms]) => ({ name, hours: roundHours(ms) }))
    .filter(slice => slice.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

export function computeTopTasks(sessions: SessionLike[], tasks: TaskLike[], start: number, end: number): TopTask[] {
  const taskTime = new Map<string, number>();
  for (const session of sessions) {
    if (session.startTime < start || session.startTime > end) continue;
    taskTime.set(session.taskId, (taskTime.get(session.taskId) || 0) + session.activeTime);
  }
  return tasks
    .map(task => ({
      taskId: task.id,
      title: task.title,
      color: task.color,
      category: task.category,
      analyticsMs: taskTime.get(task.id) || 0,
    }))
    .filter(t => t.analyticsMs > 0)
    .sort((a, b) => b.analyticsMs - a.analyticsMs)
    .slice(0, 5);
}

export function computeDailySeries(sessions: SessionLike[], start: number, end: number): DailyPoint[] {
  const daysCount = Math.max(1, Math.ceil((end - start) / MS_PER_DAY));
  const data: DailyPoint[] = [];
  for (let i = 0; i < daysCount; i++) {
    const dayStart = start + i * MS_PER_DAY;
    const dayEnd = dayStart + MS_PER_DAY - 1;
    const d = new Date(dayStart);
    const label = daysCount <= 7
      ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let productive = 0;
    let paused = 0;
    for (const session of sessions) {
      if (session.startTime >= dayStart && session.startTime <= dayEnd) {
        productive += session.activeTime;
        paused += session.totalPauseDuration;
      }
    }
    data.push({
      day: label,
      productive: roundHours(productive),
      paused: roundHours(paused),
      total: roundHours(productive + paused),
    });
  }
  return data;
}

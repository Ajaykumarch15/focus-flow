import type { Task, JournalEntry } from '../types';
import type { WorkLog } from '../store/useWorkLogStore';
import type { MemorySession } from './memorySelectors';
import { computeRangeStats } from './reportsSelectors';
import {
  formatDateShort,
  formatHours,
  formatTimeOfDay,
  startOfDayInTz,
} from '../utils/time';

// ── PI-1.1: pure Daily Insights selectors (Phase PI · DCX) ─────────────────────
// Personal Insights turn raw analytics into honest observations: "what does this
// mean?" — never "what should I do" lectures. 100% deterministic — no LLMs, no
// Date.now() ranking, no fabricated numbers. Every insight is traceable to the
// supporting metrics it shows, and each metric is computed through the existing
// analytics layer (`computeRangeStats`) or the raw data stores — nothing is
// re-implemented or invented. When a day holds too little data, the selector
// emits nothing rather than a weak, made-up insight; pages render an honest
// "Not enough data yet." state.

export type InsightCategory =
  | 'Focus' | 'Execution' | 'Consistency' | 'Work Habits' | 'Tasks'
  | 'Features' | 'Knowledge' | 'Reflection' | 'Productivity' | 'Context';

export type Confidence = 'high' | 'medium' | 'low';

export interface InsightMetric {
  label: string;
  value: string;
}

export interface DailyInsight {
  id: string;
  category: InsightCategory;
  title: string;
  observation: string;
  metrics: InsightMetric[];
  period: { label: string; start: number; end: number };
  confidence: Confidence;
  action?: { label: string; detail: string };
}

export interface DailyInsightsInput {
  sessions: MemorySession[];
  tasks: Task[];
  journals: JournalEntry[];
  workLogs: WorkLog[];
  dailyGoalMs: number;
  now?: number;
  timeZone?: string;
}

export interface DailyInsightsView {
  mostImportant: DailyInsight | null;
  todays: DailyInsight[];
  hasData: boolean;
  periodLabel: string;
  sessionCount: number;
}

// A focus block counts as "deep work" at 25+ uninterrupted minutes.
const DEEP_WORK_MIN_MS = 25 * 60 * 1000;
const MS_PER_DAY = 86400000;

function confidenceFor(score: number, highAt: number, mediumAt = 1): Confidence {
  if (score >= highAt) return 'high';
  if (score >= mediumAt) return 'medium';
  return 'low';
}

function taskTitle(tasks: Task[], taskId: string): string | null {
  const task = tasks.find((t) => t.id === taskId);
  return task ? task.title : null;
}

function todayWindow(now: number, timeZone: string): { start: number; end: number } {
  const start = startOfDayInTz(now, timeZone);
  return { start, end: start + MS_PER_DAY - 1 };
}

// ── Daily insight builders ─────────────────────────────────────────────────────

function buildFocusInsight(
  focusedMs: number,
  sessionCount: number,
  focusScore: number,
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  return {
    id: 'focus-today',
    category: 'Focus',
    title: 'Focus time today',
    observation: `You focused ${formatHours(focusedMs)} today across ${sessionCount} session${sessionCount === 1 ? '' : 's'}.`,
    metrics: [
      { label: 'Focused time', value: formatHours(focusedMs) },
      { label: 'Sessions', value: String(sessionCount) },
      ...(focusScore > 0 ? [{ label: 'Avg focus quality', value: `${focusScore}%` }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(sessionCount, 3, 1),
  };
}

function buildGoalInsight(
  focusedMs: number,
  dailyGoalMs: number,
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  const reached = focusedMs >= dailyGoalMs;
  const progressPct = Math.min(100, Math.round((focusedMs / dailyGoalMs) * 100));
  const remaining = Math.max(0, dailyGoalMs - focusedMs);
  return {
    id: 'daily-goal',
    category: 'Productivity',
    title: reached ? 'Daily focus goal reached' : 'Daily focus goal in progress',
    observation: reached
      ? `You reached your daily focus goal of ${formatHours(dailyGoalMs)}.`
      : `You are ${formatHours(remaining)} short of your ${formatHours(dailyGoalMs)} daily focus goal.`,
    metrics: [
      { label: 'Focused', value: formatHours(focusedMs) },
      { label: 'Daily goal', value: formatHours(dailyGoalMs) },
      { label: 'Progress', value: `${progressPct}%` },
    ],
    period: { label: periodLabel, start, end },
    confidence: 'high',
    ...(reached
      ? {}
      : { action: { label: 'Reach the goal', detail: `${formatHours(remaining)} of focused time remaining today.` } }),
  };
}

function buildDeepWorkInsight(
  deepSessions: MemorySession[],
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  const deepMs = deepSessions.reduce((acc, s) => acc + s.activeTime, 0);
  return {
    id: 'deep-work',
    category: 'Work Habits',
    title: 'Deep work',
    observation: `You spent ${formatHours(deepMs)} in ${deepSessions.length} deep-work session${deepSessions.length === 1 ? '' : 's'} of 25+ minutes.`,
    metrics: [
      { label: 'Deep work time', value: formatHours(deepMs) },
      { label: 'Deep sessions', value: String(deepSessions.length) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(deepSessions.length, 2, 1),
  };
}

function buildLongestSessionInsight(
  longest: MemorySession,
  sessionCount: number,
  tasks: Task[],
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  return {
    id: 'longest-focus',
    category: 'Focus',
    title: 'Longest focus session',
    observation: `Your longest single focus session today was ${formatHours(longest.activeTime)}.`,
    metrics: [
      { label: 'Longest session', value: formatHours(longest.activeTime) },
      ...(taskTitle(tasks, longest.taskId) ? [{ label: 'Task', value: taskTitle(tasks, longest.taskId) as string }] : []),
      { label: 'Started', value: formatTimeOfDay(longest.startTime) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(sessionCount, 3, 1),
  };
}

function buildInterruptionsInsight(
  pauseTotal: number,
  pausedMs: number,
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  const insight: DailyInsight = {
    id: 'interruptions',
    category: 'Work Habits',
    title: 'Interruptions',
    observation: `You paused the timer ${pauseTotal} time${pauseTotal === 1 ? '' : 's'} today, for ${formatHours(pausedMs)} total.`,
    metrics: [
      { label: 'Pauses', value: String(pauseTotal) },
      { label: 'Paused time', value: formatHours(pausedMs) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(pauseTotal, 3, 1),
  };
  if (pauseTotal >= 4) {
    insight.action = {
      label: 'Batch interruptions',
      detail: 'Grouping short breaks together can protect longer focus blocks.',
    };
  }
  return insight;
}

function buildContextSwitchesInsight(
  taskCount: number,
  sessionCount: number,
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  const insight: DailyInsight = {
    id: 'context-switches',
    category: 'Context',
    title: 'Context switches',
    observation: `Your focus moved across ${taskCount} different task${taskCount === 1 ? '' : 's'} today.`,
    metrics: [
      { label: 'Tasks touched', value: String(taskCount) },
      { label: 'Sessions', value: String(sessionCount) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(taskCount, 4, 2),
  };
  if (taskCount >= 4) {
    insight.action = {
      label: 'Batch related tasks',
      detail: 'Grouping related tasks can reduce the cost of switching.',
    };
  }
  return insight;
}

function buildCompletedInsight(
  completed: number,
  completionRate: number,
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  const insight: DailyInsight = {
    id: 'completed-today',
    category: 'Tasks',
    title: 'Tasks completed',
    observation: `You completed ${completed} task${completed === 1 ? '' : 's'} today.`,
    metrics: [
      { label: 'Completed', value: String(completed) },
      ...(completionRate > 0 ? [{ label: 'Completion rate', value: `${completionRate}%` }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: 'high',
  };
  return insight;
}

function buildCarryOverInsight(
  carryOver: number,
  openTotal: number,
  completedToday: number,
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  return {
    id: 'carry-over',
    category: 'Consistency',
    title: 'Carried-over tasks',
    observation: `${carryOver} task${carryOver === 1 ? '' : 's'} created before today are still open.`,
    metrics: [
      { label: 'Carried over', value: String(carryOver) },
      { label: 'Open tasks', value: String(openTotal) },
      { label: 'Completed today', value: String(completedToday) },
    ],
    period: { label: periodLabel, start, end },
    confidence: 'high',
    action: { label: 'Clear one backlog item', detail: 'Finishing the oldest open task first trims the backlog.' },
  };
}

function buildWorkLogInsight(
  itemsToday: { logId: string; text: string }[],
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  const logCount = new Set(itemsToday.map((i) => i.logId)).size;
  return {
    id: 'worklog-completions',
    category: 'Knowledge',
    title: 'Work-log completions',
    observation: `You logged ${itemsToday.length} completed item${itemsToday.length === 1 ? '' : 's'} across your work logs today.`,
    metrics: [
      { label: 'Completed items', value: String(itemsToday.length) },
      { label: 'Work logs touched', value: String(logCount) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(itemsToday.length, 2, 1),
  };
}

function buildJournalInsight(
  todayJournals: JournalEntry[],
  periodLabel: string,
  start: number,
  end: number,
): DailyInsight {
  const avgMood = Math.round(todayJournals.reduce((a, j) => a + j.mood, 0) / todayJournals.length);
  const avgFocus = Math.round(todayJournals.reduce((a, j) => a + j.focusRating, 0) / todayJournals.length);
  return {
    id: 'journal-entry',
    category: 'Reflection',
    title: 'Journal reflection',
    observation: `You wrote ${todayJournals.length} journal entr${todayJournals.length === 1 ? 'y' : 'ies'} today.`,
    metrics: [
      { label: 'Entries', value: String(todayJournals.length) },
      { label: 'Avg mood', value: `${avgMood}/5` },
      { label: 'Avg focus', value: `${avgFocus}/5` },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(todayJournals.length, 2, 1),
  };
}

// ── Most Important selection (deterministic rule, first match wins) ───────────
// 1) Daily goal shortfall/achievement (only when a goal exists and focus was
//    tracked) → 2) completed tasks → 3) longest focus session → none.

function pickMostImportant(
  focusedMs: number,
  dailyGoalMs: number,
  period: DailyInsight['period'],
  todays: DailyInsight[],
): DailyInsight | null {
  if (dailyGoalMs > 0 && focusedMs > 0) {
    return buildGoalInsight(focusedMs, dailyGoalMs, period.label, period.start, period.end);
  }
  return todays.find((i) => i.id === 'completed-today')
    ?? todays.find((i) => i.id === 'longest-focus')
    ?? null;
}

// ── selectDailyInsights ───────────────────────────────────────────────────────

export function selectDailyInsights(input: DailyInsightsInput): DailyInsightsView {
  const now = input.now ?? Date.now();
  const timeZone = input.timeZone ?? 'UTC';
  const { start, end } = todayWindow(now, timeZone);
  const periodLabel = `Today · ${formatDateShort(now)}`;
  const period = { label: periodLabel, start, end };

  const sessionLikes = input.sessions.map((s) => ({
    id: s.id,
    taskId: s.taskId,
    startTime: s.startTime,
    activeTime: s.activeTime,
    totalPauseDuration: s.totalPauseDuration,
    focusScore: s.focusScore ?? undefined,
  }));
  const stats = computeRangeStats(sessionLikes, input.tasks, start, end);
  const todaySessions = input.sessions.filter((s) => s.startTime >= start && s.startTime <= end);

  const todays: DailyInsight[] = [];

  if (stats.focusedMs > 0) {
    todays.push(buildFocusInsight(stats.focusedMs, stats.sessionCount, stats.focusScore, periodLabel, start, end));
  }

  const deepSessions = todaySessions.filter((s) => s.activeTime >= DEEP_WORK_MIN_MS);
  if (deepSessions.length > 0) {
    todays.push(buildDeepWorkInsight(deepSessions, periodLabel, start, end));
  }

  if (todaySessions.length > 0) {
    const longest = todaySessions.reduce((best, s) => (s.activeTime > best.activeTime ? s : best), todaySessions[0]);
    todays.push(buildLongestSessionInsight(longest, todaySessions.length, input.tasks, periodLabel, start, end));
  }

  const pauseTotal = todaySessions.reduce((acc, s) => acc + (s.pauseCount || 0), 0);
  if (pauseTotal > 0) {
    todays.push(buildInterruptionsInsight(pauseTotal, stats.pausedMs, periodLabel, start, end));
  }

  const touchedTasks = new Set(todaySessions.map((s) => s.taskId).filter(Boolean));
  if (touchedTasks.size >= 2) {
    todays.push(buildContextSwitchesInsight(touchedTasks.size, todaySessions.length, periodLabel, start, end));
  }

  if (stats.completedTasks > 0) {
    todays.push(buildCompletedInsight(stats.completedTasks, stats.completionRate, periodLabel, start, end));
  }

  const openTotal = input.tasks.filter((t) => t.status !== 'completed').length;
  const carryOver = input.tasks.filter((t) => t.status !== 'completed' && t.createdAt < start).length;
  if (carryOver > 0) {
    todays.push(buildCarryOverInsight(carryOver, openTotal, stats.completedTasks, periodLabel, start, end));
  }

  const itemsToday = input.workLogs.flatMap((log) =>
    (log.completedItems ?? [])
      .filter((item) => item.completedAt >= start && item.completedAt <= end)
      .map((item) => ({ logId: log._id, text: item.text })),
  );
  if (itemsToday.length > 0) {
    todays.push(buildWorkLogInsight(itemsToday, periodLabel, start, end));
  }

  const todayJournals = input.journals.filter((j) => j.createdAt >= start && j.createdAt <= end);
  if (todayJournals.length > 0) {
    todays.push(buildJournalInsight(todayJournals, periodLabel, start, end));
  }

  const mostImportant = pickMostImportant(stats.focusedMs, input.dailyGoalMs, period, todays);
  const visible = todays.filter((i) => i.id !== mostImportant?.id);

  return {
    mostImportant,
    todays: visible,
    hasData: mostImportant !== null || visible.length > 0,
    periodLabel,
    sessionCount: stats.sessionCount,
  };
}

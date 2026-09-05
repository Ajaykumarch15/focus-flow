import type { Task, JournalEntry } from '@shared/types';
import type { KnowledgeDoc } from '@collab/types/collaboration';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type { MemorySession } from '@personal/services/memorySelectors';
import { computeRangeStats, getComparisonDelta } from './reportsSelectors';
import { selectKnowledge } from './knowledgeSelectors';
import {
  dayKeyInTz,
  daysBetweenKeys,
  endOfIsoWeekInTz,
  formatDateShort,
  formatDateShortInTz,
  formatHours,
  formatRelativeTime,
  formatTimeOfDay,
  hourOfDayInTz,
  startOfDayInTz,
  startOfIsoWeekInTz,
  weekdayInTz,
} from '@shared/utils/time';

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
const MS_PER_HOUR = 3600000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

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

// ── PI-1.2: pure Weekly Insights selectors (Phase PI · DCX) ───────────────────
// The weekly layer shares the daily honesty contract: deterministic rules only,
// every number traces to `computeRangeStats` or the raw stores, and nothing is
// invented. The period is the current ISO week (Monday–Sunday) in the user's
// timezone, bounded in src/utils/time.ts. Week-over-week comparisons appear only
// when the prior week actually has focus data AND the current week does too —
// a missing baseline, or a blank current week, renders honest absence instead.

export interface WeeklyInsight extends DailyInsight {}

export interface WeeklyInsightsInput extends DailyInsightsInput {}

export interface WeeklyInsightsView {
  mostImportant: WeeklyInsight | null;
  weekly: WeeklyInsight[];
  hasData: boolean;
  periodLabel: string;
  sessionCount: number;
  activeDays: number;
}

// ── Weekly insight builders ───────────────────────────────────────────────────

function buildWeeklyFocusInsight(
  focusedMs: number,
  sessionCount: number,
  focusScore: number,
  periodLabel: string,
  start: number,
  end: number,
): WeeklyInsight {
  return {
    id: 'weekly-focus',
    category: 'Focus',
    title: 'Focus time this week',
    observation: `You focused ${formatHours(focusedMs)} this week across ${sessionCount} session${sessionCount === 1 ? '' : 's'}.`,
    metrics: [
      { label: 'Focused time', value: formatHours(focusedMs) },
      { label: 'Sessions', value: String(sessionCount) },
      ...(focusScore > 0 ? [{ label: 'Avg focus quality', value: `${focusScore}%` }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(sessionCount, 6, 2),
  };
}

function buildWeeklyTrendInsight(
  thisMs: number,
  prevMs: number,
  periodLabel: string,
  start: number,
  end: number,
): WeeklyInsight {
  const delta = getComparisonDelta(thisMs, prevMs);
  const flat = delta.pct === 0;
  return {
    id: 'weekly-trend',
    category: 'Consistency',
    title: 'Weekly focus trend',
    observation: flat
      ? `You focused ${formatHours(thisMs)} this week, matching last week's ${formatHours(prevMs)}.`
      : `You focused ${formatHours(thisMs)} this week, ${delta.pct}% ${delta.up ? 'more' : 'less'} than last week's ${formatHours(prevMs)}.`,
    metrics: [
      { label: 'This week', value: formatHours(thisMs) },
      { label: 'Last week', value: formatHours(prevMs) },
      { label: 'Change', value: `${delta.up ? '+' : '-'}${delta.pct}%` },
    ],
    period: { label: periodLabel, start, end },
    confidence: flat || delta.up ? 'high' : 'medium',
  };
}

function buildWeeklyDeepWorkInsight(
  deepSessions: MemorySession[],
  periodLabel: string,
  start: number,
  end: number,
): WeeklyInsight {
  const deepMs = deepSessions.reduce((acc, s) => acc + s.activeTime, 0);
  return {
    id: 'weekly-deep-work',
    category: 'Work Habits',
    title: 'Deep work this week',
    observation: `You spent ${formatHours(deepMs)} in ${deepSessions.length} deep-work session${deepSessions.length === 1 ? '' : 's'} of 25+ minutes this week.`,
    metrics: [
      { label: 'Deep work time', value: formatHours(deepMs) },
      { label: 'Deep sessions', value: String(deepSessions.length) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(deepSessions.length, 4, 1),
  };
}

function buildWeeklyConsistencyInsight(
  activeDays: number,
  focusedMs: number,
  periodLabel: string,
  start: number,
  end: number,
): WeeklyInsight {
  const insight: WeeklyInsight = {
    id: 'weekly-consistency',
    category: 'Consistency',
    title: 'Active days this week',
    observation: `You focused on ${activeDays} of 7 days this week.`,
    metrics: [
      { label: 'Active days', value: `${activeDays}/7` },
      { label: 'Focused time', value: formatHours(focusedMs) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(activeDays, 5, 3),
  };
  if (activeDays <= 2) {
    insight.action = {
      label: 'Protect a block each day',
      detail: 'Even a short daily session builds a steadier rhythm than one long push.',
    };
  }
  return insight;
}

function buildWeeklyCompletedInsight(
  completed: number,
  completionRate: number,
  periodLabel: string,
  start: number,
  end: number,
): WeeklyInsight {
  return {
    id: 'weekly-completed',
    category: 'Tasks',
    title: 'Tasks completed this week',
    observation: `You completed ${completed} task${completed === 1 ? '' : 's'} this week.`,
    metrics: [
      { label: 'Completed', value: String(completed) },
      ...(completionRate > 0 ? [{ label: 'Completion rate', value: `${completionRate}%` }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: 'high',
  };
}

function buildWeeklyWorkLogInsight(
  items: { logId: string; text: string }[],
  periodLabel: string,
  start: number,
  end: number,
): WeeklyInsight {
  const logCount = new Set(items.map((i) => i.logId)).size;
  return {
    id: 'weekly-worklog',
    category: 'Knowledge',
    title: 'Work-log completions',
    observation: `You logged ${items.length} completed item${items.length === 1 ? '' : 's'} across your work logs this week.`,
    metrics: [
      { label: 'Completed items', value: String(items.length) },
      { label: 'Work logs touched', value: String(logCount) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(items.length, 4, 1),
  };
}

function buildWeeklyJournalInsight(
  journals: JournalEntry[],
  periodLabel: string,
  start: number,
  end: number,
): WeeklyInsight {
  const avgMood = Math.round(journals.reduce((a, j) => a + j.mood, 0) / journals.length);
  const avgFocus = Math.round(journals.reduce((a, j) => a + j.focusRating, 0) / journals.length);
  return {
    id: 'weekly-journal',
    category: 'Reflection',
    title: 'Journal reflection',
    observation: `You wrote ${journals.length} journal entr${journals.length === 1 ? 'y' : 'ies'} this week.`,
    metrics: [
      { label: 'Entries', value: String(journals.length) },
      { label: 'Avg mood', value: `${avgMood}/5` },
      { label: 'Avg focus', value: `${avgFocus}/5` },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(journals.length, 3, 1),
  };
}

// ── Weekly Most Important selection (deterministic rule, first match wins) ────
// 1) week-over-week trend (only when a real baseline exists) → 2) completed
// tasks → 3) weekly focus total → none.

function pickWeeklyMostImportant(weekly: WeeklyInsight[]): WeeklyInsight | null {
  return weekly.find((i) => i.id === 'weekly-trend')
    ?? weekly.find((i) => i.id === 'weekly-completed')
    ?? weekly.find((i) => i.id === 'weekly-focus')
    ?? null;
}

// ── selectWeeklyInsights ──────────────────────────────────────────────────────

export function selectWeeklyInsights(input: WeeklyInsightsInput): WeeklyInsightsView {
  const now = input.now ?? Date.now();
  const timeZone = input.timeZone ?? 'UTC';
  const start = startOfIsoWeekInTz(now, timeZone);
  const end = endOfIsoWeekInTz(now, timeZone);
  const periodLabel = `Week · ${formatDateShortInTz(start, timeZone)} – ${formatDateShortInTz(end, timeZone)}`;

  const sessionLikes = input.sessions.map((s) => ({
    id: s.id,
    taskId: s.taskId,
    startTime: s.startTime,
    activeTime: s.activeTime,
    totalPauseDuration: s.totalPauseDuration,
    focusScore: s.focusScore ?? undefined,
  }));
  const stats = computeRangeStats(sessionLikes, input.tasks, start, end);
  const weekSessions = input.sessions.filter((s) => s.startTime >= start && s.startTime <= end);

  const prevStats = computeRangeStats(sessionLikes, input.tasks, start - MS_PER_WEEK, start - 1);

  const weekly: WeeklyInsight[] = [];

  if (stats.focusedMs > 0) {
    weekly.push(buildWeeklyFocusInsight(stats.focusedMs, stats.sessionCount, stats.focusScore, periodLabel, start, end));
  }

  if (stats.focusedMs > 0 && prevStats.focusedMs > 0) {
    weekly.push(buildWeeklyTrendInsight(stats.focusedMs, prevStats.focusedMs, periodLabel, start, end));
  }

  const deepSessions = weekSessions.filter((s) => s.activeTime >= DEEP_WORK_MIN_MS);
  if (deepSessions.length > 0) {
    weekly.push(buildWeeklyDeepWorkInsight(deepSessions, periodLabel, start, end));
  }

  const activeDays = new Set(weekSessions.map((s) => dayKeyInTz(s.startTime, timeZone))).size;
  if (activeDays >= 2) {
    weekly.push(buildWeeklyConsistencyInsight(activeDays, stats.focusedMs, periodLabel, start, end));
  }

  if (stats.completedTasks > 0) {
    weekly.push(buildWeeklyCompletedInsight(stats.completedTasks, stats.completionRate, periodLabel, start, end));
  }

  const itemsThisWeek = input.workLogs.flatMap((log) =>
    (log.completedItems ?? [])
      .filter((item) => item.completedAt >= start && item.completedAt <= end)
      .map((item) => ({ logId: log._id, text: item.text })),
  );
  if (itemsThisWeek.length > 0) {
    weekly.push(buildWeeklyWorkLogInsight(itemsThisWeek, periodLabel, start, end));
  }

  const weekJournals = input.journals.filter((j) => j.createdAt >= start && j.createdAt <= end);
  if (weekJournals.length > 0) {
    weekly.push(buildWeeklyJournalInsight(weekJournals, periodLabel, start, end));
  }

  const mostImportant = pickWeeklyMostImportant(weekly);
  const visible = weekly.filter((i) => i.id !== mostImportant?.id);

  return {
    mostImportant,
    weekly: visible,
    hasData: mostImportant !== null || visible.length > 0,
    periodLabel,
    sessionCount: stats.sessionCount,
    activeDays,
  };
}

// ── PI-1.3: pure Work Pattern selectors (Phase PI · DCX) ──────────────────────
// Where the daily/weekly layers answer "how much", this layer answers "when and
// how": the rhythm behind the totals. It looks at a trailing 4-ISO-week window
// (the current week plus the three before it) so a pattern needs repetition, not
// a single lucky day. Every pattern is gated by volume and dominance thresholds —
// a claim is only emitted when the data actually supports it, and a weak signal
// renders honest absence instead. All time-of-day / weekday math lives in
// src/utils/time.ts; the selector only decides the rules.

const PATTERN_WINDOW_WEEKS = 4;

export interface WorkPatternInsight extends DailyInsight {}

export interface WorkPatternInput extends DailyInsightsInput {}

export interface WorkPatternView {
  mostImportant: WorkPatternInsight | null;
  patterns: WorkPatternInsight[];
  hasData: boolean;
  periodLabel: string;
  sessionCount: number;
  focusedMs: number;
}

/** Rough day-part buckets used to read the peak focus window. */
function dayPartOfHour(hour: number): string {
  if (hour >= 5 && hour <= 11) return 'Morning';
  if (hour >= 12 && hour <= 16) return 'Afternoon';
  if (hour >= 17 && hour <= 20) return 'Evening';
  return 'Night';
}

/** Full plural weekday names so observations read naturally ("Tuesdays"). */
const WEEKDAY_PLURALS: Record<string, string> = {
  Sun: 'Sundays', Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays',
  Thu: 'Thursdays', Fri: 'Fridays', Sat: 'Saturdays',
};

// ── Work pattern builders ─────────────────────────────────────────────────────

function buildPatternTimeOfDayInsight(
  topPart: string,
  sharePct: number,
  sessionCount: number,
  periodLabel: string,
  start: number,
  end: number,
): WorkPatternInsight {
  const insight: WorkPatternInsight = {
    id: 'pattern-time-of-day',
    category: 'Work Habits',
    title: 'Peak focus window',
    observation: `Your focus peaks in the ${topPart.toLowerCase()} — ${sharePct}% of your recent focus falls there.`,
    metrics: [
      { label: 'Top window', value: topPart },
      { label: 'Focus share', value: `${sharePct}%` },
      { label: 'Sessions', value: String(sessionCount) },
    ],
    period: { label: periodLabel, start, end },
    confidence: sharePct >= 50 ? 'high' : 'medium',
  };
  if (sharePct >= 50) {
    insight.action = {
      label: 'Protect this window',
      detail: 'Scheduling your hardest work in your peak window can raise your effective output.',
    };
  }
  return insight;
}

function buildPatternWeekdayInsight(
  dayName: string,
  sharePct: number,
  periodLabel: string,
  start: number,
  end: number,
): WorkPatternInsight {
  const plural = WEEKDAY_PLURALS[dayName] ?? `${dayName}s`;
  return {
    id: 'pattern-weekday',
    category: 'Consistency',
    title: 'Most focused day',
    observation: `${plural} carry the largest share of your focus — ${sharePct}% of your recent focus lands there.`,
    metrics: [
      { label: 'Top day', value: plural },
      { label: 'Focus share', value: `${sharePct}%` },
    ],
    period: { label: periodLabel, start, end },
    confidence: sharePct >= 40 ? 'high' : 'medium',
  };
}

function buildPatternSessionLengthInsight(
  avgMs: number,
  sessionCount: number,
  deepCount: number,
  deepSharePct: number,
  periodLabel: string,
  start: number,
  end: number,
): WorkPatternInsight {
  return {
    id: 'pattern-session-length',
    category: 'Execution',
    title: 'Focus block length',
    observation: `Across ${sessionCount} sessions, your focus blocks average ${formatHours(avgMs)}.`,
    metrics: [
      { label: 'Avg session', value: formatHours(avgMs) },
      { label: 'Deep blocks', value: String(deepCount) },
      ...(deepSharePct > 0 ? [{ label: 'Deep share', value: `${deepSharePct}%` }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: sessionCount >= 12 ? 'high' : 'medium',
  };
}

// ── Work Pattern Most Important selection (deterministic rule, first match) ───
// 1) peak focus window → 2) most focused day → 3) focus block length → none.

function pickPatternMostImportant(patterns: WorkPatternInsight[]): WorkPatternInsight | null {
  return patterns.find((i) => i.id === 'pattern-time-of-day')
    ?? patterns.find((i) => i.id === 'pattern-weekday')
    ?? patterns.find((i) => i.id === 'pattern-session-length')
    ?? null;
}

// ── selectWorkPatternInsights ─────────────────────────────────────────────────

export function selectWorkPatternInsights(input: WorkPatternInput): WorkPatternView {
  const now = input.now ?? Date.now();
  const timeZone = input.timeZone ?? 'UTC';
  const weekStart = startOfIsoWeekInTz(now, timeZone);
  const start = weekStart - (PATTERN_WINDOW_WEEKS - 1) * MS_PER_WEEK;
  const end = weekStart + MS_PER_WEEK - 1; // end of the current ISO week
  const periodLabel = `Last 4 weeks · ${formatDateShortInTz(start, timeZone)} – ${formatDateShortInTz(end, timeZone)}`;

  const windowSessions = input.sessions.filter((s) => s.startTime >= start && s.startTime <= end);
  const sessionCount = windowSessions.length;
  const focusedMs = windowSessions.reduce((acc, s) => acc + s.activeTime, 0);

  const patterns: WorkPatternInsight[] = [];

  // Peak focus window — needs enough sessions and a clear leader.
  if (sessionCount >= 8 && focusedMs >= 2 * MS_PER_HOUR) {
    const partMs = new Map<string, number>();
    for (const s of windowSessions) {
      const part = dayPartOfHour(hourOfDayInTz(s.startTime, timeZone));
      partMs.set(part, (partMs.get(part) ?? 0) + s.activeTime);
    }
    const ranked = [...partMs.entries()].sort((a, b) => b[1] - a[1]);
    const [topPart, topMs] = ranked[0];
    const secondMs = ranked[1]?.[1] ?? 0;
    const sharePct = Math.round((topMs / focusedMs) * 100);
    if (topMs > secondMs && sharePct >= 40) {
      patterns.push(buildPatternTimeOfDayInsight(topPart, sharePct, sessionCount, periodLabel, start, end));
    }
  }

  // Most focused weekday — needs the pattern to repeat across at least 3 weeks.
  if (focusedMs >= 4 * MS_PER_HOUR) {
    const dayMs = new Map<string, number>();
    const weeks = new Set<string>();
    for (const s of windowSessions) {
      const day = weekdayInTz(s.startTime, timeZone);
      dayMs.set(day, (dayMs.get(day) ?? 0) + s.activeTime);
      weeks.add(String(startOfIsoWeekInTz(s.startTime, timeZone)));
    }
    const ranked = [...dayMs.entries()].sort((a, b) => b[1] - a[1]);
    const [topDay, topMs] = ranked[0];
    const secondMs = ranked[1]?.[1] ?? 0;
    const sharePct = Math.round((topMs / focusedMs) * 100);
    if (weeks.size >= 3 && topMs > secondMs && sharePct >= 25) {
      patterns.push(buildPatternWeekdayInsight(topDay, sharePct, periodLabel, start, end));
    }
  }

  // Focus block length — a plain average over at least a handful of sessions.
  if (sessionCount >= 6) {
    const avgMs = Math.round(focusedMs / sessionCount);
    const deepSessions = windowSessions.filter((s) => s.activeTime >= DEEP_WORK_MIN_MS);
    const deepMs = deepSessions.reduce((acc, s) => acc + s.activeTime, 0);
    const deepSharePct = deepMs > 0 ? Math.round((deepMs / focusedMs) * 100) : 0;
    patterns.push(buildPatternSessionLengthInsight(avgMs, sessionCount, deepSessions.length, deepSharePct, periodLabel, start, end));
  }

  const mostImportant = pickPatternMostImportant(patterns);
  const visible = patterns.filter((i) => i.id !== mostImportant?.id);

  return {
    mostImportant,
    patterns: visible,
    hasData: mostImportant !== null || visible.length > 0,
    periodLabel,
    sessionCount,
    focusedMs,
  };
}

// ── PI-1.4: pure Task Insights selectors (Phase PI · DCX) ─────────────────────
// This layer reads the task list itself — not the session stream — and answers
// "what does my to-do list say?". Deadline pressure, silently-stale tasks,
// subtask progress, and priority load are all derived straight from Task[]
// fields, never from invented numbers. The honesty contract holds: a claim is
// only emitted when the list actually supports it, and a healthy or empty list
// renders honest absence instead of a manufactured observation. The snapshot is
// "as of now" — every date comparison uses day keys in the user's timezone.

const TASK_STALE_DAYS = 7;

export interface TaskInsight extends DailyInsight {}

export interface TaskInsightsInput extends DailyInsightsInput {}

export interface TaskInsightsView {
  mostImportant: TaskInsight | null;
  tasks: TaskInsight[];
  hasData: boolean;
  periodLabel: string;
  openCount: number;
}

/** Whole calendar days between a past timestamp and now, never negative. */
function daysSinceInTz(timestamp: number, now: number, timeZone: string): number {
  return Math.max(0, daysBetweenKeys(dayKeyInTz(timestamp, timeZone), dayKeyInTz(now, timeZone)));
}

// ── Task insight builders ─────────────────────────────────────────────────────

function buildTaskOverdueInsight(
  overdueCount: number,
  oldestOverdueDays: number,
  periodLabel: string,
  start: number,
  end: number,
): TaskInsight {
  const insight: TaskInsight = {
    id: 'task-overdue',
    category: 'Tasks',
    title: 'Overdue tasks',
    observation: `You have ${overdueCount} task${overdueCount === 1 ? '' : 's'} past their deadline.`,
    metrics: [
      { label: 'Overdue', value: String(overdueCount) },
      ...(oldestOverdueDays > 0 ? [{ label: 'Oldest overdue', value: `${oldestOverdueDays}d` }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: 'high',
  };
  if (overdueCount >= 3) {
    insight.action = {
      label: 'Reschedule the oldest first',
      detail: 'Replan the oldest overdue task so the rest of the list stays accurate.',
    };
  }
  return insight;
}

function buildTaskStaleInsight(
  staleCount: number,
  oldestStaleDays: number,
  periodLabel: string,
  start: number,
  end: number,
): TaskInsight {
  const insight: TaskInsight = {
    id: 'task-stale',
    category: 'Consistency',
    title: 'Stale tasks',
    observation: `${staleCount} open task${staleCount === 1 ? '' : 's'} have not been touched in ${TASK_STALE_DAYS}+ days.`,
    metrics: [
      { label: 'Stale', value: String(staleCount) },
      ...(oldestStaleDays > 0 ? [{ label: 'Oldest', value: `${oldestStaleDays}d` }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(staleCount, 5, 2),
  };
  if (staleCount >= 4) {
    insight.action = {
      label: 'Review or close them',
      detail: 'Tasks that sit untouched tend to stay untouched; a quick review clears the list.',
    };
  }
  return insight;
}

function buildTaskPriorityInsight(
  urgentCount: number,
  highCount: number,
  openCount: number,
  periodLabel: string,
  start: number,
  end: number,
): TaskInsight {
  const insight: TaskInsight = {
    id: 'task-priority',
    category: 'Tasks',
    title: 'High-priority work',
    observation: urgentCount > 0
      ? `You have ${urgentCount} urgent and ${highCount} high-priority open task${urgentCount + highCount === 1 ? '' : 's'}.`
      : `You have ${highCount} high-priority open task${highCount === 1 ? '' : 's'}.`,
    metrics: [
      { label: 'Urgent', value: String(urgentCount) },
      { label: 'High', value: String(highCount) },
      { label: 'Open tasks', value: String(openCount) },
    ],
    period: { label: periodLabel, start, end },
    confidence: 'high',
  };
  if (urgentCount > 0) {
    insight.action = {
      label: 'Clear the urgent item',
      detail: 'Urgent open tasks first keeps deadlines from turning into crises.',
    };
  }
  return insight;
}

function buildTaskSubtasksInsight(
  trackedTasks: number,
  doneSubtasks: number,
  totalSubtasks: number,
  pct: number,
  periodLabel: string,
  start: number,
  end: number,
): TaskInsight {
  return {
    id: 'task-subtasks',
    category: 'Execution',
    title: 'Subtask completion',
    observation: `Across ${trackedTasks} open task${trackedTasks === 1 ? '' : 's'}, ${pct}% of ${totalSubtasks} subtasks are done.`,
    metrics: [
      { label: 'Subtasks done', value: `${doneSubtasks}/${totalSubtasks}` },
      { label: 'Tasks tracked', value: String(trackedTasks) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(trackedTasks, 5, 2),
  };
}

// ── Task Most Important selection (deterministic rule, first match wins) ──────
// 1) overdue deadlines → 2) stale tasks → 3) high-priority load → 4) subtask
// progress → none.

function pickTaskMostImportant(taskInsights: TaskInsight[]): TaskInsight | null {
  return taskInsights.find((i) => i.id === 'task-overdue')
    ?? taskInsights.find((i) => i.id === 'task-stale')
    ?? taskInsights.find((i) => i.id === 'task-priority')
    ?? taskInsights.find((i) => i.id === 'task-subtasks')
    ?? null;
}

// ── selectTaskInsights ────────────────────────────────────────────────────────

export function selectTaskInsights(input: TaskInsightsInput): TaskInsightsView {
  const now = input.now ?? Date.now();
  const timeZone = input.timeZone ?? 'UTC';
  const openTasks = input.tasks.filter((t) => t.status !== 'completed');
  const periodLabel = `Open tasks · ${formatDateShortInTz(now, timeZone)}`;
  const period = { label: periodLabel, start: 0, end: now };

  const taskInsights: TaskInsight[] = [];

  const overdue = openTasks.filter(
    (t) => t.deadline !== undefined && dayKeyInTz(t.deadline, timeZone) < dayKeyInTz(now, timeZone),
  );
  if (overdue.length > 0) {
    const oldestOverdueDays = overdue.reduce(
      (max, t) => Math.max(max, daysSinceInTz(t.deadline ?? 0, now, timeZone)),
      0,
    );
    taskInsights.push(buildTaskOverdueInsight(overdue.length, oldestOverdueDays, periodLabel, period.start, period.end));
  }

  const stale = openTasks.filter(
    (t) => (t.status === 'todo' || t.status === 'paused') && daysSinceInTz(t.updatedAt, now, timeZone) >= TASK_STALE_DAYS,
  );
  if (stale.length >= 2) {
    const oldestStaleDays = stale.reduce((max, t) => Math.max(max, daysSinceInTz(t.updatedAt, now, timeZone)), 0);
    taskInsights.push(buildTaskStaleInsight(stale.length, oldestStaleDays, periodLabel, period.start, period.end));
  }

  const urgentCount = openTasks.filter((t) => t.priority === 'urgent').length;
  const highCount = openTasks.filter((t) => t.priority === 'high').length;
  if (urgentCount + highCount >= 1) {
    taskInsights.push(buildTaskPriorityInsight(urgentCount, highCount, openTasks.length, periodLabel, period.start, period.end));
  }

  const withSubtasks = openTasks.filter((t) => t.subtasks.length > 0);
  if (withSubtasks.length >= 2) {
    const totalSubtasks = withSubtasks.reduce((acc, t) => acc + t.subtasks.length, 0);
    const doneSubtasks = withSubtasks.reduce((acc, t) => acc + t.subtasks.filter((s) => s.completed).length, 0);
    const pct = Math.round((doneSubtasks / totalSubtasks) * 100);
    taskInsights.push(buildTaskSubtasksInsight(withSubtasks.length, doneSubtasks, totalSubtasks, pct, periodLabel, period.start, period.end));
  }

  const mostImportant = pickTaskMostImportant(taskInsights);
  const visible = taskInsights.filter((i) => i.id !== mostImportant?.id);

  return {
    mostImportant,
    tasks: visible,
    hasData: mostImportant !== null || visible.length > 0,
    periodLabel,
    openCount: openTasks.length,
  };
}

// ── PI-1.5: pure Knowledge Insights selectors (Phase PI · DCX) ────────────────
// This layer answers "what have you actually learned?" over the cumulative
// knowledge base. It reuses `selectKnowledge` as the single source of truth —
// docs, decisions, lessons, and links are derived exactly as the Knowledge
// surface derives them, never re-implemented — then adds the "what does it
// mean" layer: how much knowledge exists, what kind, and when the latest item
// was captured. The base is cumulative, so the period is "all time", and an
// empty knowledge base renders honest absence instead of a manufactured claim.

export interface KnowledgeInsight extends DailyInsight {}

export interface KnowledgeInsightsInput {
  docs: KnowledgeDoc[];
  workLogs: WorkLog[];
  journals: JournalEntry[];
  now?: number;
  timeZone?: string;
}

export interface KnowledgeInsightsView {
  mostImportant: KnowledgeInsight | null;
  knowledge: KnowledgeInsight[];
  hasData: boolean;
  periodLabel: string;
  total: number;
}

// ── Knowledge insight builders ────────────────────────────────────────────────

function buildKnowledgeBaseInsight(
  docs: number,
  decisions: number,
  lessons: number,
  links: number,
  total: number,
  periodLabel: string,
  start: number,
  end: number,
): KnowledgeInsight {
  return {
    id: 'knowledge-base',
    category: 'Knowledge',
    title: 'Knowledge base',
    observation: `You have captured ${total} knowledge item${total === 1 ? '' : 's'} across docs, decisions, lessons, and links.`,
    metrics: [
      { label: 'Docs', value: String(docs) },
      { label: 'Decisions', value: String(decisions) },
      { label: 'Lessons', value: String(lessons) },
      { label: 'Links', value: String(links) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(total, 10, 4),
  };
}

function buildKnowledgeDecisionsInsight(
  count: number,
  latestTimestamp: number,
  now: number,
  periodLabel: string,
  start: number,
  end: number,
): KnowledgeInsight {
  return {
    id: 'knowledge-decisions',
    category: 'Knowledge',
    title: 'Decisions captured',
    observation: `You logged ${count} engineering decision${count === 1 ? '' : 's'} across your work logs.`,
    metrics: [
      { label: 'Decisions', value: String(count) },
      { label: 'Latest', value: formatRelativeTime(latestTimestamp, now) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(count, 5, 2),
  };
}

function buildKnowledgeLessonsInsight(
  count: number,
  latestTimestamp: number,
  now: number,
  periodLabel: string,
  start: number,
  end: number,
): KnowledgeInsight {
  return {
    id: 'knowledge-lessons',
    category: 'Knowledge',
    title: 'Lessons learned',
    observation: `You captured ${count} lesson${count === 1 ? '' : 's'} learned across your work logs.`,
    metrics: [
      { label: 'Lessons', value: String(count) },
      { label: 'Latest', value: formatRelativeTime(latestTimestamp, now) },
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(count, 5, 2),
  };
}

function buildKnowledgeLinksInsight(
  count: number,
  topCategory: string | null,
  periodLabel: string,
  start: number,
  end: number,
): KnowledgeInsight {
  return {
    id: 'knowledge-links',
    category: 'Knowledge',
    title: 'Saved resources',
    observation: `You have saved ${count} link${count === 1 ? '' : 's'} from your work logs.`,
    metrics: [
      { label: 'Links', value: String(count) },
      ...(topCategory ? [{ label: 'Top category', value: topCategory }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(count, 5, 2),
  };
}

function buildKnowledgeDocsInsight(
  count: number,
  topCategory: string | null,
  periodLabel: string,
  start: number,
  end: number,
): KnowledgeInsight {
  return {
    id: 'knowledge-docs',
    category: 'Knowledge',
    title: 'Knowledge docs',
    observation: `You have ${count} knowledge doc${count === 1 ? '' : 's'} in your base.`,
    metrics: [
      { label: 'Docs', value: String(count) },
      ...(topCategory ? [{ label: 'Top category', value: topCategory }] : []),
    ],
    period: { label: periodLabel, start, end },
    confidence: confidenceFor(count, 3, 1),
  };
}

/** Most frequent category among items; null when there are none. */
function topCategoryOf(items: { category: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  let top: string | null = null;
  let topCount = 0;
  for (const [category, count] of counts) {
    if (count > topCount) {
      top = category;
      topCount = count;
    }
  }
  return top;
}

// ── Knowledge Most Important selection ────────────────────────────────────────
// The cumulative base is the headline whenever any knowledge exists; the
// per-type cards fill the grid.

function pickKnowledgeMostImportant(knowledge: KnowledgeInsight[]): KnowledgeInsight | null {
  return knowledge.find((i) => i.id === 'knowledge-base') ?? null;
}

// ── selectKnowledgeInsights ───────────────────────────────────────────────────

export function selectKnowledgeInsights(input: KnowledgeInsightsInput): KnowledgeInsightsView {
  const now = input.now ?? Date.now();
  const timeZone = input.timeZone ?? 'UTC';
  const view = selectKnowledge(input.docs, input.workLogs, input.journals);
  const periodLabel = `All time · ${formatDateShortInTz(now, timeZone)}`;
  const period = { label: periodLabel, start: 0, end: now };

  const knowledge: KnowledgeInsight[] = [];

  if (view.total > 0) {
    knowledge.push(buildKnowledgeBaseInsight(
      view.docs.length, view.decisions.length, view.lessons.length, view.links.length, view.total,
      periodLabel, period.start, period.end,
    ));
  }
  if (view.decisions.length > 0) {
    knowledge.push(buildKnowledgeDecisionsInsight(
      view.decisions.length, view.decisions[0].timestamp, now, periodLabel, period.start, period.end,
    ));
  }
  if (view.lessons.length > 0) {
    knowledge.push(buildKnowledgeLessonsInsight(
      view.lessons.length, view.lessons[0].timestamp, now, periodLabel, period.start, period.end,
    ));
  }
  if (view.links.length > 0) {
    knowledge.push(buildKnowledgeLinksInsight(
      view.links.length, topCategoryOf(view.links), periodLabel, period.start, period.end,
    ));
  }
  if (view.docs.length > 0) {
    knowledge.push(buildKnowledgeDocsInsight(
      view.docs.length, topCategoryOf(view.docs), periodLabel, period.start, period.end,
    ));
  }

  const mostImportant = pickKnowledgeMostImportant(knowledge);
  const visible = knowledge.filter((i) => i.id !== mostImportant?.id);

  return {
    mostImportant,
    knowledge: visible,
    hasData: mostImportant !== null || visible.length > 0,
    periodLabel,
    total: view.total,
  };
}

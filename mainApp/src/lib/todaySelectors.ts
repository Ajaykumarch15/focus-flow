import type { Task, TaskStatus, Priority } from '../types';
import type { WorkLog } from '../store/useWorkLogStore';
import type { CentralBlocker, CollaborativeTask } from '../types/collaboration';
import type { DeadlineStatus } from '../utils/time';
import { dayKey, daysBetweenKeys } from '../utils/time';

// ── S1-T1: pure Today selectors (ECIS B.1 · G) ────────────────────────────────
// Continuity core helpers for the Today landing. All four are 100% pure: the
// same inputs always produce the same result, the clock is injected (`now`)
// instead of read via Date.now(), and no localStorage is touched. Ranking is
// deterministic and tiered (documented per helper). Callers render an honest
// `—`/empty state when a returned bucket is empty; nothing is fabricated.

export interface ContinueItem {
  taskId: string;
  title: string;
  status: TaskStatus;
  source: 'active' | 'paused' | 'worklog' | 'history';
  hasActiveSession: boolean;
  totalTime: number;
  lastTouchedAt: number;
}

export interface SubtaskProgress {
  done: number;
  total: number;
  pct: number;
}

export interface DoNowItem {
  task: Task;
  reason: string;
  deadlineStatus: DeadlineStatus | null;
  subtaskProgress: SubtaskProgress | null;
}

export type AttentionKind = 'overdue' | 'due-today' | 'blocker' | 'review' | 'deadline';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  subtitle?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  taskId?: string;
  dueDate?: string;
  score: number;
}

export interface AttentionDeadline {
  id?: string;
  title: string;
  dueDate: string;
}

export interface TodayStats {
  todayMs: number;
  weekMs: number;
  dailyGoalMs: number;
  progressPct: number | null;
  completedToday: number;
  overdueCount: number;
  activeCount: number;
}

export interface TodayInput {
  tasks: Task[];
  activeTaskId: string | null;
  activeSessionId: string | null;
  workLogs: WorkLog[];
  blockers: CentralBlocker[];
  reviews: CollaborativeTask[];
  deadlines: AttentionDeadline[];
  todayMs: number;
  weekMs: number;
  dailyGoalMs: number;
  now?: number;
}

export interface TodayView {
  continue: ContinueItem[];
  doNow: DoNowItem[];
  attention: AttentionItem[];
  stats: TodayStats;
}

// ── Internal ranking helpers ──────────────────────────────────────────────────

const PRIORITY_RANK: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const SEVERITY_RANK: Record<AttentionItem['severity'], number> = { critical: 4, high: 3, medium: 2, low: 1 };

function severityForPriority(priority: Priority): AttentionItem['severity'] {
  if (priority === 'urgent') return 'critical';
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
}

function daysLeft(deadline: number, now: number): number {
  return daysBetweenKeys(dayKey(now), dayKey(deadline));
}

function reasonForDoNow(task: Task, left: number | null): string {
  if (left != null && left < 0) return left === -1 ? 'Overdue today' : `Overdue by ${-left} days`;
  if (left === 0) return 'Due today';
  if (left != null && left <= 3) return left === 1 ? 'Due tomorrow' : `Due in ${left} days`;
  if (left != null) return `Due in ${left} days`;
  if (task.priority === 'urgent') return 'Urgent priority';
  if (task.priority === 'high') return 'High priority';
  return 'Ready to start';
}

// ── selectContinue ────────────────────────────────────────────────────────────
// Resume candidates in tier order: the open session's task → other paused tasks
// → tasks linked to active work logs (most recently updated first) → todo tasks
// with accumulated time (recent focus history). Deduplicated by task id.

export function selectContinue(
  tasks: Task[],
  activeTaskId: string | null,
  activeSessionId: string | null,
  workLogs: WorkLog[],
  limit = 5,
): ContinueItem[] {
  const items: ContinueItem[] = [];
  const seen = new Set<string>();

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : undefined;
  if (activeTask && activeTask.status !== 'completed') {
    items.push({
      taskId: activeTask.id,
      title: activeTask.title,
      status: activeTask.status === 'paused' ? 'paused' : 'active',
      source: 'active',
      hasActiveSession: Boolean(activeSessionId),
      totalTime: activeTask.totalTime,
      lastTouchedAt: activeTask.updatedAt,
    });
    seen.add(activeTask.id);
  }

  const paused = tasks
    .filter((t) => t.status === 'paused' && t.id !== activeTaskId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  for (const t of paused) {
    if (seen.has(t.id)) continue;
    items.push({
      taskId: t.id,
      title: t.title,
      status: 'paused',
      source: 'paused',
      hasActiveSession: false,
      totalTime: t.totalTime,
      lastTouchedAt: t.updatedAt,
    });
    seen.add(t.id);
  }

  const worklogItems: ContinueItem[] = [];
  for (const log of workLogs) {
    if (!log.taskRef || log.status === 'done') continue;
    const ref = log.taskRef;
    if (seen.has(ref._id)) continue;
    const task = tasks.find((t) => t.id === ref._id);
    if (task && task.status === 'completed') continue;
    worklogItems.push({
      taskId: ref._id,
      title: task ? task.title : ref.title,
      status: task ? task.status : 'todo',
      source: 'worklog',
      hasActiveSession: false,
      totalTime: task ? task.totalTime : (ref.totalTime || 0),
      lastTouchedAt: new Date(log.updatedAt).getTime(),
    });
    seen.add(ref._id);
  }
  worklogItems.sort((a, b) => b.lastTouchedAt - a.lastTouchedAt);
  items.push(...worklogItems);

  items.push(
    ...tasks
      .filter((t) => t.status === 'todo' && t.totalTime > 0 && !seen.has(t.id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map<ContinueItem>((t) => ({
        taskId: t.id,
        title: t.title,
        status: 'todo',
        source: 'history',
        hasActiveSession: false,
        totalTime: t.totalTime,
        lastTouchedAt: t.updatedAt,
      })),
  );

  return items.slice(0, limit);
}

// ── selectDoNow ───────────────────────────────────────────────────────────────
// Fresh, untouched todo tasks ("what to start next"), ranked by priority first,
// then deadline urgency, then recency. Untouched means never started (no
// accumulated time) and not the active task — so nothing double-lists with
// Continue. Overdue tasks also surface in Attention.

export function selectDoNow(
  tasks: Task[],
  activeTaskId: string | null,
  now = Date.now(),
  limit = 5,
): DoNowItem[] {
  const candidates = tasks.filter((t) => t.status === 'todo' && t.id !== activeTaskId && t.totalTime <= 0);

  return candidates
    .map((task) => {
      const left = task.deadline ? daysLeft(task.deadline, now) : null;
      const deadlineStatus: DeadlineStatus | null =
        left == null ? null : left < 0 ? 'overdue' : left === 0 ? 'due-today' : left <= 3 ? 'due-soon' : 'upcoming';
      const done = task.subtasks.filter((s) => s.completed).length;
      return {
        task,
        reason: reasonForDoNow(task, left),
        deadlineStatus,
        subtaskProgress: task.subtasks.length === 0
          ? null
          : { done, total: task.subtasks.length, pct: Math.round((done / task.subtasks.length) * 100) },
        priority: PRIORITY_RANK[task.priority],
        urgency: deadlineStatus
          ? deadlineStatus === 'overdue' ? 4 : deadlineStatus === 'due-today' ? 3 : deadlineStatus === 'due-soon' ? 2 : 1
          : 0,
        created: task.createdAt,
      };
    })
    .sort((a, b) => b.priority - a.priority || b.urgency - a.urgency || b.created - a.created)
    .slice(0, limit)
    .map(({ task, reason, deadlineStatus, subtaskProgress }) => ({ task, reason, deadlineStatus, subtaskProgress }));
}

// ── selectAttention ───────────────────────────────────────────────────────────
// What needs attention, tiered: overdue tasks (critical priority first) →
// unresolved blockers (critical first) → tasks due today → pending reviews →
// deadlines inside the horizon (soonest first).

export function selectAttention(
  tasks: Task[],
  blockers: CentralBlocker[],
  reviews: CollaborativeTask[],
  deadlines: AttentionDeadline[],
  now = Date.now(),
  horizonDays = 7,
  limit = 8,
): AttentionItem[] {
  const nowKey = dayKey(now);
  const items: AttentionItem[] = [];

  for (const t of tasks) {
    if (t.status === 'completed' || !t.deadline) continue;
    const left = daysBetweenKeys(nowKey, dayKey(t.deadline));
    if (left < 0) {
      items.push({
        id: `task-${t.id}`,
        kind: 'overdue',
        title: t.title,
        subtitle: left === -1 ? 'Overdue today' : `Overdue by ${-left} days`,
        severity: severityForPriority(t.priority),
        taskId: t.id,
        dueDate: dayKey(t.deadline),
        score: 1000 + PRIORITY_RANK[t.priority],
      });
    } else if (left === 0) {
      items.push({
        id: `task-${t.id}`,
        kind: 'due-today',
        title: t.title,
        subtitle: 'Due today',
        severity: severityForPriority(t.priority),
        taskId: t.id,
        dueDate: dayKey(t.deadline),
        score: 700 + PRIORITY_RANK[t.priority],
      });
    }
  }

  for (const b of blockers) {
    if (b.status === 'resolved') continue;
    items.push({
      id: `blocker-${b.id}`,
      kind: 'blocker',
      title: b.title,
      subtitle: b.impactDescription || undefined,
      severity: b.severity,
      taskId: b.taskId,
      score: 900 + SEVERITY_RANK[b.severity],
    });
  }

  for (const r of reviews) {
    items.push({
      id: `review-${r.id}`,
      kind: 'review',
      title: r.title,
      subtitle: 'Awaiting your review',
      severity: severityForPriority(r.priority),
      taskId: r.id,
      score: 500 + PRIORITY_RANK[r.priority],
    });
  }

  for (const d of deadlines) {
    if (!d.dueDate) continue;
    const left = daysBetweenKeys(nowKey, d.dueDate);
    if (left < 0 || left > horizonDays) continue;
    items.push({
      id: `deadline-${d.id ?? d.title}`,
      kind: 'deadline',
      title: d.title,
      subtitle: left === 0 ? 'Due today' : left === 1 ? 'Due tomorrow' : `Due in ${left} days`,
      severity: left === 0 ? 'high' : left <= 2 ? 'medium' : 'low',
      dueDate: d.dueDate,
      score: 400 + (horizonDays - left),
    });
  }

  return items
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

// ── selectToday ───────────────────────────────────────────────────────────────
// Composes the three buckets plus today's stats in one pure pass. `progressPct`
// is null when the daily goal is zero — callers render `—` (honest data, Q3).

export function selectToday(input: TodayInput): TodayView {
  const now = input.now ?? Date.now();
  const nowKey = dayKey(now);
  const active = input.tasks.filter((t) => t.status !== 'completed');
  const overdueCount = active.filter((t) => t.deadline && daysBetweenKeys(nowKey, dayKey(t.deadline)) < 0).length;
  const completedToday = input.tasks.filter(
    (t) => t.status === 'completed' && daysBetweenKeys(nowKey, dayKey(t.updatedAt)) === 0,
  ).length;
  const progressPct = input.dailyGoalMs > 0
    ? Math.min(100, Math.round((input.todayMs / input.dailyGoalMs) * 100))
    : null;

  return {
    continue: selectContinue(input.tasks, input.activeTaskId, input.activeSessionId, input.workLogs),
    doNow: selectDoNow(input.tasks, input.activeTaskId, now),
    attention: selectAttention(input.tasks, input.blockers, input.reviews, input.deadlines, now),
    stats: {
      todayMs: input.todayMs,
      weekMs: input.weekMs,
      dailyGoalMs: input.dailyGoalMs,
      progressPct,
      completedToday,
      overdueCount,
      activeCount: active.length,
    },
  };
}

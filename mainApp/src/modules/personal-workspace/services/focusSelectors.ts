import type { JournalEntry, Task, TimerState } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import { stripHtml } from '@shared/utils/htmlContent';

// ── S1-T5: pure Focus Session Panel selector (ECIS §G · DCX) ──────────────────
// Answers "What am I working on right now?" and "What should I do next?" for
// the /focus execution workspace. Personal-only: 100% pure — same inputs always
// produce the same result, no Date.now() in ranking, no localStorage, no side
// effects. Only values that actually exist are surfaced; a missing subtask /
// note / work-log resolves to `null` / `false` so the panel renders an honest
// state. Nothing is fabricated.

export interface FocusChip {
  label: string;
}

export interface FocusSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface FocusBlocker {
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FocusSessionView {
  taskId: string | null;
  title: string | null;
  objective: string | null;
  isPersonal: boolean;
  completed: boolean;
  status: string | null;
  sessionState: TimerState;
  hasActiveSession: boolean;
  subtasks: FocusSubtask[];
  nextSubtask: FocusSubtask | null;
  totalTimeMs: number | null;
  blocker: FocusBlocker | null;
  hasSessionNotes: boolean;
  latestNote: { content: string; createdAt: number } | null;
  workLog: { id: string; title: string } | null;
  lastWorkedAt: number | null;
}

export interface FocusInput {
  tasks: Task[];
  workLogs: WorkLog[];
  journals: JournalEntry[];
  activeTaskId: string | null;
  activeSessionId: string | null;
  activeTimerState: TimerState;
  focusTaskId: string | null;
  now?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<FocusBlocker['severity'], number> = { critical: 4, high: 3, medium: 2, low: 1 };

function toMs(value: number | string): number {
  if (typeof value === 'number') return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

// Most severe unresolved blocker attached to a linked work log.
function pickBlocker(workLogs: WorkLog[], taskId: string): FocusBlocker | null {
  let best: FocusBlocker | null = null;
  for (const log of workLogs) {
    if (log.taskRef && log.taskRef._id !== taskId) continue;
    for (const blk of log.blockerList ?? []) {
      if (blk.status === 'resolved') continue;
      if (!best || SEVERITY_RANK[blk.severity] > SEVERITY_RANK[best.severity]) {
        best = { title: blk.title, severity: blk.severity };
      }
    }
  }
  return best;
}

// Most recently updated open work log linked to the task (if any).
function findWorkLog(workLogs: WorkLog[], taskId: string): { id: string; title: string } | null {
  const linked = workLogs.filter((l) => l.taskRef && l.taskRef._id === taskId && l.status !== 'done');
  if (!linked.length) return null;
  const latest = linked.reduce((a, b) => (toMs(a.updatedAt) >= toMs(b.updatedAt) ? a : b));
  return { id: latest._id, title: latest.title || 'Work log' };
}

// ── selectFocusSession ────────────────────────────────────────────────────────
// The panel target is the explicitly selected task when present, otherwise the
// active timer's task. A selected-but-unresolvable task (deleted) resolves to
// the honest empty view — no fabricated title.

export function selectFocusSession(input: FocusInput): FocusSessionView {
  const none: FocusSessionView = {
    taskId: null,
    title: null,
    objective: null,
    isPersonal: true,
    completed: false,
    status: null,
    sessionState: input.activeTimerState,
    hasActiveSession: false,
    subtasks: [],
    nextSubtask: null,
    totalTimeMs: null,
    blocker: null,
    hasSessionNotes: false,
    latestNote: null,
    workLog: null,
    lastWorkedAt: null,
  };

  const targetId = input.focusTaskId ? input.focusTaskId : input.activeTaskId;
  if (!targetId) return none;

  const personal = input.tasks.find((t) => t.id === targetId);
  if (!personal) return none;

  const subtasks: FocusSubtask[] = (personal.subtasks ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    completed: s.completed,
  }));
  const nextSubtask = subtasks.find((s) => !s.completed) ?? null;

  // The "current objective" is the task's own description — never an invented goal.
  const objective = (personal.description || '').trim() || null;

  const journalsForTask = input.journals
    .filter((j) => j.taskId === targetId)
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    taskId: targetId,
    title: personal.title,
    objective,
    isPersonal: true,
    completed: personal.status === 'completed',
    status: personal.status,
    sessionState: input.activeTimerState,
    hasActiveSession: input.activeTaskId === targetId && input.activeTimerState !== 'idle',
    subtasks,
    nextSubtask,
    totalTimeMs: personal.totalTime,
    blocker: pickBlocker(input.workLogs, targetId),
    hasSessionNotes: journalsForTask.length > 0,
    latestNote: journalsForTask.length
      ? { content: stripHtml(journalsForTask[0].content), createdAt: journalsForTask[0].createdAt }
      : null,
    workLog: findWorkLog(input.workLogs, targetId),
    lastWorkedAt: personal.updatedAt,
  };
}

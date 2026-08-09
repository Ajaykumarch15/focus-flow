import type { TimerState } from '../types';
import type { WorkLog, DecisionItem, StructuredBlocker, ProgressSnapshot, DailyReflection } from '../store/useWorkLogStore';
import { selectFocusSession, type FocusChip, type FocusInput } from './focusSelectors';
import { buildTimelineEvents, TIMELINE_KIND_LABELS } from './timelineSelectors';
import { stripHtml } from './htmlContent';

// ── S1-T6: pure Engineering Memory selector (ECIS §G · DCX) ────────────────────
// ARK's Engineering Memory is a read-only projection of the existing
// architecture: work logs, journal entries, timer sessions, tasks and blockers.
// Every value is derived from state that already exists — no AI summaries, no
// invented decisions, no fabricated context. Session lifecycle events (start /
// pause / resume / stop) only re-project the same data so the developer never
// loses continuity. The selector is 100% pure: same inputs always produce the
// same result, no Date.now() in ranking, no localStorage, no side effects.
// Missing data resolves to `null` / `false` so the panel renders an honest
// empty state instead of inventing one.

export interface MemorySessionPause {
  pauseStart: number;
  resumeTime: number | null;
}

export interface MemorySession {
  id: string;
  taskId: string;
  startTime: number;
  endTime: number | null;
  activeTime: number;
  totalPauseDuration: number;
  pauseCount: number;
  isActive: boolean;
  focusScore: number | null;
  pauseLog: MemorySessionPause[];
}

export interface PreviousSession extends MemorySession {
  taskTitle: string | null;
}

export interface MemoryWorkLog {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
  sessionCount: number;
}

export interface MemoryDecision {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  timestamp: number;
  workLogTitle: string;
}

export interface MemoryJournal {
  content: string;
  createdAt: number;
  mood: number;
  focusRating: number;
  taskId: string | null;
}

export interface MemoryFacet {
  key: string;
  label: string;
  present: boolean;
}

export interface MemoryView {
  taskId: string | null;
  taskTitle: string | null;
  workspace: FocusChip | null;
  project: FocusChip | null;
  sprint: FocusChip | null;
  feature: FocusChip | null;
  subtaskCount: number;
  hasActiveSession: boolean;
  sessionState: TimerState;
  activeSessionId: string | null;
  sessionStartAt: number | null;
  lastResumeAt: number | null;
  currentPauseAt: number | null;
  previousSession: PreviousSession | null;
  totalTimeOnTaskMs: number | null;
  linkedWorkLog: MemoryWorkLog | null;
  lastWorkLog: MemoryWorkLog | null;
  lastJournalNote: MemoryJournal | null;
  taskJournalNote: MemoryJournal | null;
  recentDecisions: MemoryDecision[];
  blockerCount: number;
  facets: MemoryFacet[];
  completeness: number;
  totalFacets: number;
  hasAnyMemory: boolean;
}

export interface MemoryInput extends FocusInput {
  sessions: MemorySession[];
  currentSessionStart: number | null;
  currentPauseStart: number | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function toMs(value: number | string): number {
  if (typeof value === 'number') return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function sessionWorkCount(log: WorkLog): number {
  return (log.workEntries ?? []).reduce((n, e) => n + (e.sessionIds?.length ?? 0), 0);
}

function toMemoryWorkLog(log: WorkLog): MemoryWorkLog {
  return {
    id: log._id,
    title: log.title || 'Work log',
    status: log.status,
    updatedAt: toMs(log.updatedAt),
    sessionCount: sessionWorkCount(log),
  };
}

const DECISION_LIMIT = 3;

const FACET_DEFS: { key: string; label: string }[] = [
  { key: 'task', label: 'Task' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'project', label: 'Project' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'feature', label: 'Feature' },
  { key: 'subtasks', label: 'Subtasks' },
  { key: 'journal', label: 'Journal' },
  { key: 'workLog', label: 'Work log' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'sessionHistory', label: 'Session history' },
];

/**
 * Pure mapper from a server session document to the client-side MemorySession
 * shape. All fields are coerced to numbers with honest `null` for unknown
 * values; nothing is synthesized.
 */
export function mapSession(doc: Record<string, any>): MemorySession {
  return {
    id: String(doc._id ?? doc.id ?? ''),
    taskId: String(doc.taskId?._id ?? doc.taskId ?? ''),
    startTime: Number(doc.startTime ?? 0),
    endTime: doc.endTime != null ? Number(doc.endTime) : null,
    activeTime: Number(doc.activeTime ?? 0),
    totalPauseDuration: Number(doc.totalPauseDuration ?? 0),
    pauseCount: Number(doc.pauseCount ?? 0),
    isActive: Boolean(doc.isActive),
    focusScore: doc.focusScore != null ? Number(doc.focusScore) : null,
    pauseLog: Array.isArray(doc.pauseLog)
      ? doc.pauseLog.map((p: any) => ({
          pauseStart: Number(p?.pauseStart ?? 0),
          resumeTime: p?.resumeTime != null ? Number(p.resumeTime) : null,
        }))
      : [],
  };
}

// ── selectEngineeringMemory ───────────────────────────────────────────────────

export function selectEngineeringMemory(input: MemoryInput): MemoryView {
  // Reuse the S1-T5 focus selector for the task + context chain resolution so
  // this selector never duplicates that business logic.
  const focus = selectFocusSession(input);

  const activeRec =
    (input.activeSessionId != null
      ? input.sessions.find((s) => s.id === input.activeSessionId)
      : undefined)
    ?? input.sessions.find((s) => s.isActive)
    ?? null;

  const resumeTimes = activeRec
    ? activeRec.pauseLog.filter((p) => p.resumeTime != null).map((p) => p.resumeTime as number)
    : [];
  const openPause = activeRec?.pauseLog.find((p) => p.resumeTime == null) ?? null;

  const closed = input.sessions.filter((s) => !s.isActive);
  const previous = closed.length
    ? [...closed].sort((a, b) => b.startTime - a.startTime)[0]
    : null;

  const previousSession: PreviousSession | null = previous
    ? {
        ...previous,
        taskTitle:
          input.tasks.find((t) => t.id === previous.taskId)?.title
          ?? input.collabTasks.find((t) => t.id === previous.taskId)?.title
          ?? null,
      }
    : null;

  const journalsSorted = [...input.journals].sort((a, b) => b.createdAt - a.createdAt);
  const lastJournalNote = journalsSorted[0] ?? null;
  const taskJournalNote = focus.taskId
    ? journalsSorted.find((j) => j.taskId === focus.taskId) ?? null
    : null;

  const lastWorkLog = input.workLogs.length
    ? [...input.workLogs].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt))[0]
    : null;

  const linkedLog = focus.workLog
    ? input.workLogs.find((l) => l._id === focus.workLog?.id) ?? null
    : null;

  const decisions: MemoryDecision[] = input.workLogs
    .flatMap((log) =>
      (log.decisions ?? []).map((d) => ({
        id: d._id,
        title: d.title,
        decision: d.decision,
        rationale: d.rationale,
        timestamp: d.timestamp,
        workLogTitle: log.title || 'Work log',
      })),
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, DECISION_LIMIT);

  const blockerCount = focus.taskId
    ? input.blockers.filter((b) => b.taskId === focus.taskId && b.status !== 'resolved').length
    : 0;

  const present: Record<string, boolean> = {
    task: Boolean(focus.taskId && focus.title),
    workspace: Boolean(focus.workspace),
    project: Boolean(focus.project),
    sprint: Boolean(focus.sprint),
    feature: Boolean(focus.feature),
    subtasks: focus.subtasks.length > 0,
    journal: Boolean(taskJournalNote || lastJournalNote),
    workLog: Boolean(linkedLog || lastWorkLog),
    decisions: decisions.length > 0,
    sessionHistory: Boolean(activeRec || previousSession),
  };

  const facets: MemoryFacet[] = FACET_DEFS.map((f) => ({ ...f, present: Boolean(present[f.key]) }));
  const completeness = facets.filter((f) => f.present).length;

  const hasAnyMemory = Boolean(
    activeRec
    || lastWorkLog
    || lastJournalNote
    || previousSession
    || decisions.length > 0
    || (focus.totalTimeMs ?? 0) > 0,
  );

  return {
    taskId: focus.taskId,
    taskTitle: focus.title,
    workspace: focus.workspace,
    project: focus.project,
    sprint: focus.sprint,
    feature: focus.feature,
    subtaskCount: focus.subtasks.length,
    hasActiveSession: focus.hasActiveSession,
    sessionState: focus.sessionState,
    activeSessionId: input.activeSessionId,
    sessionStartAt: activeRec?.startTime ?? input.currentSessionStart,
    lastResumeAt: activeRec ? (resumeTimes.length ? Math.max(...resumeTimes) : activeRec.startTime) : null,
    currentPauseAt: openPause?.pauseStart ?? input.currentPauseStart ?? null,
    previousSession,
    totalTimeOnTaskMs: focus.totalTimeMs,
    linkedWorkLog: linkedLog ? toMemoryWorkLog(linkedLog) : null,
    lastWorkLog: lastWorkLog ? toMemoryWorkLog(lastWorkLog) : null,
    lastJournalNote: lastJournalNote
      ? {
          content: stripHtml(lastJournalNote.content),
          createdAt: lastJournalNote.createdAt,
          mood: lastJournalNote.mood,
          focusRating: lastJournalNote.focusRating,
          taskId: lastJournalNote.taskId || null,
        }
      : null,
    taskJournalNote: taskJournalNote
      ? {
          content: stripHtml(taskJournalNote.content),
          createdAt: taskJournalNote.createdAt,
          mood: taskJournalNote.mood,
          focusRating: taskJournalNote.focusRating,
          taskId: taskJournalNote.taskId || null,
        }
      : null,
    recentDecisions: decisions,
    blockerCount,
    facets,
    completeness,
    totalFacets: facets.length,
    hasAnyMemory,
  };
}

// ── selectMemory (S3-T1) ───────────────────────────────────────────────────────
// Per-work-log Engineering Memory projection (ECIS §B.4 · DCX §17:30). Answers
// "Where did I stop and what does the log already know?" from ONE work log:
//   - whereStopped → the newest timeline node (reuses the S1-T7 event builder,
//     so the same dedupe/sorting rules apply — nothing is re-invented)
//   - decisions / blockers / snapshots → the log's own collections, sorted
//   - reflection → the daily reflection, or `null` when nothing is filled
// Pure: same log always yields the same view; no Date.now(), no side effects.

export interface WorkLogMemoryWhereStopped {
  id: string;
  kind: string;
  label: string;
  title: string;
  description?: string;
  timestamp: number;
}

export interface WorkLogMemoryView {
  whereStopped: WorkLogMemoryWhereStopped | null;
  decisions: DecisionItem[];
  blockers: StructuredBlocker[];
  snapshots: ProgressSnapshot[];
  reflection: DailyReflection | null;
}

function isReflectionBlank(reflection: DailyReflection | undefined): boolean {
  if (!reflection) return true;
  return (
    (reflection.wentWell ?? '').trim() === ''
    && (reflection.slowedDown ?? '').trim() === ''
    && (reflection.learned ?? '').trim() === ''
    && (reflection.improvement ?? '').trim() === ''
  );
}

export function selectMemory(log: WorkLog): WorkLogMemoryView {
  const events = buildTimelineEvents({ tasks: [], journals: [], workLogs: [log], blockers: [], features: [] })
    .filter((event) => event.worklogId === log._id);
  const last = events[0] ?? null;

  const whereStopped: WorkLogMemoryWhereStopped | null = last
    ? {
        id: last.id,
        kind: last.kind,
        label: TIMELINE_KIND_LABELS[last.kind] ?? last.kind,
        title: last.title,
        description: last.description,
        timestamp: last.timestamp,
      }
    : null;

  const decisions = [...(log.decisions ?? [])].sort((a, b) => b.timestamp - a.timestamp);

  const blockers = [...(log.blockerList ?? [])].sort((a, b) => {
    const aOpen = a.status !== 'resolved' ? 0 : 1;
    const bOpen = b.status !== 'resolved' ? 0 : 1;
    return aOpen - bOpen || b.createdAt - a.createdAt;
  });

  const snapshots = [...(log.progressSnapshots ?? [])].sort((a, b) => b.timestamp - a.timestamp);

  const reflection = isReflectionBlank(log.reflection) ? null : log.reflection;

  return { whereStopped, decisions, blockers, snapshots, reflection };
}

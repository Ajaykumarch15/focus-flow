import type { JournalEntry, TimerState } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type {
  CollaborativeTask, GitContext,
} from '@collab/types/collaboration';
import {
  selectFocusSession, type FocusChip, type FocusInput, type FocusSubtask,
} from './focusSelectors';
import { stripHtml } from '@shared/utils/htmlContent';

// ── S2-T1: Current Task continuation selector (ECIS §G · DCX) ────────────────
// Answers "Where am I with this task, and where do I pick up next?" for the
// TaskDetail continuation surface. It reuses the S1-T5 focus selector for the
// task + context chain + session + linked work log (no duplicated derivation),
// then adds the two facets the spec requires: git context (branch / PR) and
// "where I stopped" (the most recent prose written about this task — work log
// progress/entries, else the last journal note). 100% pure — same inputs always
// produce the same result, no Date.now() in ranking, no localStorage, no side
// effects. Missing data resolves to `null` so the surface renders an honest
// continuation state; nothing is fabricated.

export interface ContinuationPr {
  number: string | null;
  url: string | null;
  reviewStatus: GitContext['reviewStatus'] | null;
  mergeStatus: GitContext['mergeStatus'] | null;
}

export interface ContinuationGit {
  branch: string | null;
  pr: ContinuationPr | null;
}

export interface StoppedWhere {
  source: 'progress' | 'entry' | 'journal' | 'worklog';
  text: string;
  at: number | null;
  workLogId: string | null;
  workLogTitle: string | null;
}

export interface ContinuationWorkLog {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
}

export interface ContinuationView {
  taskId: string | null;
  title: string | null;
  isPersonal: boolean;
  completed: boolean;
  status: string | null;
  sessionState: TimerState;
  hasActiveSession: boolean;
  totalTimeMs: number | null;
  lastWorkedAt: number | null;
  workspaceId: string | null;
  workspace: FocusChip | null;
  project: FocusChip | null;
  sprint: FocusChip | null;
  feature: FocusChip | null;
  subtasks: FocusSubtask[];
  subtasksDone: number;
  subtasksTotal: number;
  nextSubtask: FocusSubtask | null;
  workLog: ContinuationWorkLog | null;
  git: ContinuationGit;
  whereIStopped: StoppedWhere | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function toMs(value: number | string): number {
  if (typeof value === 'number') return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

// Git context: collaborative tasks carry it on gitContext; personal tasks and
// collab tasks without one fall back to the linked work log's git fields.
function resolveGit(collab: CollaborativeTask | undefined, workLog: WorkLog | null): ContinuationGit {
  if (collab?.gitContext) {
    const gc = collab.gitContext;
    return {
      branch: gc.branch ?? null,
      pr: gc.prNumber != null
        ? {
            number: String(gc.prNumber),
            url: gc.prUrl ?? null,
            reviewStatus: gc.reviewStatus ?? null,
            mergeStatus: gc.mergeStatus ?? null,
          }
        : null,
    };
  }

  if (workLog) {
    const prLink = workLog.links?.find((l) => l.category === 'PR' && l.url) ?? null;
    const prNumber = workLog.gitRef?.prNumber || null;
    const prUrl = prLink?.url ?? null;
    return {
      branch: workLog.gitRef?.branch || workLog.gitBranch || null,
      pr: prNumber || prUrl
        ? { number: prNumber, url: prUrl, reviewStatus: null, mergeStatus: null }
        : null,
    };
  }

  return { branch: null, pr: null };
}

// When timestamps tie, structured progress beats a work entry, which beats a
// journal note, which beats the untimestamped "current work" field.
const SOURCE_PRECEDENCE: Record<StoppedWhere['source'], number> = {
  progress: 0,
  entry: 1,
  journal: 2,
  worklog: 3,
};

interface StoppedCandidate {
  source: StoppedWhere['source'];
  text: string;
  at: number | null;
  workLogId: string | null;
  workLogTitle: string | null;
}

// "Where I stopped" = the most recent prose already written about this task:
// the linked work log's latest progress snapshot / work entry / note entry,
// falling back to its "current work" field, then the last journal note. When no
// artifact exists the result is null so the UI renders an honest gap.
function whereStopped(workLog: WorkLog | null, journals: JournalEntry[], taskId: string): StoppedWhere | null {
  const candidates: StoppedCandidate[] = [];

  if (workLog) {
    for (const s of workLog.progressSnapshots ?? []) {
      if (s.text?.trim()) {
        candidates.push({
          source: 'progress', text: s.text.trim(), at: toMs(s.timestamp),
          workLogId: workLog._id, workLogTitle: workLog.title,
        });
      }
    }
    for (const e of workLog.workEntries ?? []) {
      const at = e.endedAt ?? e.startedAt;
      if (e.what?.trim() && at) {
        candidates.push({
          source: 'entry', text: e.what.trim(), at,
          workLogId: workLog._id, workLogTitle: workLog.title,
        });
      }
    }
    for (const t of workLog.timelineEntries ?? []) {
      if (t.type === 'note' && (t.description || t.title)?.trim()) {
        candidates.push({
          source: 'entry', text: (t.description || t.title).trim(), at: toMs(t.timestamp),
          workLogId: workLog._id, workLogTitle: workLog.title,
        });
      }
    }
    if (workLog.currentWork?.trim()) {
      candidates.push({
        source: 'worklog', text: workLog.currentWork.trim(), at: null,
        workLogId: workLog._id, workLogTitle: workLog.title,
      });
    }
  }

  for (const j of journals) {
    if (j.taskId === taskId && j.content?.trim()) {
      candidates.push({
        source: 'journal', text: stripHtml(j.content).trim(), at: j.createdAt,
        workLogId: null, workLogTitle: null,
      });
    }
  }

  if (!candidates.length) return null;

  const timed = candidates.filter((c): c is StoppedCandidate & { at: number } => c.at != null);
  timed.sort((a, b) => (b.at - a.at) || (SOURCE_PRECEDENCE[a.source] - SOURCE_PRECEDENCE[b.source]));
  if (timed.length) {
    const best = timed[0];
    return {
      source: best.source, text: best.text, at: best.at,
      workLogId: best.workLogId, workLogTitle: best.workLogTitle,
    };
  }

  const fallback = candidates[0];
  return {
    source: fallback.source, text: fallback.text, at: null,
    workLogId: fallback.workLogId, workLogTitle: fallback.workLogTitle,
  };
}

// ── selectTaskContinuation ────────────────────────────────────────────────────
// Composes the focus session view (task resolution, context chain, subtasks,
// session, linked work log) with the git and "where I stopped" facets.

export function selectTaskContinuation(input: FocusInput): ContinuationView {
  const focus = selectFocusSession(input);

  const none: ContinuationView = {
    taskId: null,
    title: null,
    isPersonal: true,
    completed: false,
    status: null,
    sessionState: input.activeTimerState,
    hasActiveSession: false,
    totalTimeMs: null,
    lastWorkedAt: null,
    workspaceId: null,
    workspace: null,
    project: null,
    sprint: null,
    feature: null,
    subtasks: [],
    subtasksDone: 0,
    subtasksTotal: 0,
    nextSubtask: null,
    workLog: null,
    git: { branch: null, pr: null },
    whereIStopped: null,
  };

  if (!focus.taskId) return none;

  const collab = input.collabTasks.find((t) => t.id === focus.taskId);
  const workLog = focus.workLog ? input.workLogs.find((l) => l._id === focus.workLog!.id) ?? null : null;

  return {
    ...none,
    taskId: focus.taskId,
    title: focus.title,
    isPersonal: focus.isPersonal,
    completed: focus.completed,
    status: focus.status,
    sessionState: focus.sessionState,
    hasActiveSession: focus.hasActiveSession,
    totalTimeMs: focus.totalTimeMs,
    lastWorkedAt: focus.lastWorkedAt,
    workspaceId: focus.workspaceId,
    workspace: focus.workspace,
    project: focus.project,
    sprint: focus.sprint,
    feature: focus.feature,
    subtasks: focus.subtasks,
    subtasksDone: focus.subtasks.filter((s) => s.completed).length,
    subtasksTotal: focus.subtasks.length,
    nextSubtask: focus.nextSubtask,
    workLog: focus.workLog
      ? {
          id: focus.workLog.id,
          title: focus.workLog.title,
          status: workLog?.status ?? 'in-progress',
          updatedAt: workLog ? toMs(workLog.updatedAt) : 0,
        }
      : null,
    git: resolveGit(collab, workLog),
    whereIStopped: whereStopped(workLog, input.journals, focus.taskId),
  };
}

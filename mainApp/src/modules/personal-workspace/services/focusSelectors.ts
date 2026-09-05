import type { JournalEntry, Task, TimerState } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type {
  CentralBlocker, CollaborativeTask, Feature, Project, Sprint, Workspace,
} from '@collab/types/collaboration';
import { stripHtml } from '@shared/utils/htmlContent';

// ── S1-T5: pure Focus Session Panel selector (ECIS §G · DCX) ──────────────────
// Answers "What am I working on right now?" and "What should I do next?" for
// the /focus execution workspace. 100% pure — same inputs always produce the
// same result, no Date.now() in ranking, no localStorage, no side effects.
// Only values that actually exist are surfaced; a missing sprint / feature /
// project / subtask / note / work-log / estimate resolves to `null` / `false`
// so the panel renders an honest state. Nothing is fabricated.

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
  workspaceId: string | null;
  workspace: FocusChip | null;
  project: FocusChip | null;
  sprint: FocusChip | null;
  feature: FocusChip | null;
  subtasks: FocusSubtask[];
  nextSubtask: FocusSubtask | null;
  totalTimeMs: number | null;
  estimatedRemainingHours: number | null;
  blocker: FocusBlocker | null;
  hasSessionNotes: boolean;
  latestNote: { content: string; createdAt: number } | null;
  workLog: { id: string; title: string } | null;
  lastWorkedAt: number | null;
}

export interface FocusInput {
  tasks: Task[];
  collabTasks: CollaborativeTask[];
  workspaces: Workspace[];
  projects: Project[];
  sprints: Sprint[];
  features: Feature[];
  workLogs: WorkLog[];
  blockers: CentralBlocker[];
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

// Most severe unresolved blocker for the task: central blockers first, then
// structured blockers attached to a linked work log.
function pickBlocker(blockers: CentralBlocker[], workLogs: WorkLog[], taskId: string): FocusBlocker | null {
  const central = blockers
    .filter((b) => b.status !== 'resolved' && b.taskId === taskId)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  if (central.length) return { title: central[0].title, severity: central[0].severity };

  let best: FocusBlocker | null = null;
  for (const log of workLogs) {
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
    workspaceId: null,
    workspace: null,
    project: null,
    sprint: null,
    feature: null,
    subtasks: [],
    nextSubtask: null,
    totalTimeMs: null,
    estimatedRemainingHours: null,
    blocker: null,
    hasSessionNotes: false,
    latestNote: null,
    workLog: null,
    lastWorkedAt: null,
  };

  const targetId = input.focusTaskId ? input.focusTaskId : input.activeTaskId;
  if (!targetId) return none;

  const personal = input.tasks.find((t) => t.id === targetId);
  const collab = input.collabTasks.find((t) => t.id === targetId);
  if (!personal && !collab) return none;

  const isPersonal = Boolean(personal);
  const task = personal ?? collab!;
  const completed = isPersonal ? personal!.status === 'completed' : collab!.sprintStatus === 'done';

  const workspaceId = collab?.workspaceId ?? null;
  const ws = workspaceId ? input.workspaces.find((w) => w.id === workspaceId) : undefined;
  const project = collab?.projectId ? input.projects.find((p) => p.id === collab.projectId) : undefined;
  const sprint = collab?.sprintId ? input.sprints.find((s) => s.id === collab.sprintId) : undefined;
  const feature = collab?.featureId ? input.features.find((f) => f.id === collab.featureId) : undefined;

  const subtasks: FocusSubtask[] = (task.subtasks ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    completed: s.completed,
  }));
  const nextSubtask = subtasks.find((s) => !s.completed) ?? null;

  // The "current objective" is the task's own description, falling back to the
  // feature description when the task carries none — never an invented goal.
  const objective = (task.description || '').trim() || (feature?.description || '').trim() || null;

  const journalsForTask = input.journals
    .filter((j) => j.taskId === targetId)
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    taskId: targetId,
    title: task.title,
    objective,
    isPersonal,
    completed,
    status: isPersonal ? personal!.status : collab!.sprintStatus,
    sessionState: input.activeTimerState,
    hasActiveSession: input.activeTaskId === targetId && input.activeTimerState !== 'idle',
    workspaceId,
    workspace: ws ? { label: ws.name } : null,
    project: project ? { label: project.name } : null,
    sprint: sprint ? { label: sprint.name } : null,
    feature: feature ? { label: feature.name } : null,
    subtasks,
    nextSubtask,
    totalTimeMs: isPersonal ? personal!.totalTime : (collab!.actualHours || 0) * 3_600_000,
    estimatedRemainingHours:
      isPersonal || collab!.estimatedHours == null
        ? null
        : Math.max(0, collab!.estimatedHours - (collab!.actualHours || 0)),
    blocker: pickBlocker(input.blockers, input.workLogs, targetId),
    hasSessionNotes: journalsForTask.length > 0,
    latestNote: journalsForTask.length
      ? { content: stripHtml(journalsForTask[0].content), createdAt: journalsForTask[0].createdAt }
      : null,
    workLog: findWorkLog(input.workLogs, targetId),
    lastWorkedAt: isPersonal ? personal!.updatedAt : toMs(collab!.updatedAt),
  };
}

import type { Task, TimerState } from '@shared/types';
import type { CollaborativeTask, Feature, Project, Sprint, Workspace } from '@collab/types/collaboration';

// ── S1-T3: pure NowStrip selector (ECIS B · G · DCX §4) ───────────────────────
// Answers "What am I working on right now?" from state that already exists:
// the active timer's task plus, when that task is collaborative, its
// workspace → project → sprint → feature chain. 100% pure — same inputs always
// produce the same result, no Date.now(), no localStorage, no side effects.
// Only values that actually exist are surfaced; missing sprint/project/task
// resolve to `null` so callers render an honest strip (nothing fabricated).

export interface NowChip {
  label: string;
}

export interface NowContext {
  state: 'none' | 'personal' | 'collab';
  taskId: string | null;
  title: string | null;
  completed: boolean;
  sessionState: TimerState;
  workspace: NowChip | null;
  workspaceId: string | null;
  project: NowChip | null;
  sprint: NowChip | null;
  feature: NowChip | null;
  branch: string | null;
  subtasksDone: number;
  subtasksTotal: number;
}

export interface NowInput {
  tasks: Task[];
  collabTasks: CollaborativeTask[];
  workspaces: Workspace[];
  projects: Project[];
  sprints: Sprint[];
  features: Feature[];
  activeTaskId: string | null;
  activeSessionId: string | null;
  activeTimerState: TimerState;
}

export function selectNowStrip(input: NowInput): NowContext {
  const { activeTaskId, activeTimerState } = input;

  const base: NowContext = {
    state: 'none',
    taskId: activeTaskId,
    title: null,
    completed: false,
    sessionState: activeTimerState,
    workspace: null,
    workspaceId: null,
    project: null,
    sprint: null,
    feature: null,
    branch: null,
    subtasksDone: 0,
    subtasksTotal: 0,
  };

  // No active task — honest "nothing running" state.
  if (!activeTaskId) return base;

  const personalTask = input.tasks.find((t) => t.id === activeTaskId);
  const collabTask = input.collabTasks.find((t) => t.id === activeTaskId);

  // Active timer points at a task we cannot resolve (e.g. deleted) — surface
  // the session honestly without fabricating a title.
  if (!personalTask && !collabTask) return base;

  const subtasks = collabTask?.subtasks ?? personalTask?.subtasks ?? [];
  const context: NowContext = {
    ...base,
    state: collabTask ? 'collab' : 'personal',
    title: collabTask?.title ?? personalTask?.title ?? null,
    completed: personalTask?.status === 'completed' || collabTask?.sprintStatus === 'done',
    branch: collabTask?.gitContext?.branch ?? null,
    subtasksDone: subtasks.filter((s) => s.completed).length,
    subtasksTotal: subtasks.length,
  };

  // Personal tasks carry no workspace linkage — the chain stays empty.
  if (!collabTask) return context;

  const ws = input.workspaces.find((w) => w.id === collabTask.workspaceId);
  if (ws) {
    context.workspace = { label: ws.name };
    context.workspaceId = ws.id;
  }

  const project = input.projects.find((p) => p.id === collabTask.projectId);
  if (project) context.project = { label: project.name };

  if (collabTask.sprintId) {
    const sprint = input.sprints.find((s) => s.id === collabTask.sprintId);
    if (sprint) context.sprint = { label: sprint.name };
  }

  if (collabTask.featureId) {
    const feature = input.features.find((f) => f.id === collabTask.featureId);
    if (feature) context.feature = { label: feature.name };
  }

  return context;
}

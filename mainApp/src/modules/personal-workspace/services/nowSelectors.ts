import type { Task, TimerState } from '@shared/types';

// ── S1-T3: pure NowStrip selector (ECIS B · G · DCX §4) ───────────────────────
// Answers "What am I working on right now?" from personal task state that
// already exists. 100% pure — same inputs always produce the same result, no
// Date.now(), no localStorage, no side effects. Only values that actually exist
// are surfaced; a missing task resolves to `null` so callers render an honest
// strip (nothing fabricated).

export interface NowContext {
  state: 'none' | 'personal';
  taskId: string | null;
  title: string | null;
  completed: boolean;
  sessionState: TimerState;
  subtasksDone: number;
  subtasksTotal: number;
}

export interface NowInput {
  tasks: Task[];
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
    subtasksDone: 0,
    subtasksTotal: 0,
  };

  // No active task — honest "nothing running" state.
  if (!activeTaskId) return base;

  const personalTask = input.tasks.find((t) => t.id === activeTaskId);

  // Active timer points at a task we cannot resolve (e.g. deleted) — surface
  // the session honestly without fabricating a title.
  if (!personalTask) return base;

  const subtasks = personalTask.subtasks ?? [];
  return {
    ...base,
    state: 'personal',
    title: personalTask.title,
    completed: personalTask.status === 'completed',
    subtasksDone: subtasks.filter((s) => s.completed).length,
    subtasksTotal: subtasks.length,
  };
}

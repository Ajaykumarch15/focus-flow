/**
 * activeTimerRouter.ts — Routes the parallel timerEngine's lifecycle calls to
 * the correct Zustand store / backend session endpoint.
 *
 * The `parallelTimerEngine` singleton is driven by two stores:
 *   - `useStore`             → work tasks    → api.sessions
 *   - `usePersonalTaskStore` → personal tasks → api.personalSessions
 *
 * Each session carries a `kind` (`work` | `personal`, see parallelTimerEngine).
 * The router determines which store owns a given task and routes stop/start calls
 * to the appropriate endpoint.
 *
 * Supports parallel timers: multiple sessions can run concurrently.
 */

import { parallelTimerEngine, TimerSessionKind } from './parallelTimerEngine';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';

/**
 * Get the session kind for a specific task.
 */
export function getTaskSessionKind(taskId: string): TimerSessionKind | null {
  const snapshot = parallelTimerEngine.getSnapshot(taskId);
  return snapshot?.sessionKind ?? null;
}

/**
 * Stop a specific task's session, routed to its owning store/backend.
 * No-op if the task's timer is already idle.
 */
export async function stopTaskTimer(taskId: string): Promise<void> {
  const kind = getTaskSessionKind(taskId);
  const state = parallelTimerEngine.getState(taskId);

  if (state === 'idle') return;

  if (kind === 'personal') {
    await usePersonalTaskStore.getState().stopTimer(taskId);
  } else {
    await useStore.getState().stopTimer(taskId);
  }
}

/**
 * Pause a specific task's session, routed to its owning store/backend.
 */
export function pauseTaskTimer(taskId: string): void {
  const kind = getTaskSessionKind(taskId);

  if (kind === 'personal') {
    usePersonalTaskStore.getState().pauseTimer(taskId);
  } else {
    useStore.getState().pauseTimer(taskId);
  }
}

/**
 * Resume a specific task's session, routed to its owning store/backend.
 */
export function resumeTaskTimer(taskId: string): void {
  const kind = getTaskSessionKind(taskId);

  if (kind === 'personal') {
    usePersonalTaskStore.getState().resumeTimer(taskId);
  } else {
    useStore.getState().resumeTimer(taskId);
  }
}

/**
 * Stop all active timers, routed to their owning stores.
 */
export async function stopAllTimers(): Promise<void> {
  const activeTaskIds = parallelTimerEngine.getActiveTaskIds();
  for (const taskId of activeTaskIds) {
    await stopTaskTimer(taskId);
  }
}

/**
 * Get all active timer task IDs.
 */
export function getActiveTimerTaskIds(): string[] {
  return parallelTimerEngine.getActiveTaskIds();
}

/**
 * Check if any timer is currently running.
 */
export function isAnyTimerRunning(): boolean {
  return parallelTimerEngine.isAnyRunning();
}

// ── Legacy API (backward compatibility) ────────────────────────────────────

/**
 * @deprecated Use getTaskSessionKind instead. Kept for backward compat.
 */
export function activeTimerKind(): TimerSessionKind | null {
  const taskIds = parallelTimerEngine.getActiveTaskIds();
  if (taskIds.length === 0) return null;
  return getTaskSessionKind(taskIds[0]);
}

/**
 * @deprecated Use stopTaskTimer instead. Kept for backward compat.
 */
export async function stopActiveTimer(): Promise<void> {
  const taskIds = parallelTimerEngine.getActiveTaskIds();
  if (taskIds.length > 0) {
    await stopTaskTimer(taskIds[0]);
  }
}

/**
 * @deprecated Use stopTaskTimer instead.
 */
export async function stopActiveTimerForSwitch(): Promise<void> {
  await stopActiveTimer();
}

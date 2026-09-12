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
import { timerEngine } from './timerEngine';
import { api } from '@shared/utils/api';
import { offlineQueue, createOpId } from '@shared/utils/offlineQueue';
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
 *
 * Handles both parallel timers (in parallelTimerEngine) and legacy single
 * timers (in timerEngine) by checking which engine owns the active session.
 */
export async function stopTaskTimer(taskId: string): Promise<void> {
  // Check parallel engine first
  const parallelSnapshot = parallelTimerEngine.getSnapshot(taskId);
  if (parallelSnapshot && parallelSnapshot.timerState !== 'idle') {
    const kind = parallelSnapshot.sessionKind;
    const sessionId = parallelSnapshot.sessionId;
    const now = Date.now();
    const opId = createOpId();

    const res = await parallelTimerEngine.stop(taskId, now);
    if (!res.success && res.error !== 'Timer is already idle') return;

    // Route API stop to the correct endpoint
    if (sessionId) {
      try {
        if (kind === 'personal') {
          await api.personalSessions.stop(sessionId, now, opId);
          await usePersonalTaskStore.getState().fetchTasks();
        } else {
          await api.sessions.stop(sessionId, now, opId);
          await useStore.getState().fetchTasks();
        }
      } catch {
        offlineQueue.enqueue('STOP_SESSION', taskId, sessionId, { endTime: now }, opId, kind ?? 'work');
      }
    }
    return;
  }

  // Fall back to legacy single timer engine
  const legacyState = timerEngine.getState();
  if (legacyState === 'idle') return;
  if (timerEngine.getActiveTaskId() !== taskId) return;

  const kind = timerEngine.getSessionKind();
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

/**
 * activeTimerRouter.ts — Routes the shared timerEngine's lifecycle calls to the
 * correct Zustand store / backend session endpoint.
 *
 * The single `timerEngine` singleton is driven by two stores:
 *   - `useStore`             → work tasks    → api.sessions
 *   - `usePersonalTaskStore` → personal tasks → api.personalSessions
 *
 * Each session carries a `kind` (`work` | `personal`, see timerEngine). When a
 * timer is switched, the *running* task may belong to the other store, so we
 * must stop it through that store — not through the store initiating the switch
 * (which would call the wrong `api.*Sessions` endpoint and orphan the session).
 *
 * Importing both stores statically is safe: neither store imports this module or
 * the other (useStore reaches this router only via a lazy `import()` inside its
 * startTimer), so there is no circular dependency.
 */

import { timerEngine } from './timerEngine';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';

export function activeTimerKind(): ReturnType<typeof timerEngine.getSessionKind> {
  return timerEngine.getSessionKind();
}

/**
 * Stop whichever session is currently active, routed to its owning store/backend.
 * No-op if the engine is already idle.
 */
export async function stopActiveTimer(): Promise<void> {
  const kind = timerEngine.getSessionKind();
  const taskId = timerEngine.getActiveTaskId();
  if (!taskId || timerEngine.getState() === 'idle') return;

  if (kind === 'personal') {
    await usePersonalTaskStore.getState().stopTimer(taskId);
  } else {
    await useStore.getState().stopTimer(taskId);
  }
}

/**
 * Convenience used by a store's `startTimer` to close a *different* running task
 * before starting its own. The prior task is stopped via its owning store so the
 * correct session endpoint is hit.
 */
export async function stopActiveTimerForSwitch(): Promise<void> {
  await stopActiveTimer();
}

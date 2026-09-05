/**
 * timerHeartbeat.ts — Single shared, kind-aware timer heartbeat.
 *
 * Both the work store and the personal store previously owned their own
 * `startHeartbeat`/`stopHeartbeat` that pinged a HARD-CODED endpoint
 * (`api.sessions.heartbeat`). That was wrong for personal sessions: on refresh,
 * `useStore.loadAll` rehydrated a personal session from localStorage and then
 * started a work-endpoint heartbeat for a personal session id; the server 404'd
 * it and the `onStale` callback cleared the personal timer ~30s later.
 *
 * This module routes the ping by `timerEngine.getSessionKind()` so a personal
 * session is always heartbeated on `api.personalSessions` and a work session on
 * `api.sessions`. A single module-level interval also prevents the two stores
 * from starting duplicate heartbeats.
 */

import { timerEngine } from './timerEngine';
import { api } from '@shared/utils/api';

const HEARTBEAT_INTERVAL_MS = 30_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startTimerHeartbeat(onStale?: () => void): void {
  stopTimerHeartbeat();
  const sessionId = timerEngine.getActiveSessionId();
  if (!sessionId) return;

  const ping =
    timerEngine.getSessionKind() === 'personal'
      ? api.personalSessions.heartbeat
      : api.sessions.heartbeat;

  heartbeatTimer = setInterval(() => {
    ping(sessionId).catch((err: any) => {
      const msg = err?.message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        stopTimerHeartbeat();
        onStale?.();
      }
    });
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopTimerHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

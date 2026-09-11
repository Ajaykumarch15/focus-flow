/**
 * timerHeartbeat.ts — Multi-timer kind-aware heartbeat.
 *
 * Supports both legacy single-timer mode and new parallel multi-timer mode.
 * Routes pings to the correct endpoint based on session kind:
 *   - personal sessions → api.personalSessions.heartbeat
 *   - work sessions → api.sessions.heartbeat
 *
 * Each active session gets its own heartbeat interval. Stale sessions
 * (404 from server) trigger the onStale callback for that specific session.
 *
 * IMPORTANT: The heartbeat reads sessionId and kind fresh from the timer engine
 * on each ping to handle cross-tab state changes correctly.
 */

import { timerEngine } from './timerEngine';
import { api } from '@shared/utils/api';

const HEARTBEAT_INTERVAL_MS = 30_000;

// Legacy single-timer heartbeat
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Parallel multi-timer heartbeats: sessionId -> interval
const parallelHeartbeats: Map<string, ReturnType<typeof setInterval>> = new Map();

// Track stale callbacks per session
const staleCallbacks: Map<string, () => void> = new Map();

/**
 * Start heartbeat for a specific session (parallel mode).
 */
export function startSessionHeartbeat(
  sessionId: string,
  kind: 'work' | 'personal',
  onStale?: () => void
): void {
  // Don't duplicate if already heartbeating this session
  if (parallelHeartbeats.has(sessionId)) return;

  if (onStale) {
    staleCallbacks.set(sessionId, onStale);
  }

  const interval = setInterval(() => {
    // Read the current ping function based on kind (static for this session)
    const ping =
      kind === 'personal'
        ? api.personalSessions.heartbeat
        : api.sessions.heartbeat;

    ping(sessionId).catch((err: any) => {
      const msg = err?.message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        stopSessionHeartbeat(sessionId);
        staleCallbacks.get(sessionId)?.();
        staleCallbacks.delete(sessionId);
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  parallelHeartbeats.set(sessionId, interval);
}

/**
 * Stop heartbeat for a specific session.
 */
export function stopSessionHeartbeat(sessionId: string): void {
  const interval = parallelHeartbeats.get(sessionId);
  if (interval) {
    clearInterval(interval);
    parallelHeartbeats.delete(sessionId);
    staleCallbacks.delete(sessionId);
  }
}

/**
 * Stop all parallel heartbeats.
 */
export function stopAllSessionHeartbeats(): void {
  parallelHeartbeats.forEach((interval) => clearInterval(interval));
  parallelHeartbeats.clear();
  staleCallbacks.clear();
}

/**
 * Get count of active heartbeats.
 */
export function getActiveHeartbeatCount(): number {
  return parallelHeartbeats.size;
}

// ── Legacy API (backward compatibility) ────────────────────────────────────

/**
 * Start heartbeat for the legacy single timer.
 * Reads sessionId and kind fresh from timerEngine on each ping.
 * @deprecated Use startSessionHeartbeat for parallel timers.
 */
export function startTimerHeartbeat(onStale?: () => void): void {
  stopTimerHeartbeat();

  heartbeatTimer = setInterval(() => {
    // Read fresh state from the engine on each ping
    const sessionId = timerEngine.getActiveSessionId();
    const kind = timerEngine.getSessionKind();

    if (!sessionId) {
      stopTimerHeartbeat();
      return;
    }

    const ping =
      kind === 'personal'
        ? api.personalSessions.heartbeat
        : api.sessions.heartbeat;

    ping(sessionId).catch((err: any) => {
      const msg = err?.message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        stopTimerHeartbeat();
        onStale?.();
      }
    });
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop the legacy single timer heartbeat.
 * @deprecated Use stopSessionHeartbeat for parallel timers.
 */
export function stopTimerHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

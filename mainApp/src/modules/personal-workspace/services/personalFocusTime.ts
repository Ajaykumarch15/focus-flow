/**
 * personalFocusTime.ts — Personal workspace focus-time helpers.
 *
 * Personal task sessions are tracked server-side (`PersonalSession` model) and
 * are NOT embedded in personal task docs (`mapTask` maps `sessions: []`), so
 * any goal math that sums `task.sessions` is always zero. These helpers fetch
 * sessions from the API and compute closed-session + live-timer totals the
 * same way the worklog day-cache does (`rebuildDayCache`: closed sessions from
 * the backend, live time added by the timer engines).
 */

import { api } from '@shared/utils/api';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';
import { timerEngine } from '@worklog/services/timerEngine';

export interface PersonalSessionLite {
  /** Epoch ms */
  startTime: number;
  /** ms of active (non-paused) time; live sessions may be partial */
  activeTime: number;
  isActive: boolean;
}

/** Fetch the user's personal work sessions (light mapping, resilient). */
export async function fetchPersonalSessions(): Promise<PersonalSessionLite[]> {
  try {
    const docs = await api.personalSessions.list();
    return (Array.isArray(docs) ? docs : []).map((d: Record<string, unknown>) => ({
      startTime: typeof d.startTime === 'number' ? d.startTime : new Date(String(d.startTime)).getTime() || 0,
      activeTime: typeof d.activeTime === 'number' ? d.activeTime : 0,
      isActive: !!d.isActive,
    }));
  } catch {
    return [];
  }
}

/**
 * Sum ACTIVE TIME of CLOSED personal sessions started within [startEpoch, endEpoch].
 * Live (isActive) sessions are excluded — their running time is contributed by
 * the timer engines via `computeLivePersonalMs` to avoid double counting.
 */
export function sumClosedSessionMs(
  sessions: PersonalSessionLite[],
  startEpoch: number,
  endEpoch: number,
): number {
  let total = 0;
  for (const s of sessions) {
    if (s.isActive) continue;
    if (s.startTime >= startEpoch && s.startTime <= endEpoch) total += s.activeTime || 0;
  }
  return total;
}

/**
 * Live (in-progress) personal-workspace time across both timer engines:
 * - parallel engine: all non-idle timers whose session kind is personal
 *   (or that belong to a known personal task when kind is unknown);
 * - legacy single-timer engine: only when it isn't mirrored by the parallel
 *   engine and its task is a personal task.
 */
export function computeLivePersonalMs(personalTaskIds: string[], now: number = Date.now()): number {
  const idSet = new Set(personalTaskIds);
  let total = 0;

  const parallel = parallelTimerEngine.getAllSnapshots();
  for (const [taskId, snap] of parallel) {
    if (snap.timerState === 'idle') continue;
    const isPersonal = snap.sessionKind === 'personal' || (!snap.sessionKind && idSet.has(taskId));
    if (!isPersonal) continue;
    total += parallelTimerEngine.getElapsedMs(taskId, now);
  }

  // Legacy engine: skip if this task already counted above
  if (timerEngine.getState() !== 'idle') {
    const legacy = timerEngine.getSnapshot();
    const legacyTaskId = legacy.taskId;
    if (legacyTaskId && !parallel.has(legacyTaskId) && idSet.has(legacyTaskId)) {
      total += timerEngine.getElapsedMs(now);
    }
  }

  return total;
}

/**
 * timerPersist.ts
 *
 * Saves active timer state to localStorage every tick.
 * On page refresh, this lets us show the correct elapsed time
 * INSTANTLY (before the API call returns the session from Atlas).
 */

const KEY = 'ff_active_timer';

export interface PersistedTimer {
  taskId:              string;
  sessionId:           string | null;
  timerState:          'running' | 'paused';
  sessionStartTime:    number;   // epoch ms — when the session started
  totalPauseDuration:  number;   // ms paused so far
  pauseStart?:         number;   // if currently paused, when it started
}

export function saveTimer(data: PersistedTimer): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* storage full */ }
}

export function loadTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTimer(): void {
  localStorage.removeItem(KEY);
}

/**
 * Given a persisted timer snapshot, calculate how many ms of
 * active (non-paused) work have elapsed right now.
 */
export function calcElapsed(t: PersistedTimer): number {
  const now = Date.now();
  if (t.timerState === 'paused' && t.pauseStart) {
    // Paused — don't count the current pause
    return Math.max(0, now - t.sessionStartTime - t.totalPauseDuration - (now - t.pauseStart));
  }
  return Math.max(0, now - t.sessionStartTime - t.totalPauseDuration);
}

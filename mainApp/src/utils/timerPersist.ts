/**
 * timerPersist.ts
 *
 * Two responsibilities:
 * 1. Active timer state → localStorage so refresh restores the running clock.
 * 2. Today's completed-session total → localStorage so daily progress bar
 *    never resets to 0 when a new task starts or the page refreshes.
 */

// ── Active timer ──────────────────────────────────────────────────────────────
const TIMER_KEY = 'ff_active_timer';
const TODAY_KEY = 'ff_today_ms';

export interface PersistedTimer {
  taskId: string;
  sessionId: string | null;
  timerState: 'running' | 'paused';
  sessionStartTime: number;   // epoch ms — when the session started
  totalPauseDuration: number;   // ms paused so far
  pauseStart?: number;   // if currently paused, when it started
}

export function saveTimer(data: PersistedTimer): void {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(data)); }
  catch { /* storage full */ }
}

export function loadTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearTimer(): void {
  localStorage.removeItem(TIMER_KEY);
}

/**
 * Given a persisted timer snapshot, calculate how many ms of
 * active (non-paused) work have elapsed right now.
 */
export function calcElapsed(t: PersistedTimer): number {
  if (t.timerState === 'paused' && t.pauseStart) {
    // Paused: count only up to when the pause started
    return Math.max(0, t.pauseStart - t.sessionStartTime - t.totalPauseDuration);
  }
  // Running: count up to now
  return Math.max(0, Date.now() - t.sessionStartTime - t.totalPauseDuration);
}

// ── Today's completed sessions cache ─────────────────────────────────────────
// Stores the SUM of activeMs for all sessions stopped today.
// Read by getTodayTime() so daily progress never resets on new task start.

interface TodayCache {
  date: string;   // YYYY-MM-DD
  ms: number;
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/** Load today's completed-session total (0 if none or a different day). */
export function loadTodayMs(): number {
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (!raw) return 0;
    const { date, ms } = JSON.parse(raw) as TodayCache;
    return date === todayKey() ? ms : 0;
  } catch { return 0; }
}

/**
 * Add a just-completed session's active time to today's cache.
 * Call this inside stopTimer BEFORE wiping store state.
 */
export function addCompletedSession(activeMs: number): void {
  try {
    const existing = loadTodayMs();
    const updated: TodayCache = { date: todayKey(), ms: existing + activeMs };
    localStorage.setItem(TODAY_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

/** Overwrite today's total (used after full recalculation). */
export function saveTodayMs(ms: number): void {
  try {
    localStorage.setItem(TODAY_KEY, JSON.stringify({ date: todayKey(), ms }));
  } catch { /* ignore */ }
}

/** Clear today's cache (call on logout). */
export function clearTodayMs(): void {
  localStorage.removeItem(TODAY_KEY);
}
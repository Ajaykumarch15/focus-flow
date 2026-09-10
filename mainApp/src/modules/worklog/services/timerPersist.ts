/**
 * timerPersist.ts
 *
 * Two responsibilities:
 * 1. Active timer state → localStorage so refresh restores the running clock.
 * 2. Today's completed-session total → localStorage so daily progress bar
 *    never resets to 0 when a new task starts or the page refreshes.
 *
 * Supports both legacy single-timer format and new parallel multi-timer format.
 */

import { getTodayKey, getIsoWeekStartKey, getIsoWeekEndKey, getTimezone, dayKeyInTz } from '@shared/utils/time';

// ── Active timer(s) ──────────────────────────────────────────────────────────
const TIMER_KEY = 'ff_active_timer';      // Legacy single timer
const TIMERS_KEY = 'ff_active_timers';    // New parallel multi-timer
const DAY_CACHE_KEY = 'ff_day_cache';
const LEGACY_TODAY_KEY = 'ff_today_ms';

export interface PersistedTimer {
  taskId: string;
  sessionId: string | null;
  timerState: 'running' | 'paused';
  sessionStartTime: number;   // epoch ms — when the session started
  totalPauseDuration: number;   // ms paused so far
  pauseStart?: number;   // if currently paused, when it started
  baseElapsedMs?: number;   // pre-existing accumulated time (resumed task total)
  sessionKind?: 'work' | 'personal';   // which backend owns this session
}

// ── Legacy single-timer API (kept for backward compat / migration) ──────────

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

// ── Parallel multi-timer API ────────────────────────────────────────────────

export function saveTimers(data: PersistedTimer[]): void {
  try {
    // Migrate any legacy single timer into the array
    const migrated = migrateLegacyTimer(data);
    // Deduplicate by taskId (latest timestamp wins) to prevent duplicates
    // from concurrent cross-tab migration
    const deduped = deduplicateTimers(migrated);
    localStorage.setItem(TIMERS_KEY, JSON.stringify(deduped));
    // Clear legacy key once migrated
    localStorage.removeItem(TIMER_KEY);
  } catch { /* storage full */ }
}

export function loadTimers(): PersistedTimer[] {
  try {
    const raw = localStorage.getItem(TIMERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Fall back to legacy single timer format
    const legacy = loadTimer();
    return legacy ? [legacy] : [];
  } catch { return []; }
}

export function clearTimers(): void {
  localStorage.removeItem(TIMERS_KEY);
  localStorage.removeItem(TIMER_KEY);
}

/**
 * Migrate legacy single timer into parallel format if not already present.
 */
function migrateLegacyTimer(newTimers: PersistedTimer[]): PersistedTimer[] {
  const legacy = loadTimer();
  if (!legacy) return newTimers;

  // Check if legacy timer is already in the new array
  const exists = newTimers.some((t) => t.taskId === legacy.taskId);
  if (exists) {
    // Legacy already migrated, clear it
    localStorage.removeItem(TIMER_KEY);
    return newTimers;
  }

  // Add legacy timer to array and clear legacy storage
  localStorage.removeItem(TIMER_KEY);
  return [legacy, ...newTimers];
}

/**
 * Deduplicate timers by taskId. If duplicates exist, keep the one with the
 * latest sessionStartTime (most recent).
 */
function deduplicateTimers(timers: PersistedTimer[]): PersistedTimer[] {
  const map = new Map<string, PersistedTimer>();
  for (const timer of timers) {
    const existing = map.get(timer.taskId);
    if (!existing || timer.sessionStartTime > existing.sessionStartTime) {
      map.set(timer.taskId, timer);
    }
  }
  return Array.from(map.values());
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

// ── Per-day completed-session cache ──────────────────────────────────────────
// Stores the SUM of activeMs for all sessions stopped, keyed by YYYY-MM-DD day.
// Read by getTodayTime() so daily progress never resets on new task start, and
// summed across the ISO week for real weekly totals (IES-P1-19).

interface LegacyTodayCache {
  date: string;   // YYYY-MM-DD
  ms: number;
}

function todayKey(): string {
  return getTodayKey();
}

function readDayCache(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DAY_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, number>;
      }
    }
  } catch { /* ignore */ }
  return {};
}

function writeDayCache(cache: Record<string, number>): void {
  try { localStorage.setItem(DAY_CACHE_KEY, JSON.stringify(cache)); }
  catch { /* storage full */ }
}

/** One-time migration: fold a legacy ff_today_ms snapshot into the day cache. */
function migrateLegacyToday(): void {
  try {
    const raw = localStorage.getItem(LEGACY_TODAY_KEY);
    if (!raw) return;
    const { date, ms } = JSON.parse(raw) as LegacyTodayCache;
    if (date && typeof ms === 'number' && ms > 0) {
      const cache = readDayCache();
      if (!(date in cache)) {
        cache[date] = ms;
        writeDayCache(cache);
      }
    }
    localStorage.removeItem(LEGACY_TODAY_KEY);
  } catch { /* ignore */ }
}

/** Load today's completed-session total (0 if none). */
export function loadTodayMs(): number {
  migrateLegacyToday();
  return readDayCache()[todayKey()] || 0;
}

/**
 * Add a just-completed session's active time to today's cache.
 * Call this inside stopTimer BEFORE wiping store state.
 */
export function addCompletedSession(activeMs: number): void {
  migrateLegacyToday();
  const cache = readDayCache();
  cache[todayKey()] = (cache[todayKey()] || 0) + activeMs;
  writeDayCache(cache);
}

/** Overwrite today's total (used after full recalculation). */
export function saveTodayMs(ms: number): void {
  migrateLegacyToday();
  const cache = readDayCache();
  cache[todayKey()] = ms;
  writeDayCache(cache);
}

/** Load a specific day's completed total (0 if unknown). */
export function loadDayMs(dayKey: string): number {
  migrateLegacyToday();
  return readDayCache()[dayKey] || 0;
}

/** Sum of completed sessions across the current ISO week (Mon–Sun). */
export function loadWeekMs(timeZone = getTimezone()): number {
  migrateLegacyToday();
  const cache = readDayCache();
  const startKey = getIsoWeekStartKey(timeZone);
  const endKey = getIsoWeekEndKey(timeZone);
  let total = 0;
  for (const [key, ms] of Object.entries(cache)) {
    if (key >= startKey && key <= endKey) total += ms;
  }
  return total;
}

/** Clear the day cache (call on logout). */
export function clearTodayMs(): void {
  localStorage.removeItem(DAY_CACHE_KEY);
  localStorage.removeItem(LEGACY_TODAY_KEY);
}

/**
 * Rebuild the whole day cache from the backend's session list. Only closed
 * (inactive) sessions count; the live one is added separately by the engine.
 * Keyed by the user's calendar day of the session's start time — the same
 * day semantics `addCompletedSession` uses, so today/week totals survive a
 * refresh or re-login instead of resetting to zero.
 */
export function rebuildDayCache(sessions: Array<{ startTime?: number; activeTime?: number; isActive?: boolean }>): void {
  migrateLegacyToday();
  const cache: Record<string, number> = {};
  for (const s of sessions) {
    if (!s || s.isActive) continue;
    const activeMs = s.activeTime || 0;
    if (activeMs <= 0 || !s.startTime) continue;
    const key = dayKeyInTz(s.startTime);
    cache[key] = (cache[key] || 0) + activeMs;
  }
  try { localStorage.setItem(DAY_CACHE_KEY, JSON.stringify(cache)); }
  catch { /* storage full */ }
}
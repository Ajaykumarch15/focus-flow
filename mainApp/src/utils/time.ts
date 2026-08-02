// ── Central Time Service ──────────────────────────────────────────────────────
// All date/time logic goes through here. No inline `new Date().toISOString()`,
// no scattered `setHours(0,0,0,0)`, no mixed UTC/local comparisons.

// ── Duration formatters ──────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** HH:MM:SS or MM:SS — for the live digital timer display. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export const formatClock = formatDuration;

/** Human-readable short form — "1h 23m", "45m 10s", "8s". */
export function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Short hours string — "1.5h" or "45m". */
export function formatHours(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 1) {
    const minutes = Math.floor(ms / 60000);
    return `${minutes}m`;
  }
  return `${hours.toFixed(1)}h`;
}

/** Returns hours as a decimal number — for charts. */
export function formatHoursDecimal(ms: number): number {
  return Math.round((ms / 3600000) * 10) / 10;
}

// ── Deadline helpers ─────────────────────────────────────────────────────────

export type DeadlineStatus = 'overdue' | 'due-today' | 'due-soon' | 'upcoming';

export function getDeadlineStatus(deadline: number | undefined): { status: DeadlineStatus; label: string } | null {
  if (!deadline) return null;
  const now = Date.now();
  const diff = deadline - now;
  const daysLeft = Math.ceil(diff / 86400000);

  if (diff < 0) {
    const daysOver = Math.abs(daysLeft);
    return { status: 'overdue', label: daysOver === 0 ? 'Overdue today' : `Overdue by ${daysOver} day${daysOver !== 1 ? 's' : ''}` };
  }
  if (daysLeft === 0) return { status: 'due-today', label: 'Due today' };
  if (daysLeft === 1) return { status: 'due-soon', label: 'Due tomorrow' };
  if (daysLeft <= 3) return { status: 'due-soon', label: `Due in ${daysLeft} days` };
  return { status: 'upcoming', label: `Due in ${daysLeft} days` };
}

export function isOverdue(deadline: number | undefined): boolean {
  if (!deadline) return false;
  return deadline < Date.now();
}

export function isDueToday(deadline: number | undefined): boolean {
  if (!deadline) return false;
  return isToday(deadline);
}

// ── Core date helpers (LOCAL TIME ONLY) ──────────────────────────────────────
// Every function below uses local system time. No UTC. No toISOString().

/** Returns today's date as local "YYYY-MM-DD". Safe for localStorage keys. */
export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns start-of-day (local midnight) epoch ms. */
export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Returns end-of-day (local 23:59:59.999) epoch ms. */
export function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Returns start-of-day (local midnight) epoch ms for any date. */
export function startOfDay(date: Date | number): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Returns end-of-day (local 23:59:59.999) epoch ms for any date. */
export function endOfDay(date: Date | number): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Returns true if the timestamp falls on today's calendar date.
 * Accepts epoch ms or ISO string. Uses LOCAL time comparison.
 */
export function isToday(timestamp: number | string): boolean {
  const d = new Date(timestamp);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

/**
 * Compare if two timestamps fall on the same calendar day (local time).
 */
export function isSameDay(a: number | string, b: number | string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getDate() === db.getDate() &&
    da.getMonth() === db.getMonth() &&
    da.getFullYear() === db.getFullYear()
  );
}

/**
 * Returns a local "YYYY-MM-DD" key for any timestamp.
 * Use this for grouping sessions by day.
 */
export function dayKey(timestamp: number | string): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns true if the timestamp falls within the current calendar week (Sun–Sat). */
export function isThisWeek(timestamp: number): boolean {
  const d = new Date(timestamp);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

/** Returns start of the current week (Sunday) at local midnight. */
export function getWeekStart(): number {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - now.getDay());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Returns the last 7 days as short names ["Sun","Mon",...]. */
export function getWeekDays(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
  }
  return days;
}

// ── Cross-midnight session splitting ─────────────────────────────────────────

export interface DayBucket {
  dateKey: string;     // "YYYY-MM-DD" local
  startMs: number;     // epoch ms of this day's portion start
  endMs: number;       // epoch ms of this day's portion end
  activeMs: number;    // active (non-paused) ms in this day
}

/**
 * Split a session's active time across midnight boundaries.
 * Given a session with startMs, endMs, and totalActiveMs,
 * returns an array of DayBucket objects — one per calendar day.
 *
 * This handles:
 * - Sessions within a single day (returns 1 bucket)
 * - Sessions that cross midnight (returns 2+ buckets)
 * - Sessions paused and resumed across days
 */
export function splitSessionAcrossMidnight(
  startMs: number,
  endMs: number,
  activeMs: number,
): DayBucket[] {
  if (endMs <= startMs || activeMs <= 0) return [];

  const totalWallMs = endMs - startMs;
  if (totalWallMs <= 0) return [];

  // If the entire session is within one day, no splitting needed
  if (isSameDay(startMs, endMs)) {
    return [{ dateKey: dayKey(startMs), startMs, endMs, activeMs }];
  }

  // Session crosses midnight — split proportionally by wall time
  const buckets: DayBucket[] = [];
  let cursor = startMs;
  let remainingActive = activeMs;

  while (cursor < endMs) {
    const dayEnd = endOfDay(cursor);
    const nextDayStart = dayEnd + 1;
    const segmentEnd = Math.min(dayEnd, endMs);
    const segmentWallMs = segmentEnd - cursor;

    // Proportion of active time in this segment
    const segmentActiveMs = Math.round(remainingActive * (segmentWallMs / (endMs - cursor)));

    buckets.push({
      dateKey: dayKey(cursor),
      startMs: cursor,
      endMs: segmentEnd,
      activeMs: segmentActiveMs,
    });

    remainingActive -= segmentActiveMs;
    cursor = nextDayStart;
  }

  // Assign any rounding remainder to the last bucket
  if (remainingActive > 0 && buckets.length > 0) {
    buckets[buckets.length - 1].activeMs += remainingActive;
  }

  return buckets;
}

// ── Date formatting ──────────────────────────────────────────────────────────

/** Format a date for display — "Jul 26, 2026" */
export function formatDate(date: Date | number): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Format a date as "EEE, MMM d" — "Sun, Jul 26" */
export function formatDateShort(date: Date | number): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

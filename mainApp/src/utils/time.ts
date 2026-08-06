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
// IES-P1-06: deadlines are calendar days in the user's timezone, so every
// deadline comparison happens on day keys — never on raw instants.

export type DeadlineStatus = 'overdue' | 'due-today' | 'due-soon' | 'upcoming';

export function getDeadlineStatus(deadline: number | undefined, timeZone = getTimezone()): { status: DeadlineStatus; label: string } | null {
  if (!deadline) return null;
  const daysLeft = daysBetweenKeys(getTodayKey(timeZone), dayKeyInTz(deadline, timeZone));

  if (daysLeft < 0) {
    return { status: 'overdue', label: daysLeft === -1 ? 'Overdue today' : `Overdue by ${-daysLeft} day${-daysLeft !== 1 ? 's' : ''}` };
  }
  if (daysLeft === 0) return { status: 'due-today', label: 'Due today' };
  if (daysLeft === 1) return { status: 'due-soon', label: 'Due tomorrow' };
  if (daysLeft <= 3) return { status: 'due-soon', label: `Due in ${daysLeft} days` };
  return { status: 'upcoming', label: `Due in ${daysLeft} days` };
}

export function isOverdue(deadline: number | undefined, timeZone = getTimezone()): boolean {
  if (!deadline) return false;
  return dayKeyInTz(deadline, timeZone) < getTodayKey(timeZone);
}

export function isDueToday(deadline: number | undefined, timeZone = getTimezone()): boolean {
  if (!deadline) return false;
  return dayKeyInTz(deadline, timeZone) === getTodayKey(timeZone);
}

// ── Timezone-aware day keys (mirror server/utils/dates.js) ───────────────────
// The user's calendar day is defined by their profile timezone. `getTodayKey`
// is the single source of truth for "today" on the client. localStorage is read
// per call (never cached) so a timezone change in Settings applies immediately.

export function getTimezone(): string {
  try {
    const raw = localStorage.getItem('ff_profile_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.timezone) return parsed.timezone;
    }
  } catch { /* ignore */ }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function dayKeyInTz(timestamp: number | string, timeZone = getTimezone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

/** The user's "today" as a YYYY-MM-DD day key. */
export function getTodayKey(timeZone = getTimezone()): string {
  return dayKeyInTz(Date.now(), timeZone);
}

export function getOffsetMs(date: Date | number, timeZone: string): number {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(d);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour === '24' ? '0' : values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return asUtc - d.getTime();
  } catch {
    return 0;
  }
}

/** Encode a local calendar day (YYYY-MM-DD) as the user-tz midnight instant. */
export function localDateToUtc(dateKey: string, timeZone: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return utcGuess - getOffsetMs(new Date(utcGuess), timeZone);
}

/** Start of the calendar day a timestamp falls in, for the user's timezone. */
export function startOfDayInTz(timestamp: number | string, timeZone = getTimezone()): number {
  return localDateToUtc(dayKeyInTz(timestamp, timeZone), timeZone);
}

/** Whole calendar days between two YYYY-MM-DD keys (positive = `toKey` is later). */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/** Shift a YYYY-MM-DD key by a signed number of days (calendar-date math). */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * Monday of the current ISO week, as a YYYY-MM-DD key in the user's timezone.
 * ISO weeks run Monday–Sunday; the day-cache week totals use this boundary.
 */
export function getIsoWeekStartKey(timeZone = getTimezone()): string {
  const today = getTodayKey(timeZone);
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7;
  return addDaysToKey(today, -daysSinceMonday);
}

/** Sunday ending the current ISO week, as a YYYY-MM-DD key in the user's timezone. */
export function getIsoWeekEndKey(timeZone = getTimezone()): string {
  return addDaysToKey(getIsoWeekStartKey(timeZone), 6);
}

/**
 * Monday-midnight epoch ms of the ISO week a timestamp falls in, for a timezone.
 * ISO weeks run Monday–Sunday; the instant is the user-tz midnight of Monday so
 * a range filter can use it directly as a window start.
 */
export function startOfIsoWeekInTz(timestamp: number | string, timeZone = getTimezone()): number {
  const key = dayKeyInTz(timestamp, timeZone);
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7;
  return localDateToUtc(addDaysToKey(key, -daysSinceMonday), timeZone);
}

/** Sunday 23:59:59.999 epoch ms ending the ISO week a timestamp falls in. */
export function endOfIsoWeekInTz(timestamp: number | string, timeZone = getTimezone()): number {
  return startOfIsoWeekInTz(timestamp, timeZone) + 7 * 86400000 - 1;
}

/**
 * Hour of the day (0–23) a timestamp falls in, for a timezone. Uses the tz
 * offset at that exact instant, so DST transitions do not skew the hour.
 */
export function hourOfDayInTz(timestamp: number | string, timeZone = getTimezone()): number {
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  return new Date(ts + getOffsetMs(new Date(ts), timeZone)).getUTCHours();
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Weekday short name ("Mon"–"Sun") of the calendar day a timestamp falls in, for a timezone. */
export function weekdayInTz(timestamp: number | string, timeZone = getTimezone()): string {
  const [y, m, d] = dayKeyInTz(timestamp, timeZone).split('-').map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
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

/**
 * Format the calendar date a timestamp falls on, in a chosen timezone — "Sun,
 * Aug 9". Unlike `formatDateShort` (local wall clock), this never shifts across
 * midnight, so a range label matches the same timezone the range was computed in.
 */
export function formatDateShortInTz(timestamp: number | string, timeZone = getTimezone()): string {
  const [y, m, d] = dayKeyInTz(timestamp, timeZone).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

/** Local wall-clock time — "9:41 AM". */
export function formatTimeOfDay(timestamp: number | string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

// ── Relative time ────────────────────────────────────────────────────────────
// Single shared implementation (extracted from the inline timeAgo snippet that
// was duplicated across AdminActivity/AdminOverview) so every feed renders the
// same compact "5m ago" wording.

/** Compact relative time — "just now", "5m ago", "3h ago", "2d ago". */
export function formatRelativeTime(timestamp: number | string, now: number = Date.now()): string {
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (!Number.isFinite(ts)) return '';
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

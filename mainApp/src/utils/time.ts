// ── Duration formatters ───────────────────────────────────────────────────────

/**
 * HH:MM:SS or MM:SS — for the live digital timer display.
 * e.g. 3661000ms → "01:01:01"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Alias — same as formatDuration, used in WorkLog TimerPanel. */
export const formatClock = formatDuration;

/**
 * Human-readable short form — "1h 23m", "45m 10s", "8s".
 * Used in Time Summary panels and stat cards.
 */
export function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Short hours string — "1.5h" or "45m".
 * Used in stat cards on the Dashboard.
 */
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Returns today's date as "YYYY-MM-DD". */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns start-of-day (midnight) epoch ms for a given date. */
export function startOfDay(date = new Date()): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Returns true if the timestamp falls on today's calendar date.
 * Accepts epoch ms.
 */
export function isToday(timestamp: number): boolean {
  const d = new Date(timestamp);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
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

/** Returns the last 7 days as short names ["Mon","Tue",...]. */
export function getWeekDays(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getDayName(d));
  }
  return days;
}
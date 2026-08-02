import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDuration,
  formatClock,
  formatMs,
  formatHours,
  formatHoursDecimal,
  getDeadlineStatus,
  isOverdue,
  isDueToday,
  getToday,
  startOfToday,
  endOfToday,
  startOfDay,
  endOfDay,
  isToday,
  isSameDay,
  dayKey,
  isThisWeek,
  getWeekStart,
  getWeekDays,
  splitSessionAcrossMidnight,
  formatDate,
  formatDateShort,
} from '../time';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatDuration', () => {
  it('formats sub-minute durations as MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(59_999)).toBe('00:59');
    expect(formatDuration(60_000)).toBe('01:00');
    expect(formatDuration(45_000)).toBe('00:45');
  });

  it('formats hour-long durations as HH:MM:SS', () => {
    expect(formatDuration(3_661_000)).toBe('01:01:01');
    expect(formatDuration(3_600_000)).toBe('01:00:00');
  });

  it('is aliased as formatClock', () => {
    expect(formatClock(90_000)).toBe('01:30');
  });
});

describe('formatMs / formatHours', () => {
  it('formats short human durations', () => {
    expect(formatMs(0)).toBe('0m');
    expect(formatMs(-1)).toBe('0m');
    expect(formatMs(8_000)).toBe('8s');
    expect(formatMs(45_000)).toBe('45s');
    expect(formatMs(3_700_000)).toBe('1h 1m');
    expect(formatMs(45_123_000)).toBe('12h 32m');
  });

  it('formats hours with one decimal', () => {
    expect(formatHours(45 * 60_000)).toBe('45m');
    expect(formatHours(3_600_000)).toBe('1.0h');
    expect(formatHours(90 * 60_000)).toBe('1.5h');
  });

  it('rounds decimal hours for charts', () => {
    expect(formatHoursDecimal(3_700_000)).toBe(1);
    expect(formatHoursDecimal(5_400_000)).toBe(1.5);
  });
});

describe('deadline helpers', () => {
  it('returns null when no deadline is set', () => {
    expect(getDeadlineStatus(undefined)).toBeNull();
    expect(isOverdue(undefined)).toBe(false);
    expect(isDueToday(undefined)).toBe(false);
  });

  it('classifies overdue deadlines', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const now = Date.now();
    expect(getDeadlineStatus(now - 1)?.status).toBe('overdue');
    expect(getDeadlineStatus(now - 86_400_000)?.label).toBe('Overdue by 1 day');
    expect(getDeadlineStatus(now - 2 * 86_400_000)?.label).toBe('Overdue by 2 days');
    expect(isOverdue(now - 1)).toBe(true);
  });

  it('classifies due-today, due-soon and upcoming deadlines', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const now = Date.now();
    expect(getDeadlineStatus(now)?.status).toBe('due-today');
    expect(isDueToday(now)).toBe(true);
    expect(getDeadlineStatus(now + 86_400_000)?.status).toBe('due-soon');
    expect(getDeadlineStatus(now + 2 * 86_400_000)?.label).toBe('Due in 2 days');
    expect(getDeadlineStatus(now + 3 * 86_400_000)?.label).toBe('Due in 3 days');
    expect(getDeadlineStatus(now + 4 * 86_400_000)?.status).toBe('upcoming');
  });
});

describe('calendar day helpers (local time)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 14, 30, 0)); // Wed 2026-07-15 local
  });

  it('getToday returns a local YYYY-MM-DD key', () => {
    expect(getToday()).toBe('2026-07-15');
  });

  it('startOfToday/endOfToday bound the local day', () => {
    const now = Date.now();
    const start = startOfToday();
    const end = endOfToday();
    expect(start).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 6, 15, 23, 59, 59, 999).getTime());
    expect(start).toBeLessThanOrEqual(now);
    expect(end).toBeGreaterThanOrEqual(now);
  });

  it('startOfDay/endOfDay operate on any date', () => {
    const base = new Date(2026, 6, 20, 7, 15, 0).getTime();
    expect(startOfDay(base)).toBe(new Date(2026, 6, 20, 0, 0, 0, 0).getTime());
    expect(endOfDay(base)).toBe(new Date(2026, 6, 20, 23, 59, 59, 999).getTime());
  });

  it('isToday and isSameDay compare on local calendar date', () => {
    const today = new Date(2026, 6, 15, 9, 0).getTime();
    const tomorrow = new Date(2026, 6, 16, 9, 0).getTime();
    expect(isToday(today)).toBe(true);
    expect(isToday(tomorrow)).toBe(false);
    expect(isToday(new Date(2026, 6, 15, 9, 0).toISOString())).toBe(true);
    expect(isSameDay(today, new Date(2026, 6, 15, 23, 0).getTime())).toBe(true);
    expect(isSameDay(today, tomorrow)).toBe(false);
  });

  it('dayKey groups a timestamp into a local date string', () => {
    expect(dayKey(new Date(2026, 6, 3, 22, 45).getTime())).toBe('2026-07-03');
    expect(dayKey(new Date(2026, 11, 31, 0, 0).toISOString())).toBe('2026-12-31');
  });

  it('isThisWeek and getWeekStart use the Sunday-start week', () => {
    const weekStart = new Date(2026, 6, 12, 0, 0, 0, 0).getTime(); // Sunday
    expect(getWeekStart()).toBe(weekStart);
    expect(isThisWeek(new Date(2026, 6, 13, 12, 0).getTime())).toBe(true);
    expect(isThisWeek(new Date(2026, 6, 15, 12, 0).getTime())).toBe(true);
    expect(isThisWeek(new Date(2026, 6, 11, 23, 0).getTime())).toBe(false); // last Saturday
  });

  it('getWeekDays returns the trailing 7-day window', () => {
    const days = getWeekDays();
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(new Date(2026, 6, 15, 12, 0).toLocaleDateString('en-US', { weekday: 'short' }));
  });
});

describe('splitSessionAcrossMidnight', () => {
  it('returns a single bucket for sessions within one day', () => {
    const start = new Date(2026, 6, 15, 10, 0).getTime();
    const end = new Date(2026, 6, 15, 12, 0).getTime();
    const buckets = splitSessionAcrossMidnight(start, end, 7_200_000);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].dateKey).toBe('2026-07-15');
    expect(buckets[0].activeMs).toBe(7_200_000);
  });

  it('returns no buckets for degenerate sessions', () => {
    const start = new Date(2026, 6, 15, 10, 0).getTime();
    expect(splitSessionAcrossMidnight(start, start, 1_000)).toEqual([]);
    expect(splitSessionAcrossMidnight(start, start + 1_000, 0)).toEqual([]);
  });

  it('splits a cross-midnight session across both days and preserves active time', () => {
    const start = new Date(2026, 6, 15, 23, 0).getTime();
    const end = new Date(2026, 6, 16, 1, 0).getTime();
    const buckets = splitSessionAcrossMidnight(start, end, 7_200_000);
    expect(buckets.map((b) => b.dateKey)).toEqual(['2026-07-15', '2026-07-16']);
    const total = buckets.reduce((sum, b) => sum + b.activeMs, 0);
    expect(total).toBe(7_200_000);
    expect(buckets[0].activeMs).toBeGreaterThan(0);
    expect(buckets[1].activeMs).toBeGreaterThan(0);
  });
});

describe('date formatting', () => {
  it('formats full and short dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    expect(formatDate(new Date(2026, 6, 26))).toBe('Jul 26, 2026');
    expect(formatDateShort(new Date(2026, 6, 26))).toMatch(/Sun, Jul 26/);
  });
});

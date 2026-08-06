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
  formatDateShortInTz,
  getTodayKey,
  dayKeyInTz,
  getOffsetMs,
  localDateToUtc,
  startOfDayInTz,
  daysBetweenKeys,
  addDaysToKey,
  getIsoWeekStartKey,
  getIsoWeekEndKey,
  startOfIsoWeekInTz,
  endOfIsoWeekInTz,
  hourOfDayInTz,
  weekdayInTz,
  getTimezone,
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

  it('classifies overdue deadlines (calendar-day semantics)', () => {
    const tz = 'UTC';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(getDeadlineStatus(Date.parse('2026-07-14T23:00:00Z'), tz)?.status).toBe('overdue');
    expect(getDeadlineStatus(Date.parse('2026-07-13T00:00:00Z'), tz)?.label).toBe('Overdue by 2 days');
    expect(isOverdue(Date.parse('2026-07-14T23:59:59Z'), tz)).toBe(true);
    // An instant earlier on the due day itself is NOT overdue
    expect(isOverdue(Date.parse('2026-07-15T00:00:00Z'), tz)).toBe(false);
  });

  it('classifies due-today, due-soon and upcoming deadlines', () => {
    const tz = 'UTC';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(getDeadlineStatus(Date.parse('2026-07-15T23:00:00Z'), tz)?.status).toBe('due-today');
    expect(isDueToday(Date.parse('2026-07-15T00:00:00Z'), tz)).toBe(true);
    expect(getDeadlineStatus(Date.parse('2026-07-16T00:00:00Z'), tz)?.status).toBe('due-soon');
    expect(getDeadlineStatus(Date.parse('2026-07-17T00:00:00Z'), tz)?.label).toBe('Due in 2 days');
    expect(getDeadlineStatus(Date.parse('2026-07-18T00:00:00Z'), tz)?.label).toBe('Due in 3 days');
    expect(getDeadlineStatus(Date.parse('2026-07-19T00:00:00Z'), tz)?.status).toBe('upcoming');
  });

  it('never drifts across timezones (deadline day is stable in any tz)', () => {
    const tz = 'America/New_York';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    // Old UTC-midnight storage read back in a negative-offset tz used to land
    // on the previous day; day-key comparison keeps the picked date.
    const deadline = localDateToUtc('2026-07-15', tz); // tz-midnight of the due day
    expect(isDueToday(deadline, tz)).toBe(true);
    expect(isOverdue(deadline, tz)).toBe(false);
  });
});

describe('timezone-aware day keys', () => {
  it('dayKeyInTz groups by the given timezone', () => {
    expect(dayKeyInTz(Date.parse('2026-07-10T00:00:00Z'), 'Asia/Kolkata')).toBe('2026-07-10');
    expect(dayKeyInTz(Date.parse('2026-07-10T00:00:00Z'), 'America/New_York')).toBe('2026-07-09');
    expect(dayKeyInTz(Date.parse('2026-07-10T23:30:00Z'), 'Asia/Kolkata')).toBe('2026-07-11');
  });

  it('getTodayKey reflects the requested timezone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(getTodayKey('UTC')).toBe('2026-07-15');
    expect(getTodayKey('Asia/Kolkata')).toBe('2026-07-15');
    expect(getTodayKey('America/New_York')).toBe('2026-07-15');
    vi.setSystemTime(new Date('2026-07-15T23:30:00Z'));
    expect(getTodayKey('America/New_York')).toBe('2026-07-15');
    expect(getTodayKey('Asia/Kolkata')).toBe('2026-07-16');
  });

  it('getOffsetMs matches the tz offset at a given instant', () => {
    const summer = Date.parse('2026-07-10T00:00:00Z');
    const winter = Date.parse('2026-01-10T00:00:00Z');
    expect(getOffsetMs(summer, 'UTC')).toBe(0);
    expect(getOffsetMs(summer, 'Asia/Kolkata')).toBe(5.5 * 3600000);
    expect(getOffsetMs(winter, 'America/New_York')).toBe(-5 * 3600000);
  });

  it('localDateToUtc round-trips through dayKeyInTz in any timezone', () => {
    for (const tz of ['UTC', 'Asia/Kolkata', 'America/New_York']) {
      const key = '2026-08-05';
      const instant = localDateToUtc(key, tz);
      expect(dayKeyInTz(instant, tz)).toBe(key);
    }
  });

  it('startOfDayInTz returns the tz-midnight of the day a timestamp falls in', () => {
    const tz = 'Asia/Kolkata';
    const ts = Date.parse('2026-07-10T05:30:00Z');
    expect(startOfDayInTz(ts, tz)).toBe(localDateToUtc('2026-07-10', tz));
    expect(startOfDayInTz(ts, tz)).toBeLessThanOrEqual(ts);
  });

  it('daysBetweenKeys counts whole calendar days', () => {
    expect(daysBetweenKeys('2026-07-15', '2026-07-15')).toBe(0);
    expect(daysBetweenKeys('2026-07-15', '2026-07-16')).toBe(1);
    expect(daysBetweenKeys('2026-07-15', '2026-07-13')).toBe(-2);
    expect(daysBetweenKeys('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('getTimezone falls back to the browser timezone without a profile cache', () => {
    try { localStorage.removeItem('ff_profile_cache'); } catch { /* ignore */ }
    expect(getTimezone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
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

describe('ISO week helpers (IES-P1-19)', () => {
  it('addDaysToKey shifts calendar dates across month/year boundaries', () => {
    expect(addDaysToKey('2026-07-15', -7)).toBe('2026-07-08');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('getIsoWeekStartKey returns the Monday of the current week (Mon–Sun)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z')); // Wednesday
    expect(getIsoWeekStartKey('UTC')).toBe('2026-07-13');
    expect(getIsoWeekEndKey('UTC')).toBe('2026-07-19');
    vi.setSystemTime(new Date('2026-07-19T12:00:00Z')); // Sunday — still this week
    expect(getIsoWeekStartKey('UTC')).toBe('2026-07-13');
    vi.setSystemTime(new Date('2026-07-20T00:00:00Z')); // Monday — new week
    expect(getIsoWeekStartKey('UTC')).toBe('2026-07-20');
  });

  it('startOfIsoWeekInTz/endOfIsoWeekInTz bound the ISO week at tz midnight', () => {
    const wed = Date.parse('2026-08-05T12:00:00Z'); // Wed Aug 5 2026
    expect(startOfIsoWeekInTz(wed, 'UTC')).toBe(Date.UTC(2026, 7, 3));
    expect(endOfIsoWeekInTz(wed, 'UTC')).toBe(Date.UTC(2026, 7, 9, 23, 59, 59, 999));
  });

  it('week boundaries respect the user timezone, not the instant', () => {
    // Aug 5 18:30Z is Aug 6 00:00 in Kolkata — a Thursday of the same ISO week.
    const instant = Date.parse('2026-08-05T18:30:00Z');
    expect(startOfIsoWeekInTz(instant, 'Asia/Kolkata')).toBe(localDateToUtc('2026-08-03', 'Asia/Kolkata'));
    expect(endOfIsoWeekInTz(instant, 'Asia/Kolkata')).toBe(localDateToUtc('2026-08-09', 'Asia/Kolkata') + 86400000 - 1);
    // The same instant is still Wednesday evening in New York — same week start.
    expect(startOfIsoWeekInTz(instant, 'America/New_York')).toBe(localDateToUtc('2026-08-03', 'America/New_York'));
  });
});

describe('date formatting', () => {
  it('formats full and short dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    expect(formatDate(new Date(2026, 6, 26))).toBe('Jul 26, 2026');
    expect(formatDateShort(new Date(2026, 6, 26))).toMatch(/Sun, Jul 26/);
  });

  it('formatDateShortInTz labels the calendar date in the given timezone', () => {
    // 2026-08-09 23:59:59Z is already Monday in Kolkata but still Sunday in UTC.
    const instant = Date.parse('2026-08-09T23:59:59Z');
    expect(formatDateShortInTz(instant, 'UTC')).toBe('Sun, Aug 9');
    expect(formatDateShortInTz(instant, 'Asia/Kolkata')).toBe('Mon, Aug 10');
    expect(formatDateShortInTz(instant, 'America/New_York')).toBe('Sun, Aug 9');
  });

  it('hourOfDayInTz returns the wall-clock hour in the given timezone', () => {
    expect(hourOfDayInTz('2026-08-05T03:30:00Z', 'UTC')).toBe(3);
    expect(hourOfDayInTz('2026-08-05T03:30:00Z', 'Asia/Kolkata')).toBe(9); // 03:30Z = 09:00 IST
    expect(hourOfDayInTz('2026-08-05T23:30:00Z', 'Asia/Kolkata')).toBe(5); // Aug 6 05:00 IST
    expect(hourOfDayInTz('2026-08-05T23:30:00Z', 'America/New_York')).toBe(19); // EDT evening
  });

  it('weekdayInTz names the calendar day in the given timezone', () => {
    expect(weekdayInTz('2026-08-05T18:30:00Z', 'UTC')).toBe('Wed');
    expect(weekdayInTz('2026-08-05T18:30:00Z', 'Asia/Kolkata')).toBe('Thu'); // Aug 6 IST
    expect(weekdayInTz('2026-08-09T23:59:00Z', 'America/New_York')).toBe('Sun');
  });
});

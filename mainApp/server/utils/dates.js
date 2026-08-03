// IES-P1-02 / IES-P1-06: single timezone-aware day-key implementation.
//
// All calendar-day logic (worklog sync, reports, streaks) must derive the
// "YYYY-MM-DD" day key from the user's timezone here — never from server-local
// or UTC date parsing. `localDateToUtc` encodes a local day as a UTC-midnight
// instant so it round-trips through `dayKey` in the same timezone.
'use strict';

// IES-P1-27: shared session-time bounds. `sessionTime.js` derives from these so
// the clock-skew tolerance and 24h recency window live in exactly one place.
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

function dayKey(ts, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts));
}

function getOffsetMs(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour === '24' ? '0' : values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

// Encode a local calendar day (YYYY-MM-DD) as a UTC-midnight Date.
function localDateToUtc(dateKey, timeZone) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(utcGuess.getTime() - getOffsetMs(utcGuess, timeZone));
}

// Candidate day keys an existing workEntry `date` may represent: the tz-aware
// midnight encoding (`localDateToUtc`) and the legacy UTC-midnight encoding.
function entryDayKey(entry, timeZone) {
  const raw = entry && entry.date;
  const ts = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  if (!Number.isFinite(ts)) return null;
  return {
    tzKey: dayKey(ts, timeZone),
    isoKey: new Date(ts).toISOString().slice(0, 10),
  };
}

// IES-P1-06: single source for the user's calendar timezone.
function userTimezone(user) {
  return user?.settings?.timezone || 'UTC';
}

// IES-P1-14: true when a millisecond timestamp (number or Date) falls inside
// the half-open local-day range [start, end). Shared by day reports so the
// completed-item and work-entry attribution use one range check.
function tsInDayRange(ts, start, end) {
  const t = ts instanceof Date ? ts.getTime() : Number(ts);
  return Number.isFinite(t) && t >= start.getTime() && t < end.getTime();
}

module.exports = {
  dayKey,
  getOffsetMs,
  localDateToUtc,
  entryDayKey,
  userTimezone,
  tsInDayRange,
  FUTURE_SKEW_MS,
  MAX_SESSION_AGE_MS,
};

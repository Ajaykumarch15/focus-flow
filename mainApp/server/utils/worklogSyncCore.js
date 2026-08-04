// IES-P1-02: pure timezone-aware session→work-entry computation.
//
// No mongoose imports — safe to load from migrations and unit tests.
'use strict';

const { dayKey, localDateToUtc, entryDayKey } = require('./dates');

/**
 * Effective active milliseconds a session contributes at `now`. Live sessions
 * count running elapsed time; stopped sessions use their recorded activeTime.
 * @param {object} session
 * @param {number} [now]
 * @returns {number}
 */
function sessionActiveMs(session, now = Date.now()) {
  if (!session.isActive) return session.activeTime || 0;
  const lastPause = session.pauseLog?.length
    ? session.pauseLog[session.pauseLog.length - 1]
    : null;
  const isPaused = lastPause && !lastPause.resumeTime;
  const cutoff = isPaused ? lastPause.pauseStart : now;
  return Math.max(0, cutoff - session.startTime - (session.totalPauseDuration || 0));
}

/**
 * Pure: aggregate sessions into per-local-day work entries (one per day) with
 * summed activeMs and earliest/latest bounds. Deterministic (sorted by day key).
 * @param {Array<object>} sessions
 * @param {string} timeZone
 * @param {number} [now]
 * @returns {Array<{date: Date, activeMs: number, startedAt: number, endedAt: number, sessionIds: Array, _dayKey: string}>}
 */
function buildEffectiveWorkEntries(sessions, timeZone = 'UTC', now = Date.now()) {
  const grouped = new Map();
  for (const session of sessions) {
    const activeMs = sessionActiveMs(session, now);
    if (activeMs <= 0) continue;
    const key = dayKey(session.startTime, timeZone);
    const existing = grouped.get(key) || {
      date: localDateToUtc(key, timeZone),
      activeMs: 0,
      startedAt: session.startTime,
      endedAt: session.endTime || session.startTime,
      sessionIds: [],
      _dayKey: key,
    };
    existing.activeMs += activeMs;
    existing.startedAt = Math.min(existing.startedAt, session.startTime);
    existing.endedAt = Math.max(existing.endedAt, session.endTime || now);
    existing.sessionIds.push(session._id);
    grouped.set(key, existing);
  }
  return Array.from(grouped.values()).sort((a, b) => (a._dayKey < b._dayKey ? -1 : 1));
}

/**
 * Pure: merge effective entries into a log's workEntries. Days with session time
 * survive (preserving user `what` and sub-document `_id`); stale days are
 * dropped because sessions are the single source of truth.
 * @returns {{ workEntries: Array, totalActiveMs: number }}
 */
function applyEffectiveWorkEntries(log, sessions, timeZone = 'UTC', now = Date.now()) {
  const effective = buildEffectiveWorkEntries(sessions, timeZone, now);
  const byKey = new Map(effective.map(e => [e._dayKey, e]));
  const previous = new Map();
  for (const entry of log.workEntries || []) {
    const key = entryDayKey(entry, timeZone);
    const matchKey =
      key && (byKey.has(key.tzKey) ? key.tzKey : byKey.has(key.isoKey) ? key.isoKey : null);
    if (matchKey) previous.set(matchKey, { what: entry.what || '', _id: entry._id });
  }
  const workEntries = effective.map(({ _dayKey, ...entry }) => {
    const prev = previous.get(_dayKey);
    return {
      ...entry,
      ...(prev && prev._id ? { _id: prev._id } : {}),
      what: prev ? prev.what : '',
    };
  });
  const totalActiveMs = workEntries.reduce((sum, e) => sum + (e.activeMs || 0), 0);
  return { workEntries, totalActiveMs };
}

module.exports = {
  sessionActiveMs,
  buildEffectiveWorkEntries,
  applyEffectiveWorkEntries,
};

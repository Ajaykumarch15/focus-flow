const express = require('express');
const crypto = require('crypto');
const WorkLog = require('../models/WorkLog');
const Session = require('../models/Session');
const User = require('../models/User');
const ReportShare = require('../models/ReportShare');
const protect = require('../middleware/auth');
const { z, dateKey, intInRange, validate } = require('../utils/validation');
// IES-P1-27: tz helpers are shared from `utils/dates.js` — no local copies.
const { tsInDayRange, getOffsetMs, localDateToUtc, dayKey, userTimezone } = require('../utils/dates');
const router = express.Router();

// IES-P0-16: body/param/query schemas.
const shareCreateSchema = z.object({
  date: dateKey,
  expiresInDays: intInRange(1, 365, 'expiresInDays').optional(),
});
const shareTokenParamsSchema = z.object({ token: z.string().min(1, 'Token is required').max(200, 'Token too long') });
const dayQuerySchema = z.object({ date: dateKey.optional() });

function dayRange(dateStr, timeZone = 'UTC') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
  const start = localDateToUtc(dateStr, timeZone);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function isValidDateKey(dateStr) {
  return typeof dateStr === 'string' && !!dayRange(dateStr);
}

function sanitizeWorkLog(log) {
  return {
    _id: log._id,
    title: log.title,
    problem: log.problem,
    gitBranch: log.gitBranch,
    currentWork: log.currentWork,
    plan: log.plan,
    designNotes: log.designNotes,
    blockers: log.blockers,
    completedItems: log.completedItems,
    links: log.links,
    status: log.status,
    mood: log.mood,
    tags: log.tags,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

// IES-P1-14: completed items carry millisecond timestamps; an item is attributed
// to the day it was completed (completedAt, falling back to createdAt).
function completedItemTimestamp(item) {
  if (!item) return null;
  return item.completedAt || item.createdAt || null;
}

// IES-P1-14: count completed items whose timestamp falls inside one local day.
function countCompletedItemsInRange(workLogs, start, end) {
  let count = 0;
  for (const log of workLogs || []) {
    for (const item of log.completedItems || []) {
      if (tsInDayRange(completedItemTimestamp(item), start, end)) count += 1;
    }
  }
  return count;
}

async function buildDayReport(userId, date, timeZone, includeSessionDetails = true) {
  const range = dayRange(date, timeZone);
  if (!range) {
    const err = new Error('Invalid report date');
    err.status = 400;
    throw err;
  }

  const { start, end } = range;
  const [sessions, workLogs] = await Promise.all([
    Session.find({
      userId,
      startTime: { $gte: start.getTime(), $lt: end.getTime() },
      isActive: false,
    }).populate('taskId', 'title color category priority'),
    WorkLog.find({
      userId,
      $or: [
        { createdAt: { $gte: start, $lt: end } },
        { updatedAt: { $gte: start, $lt: end } },
        { 'workEntries.date': { $gte: start, $lt: end } },
      ],
    }).sort({ updatedAt: -1 }),
  ]);

  const taskMap = {};

  for (const session of sessions) {
    const task = session.taskId;
    const tid = task?._id?.toString() || 'unknown';
    if (!taskMap[tid]) {
      taskMap[tid] = {
        taskId: tid,
        title: task?.title || 'Deleted task',
        color: task?.color || '#6b7280',
        category: task?.category || 'Other',
        priority: task?.priority || 'medium',
        totalMs: 0,
        sessionCount: 0,
        sessions: [],
      };
    }

    taskMap[tid].totalMs += session.activeTime || 0;
    taskMap[tid].sessionCount += 1;
    if (includeSessionDetails) {
      taskMap[tid].sessions.push({
        _id: session._id,
        startTime: session.startTime,
        endTime: session.endTime,
        activeTime: session.activeTime,
        totalPauseDuration: session.totalPauseDuration,
      });
    }
  }

  // IES-P1-14: the report total is reconciled with the unified-sync work entries
  // (IES-P1-02) — the worklog view is the source of truth, so the report matches
  // what the worklog page shows. Sessions are the fallback only when a day has
  // no persisted entries yet (e.g. legacy data). The per-task breakdown above
  // stays session-derived (same attribution: each session belongs to the local
  // day of its startTime), keeping both views in lock-step.
  let totalMs = 0;
  for (const log of workLogs) {
    for (const entry of log.workEntries || []) {
      if (tsInDayRange(entry.date, start, end)) totalMs += entry.activeMs || 0;
    }
  }
  if (totalMs === 0) {
    for (const session of sessions) totalMs += session.activeTime || 0;
  }

  return {
    date,
    totalMs,
    totalHours: Math.round(totalMs / 3600000 * 10) / 10,
    tasks: Object.values(taskMap).sort((a, b) => b.totalMs - a.totalMs),
    workLogs: workLogs.map(sanitizeWorkLog),
    sessionCount: sessions.length,
    workLogCount: workLogs.length,
    completedCount: countCompletedItemsInRange(workLogs, start, end),
    branches: [...new Set(workLogs.map(log => log.gitBranch).filter(Boolean))],
  };
}

// IES-P1-17: shared by GET /summary (own data) and the admin per-user summary —
// one day-window resolution + one per-day aggregation so the two endpoints can
// never drift. Defaults to the trailing 30 local days when from/to are absent.
function resolveSummaryRange(query, timeZone) {
  const today = dayKey(Date.now(), timeZone);
  const fromKey = isValidDateKey(query.from)
    ? query.from
    : (() => {
      const d = localDateToUtc(today, timeZone);
      d.setUTCDate(d.getUTCDate() - 29);
      return dayKey(d.getTime(), timeZone);
    })();
  const toKey = isValidDateKey(query.to) ? query.to : today;
  return { fromKey, toKey };
}

// IES-P1-17: per-day summary array for one user over [fromKey, toKey] (local
// timezone). Includes the IES-P1-14 completed-item-per-day attribution; the old
// admin copy of this loop added `completedItems.length` per log/day instead.
async function buildSummaryDays({ userId, fromKey, toKey, timeZone }) {
  const from = dayRange(fromKey, timeZone).start;
  const to = dayRange(toKey, timeZone).end;

  const [sessions, workLogs] = await Promise.all([
    Session.find({
      userId,
      startTime: { $gte: from.getTime(), $lt: to.getTime() },
      isActive: false,
    }).populate('taskId', 'title color category'),
    WorkLog.find({
      userId,
      $or: [
        { createdAt: { $gte: from, $lt: to } },
        { updatedAt: { $gte: from, $lt: to } },
        { 'workEntries.date': { $gte: from, $lt: to } },
      ],
    }),
  ]);

  const dayMap = {};
  for (const session of sessions) {
    const day = dayKey(session.startTime, timeZone);
    if (!dayMap[day]) {
      dayMap[day] = { date: day, totalMs: 0, sessionCount: 0, taskIds: new Set(), workLogCount: 0, completedCount: 0 };
    }
    dayMap[day].totalMs += session.activeTime || 0;
    dayMap[day].sessionCount += 1;
    if (session.taskId) dayMap[day].taskIds.add(session.taskId._id?.toString());
  }

  for (const log of workLogs) {
    const entryDays = (log.workEntries || [])
      .filter(entry => entry.date >= from && entry.date < to)
      .map(entry => dayKey(entry.date.getTime(), timeZone));
    const days = entryDays.length > 0 ? [...new Set(entryDays)] : [dayKey(log.updatedAt.getTime(), timeZone)];

    for (const day of days) {
      if (!dayMap[day]) {
        dayMap[day] = { date: day, totalMs: 0, sessionCount: 0, taskIds: new Set(), workLogCount: 0, completedCount: 0 };
      }
      dayMap[day].workLogCount += 1;
    }

    // IES-P1-14: completed items are attributed to the day they were
    // completed, not to every day the log happens to appear in the range.
    for (const item of log.completedItems || []) {
      const ts = completedItemTimestamp(item);
      if (!tsInDayRange(ts, from, to)) continue;
      const day = dayKey(ts, timeZone);
      if (!dayMap[day]) {
        dayMap[day] = { date: day, totalMs: 0, sessionCount: 0, taskIds: new Set(), workLogCount: 0, completedCount: 0 };
      }
      dayMap[day].completedCount += 1;
    }
  }

  return Object.values(dayMap).map(day => ({
    date: day.date,
    totalMs: day.totalMs,
    totalHours: Math.round(day.totalMs / 3600000 * 10) / 10,
    sessionCount: day.sessionCount,
    taskCount: day.taskIds.size,
    workLogCount: day.workLogCount,
    completedCount: day.completedCount,
  }));
}

router.get('/summary', protect, async (req, res, next) => {
  try {
    const timeZone = userTimezone(req.user);
    const { fromKey, toKey } = resolveSummaryRange(req.query, timeZone);
    res.json(await buildSummaryDays({ userId: req.user._id, fromKey, toKey, timeZone }));
  } catch (err) {
    next(err);
  }
});

router.get('/day', protect, validate(null, { query: dayQuerySchema }), async (req, res, next) => {
  try {
    const requestedDate = req.query.date || dayKey(Date.now(), userTimezone(req.user));
    if (!isValidDateKey(requestedDate)) {
      return res.status(400).json({ message: 'Invalid report date' });
    }
    res.json(await buildDayReport(req.user._id, requestedDate, userTimezone(req.user)));
  } catch (err) {
    next(err);
  }
});

// ── Share routes ────────────────────────────────────────────────────────────
// IES-P1-15 · Route ordering is explicit — distinct prefixes keep the share
// paths unambiguous and order-independent:
//   POST /share                 create a token-gated share (auth)
//   POST /share/:token/revoke   revoke a share (auth)
//   GET  /share/token/:token    public token-gated render (no auth)
// The legacy unauthenticated GET /share/:userId/:date was deleted in IES-P0-02
// and must never be reintroduced; ALL public share access goes through the
// reserved /share/token/ prefix. Share bodies are private, so every handler
// below sets `Cache-Control: no-store` to stop proxies/browsers from caching
// (a revoked share must not keep rendering from cache).
router.post('/share', protect, validate(shareCreateSchema), async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const { date } = req.body;
    if (!isValidDateKey(date)) {
      return res.status(400).json({ message: 'Invalid report date' });
    }

    // IES-P1-13: `expiresInDays` is validated to 1..365 by the schema (or
    // defaults to 30), so `expiresAt` is always present and bounded. The
    // `Math.min` cap is belt-and-suspenders against future schema drift.
    const expiresInDays = req.body.expiresInDays ?? 30;
    const expiresAt = new Date(Date.now() + Math.min(expiresInDays, 365) * 86400000);
    const share = await ReportShare.create({
      token: crypto.randomBytes(24).toString('base64url'),
      userId: req.user._id,
      date,
      expiresAt,
    });

    res.status(201).json({
      token: share.token,
      date: share.date,
      expiresAt: share.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/share/:token/revoke', protect, validate(null, { params: shareTokenParamsSchema }), async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const share = await ReportShare.findOneAndUpdate(
      { token: req.params.token, userId: req.user._id, revokedAt: null },
      { revokedAt: new Date() },
      { new: true }
    );
    if (!share) return res.status(404).json({ message: 'Share link not found' });
    res.json({ message: 'Share link revoked' });
  } catch (err) {
    next(err);
  }
});

router.get('/share/token/:token', validate(null, { params: shareTokenParamsSchema }), async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const share = await ReportShare.findOne({ token: req.params.token });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt.getTime() < Date.now())) {
      return res.status(404).json({ message: 'Share link expired or revoked' });
    }

    const user = await User.findById(share.userId).select('name settings');
    // IES-P1-23: a soft-deleted owner's shares never render — their ReportShare
    // docs are also revoked by the delete cascade, but the per-share check keeps
    // stale/legacy shares inert even if that cascade was skipped.
    if (!user || user.deletedAt) return res.status(404).json({ message: 'User not found' });

    const report = await buildDayReport(share.userId, share.date, userTimezone(user), false);
    res.json({
      intern: user.name,
      share: { token: share.token, expiresAt: share.expiresAt },
      ...report,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/leaderboard ───────────────────────────────────────────
router.get('/leaderboard', protect, async (req, res, next) => {
  try {
    // IES-P1-04: `deletedAt: null` lets the partial index
    // `{ leaderboardOptIn, totalPoints }` serve this query (also drops deleted users).
    const topUsers = await User.find({ leaderboardOptIn: true, deletedAt: null })
      .select('name avatar totalPoints streak')
      .sort({ totalPoints: -1 })
      .limit(10);
    res.json(topUsers);
  } catch (err) {
    next(err);
  }
});

router.helpers = {
  buildDayReport,
  buildSummaryDays,
  resolveSummaryRange,
  userTimezone,
  dayKey,
  isValidDateKey,
  localDateToUtc,
  dayRange,
};

module.exports = router;

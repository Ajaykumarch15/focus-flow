const express = require('express');
const crypto = require('crypto');
const WorkLog = require('../models/WorkLog');
const Session = require('../models/Session');
const User = require('../models/User');
const ReportShare = require('../models/ReportShare');
const protect = require('../middleware/auth');

const router = express.Router();

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

function localDateToUtc(dateStr, timeZone = 'UTC') {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(utcGuess.getTime() - getOffsetMs(utcGuess, timeZone));
}

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

function userTimezone(user) {
  return user?.settings?.timezone || 'UTC';
}

function dayKey(ts, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts));
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
  let totalMs = 0;

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
    totalMs += session.activeTime || 0;
  }

  return {
    date,
    totalMs,
    totalHours: Math.round(totalMs / 3600000 * 10) / 10,
    tasks: Object.values(taskMap).sort((a, b) => b.totalMs - a.totalMs),
    workLogs: workLogs.map(sanitizeWorkLog),
    sessionCount: sessions.length,
    workLogCount: workLogs.length,
    completedCount: workLogs.reduce((a, log) => a + log.completedItems.length, 0),
    branches: [...new Set(workLogs.map(log => log.gitBranch).filter(Boolean))],
  };
}

router.get('/summary', protect, async (req, res, next) => {
  try {
    const timeZone = userTimezone(req.user);
    const today = dayKey(Date.now(), timeZone);
    const fromKey = isValidDateKey(req.query.from)
      ? req.query.from
      : (() => {
        const d = localDateToUtc(today, timeZone);
        d.setUTCDate(d.getUTCDate() - 29);
        return dayKey(d.getTime(), timeZone);
      })();
    const toKey = isValidDateKey(req.query.to) ? req.query.to : today;
    const from = dayRange(fromKey, timeZone).start;
    const to = dayRange(toKey, timeZone).end;

    const [sessions, workLogs] = await Promise.all([
      Session.find({
        userId: req.user._id,
        startTime: { $gte: from.getTime(), $lt: to.getTime() },
        isActive: false,
      }).populate('taskId', 'title color category'),
      WorkLog.find({
        userId: req.user._id,
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
        dayMap[day].completedCount += log.completedItems.length;
      }
    }

    res.json(Object.values(dayMap).map(day => ({
      date: day.date,
      totalMs: day.totalMs,
      totalHours: Math.round(day.totalMs / 3600000 * 10) / 10,
      sessionCount: day.sessionCount,
      taskCount: day.taskIds.size,
      workLogCount: day.workLogCount,
      completedCount: day.completedCount,
    })));
  } catch (err) {
    console.error('GET /reports/summary error:', err);
    next(err);
  }
});

router.get('/day', protect, async (req, res, next) => {
  try {
    const requestedDate = req.query.date || dayKey(Date.now(), userTimezone(req.user));
    if (!isValidDateKey(requestedDate)) {
      return res.status(400).json({ message: 'Invalid report date' });
    }
    res.json(await buildDayReport(req.user._id, requestedDate, userTimezone(req.user)));
  } catch (err) {
    console.error('GET /reports/day error:', err);
    next(err);
  }
});

router.post('/share', protect, async (req, res, next) => {
  try {
    const { date } = req.body;
    if (!isValidDateKey(date)) {
      return res.status(400).json({ message: 'Invalid report date' });
    }

    const expiresInDays = Number(req.body.expiresInDays || 30);
    const expiresAt = Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + Math.min(expiresInDays, 365) * 86400000)
      : undefined;
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
    console.error('POST /reports/share error:', err);
    next(err);
  }
});

router.post('/share/:token/revoke', protect, async (req, res, next) => {
  try {
    const share = await ReportShare.findOneAndUpdate(
      { token: req.params.token, userId: req.user._id, revokedAt: null },
      { revokedAt: new Date() },
      { new: true }
    );
    if (!share) return res.status(404).json({ message: 'Share link not found' });
    res.json({ message: 'Share link revoked' });
  } catch (err) {
    console.error('POST /reports/share/:token/revoke error:', err);
    next(err);
  }
});

router.get('/share/token/:token', async (req, res, next) => {
  try {
    const share = await ReportShare.findOne({ token: req.params.token });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt.getTime() < Date.now())) {
      return res.status(404).json({ message: 'Share link expired or revoked' });
    }

    const user = await User.findById(share.userId).select('name settings');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const report = await buildDayReport(share.userId, share.date, userTimezone(user), false);
    res.json({
      intern: user.name,
      share: { token: share.token, expiresAt: share.expiresAt },
      ...report,
    });
  } catch (err) {
    console.error('GET /reports/share/token error:', err);
    next(err);
  }
});

// ── GET /api/reports/leaderboard ───────────────────────────────────────────
router.get('/leaderboard', protect, async (req, res, next) => {
  try {
    const topUsers = await User.find({ leaderboardOptIn: true })
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
  userTimezone,
  dayKey,
  isValidDateKey,
  localDateToUtc,
  dayRange,
};

module.exports = router;

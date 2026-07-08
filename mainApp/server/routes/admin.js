const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const reportsRouter = require('./reports');
const { buildDayReport, userTimezone, dayKey, isValidDateKey, localDateToUtc, dayRange } = reportsRouter.helpers;

const router = express.Router();

// Apply protect and admin middleware to all routes in this router
router.use(protect);
router.use(admin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ts = today.getTime();

    const [users, activeSessions, todaySessions] = await Promise.all([
      User.countDocuments({}),
      Session.countDocuments({ isActive: true }),
      Session.find({ isActive: false, startTime: { $gte: ts } })
    ]);

    const todayTotalMs = todaySessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);

    res.json({
      totalUsers: users,
      activeUsers: activeSessions, // Number of people currently timing
      todayTotalMs,
      todaySessionCount: todaySessions.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/users/:userId/analytics ──────────────────────────────────
router.get('/users/:userId/analytics', async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to } = req.query;

    const query = { userId };
    const sessionQuery = { userId, isActive: false };
    const workLogQuery = { userId };

    if (from || to) {
      const dateRange = {};
      if (from) dateRange.$gte = Number(from);
      if (to)   dateRange.$lte = Number(to);
      
      sessionQuery.startTime = dateRange;
      // WorkLogs don't have a single startTime in the model usually, 
      // they have entries. But they have updatedAt.
      // Let's assume the user wants logs updated in this range.
      workLogQuery.updatedAt = {
        $gte: new Date(Number(from) || 0),
        $lte: new Date(Number(to) || Date.now())
      };
    }
    
    const [tasks, completedSessions, activeSessions, workLogs] = await Promise.all([
      Task.find({ userId }),
      Session.find({ ...sessionQuery, isActive: false }),
      Session.find({ userId, isActive: true }),
      WorkLog.find(workLogQuery).sort({ updatedAt: -1 })
    ]);

    // Calculate time from completed sessions
    let totalTimeMs = completedSessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);

    // ADD LIVE PROGRESS: Calculate current elapsed time for any active sessions
    const now = Date.now();
    activeSessions.forEach(s => {
      // Check if session falls within filter range
      if ((!from || s.startTime >= Number(from)) && (!to || s.startTime <= Number(to))) {
        // liveActive = now - startTime - totalPause
        const liveActive = Math.max(0, now - s.startTime - (s.totalPauseDuration || 0));
        totalTimeMs += liveActive;
      }
    });

    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    res.json({
      summary: {
        totalTasks: tasks.length,
        completedTasks,
        totalTimeMs,
        workLogCount: workLogs.length,
        sessionCount: completedSessions.length + activeSessions.length
      },
      tasks,
      sessions: [...completedSessions, ...activeSessions],
      workLogs
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/users/:userId/reports/summary ──────────────────────────────────
router.get('/users/:userId/reports/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const timeZone = userTimezone(user);
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
    console.error('GET /admin/users/:userId/reports/summary error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/users/:userId/reports/day ──────────────────────────────────────
router.get('/users/:userId/reports/day', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const requestedDate = req.query.date || dayKey(Date.now(), userTimezone(user));
    if (!isValidDateKey(requestedDate)) {
      return res.status(400).json({ message: 'Invalid report date' });
    }
    res.json(await buildDayReport(userId, requestedDate, userTimezone(user)));
  } catch (err) {
    console.error('GET /admin/users/:userId/reports/day error:', err);
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;

const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const reportsRouter = require('./reports');
const { buildDayReport, userTimezone, dayKey, isValidDateKey, localDateToUtc, dayRange } = reportsRouter.helpers;

const router = express.Router();

// Apply protect and admin middleware to all routes in this router
router.use(protect);
router.use(admin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
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
    next(err);
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const filter = req.query.includeDeleted ? {} : { deletedAt: null };
    const users = await User.find(filter).select('-googleTokens').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/deleted ─────────────────────────────────────────────
router.get('/users/deleted', async (req, res, next) => {
  try {
    const users = await User.find({ deletedAt: { $ne: null } }).select('-googleTokens').sort({ deletedAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/users/:userId ──────────────────────────────────────────
router.patch('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, email, role, settings } = req.body;

    const update = {};
    if (name !== undefined)  update.name = name;
    if (email !== undefined) update.email = email.toLowerCase().trim();
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      update.role = role;
    }
    if (settings !== undefined) update.settings = settings;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const ops = { $set: update };
    // Role change invalidates any previously-issued tokens (IES-P0-08).
    if (role !== undefined) ops.$inc = { tokenVersion: 1 };

    const user = await User.findByIdAndUpdate(userId, ops, { new: true, runValidators: true }).select('-googleTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
    const details = { targetUserId: userId, targetName: user.name };
    if (role !== undefined) {
      const oldUser = await User.findById(userId).select('role');
      details.oldRole = oldUser?.role;
      details.newRole = role;
      Activity.create({ userId: req.user._id, action: 'user.role_changed', details }).catch(() => {});
    } else {
      Activity.create({ userId: req.user._id, action: 'user.updated', details }).catch(() => {});
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    next(err);
  }
});

// ── DELETE /api/admin/users/:userId (soft delete) ───────────────────────────
router.delete('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndUpdate(
      userId,
      // Soft-delete also bumps tokenVersion so the deleted user's sessions die immediately.
      { $set: { deletedAt: new Date() }, $inc: { tokenVersion: 1 } },
      { new: true }
    ).select('-googleTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User soft-deleted', user });
    Activity.create({ userId: req.user._id, action: 'user.deleted', details: { targetUserId: userId, targetName: user.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/users/:userId/restore ────────────────────────────────────
router.post('/users/:userId/restore', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { deletedAt: null } },
      { new: true }
    ).select('-googleTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
    Activity.create({ userId: req.user._id, action: 'user.restored', details: { targetUserId: userId, targetName: user.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/:userId/analytics ──────────────────────────────────
router.get('/users/:userId/analytics', async (req, res, next) => {
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
    next(err);
  }
});

// ── GET /api/admin/users/:userId/reports/summary ──────────────────────────────────
router.get('/users/:userId/reports/summary', async (req, res, next) => {
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
    next(err);
  }
});

// ── GET /api/admin/users/:userId/reports/day ──────────────────────────────────────
router.get('/users/:userId/reports/day', async (req, res, next) => {
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
    next(err);
  }
});

// ── GET /api/admin/system-analytics ─────────────────────────────────────────
router.get('/system-analytics', async (req, res, next) => {
  try {
    const period = req.query.period || 'month';
    const now = Date.now();
    const periodMs = { week: 7 * 86400000, month: 30 * 86400000, quarter: 90 * 86400000 };
    const fromMs = now - (periodMs[period] || periodMs.month);

    const [totalUsers, newUsers, sessions, tasks, activeSessions] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({ deletedAt: null, createdAt: { $gte: new Date(fromMs) } }),
      Session.find({ startTime: { $gte: fromMs }, isActive: false }).select('userId activeTime focusScore startTime'),
      Task.find({ createdAt: { $gte: new Date(fromMs) } }).select('userId status category totalTime'),
      Session.find({ isActive: true }).select('userId startTime totalPauseDuration'),
    ]);

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalFocusMs = sessions.reduce((a, s) => a + (s.activeTime || 0), 0);
    const avgFocusScore = sessions.length > 0
      ? Math.round(sessions.reduce((a, s) => a + (s.focusScore || 0), 0) / sessions.length)
      : 0;
    const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const uniqueActiveUsers = new Set(sessions.map(s => s.userId.toString())).size;

    const now2 = Date.now();
    activeSessions.forEach(s => {
      const live = Math.max(0, now2 - s.startTime - (s.totalPauseDuration || 0));
      sessions.push({ activeTime: live, focusScore: 0, userId: s.userId });
    });

    const dailyMap = {};
    const thirtyDaysAgo = now - 30 * 86400000;
    for (const s of sessions) {
      if (!s.startTime || s.startTime < thirtyDaysAgo) continue;
      const d = new Date(s.startTime);
      if (isNaN(d.getTime())) continue;
      const dk = d.toISOString().slice(0, 10);
      if (!dailyMap[dk]) dailyMap[dk] = { date: dk, totalMs: 0, sessionCount: 0, activeUsers: new Set() };
      dailyMap[dk].totalMs += s.activeTime || 0;
      dailyMap[dk].sessionCount += 1;
      dailyMap[dk].activeUsers.add(s.userId.toString());
    }
    const dailyFocus = Object.values(dailyMap)
      .map(d => ({ ...d, activeUsers: d.activeUsers.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const categoryMap = {};
    for (const t of tasks) {
      const cat = t.category || 'Uncategorized';
      if (!categoryMap[cat]) categoryMap[cat] = { category: cat, totalTimeMs: 0, taskCount: 0 };
      categoryMap[cat].totalTimeMs += t.totalTime || 0;
      categoryMap[cat].taskCount += 1;
    }
    const topCategories = Object.values(categoryMap).sort((a, b) => b.totalTimeMs - a.totalTimeMs).slice(0, 10);

    const dailySignups = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      dailySignups[d] = 0;
    }
    const allNewUsers = await User.find({ createdAt: { $gte: new Date(thirtyDaysAgo) } }).select('createdAt');
    for (const u of allNewUsers) {
      if (!u.createdAt) continue;
      const d = u.createdAt.toISOString().slice(0, 10);
      if (dailySignups[d] !== undefined) dailySignups[d]++;
    }
    const userGrowth = Object.entries(dailySignups).map(([date, count]) => ({ date, count }));

    res.json({
      period,
      totalUsers,
      newUsers,
      activeUsers: uniqueActiveUsers,
      totalFocusMs,
      totalSessions: sessions.length,
      avgFocusScore,
      taskCompletionRate,
      totalTasks: tasks.length,
      completedTasks,
      dailyFocus,
      topCategories,
      userGrowth,
    });
  } catch (err) {
    console.error('GET /admin/system-analytics error:', err);
    next(err);
  }
});

// ── GET /api/admin/activity ─────────────────────────────────────────────────
router.get('/activity', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const query = {};
    if (req.query.before) query.createdAt = { $lt: new Date(req.query.before) };
    if (req.query.action) query.action = req.query.action;

    const activities = await Activity.find(query)
      .populate('userId', 'name email avatar role')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(activities);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

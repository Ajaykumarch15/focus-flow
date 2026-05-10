const express  = require('express');
const mongoose = require('mongoose');
const WorkLog  = require('../models/WorkLog');
const Session  = require('../models/Session');
const Task     = require('../models/Task');
const User     = require('../models/User');
const protect  = require('../middleware/auth');

const router = express.Router();

// ── Helper: build start/end of a given date ───────────────────────────────────
function dayRange(dateStr) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// ── GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD ───────────────────
// Returns per-day summary for the date range (for calendar heatmap)
router.get('/summary', protect, async (req, res) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d; })();

    const to = req.query.to
      ? new Date(req.query.to)
      : (() => { const d = new Date(); d.setHours(23,59,59,999); return d; })();

    const userId = req.user._id;

    // All sessions in range
    const sessions = await Session.find({
      userId,
      startTime: { $gte: from.getTime(), $lte: to.getTime() },
      isActive:  false,
    }).populate('taskId', 'title color category');

    // All work logs created or updated in range
    const workLogs = await WorkLog.find({
      userId,
      $or: [
        { createdAt: { $gte: from, $lte: to } },
        { updatedAt: { $gte: from, $lte: to } },
      ],
    });

    // Build day-keyed map
    const dayMap = {};

    const getDay = (ts) => new Date(ts).toISOString().split('T')[0];

    for (const session of sessions) {
      const day = getDay(session.startTime);
      if (!dayMap[day]) dayMap[day] = { date: day, totalMs: 0, sessionCount: 0, taskIds: new Set(), workLogCount: 0, completedCount: 0 };
      dayMap[day].totalMs      += session.activeTime;
      dayMap[day].sessionCount += 1;
      if (session.taskId) dayMap[day].taskIds.add(session.taskId._id?.toString());
    }

    for (const log of workLogs) {
      const day = getDay(log.updatedAt);
      if (!dayMap[day]) dayMap[day] = { date: day, totalMs: 0, sessionCount: 0, taskIds: new Set(), workLogCount: 0, completedCount: 0 };
      dayMap[day].workLogCount   += 1;
      dayMap[day].completedCount += log.completedItems.length;
    }

    // Serialize
    const summary = Object.values(dayMap).map(d => ({
      date:           d.date,
      totalMs:        d.totalMs,
      totalHours:     Math.round(d.totalMs / 3600000 * 10) / 10,
      sessionCount:   d.sessionCount,
      taskCount:      d.taskIds.size,
      workLogCount:   d.workLogCount,
      completedCount: d.completedCount,
    }));

    res.json(summary);
  } catch (err) {
    console.error('GET /reports/summary error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reports/day?date=YYYY-MM-DD ──────────────────────────────────────
// Full detail for a single day — used by "day detail" view and lead view
router.get('/day', protect, async (req, res) => {
  try {
    const { start, end } = dayRange(req.query.date || new Date().toISOString().split('T')[0]);
    const userId = req.user._id;

    // Sessions that started on this day
    const sessions = await Session.find({
      userId,
      startTime: { $gte: start.getTime(), $lt: end.getTime() },
    }).populate('taskId', 'title color category priority');

    // Work logs updated/created on this day
    const workLogs = await WorkLog.find({
      userId,
      $or: [
        { createdAt: { $gte: start, $lt: end } },
        { updatedAt: { $gte: start, $lt: end } },
      ],
    }).sort({ updatedAt: -1 });

    // Aggregate by task
    const taskMap = {};
    let totalMs = 0;

    for (const session of sessions) {
      const task = session.taskId;
      const tid  = task?._id?.toString() || 'unknown';
      if (!taskMap[tid]) {
        taskMap[tid] = {
          taskId:      tid,
          title:       task?.title    || 'Deleted task',
          color:       task?.color    || '#6b7280',
          category:    task?.category || 'Other',
          priority:    task?.priority || 'medium',
          totalMs:     0,
          sessions:    [],
        };
      }
      taskMap[tid].totalMs += session.activeTime;
      taskMap[tid].sessions.push({
        _id:                session._id,
        startTime:          session.startTime,
        endTime:            session.endTime,
        activeTime:         session.activeTime,
        totalPauseDuration: session.totalPauseDuration,
      });
      totalMs += session.activeTime;
    }

    res.json({
      date:          start.toISOString().split('T')[0],
      totalMs,
      totalHours:    Math.round(totalMs / 3600000 * 10) / 10,
      tasks:         Object.values(taskMap).sort((a, b) => b.totalMs - a.totalMs),
      workLogs:      workLogs.map(l => ({
        _id:            l._id,
        title:          l.title,
        problem:        l.problem,
        gitBranch:      l.gitBranch,
        currentWork:    l.currentWork,
        plan:           l.plan,
        designNotes:    l.designNotes,
        blockers:       l.blockers,
        completedItems: l.completedItems,
        links:          l.links,
        status:         l.status,
        mood:           l.mood,
        tags:           l.tags,
        createdAt:      l.createdAt,
        updatedAt:      l.updatedAt,
      })),
      sessionCount:  sessions.length,
      workLogCount:  workLogs.length,
      completedCount:workLogs.reduce((a, l) => a + l.completedItems.length, 0),
      branches:      [...new Set(workLogs.map(l => l.gitBranch).filter(Boolean))],
    });
  } catch (err) {
    console.error('GET /reports/day error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reports/share/:userId/:date ──────────────────────────────────────
// PUBLIC endpoint — no auth — lets a lead view a specific day's report
// Returns sanitized data (no private fields)
router.get('/share/:userId/:date', async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId.createFromHexString(req.params.userId);
    const { start, end } = dayRange(req.params.date);

    const [user, sessions, workLogs] = await Promise.all([
      User.findById(userId).select('name'),
      Session.find({
        userId,
        startTime: { $gte: start.getTime(), $lt: end.getTime() },
        isActive: false,
      }).populate('taskId', 'title color category'),
      WorkLog.find({
        userId,
        $or: [
          { createdAt: { $gte: start, $lt: end } },
          { updatedAt: { $gte: start, $lt: end } },
        ],
      }).sort({ updatedAt: -1 }),
    ]);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const taskMap = {};
    let totalMs = 0;
    for (const s of sessions) {
      const tid = s.taskId?._id?.toString() || 'x';
      if (!taskMap[tid]) taskMap[tid] = { title: s.taskId?.title || 'Task', color: s.taskId?.color || '#6b7280', category: s.taskId?.category, totalMs: 0, sessionCount: 0 };
      taskMap[tid].totalMs     += s.activeTime;
      taskMap[tid].sessionCount += 1;
      totalMs += s.activeTime;
    }

    res.json({
      intern:        user.name,
      date:          req.params.date,
      totalMs,
      totalHours:    Math.round(totalMs / 3600000 * 10) / 10,
      tasks:         Object.values(taskMap).sort((a, b) => b.totalMs - a.totalMs),
      workLogs:      workLogs.map(l => ({
        title:          l.title,
        problem:        l.problem,
        gitBranch:      l.gitBranch,
        currentWork:    l.currentWork,
        plan:           l.plan,
        designNotes:    l.designNotes,
        blockers:       l.blockers,
        completedItems: l.completedItems,
        links:          l.links,
        status:         l.status,
        mood:           l.mood,
        tags:           l.tags,
      })),
      branches:      [...new Set(workLogs.map(l => l.gitBranch).filter(Boolean))],
      completedCount:workLogs.reduce((a, l) => a + l.completedItems.length, 0),
    });
  } catch (err) {
    console.error('GET /reports/share error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');

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

module.exports = router;

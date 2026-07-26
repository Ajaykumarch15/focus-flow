const express = require('express');
const Session = require('../models/Session');
const Task    = require('../models/Task');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── GET /api/sessions — fetch sessions (optional ?taskId=, ?active=true) ──────
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.taskId) filter.taskId = req.query.taskId;
    if (req.query.active === 'true') filter.isActive = true;

    const sessions = await Session.find(filter).sort({ startTime: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/sessions — start a new session ──────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { taskId, startTime } = req.body;

    // Verify task belongs to user
    const task = await Task.findOne({ _id: taskId, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // The UI supports one active timer per user. Finalize any orphaned active
    // sessions before starting a new one so restore/reporting stays coherent.
    const orphanEndTime = Date.now();
    const orphanedSessions = await Session.find({ userId: req.user._id, isActive: true });
    const orphanedTaskIds = [...new Set(orphanedSessions.map(s => s.taskId.toString()))];
    await Promise.all(orphanedSessions.map(async (activeSession) => {
      const lastPause = [...activeSession.pauseLog].reverse().find(p => !p.resumeTime);
      if (lastPause) {
        lastPause.resumeTime = orphanEndTime;
        activeSession.totalPauseDuration += orphanEndTime - lastPause.pauseStart;
      }
      activeSession.endTime = orphanEndTime;
      activeSession.isActive = false;
      activeSession.activeTime = Math.max(
        0,
        orphanEndTime - activeSession.startTime - activeSession.totalPauseDuration
      );
      await activeSession.save();
    }));
    await Promise.all(orphanedTaskIds.map(async (orphanedTaskId) => {
      const allSessions = await Session.find({ taskId: orphanedTaskId, userId: req.user._id, isActive: false });
      const totalTime = allSessions.reduce((acc, s) => acc + s.activeTime, 0);
      await Task.findOneAndUpdate(
        { _id: orphanedTaskId, userId: req.user._id },
        { totalTime, status: 'todo' }
      );
    }));

    const session = await Session.create({
      userId: req.user._id,
      taskId,
      startTime: startTime || Date.now(),
      isActive: true,
    });

    // Mark task as active
    await Task.findByIdAndUpdate(taskId, { status: 'active' });

    res.status(201).json(session);
    Activity.create({ userId: req.user._id, action: 'session.started', details: { taskId, taskTitle: task.title } }).catch(() => {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/sessions/:id/pause — log a pause start ───────────────────────
router.patch('/:id/pause', async (req, res) => {
  try {
    const { pauseTime } = req.body;
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, isActive: true },
      { 
        $push: { pauseLog: { pauseStart: pauseTime || Date.now() } },
        $inc: { pauseCount: 1 }
      },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Active session not found' });

    await Task.findByIdAndUpdate(session.taskId, { status: 'paused' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/sessions/:id/resume — close the last pause entry ──────────────
router.patch('/:id/resume', async (req, res) => {
  try {
    const { resumeTime } = req.body;
    const now = resumeTime || Date.now();

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Close the last open pause entry
    const lastPause = [...session.pauseLog].reverse().find(p => !p.resumeTime);
    if (lastPause) {
      lastPause.resumeTime = now;
      const pauseDuration = now - lastPause.pauseStart;
      session.totalPauseDuration += pauseDuration;
    }

    await session.save();

    await Task.findByIdAndUpdate(session.taskId, { status: 'active' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/sessions/:id/stop — finalise the session ─────────────────────
router.patch('/:id/stop', async (req, res) => {
  try {
    const { endTime } = req.body;
    const now = endTime || Date.now();

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Close any open pause
    const lastPause = [...session.pauseLog].reverse().find(p => !p.resumeTime);
    if (lastPause) {
      lastPause.resumeTime = now;
      session.totalPauseDuration += now - lastPause.pauseStart;
    }

    session.endTime  = now;
    session.isActive = false;
    session.activeTime = Math.max(0, now - session.startTime - session.totalPauseDuration);

    // ── Focus Score Algorithm ──────────────────────────────────────────────
    // Base score is 100. Deduct 5 points per pause.
    // Also deduct based on pause duration relative to active time.
    let score = 100;
    score -= (session.pauseCount || 0) * 5;
    if (session.activeTime > 0) {
      const pauseRatio = session.totalPauseDuration / session.activeTime;
      score -= Math.min(50, pauseRatio * 20); // up to 50 point penalty for long pauses
    }
    session.focusScore = Math.max(0, Math.round(score));

    await session.save();

    // ── Update User Stats (Streaks & Points) ──────────────────────────────
    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Calculate today's total time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = await Session.find({
      userId: user._id,
      isActive: false,
      startTime: { $gte: todayStart.getTime() }
    });
    const todayTotalMs = todaySessions.reduce((acc, s) => acc + s.activeTime, 0);
    const goalMs = (user.settings?.dailyGoal || 8) * 3600000;

    // Award points: 1 point per minute of focused work, scaled by focus score
    const sessionPoints = Math.round((session.activeTime / 60000) * (session.focusScore / 100));
    user.totalPoints = (user.totalPoints || 0) + sessionPoints;

    if (todayTotalMs >= goalMs && user.streak.lastDate !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (user.streak.lastDate === yesterdayStr) {
        user.streak.current += 1;
      } else {
        user.streak.current = 1;
      }
      user.streak.lastDate = todayStr;
      if (user.streak.current > (user.streak.best || 0)) {
        user.streak.best = user.streak.current;
      }
    }
    await user.save();

    // Roll up total time on the Task document
    const allSessions = await Session.find({ taskId: session.taskId, userId: req.user._id, isActive: false });
    const totalTime = allSessions.reduce((acc, s) => acc + s.activeTime, 0);
    await Task.findByIdAndUpdate(session.taskId, { totalTime, status: 'todo' });

    res.json(session);
    Activity.create({ userId: req.user._id, action: 'session.completed', details: { taskId: session.taskId, activeMs: session.activeTime } }).catch(() => {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

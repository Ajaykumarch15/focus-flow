const express = require('express');
const Session = require('../models/Session');
const Task    = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { serverTime } = require('../utils/sessionTime');

const router = express.Router();
router.use(protect);

// Helper to auto-add timeline entries to active WorkLogs
async function addTimelineEntryToWorkLogs(userId, taskId, type, title, description = '') {
  try {
    const logs = await WorkLog.find({
      userId,
      $or: [{ taskRef: taskId }, { isActive: true }]
    });

    for (const log of logs) {
      log.timelineEntries.push({
        timestamp: Date.now(),
        type,
        title,
        description,
        category: 'Focus Session'
      });
      await log.save();
    }
  } catch (err) {
    console.error('Failed to add timeline entry to WorkLogs:', err);
  }
}

// Helper to auto-sync session time to linked WorkLogs
async function syncSessionToWorkLogs(userId, taskId, session) {
  try {
    if (!session || !session.activeTime) return;

    const task = await Task.findById(taskId);
    const taskTitle = task ? task.title : 'Task';

    const logs = await WorkLog.find({
      userId,
      $or: [{ taskRef: taskId }, { isActive: true }]
    });

    if (!logs.length) return;

    const sessionDateStr = new Date(session.startTime).toDateString();

    for (const log of logs) {
      let entry = log.workEntries.find(e => new Date(e.date).toDateString() === sessionDateStr);
      if (!entry) {
        log.workEntries.push({
          date: new Date(session.startTime),
          what: `Focus session on ${taskTitle}`,
          startedAt: session.startTime,
          endedAt: session.endTime,
          activeMs: session.activeTime,
          sessionIds: [session._id],
        });
      } else {
        if (!entry.sessionIds.includes(session._id)) {
          entry.sessionIds.push(session._id);
          entry.activeMs += session.activeTime;
          if (!entry.startedAt || session.startTime < entry.startedAt) entry.startedAt = session.startTime;
          if (!entry.endedAt || session.endTime > entry.endedAt) entry.endedAt = session.endTime;
        }
      }
      log.totalActiveMs = log.workEntries.reduce((sum, e) => sum + (e.activeMs || 0), 0);
      await log.save();
    }
  } catch (err) {
    console.error('WorkLog sync failed:', err);
  }
}

// ── GET /api/sessions — fetch sessions (optional ?taskId=, ?active=true) ──────
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.taskId) filter.taskId = req.query.taskId;
    if (req.query.active === 'true') filter.isActive = true;

    const sessions = await Session.find(filter).sort({ startTime: -1 });
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sessions — start a new session ──────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { taskId, startTime } = req.body;
    if (!taskId) return res.status(400).json({ message: 'taskId is required' });

    const task = await Task.findOne({ _id: taskId, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const now = serverTime(startTime);

    const existingSameTaskSession = await Session.findOne({
      userId: req.user._id,
      taskId,
      isActive: true,
    });

    if (existingSameTaskSession) {
      return res.status(200).json(existingSameTaskSession);
    }

    const orphanedSessions = await Session.find({ userId: req.user._id, isActive: true });
    const orphanedTaskIds = [...new Set(orphanedSessions.map(s => s.taskId.toString()))];

    await Promise.all(orphanedSessions.map(async (activeSession) => {
      const lastPause = [...activeSession.pauseLog].reverse().find(p => !p.resumeTime);
      if (lastPause) {
        lastPause.resumeTime = now;
        activeSession.totalPauseDuration += now - lastPause.pauseStart;
      }
      activeSession.endTime = now;
      activeSession.isActive = false;
      activeSession.activeTime = Math.max(
        0,
        now - activeSession.startTime - activeSession.totalPauseDuration
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
      startTime: now,
      isActive: true,
    });

    await Task.findByIdAndUpdate(taskId, { status: 'active' });

    // Auto timeline entry
    await addTimelineEntryToWorkLogs(req.user._id, taskId, 'timer_start', `▶ Started Focus Session`, `Task: ${task.title}`);

    res.status(201).json(session);
    Activity.create({ userId: req.user._id, action: 'session.started', details: { taskId, taskTitle: task.title } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sessions/:id/pause — log a pause start ───────────────────────
router.patch('/:id/pause', async (req, res, next) => {
  try {
    const { pauseTime } = req.body;

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!session) return res.status(404).json({ message: 'Active session not found' });

    const now = serverTime(pauseTime, { min: session.startTime });

    const hasOpenPause = session.pauseLog.some(p => !p.resumeTime);
    if (!hasOpenPause) {
      session.pauseLog.push({ pauseStart: now });
      session.pauseCount = (session.pauseCount || 0) + 1;
      await session.save();
    }

    await Task.findByIdAndUpdate(session.taskId, { status: 'paused' });

    // Auto timeline entry
    await addTimelineEntryToWorkLogs(req.user._id, session.taskId, 'timer_pause', `⏸ Paused Focus Session`);

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sessions/:id/resume — close the last pause entry ──────────────
router.patch('/:id/resume', async (req, res, next) => {
  try {
    const { resumeTime } = req.body;

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!session) return res.status(404).json({ message: 'Active session not found' });

    const now = serverTime(resumeTime, { min: session.startTime });

    const lastPause = [...session.pauseLog].reverse().find(p => !p.resumeTime);
    if (lastPause) {
      lastPause.resumeTime = now;
      const pauseDuration = Math.max(0, now - lastPause.pauseStart);
      session.totalPauseDuration += pauseDuration;
      await session.save();
    }

    await Task.findByIdAndUpdate(session.taskId, { status: 'active' });

    // Auto timeline entry
    await addTimelineEntryToWorkLogs(req.user._id, session.taskId, 'timer_resume', `▶ Resumed Focus Session`);

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sessions/:id/stop — finalise the session ─────────────────────
router.patch('/:id/stop', async (req, res, next) => {
  try {
    const { endTime } = req.body;

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (!session.isActive) {
      return res.json(session);
    }

    const now = serverTime(endTime, { min: session.startTime });

    const lastPause = [...session.pauseLog].reverse().find(p => !p.resumeTime);
    if (lastPause) {
      lastPause.resumeTime = now;
      session.totalPauseDuration += Math.max(0, now - lastPause.pauseStart);
    }

    session.endTime = now;
    session.isActive = false;
    session.activeTime = Math.max(0, now - session.startTime - session.totalPauseDuration);

    let score = 100;
    score -= (session.pauseCount || 0) * 5;
    if (session.activeTime > 0) {
      const pauseRatio = session.totalPauseDuration / session.activeTime;
      score -= Math.min(50, pauseRatio * 20);
    }
    session.focusScore = Math.max(0, Math.round(score));

    await session.save();

    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = await Session.find({
      userId: user._id,
      isActive: false,
      startTime: { $gte: todayStart.getTime() }
    });
    const todayTotalMs = todaySessions.reduce((acc, s) => acc + s.activeTime, 0);
    const goalMs = (user.settings?.dailyGoal || 8) * 3600000;

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

    const allSessions = await Session.find({ taskId: session.taskId, userId: req.user._id, isActive: false });
    const totalTime = allSessions.reduce((acc, s) => acc + s.activeTime, 0);
    await Task.findByIdAndUpdate(session.taskId, { totalTime, status: 'todo' });

    // Sync to WorkLog automatically + auto timeline entry
    await syncSessionToWorkLogs(req.user._id, session.taskId, session);
    const mins = Math.round(session.activeTime / 60000);
    await addTimelineEntryToWorkLogs(req.user._id, session.taskId, 'timer_stop', `■ Stopped Focus Session (${mins}m logged)`);

    res.json(session);
    Activity.create({ userId: req.user._id, action: 'session.completed', details: { taskId: session.taskId, activeMs: session.activeTime } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;

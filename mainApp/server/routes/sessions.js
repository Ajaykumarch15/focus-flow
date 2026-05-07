const express = require('express');
const Session = require('../models/Session');
const Task    = require('../models/Task');
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

    // Close any orphaned active sessions for this task (safety net)
    await Session.updateMany(
      { taskId, userId: req.user._id, isActive: true },
      { $set: { isActive: false, endTime: Date.now() } }
    );

    const session = await Session.create({
      userId: req.user._id,
      taskId,
      startTime: startTime || Date.now(),
      isActive: true,
    });

    // Mark task as active
    await Task.findByIdAndUpdate(taskId, { status: 'active' });

    res.status(201).json(session);
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
      { $push: { pauseLog: { pauseStart: pauseTime || Date.now() } } },
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

    await session.save();

    // Roll up total time on the Task document
    const allSessions = await Session.find({ taskId: session.taskId, isActive: false });
    const totalTime = allSessions.reduce((acc, s) => acc + s.activeTime, 0);
    await Task.findByIdAndUpdate(session.taskId, { totalTime, status: 'todo' });

    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

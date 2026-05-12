const express = require('express');
const WorkLog = require('../models/WorkLog');
const Session = require('../models/Session');
const Task    = require('../models/Task');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── Helpers ───────────────────────────────────────────────────────────────────
function toMidnight(d) {
  const date = d ? new Date(d) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sumMs(entries) {
  return (entries || []).reduce((a, e) => a + (e.activeMs || 0), 0);
}

// Pull today's session data for a task and upsert a workEntry for today
async function syncTodayEntry(log, userId) {
  if (!log.taskRef) return log;

  const today = toMidnight();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const sessions = await Session.find({
    userId,
    taskId:    log.taskRef,
    startTime: { $gte: today.getTime(), $lt: tomorrow.getTime() },
    isActive:  false,
  });

  if (sessions.length === 0) return log;

  const activeMs   = sessions.reduce((a, s) => a + (s.activeTime || 0), 0);
  const startedAt  = Math.min(...sessions.map(s => s.startTime));
  const endedAt    = Math.max(...sessions.map(s => s.endTime || s.startTime));
  const sessionIds = sessions.map(s => s._id);

  const existingIdx = log.workEntries.findIndex(e => {
    const d = new Date(e.date); d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });

  if (existingIdx >= 0) {
    log.workEntries[existingIdx].activeMs   = activeMs;
    log.workEntries[existingIdx].startedAt  = startedAt;
    log.workEntries[existingIdx].endedAt    = endedAt;
    log.workEntries[existingIdx].sessionIds = sessionIds;
  } else {
    log.workEntries.push({ date: today, activeMs, startedAt, endedAt, sessionIds, what: '' });
  }

  log.totalActiveMs = sumMs(log.workEntries);
  await log.save();
  return log;
}

// ── GET /api/worklogs ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.active === 'true')  filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const logs = await WorkLog.find(filter)
      .populate('taskRef', 'title color category totalTime')
      .sort({ isActive: -1, updatedAt: -1 });

    res.json(logs);
  } catch (err) {
    console.error('GET /worklogs error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/worklogs/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    let log = await WorkLog.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('taskRef', 'title color category totalTime');

    if (!log) return res.status(404).json({ message: 'Not found' });

    // Auto-sync today's time from linked task sessions
    log = await syncTodayEntry(log, req.user._id);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      title, problem, gitBranch, currentWork, plan,
      designNotes, blockers, status, mood, tags, taskRef,
    } = req.body;

    const log = await WorkLog.create({
      userId:      req.user._id,
      title:       title     || 'Untitled Work Item',
      problem, gitBranch, currentWork, plan, designNotes, blockers,
      status:      status    || 'in-progress',
      isActive:    true,
      mood:        mood      || 3,
      tags:        tags      || [],
      taskRef:     taskRef   || undefined,
      workEntries: [],
      totalActiveMs: 0,
    });

    // If task linked, seed today's entry immediately
    let populated = await log.populate('taskRef', 'title color category totalTime');
    populated = await syncTodayEntry(populated, req.user._id);

    console.log(`✅ WorkLog created: "${log.title}" linked to task: ${taskRef || 'none'}`);
    res.status(201).json(populated);
  } catch (err) {
    console.error('POST /worklogs error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/worklogs/:id ───────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime');

    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/sync-time ─────────────────────────────────────────
// Call this after stopping a timer to pull fresh session data into the work log
router.post('/:id/sync-time', async (req, res) => {
  try {
    let log = await WorkLog.findOne({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Not found' });

    log = await syncTodayEntry(log, req.user._id);
    await log.populate('taskRef', 'title color category totalTime');
    res.json(log);
  } catch (err) {
    console.error('sync-time error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/worklogs/:id/entries/:entryId ─────────────────────────────────
// Update the "what I did" text for a specific day's entry
router.patch('/:id/entries/:entryId', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, 'workEntries._id': req.params.entryId },
      { $set: { 'workEntries.$.what': req.body.what } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime');

    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/close ─────────────────────────────────────────────
router.post('/:id/close', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'done', isActive: false, closedAt: new Date() } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/continue ──────────────────────────────────────────
router.post('/:id/continue', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'in-progress', isActive: true, closedAt: null, reopenedAt: new Date() } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/completed ─────────────────────────────────────────
router.post('/:id/completed', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { completedItems: { text: req.body.text, done: true } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/worklogs/:id/completed/:itemId ────────────────────────────────
router.delete('/:id/completed/:itemId', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { completedItems: { _id: req.params.itemId } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/links ──────────────────────────────────────────────
router.post('/:id/links', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { links: { label: req.body.label, url: req.body.url } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/worklogs/:id/links/:linkId ────────────────────────────────────
router.delete('/:id/links/:linkId', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { links: { _id: req.params.linkId } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/worklogs/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

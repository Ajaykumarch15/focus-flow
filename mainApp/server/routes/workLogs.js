const express = require('express');
const WorkLog = require('../models/WorkLog');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── GET /api/worklogs ─────────────────────────────────────────────────────────
// ?active=true  → only open logs (default for dashboard/sidebar)
// ?active=false → only closed logs (history)
// no param      → all logs
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };

    if (req.query.active === 'true')  filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const logs = await WorkLog.find(filter).sort({ isActive: -1, updatedAt: -1 });
    res.json(logs);
  } catch (err) {
    console.error('GET /worklogs error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/worklogs/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const log = await WorkLog.findOne({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Work log not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs ────────────────────────────────────────────────────────
// Creates a brand-new work log (no unique constraint — many per day allowed)
router.post('/', async (req, res) => {
  try {
    const {
      title, problem, gitBranch, currentWork,
      plan, designNotes, blockers, status, mood, tags,
    } = req.body;

    const log = await WorkLog.create({
      userId:      req.user._id,
      title:       title       || 'Untitled Work Item',
      problem:     problem     || '',
      gitBranch:   gitBranch   || '',
      currentWork: currentWork || '',
      plan:        plan        || '',
      designNotes: designNotes || '',
      blockers:    blockers    || '',
      status:      status      || 'in-progress',
      isActive:    true,
      mood:        mood        || 3,
      tags:        tags        || [],
    });

    console.log(`✅ WorkLog created: "${log.title}" (${log._id}) for user ${req.user._id}`);
    res.status(201).json(log);
  } catch (err) {
    console.error('POST /worklogs error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/worklogs/:id ───────────────────────────────────────────────────
// General field update (title, problem, gitBranch, plan, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!log) return res.status(404).json({ message: 'Work log not found' });
    res.json(log);
  } catch (err) {
    console.error('PATCH /worklogs/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/close ─────────────────────────────────────────────
// Mark a work log as DONE — closes it, moves to history
router.post('/:id/close', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        $set: {
          status:   'done',
          isActive: false,
          closedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: 'Work log not found' });
    console.log(`✅ WorkLog closed: "${log.title}" (${log._id})`);
    res.json(log);
  } catch (err) {
    console.error('POST /worklogs/:id/close error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/continue ──────────────────────────────────────────
// Re-open a done work log — puts it back at the top of active logs
router.post('/:id/continue', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        $set: {
          status:     'in-progress',
          isActive:   true,
          closedAt:   null,
          reopenedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: 'Work log not found' });
    console.log(`🔄 WorkLog continued: "${log.title}" (${log._id})`);
    res.json(log);
  } catch (err) {
    console.error('POST /worklogs/:id/continue error:', err);
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
    );
    if (!log) return res.status(404).json({ message: 'Work log not found' });
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
    );
    if (!log) return res.status(404).json({ message: 'Work log not found' });
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
    );
    if (!log) return res.status(404).json({ message: 'Work log not found' });
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
    );
    if (!log) return res.status(404).json({ message: 'Work log not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/worklogs/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Work log not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

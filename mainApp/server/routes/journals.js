const express = require('express');
const Journal = require('../models/Journal');
const protect = require('../middleware/auth');
const { buildPatch } = require('../utils/patchSanitizer');

const router = express.Router();
router.use(protect);

// Fields a client may update on a Journal via PATCH. Everything else is rejected.
const JOURNAL_PATCH_FIELDS = {
  taskId: true,
  content: true,
  mood: true,
  focusRating: true,
};

// GET /api/journals
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.taskId) filter.taskId = req.query.taskId;
    const journals = await Journal.find(filter).sort({ createdAt: -1 });
    console.log(`📔 Fetched ${journals.length} journals for user ${req.user._id}`);
    res.json(journals);
  } catch (err) {
    console.error('GET /journals error:', err);
    next(err);
  }
});

// POST /api/journals
router.post('/', async (req, res, next) => {
  try {
    const { taskId, content, mood, focusRating } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const journal = await Journal.create({
      userId: req.user._id,
      taskId: taskId || undefined,
      content: content.trim(),
      mood: mood || 3,
      focusRating: focusRating || 3,
    });

    console.log(`✅ Journal saved (${journal._id}) for user ${req.user._id}`);
    res.status(201).json(journal);
  } catch (err) {
    console.error('POST /journals error:', err);
    next(err);
  }
});

// PATCH /api/journals/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const patch = buildPatch(req.body, JOURNAL_PATCH_FIELDS);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    const journal = await Journal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: patch },
      { new: true }
    );
    if (!journal) return res.status(404).json({ message: 'Journal not found' });
    res.json(journal);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/journals/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const journal = await Journal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!journal) return res.status(404).json({ message: 'Journal not found' });
    res.json({ message: 'deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

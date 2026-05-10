const express = require('express');
const Journal = require('../models/Journal');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/journals
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.taskId) filter.taskId = req.query.taskId;
    const journals = await Journal.find(filter).sort({ createdAt: -1 });
    console.log(`📔 Fetched ${journals.length} journals for user ${req.user._id}`);
    res.json(journals);
  } catch (err) {
    console.error('GET /journals error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/journals
router.post('/', async (req, res) => {
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
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/journals/:id
router.patch('/:id', async (req, res) => {
  try {
    const journal = await Journal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true }
    );
    if (!journal) return res.status(404).json({ message: 'Journal not found' });
    res.json(journal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/journals/:id
router.delete('/:id', async (req, res) => {
  try {
    const journal = await Journal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!journal) return res.status(404).json({ message: 'Journal not found' });
    res.json({ message: 'deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

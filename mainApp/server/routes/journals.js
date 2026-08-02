const express = require('express');
const Journal = require('../models/Journal');
const protect = require('../middleware/auth');
const { buildPatch } = require('../utils/patchSanitizer');
const { logger } = require('../utils/logger');
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param schemas.
const journalFields = {
  taskId: objectId,
  content: requiredString(20000, 'content', 'Content is required'),
  mood: z.coerce.number().int('mood must be an integer').min(1, 'mood must be between 1 and 5').max(5, 'mood must be between 1 and 5'),
  focusRating: z.coerce.number().int('focusRating must be an integer').min(1, 'focusRating must be between 1 and 5').max(5, 'focusRating must be between 1 and 5'),
};

const journalCreateSchema = z.object({ ...journalFields, taskId: objectId.optional() }).passthrough();
const journalPatchSchema = z.object(journalFields).partial().passthrough();
const journalParamsSchema = z.object({ id: objectId });

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
    logger.debug({ count: journals.length }, 'journals fetched');
    res.json(journals);
  } catch (err) {
    next(err);
  }
});

// POST /api/journals
router.post('/', validate(journalCreateSchema), async (req, res, next) => {
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

    logger.debug('journal saved');
    res.status(201).json(journal);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/journals/:id
router.patch('/:id', validate(journalPatchSchema, { params: journalParamsSchema }), async (req, res, next) => {
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
router.delete('/:id', validate(null, { params: journalParamsSchema }), async (req, res, next) => {
  try {
    const journal = await Journal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!journal) return res.status(404).json({ message: 'Journal not found' });
    res.json({ message: 'deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const PersonalFutureGoal = require('../models/PersonalFutureGoal');
const PersonalRoadmap = require('../models/PersonalRoadmap');
const protect = require('../middleware/auth');
const { z, objectId, requiredString, validate } = require('../utils/validation');
const { buildPatch } = require('../utils/patchSanitizer');

const router = express.Router();
router.use(protect);

const GOAL_CATEGORIES = ['career', 'projects', 'learning', 'travel', 'personal', 'health', 'finance', 'creative', 'other'];
const GOAL_STATUSES = ['someday', 'considering', 'active', 'completed', 'dropped'];
const GOAL_PRIORITIES = ['low', 'medium', 'high'];

const goalCreateSchema = z.object({
  title: requiredString(200, 'title', 'Title is required'),
  description: z.string().max(2000, 'Description too long').default(''),
  category: z.enum(GOAL_CATEGORIES).default('other'),
  priority: z.enum(GOAL_PRIORITIES).default('medium'),
  color: z.string().max(20, 'Color too long').default('#8b5cf6'),
  remindAt: z.string().nullable().optional(),
}).passthrough();

const goalPatchSchema = z.object({
  title: requiredString(200, 'title', 'Title is required').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  category: z.enum(GOAL_CATEGORIES).optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  priority: z.enum(GOAL_PRIORITIES).optional(),
  color: z.string().max(20, 'Color too long').optional(),
  remindAt: z.string().nullable().optional(),
}).passthrough();

const goalParamsSchema = z.object({ id: objectId });

const ALLOWED_GOAL_PATCH = { title: true, description: true, category: true, status: true, priority: true, color: true, remindAt: true };

// GET /api/personal-future-goals
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;

    const goals = await PersonalFutureGoal.find(filter).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    next(err);
  }
});

// GET /api/personal-future-goals/review — goals not reviewed in 30+ days
router.get('/review', async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const goals = await PersonalFutureGoal.find({
      userId: req.user._id,
      status: { $in: ['someday', 'considering'] },
      $or: [
        { lastReviewedAt: null },
        { lastReviewedAt: { $lt: thirtyDaysAgo } },
      ],
    }).sort({ createdAt: -1 });

    res.json(goals);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-future-goals
router.post('/', validate(goalCreateSchema), async (req, res, next) => {
  try {
    const goal = await PersonalFutureGoal.create({ ...req.body, userId: req.user._id });
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

// GET /api/personal-future-goals/:id
router.get('/:id', validate(null, { params: goalParamsSchema }), async (req, res, next) => {
  try {
    const goal = await PersonalFutureGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json(goal);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-future-goals/:id
router.patch('/:id', validate(goalPatchSchema, { params: goalParamsSchema }), async (req, res, next) => {
  try {
    const goal = await PersonalFutureGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    const patch = buildPatch(req.body, ALLOWED_GOAL_PATCH);
    const updated = await PersonalFutureGoal.findByIdAndUpdate(goal._id, patch, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personal-future-goals/:id
router.delete('/:id', validate(null, { params: goalParamsSchema }), async (req, res, next) => {
  try {
    const goal = await PersonalFutureGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    await PersonalFutureGoal.findByIdAndDelete(goal._id);
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-future-goals/:id/review — mark as reviewed
router.patch('/:id/review', validate(null, { params: goalParamsSchema }), async (req, res, next) => {
  try {
    const goal = await PersonalFutureGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    const updated = await PersonalFutureGoal.findByIdAndUpdate(
      goal._id,
      { lastReviewedAt: new Date() },
      { new: true, runValidators: true },
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-future-goals/:id/start — convert goal into a Roadmap
router.post('/:id/start', validate(null, { params: goalParamsSchema }), async (req, res, next) => {
  try {
    const goal = await PersonalFutureGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    const roadmap = await PersonalRoadmap.create({
      userId: req.user._id,
      title: goal.title,
      description: goal.description || `Goal: ${goal.title}`,
      type: goal.category === 'learning' ? 'learning'
        : goal.category === 'projects' ? 'project'
        : goal.category === 'career' ? 'career'
        : 'personal',
      status: 'planning',
      icon: 'Target',
      color: goal.color,
    });

    const updated = await PersonalFutureGoal.findByIdAndUpdate(
      goal._id,
      { status: 'active', linkedRoadmapId: roadmap._id },
      { new: true, runValidators: true },
    );

    res.json({ roadmapId: roadmap._id, title: roadmap.title, goal: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

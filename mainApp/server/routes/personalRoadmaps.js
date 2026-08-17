const express = require('express');
const Roadmap = require('../models/Roadmap');
const RoadmapPhase = require('../models/RoadmapPhase');
const RoadmapMilestone = require('../models/RoadmapMilestone');
const Task = require('../models/Task');
const protect = require('../middleware/auth');
const { z, objectId, dateInput, requiredString, validate } = require('../utils/validation');
const { buildPatch } = require('../utils/patchSanitizer');

const router = express.Router();
router.use(protect);

const ROADMAP_TYPES = ['learning', 'project', 'career', 'certification', 'interview-prep', 'personal', 'custom'];
const ROADMAP_STATUS = ['planning', 'active', 'completed', 'paused', 'archived'];
const PHASE_STATUS = ['upcoming', 'active', 'completed', 'paused'];
const MILESTONE_STATUS = ['todo', 'in-progress', 'completed'];

const roadmapCreateSchema = z.object({
  title: requiredString(200, 'title', 'Title is required'),
  description: z.string().max(2000, 'Description too long').default(''),
  type: z.enum(ROADMAP_TYPES).default('custom'),
  startDate: dateInput.optional(),
  targetDate: dateInput.optional(),
  status: z.enum(ROADMAP_STATUS).default('planning'),
  icon: z.string().max(50, 'Icon name too long').default('Map'),
  color: z.string().max(20, 'Color too long').default('#0ea5e9'),
}).passthrough();

const roadmapPatchSchema = z.object({
  title: requiredString(200, 'title', 'Title is required').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  type: z.enum(ROADMAP_TYPES).optional(),
  startDate: dateInput.nullable().optional(),
  targetDate: dateInput.nullable().optional(),
  status: z.enum(ROADMAP_STATUS).optional(),
  icon: z.string().max(50, 'Icon name too long').optional(),
  color: z.string().max(20, 'Color too long').optional(),
}).passthrough();

const roadmapParamsSchema = z.object({ id: objectId });

const phaseCreateSchema = z.object({
  title: requiredString(200, 'title', 'Title is required'),
  description: z.string().max(1000, 'Description too long').default(''),
  order: z.number().finite('Invalid order').default(0),
  startDate: dateInput.optional(),
  targetDate: dateInput.optional(),
  status: z.enum(PHASE_STATUS).default('upcoming'),
}).passthrough();

const phasePatchSchema = z.object({
  title: requiredString(200, 'title', 'Title is required').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  order: z.number().finite('Invalid order').optional(),
  startDate: dateInput.nullable().optional(),
  targetDate: dateInput.nullable().optional(),
  status: z.enum(PHASE_STATUS).optional(),
}).passthrough();

const milestoneCreateSchema = z.object({
  title: requiredString(200, 'title', 'Title is required'),
  description: z.string().max(1000, 'Description too long').default(''),
  order: z.number().finite('Invalid order').default(0),
  targetDate: dateInput.optional(),
  status: z.enum(MILESTONE_STATUS).default('todo'),
}).passthrough();

const milestonePatchSchema = z.object({
  title: requiredString(200, 'title', 'Title is required').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  order: z.number().finite('Invalid order').optional(),
  targetDate: dateInput.nullable().optional(),
  status: z.enum(MILESTONE_STATUS).optional(),
}).passthrough();

const ALLOWED_ROADMAP_PATCH = ['title', 'description', 'type', 'startDate', 'targetDate', 'status', 'icon', 'color'];
const ALLOWED_PHASE_PATCH = ['title', 'description', 'order', 'startDate', 'targetDate', 'status'];
const ALLOWED_MILESTONE_PATCH = ['title', 'description', 'order', 'targetDate', 'status'];

// ── ROADMAP CRUD ──────────────────────────────────────────────────────────────

// GET /api/roadmaps
router.get('/', async (req, res, next) => {
  try {
    const roadmaps = await Roadmap.find({ userId: req.user._id }).sort({ createdAt: -1 });

    const roadmapIds = roadmaps.map(r => r._id);

    const [phaseCounts, milestoneCounts, taskData] = await Promise.all([
      RoadmapPhase.aggregate([
        { $match: { roadmapId: { $in: roadmapIds } } },
        { $group: { _id: '$roadmapId', count: { $sum: 1 } } },
      ]),
      RoadmapMilestone.aggregate([
        { $match: { roadmapId: { $in: roadmapIds } } },
        { $group: { _id: '$roadmapId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      ]),
      Task.aggregate([
        { $match: { userId: req.user._id, roadmapRef: { $in: roadmapIds } } },
        { $group: { _id: '$roadmapRef', totalTasks: { $sum: 1 }, completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, totalTime: { $sum: '$totalTime' } } },
      ]),
    ]);

    const phaseMap = Object.fromEntries(phaseCounts.map(p => [String(p._id), p.count]));
    const milestoneMap = Object.fromEntries(milestoneCounts.map(m => [String(m._id), { total: m.total, completed: m.completed }]));
    const taskMap = Object.fromEntries(taskData.map(t => [String(t._id), { totalTasks: t.totalTasks, completedTasks: t.completedTasks, totalTime: t.totalTime }]));

    const enriched = roadmaps.map(r => {
      const ms = milestoneMap[String(r._id)] || { total: 0, completed: 0 };
      const ts = taskMap[String(r._id)] || { totalTasks: 0, completedTasks: 0, totalTime: 0 };
      return {
        ...r.toObject(),
        phaseCount: phaseMap[String(r._id)] || 0,
        milestoneTotal: ms.total,
        milestoneCompleted: ms.completed,
        totalTasks: ts.totalTasks,
        completedTasks: ts.completedTasks,
        totalTime: ts.totalTime,
        progress: ms.total > 0 ? Math.round((ms.completed / ms.total) * 100) : 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/roadmaps
router.post('/', validate(roadmapCreateSchema), async (req, res, next) => {
  try {
    const roadmap = await Roadmap.create({ ...req.body, userId: req.user._id });
    res.status(201).json({ ...roadmap.toObject(), phaseCount: 0, milestoneTotal: 0, milestoneCompleted: 0, totalTasks: 0, completedTasks: 0, totalTime: 0, progress: 0 });
  } catch (err) {
    next(err);
  }
});

// GET /api/roadmaps/:id
router.get('/:id', validate(null, { params: roadmapParamsSchema }), async (req, res, next) => {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const [phases, milestones, tasks] = await Promise.all([
      RoadmapPhase.find({ roadmapId: roadmap._id, userId: req.user._id }).sort({ order: 1 }),
      RoadmapMilestone.find({ roadmapId: roadmap._id, userId: req.user._id }).sort({ order: 1 }),
      Task.find({ roadmapRef: roadmap._id, userId: req.user._id }),
    ]);

    const milestoneTotal = milestones.length;
    const milestoneCompleted = milestones.filter(m => m.status === 'completed').length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTime = tasks.reduce((sum, t) => sum + (t.totalTime || 0), 0);

    const phasesWithProgress = phases.map(phase => {
      const phaseMilestones = milestones.filter(m => String(m.phaseId) === String(phase._id));
      const phaseMilestoneTotal = phaseMilestones.length;
      const phaseMilestoneCompleted = phaseMilestones.filter(m => m.status === 'completed').length;
      return {
        ...phase.toObject(),
        milestoneTotal: phaseMilestoneTotal,
        milestoneCompleted: phaseMilestoneCompleted,
        progress: phaseMilestoneTotal > 0 ? Math.round((phaseMilestoneCompleted / phaseMilestoneTotal) * 100) : 0,
      };
    });

    const milestonesWithProgress = milestones.map(milestone => {
      const milestoneTasks = tasks.filter(t => String(t.milestoneRef) === String(milestone._id));
      const mtTotal = milestoneTasks.length;
      const mtCompleted = milestoneTasks.filter(t => t.status === 'completed').length;
      return {
        ...milestone.toObject(),
        totalTasks: mtTotal,
        completedTasks: mtCompleted,
        progress: mtTotal > 0 ? Math.round((mtCompleted / mtTotal) * 100) : 0,
      };
    });

    const progress = milestoneTotal > 0 ? Math.round((milestoneCompleted / milestoneTotal) * 100) : 0;

    res.json({
      ...roadmap.toObject(),
      phases: phasesWithProgress,
      milestones: milestonesWithProgress,
      tasks: tasks.map(t => ({
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        totalTime: t.totalTime,
        milestoneRef: t.milestoneRef,
        phaseRef: t.phaseRef,
        deadline: t.deadline,
      })),
      progress,
      milestoneTotal,
      milestoneCompleted,
      totalTasks,
      completedTasks,
      totalTime,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/roadmaps/:id
router.patch('/:id', validate(roadmapPatchSchema), async (req, res, next) => {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const patch = buildPatch(req.body, ALLOWED_ROADMAP_PATCH);
    const updated = await Roadmap.findByIdAndUpdate(roadmap._id, patch, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roadmaps/:id
router.delete('/:id', validate(null, { params: roadmapParamsSchema }), async (req, res, next) => {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const milestoneIds = (await RoadmapMilestone.find({ roadmapId: roadmap._id })).map(m => m._id);

    await Promise.all([
      RoadmapPhase.deleteMany({ roadmapId: roadmap._id, userId: req.user._id }),
      RoadmapMilestone.deleteMany({ roadmapId: roadmap._id, userId: req.user._id }),
      Task.updateMany({ roadmapRef: roadmap._id, userId: req.user._id }, { $set: { roadmapRef: null, phaseRef: null, milestoneRef: null } }),
      Roadmap.findByIdAndDelete(roadmap._id),
    ]);

    res.json({ message: 'Roadmap deleted' });
  } catch (err) {
    next(err);
  }
});

// ── PHASE CRUD ────────────────────────────────────────────────────────────────

// GET /api/roadmaps/:roadmapId/phases
router.get('/:roadmapId/phases', async (req, res, next) => {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.roadmapId, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const phases = await RoadmapPhase.find({ roadmapId: roadmap._id, userId: req.user._id }).sort({ order: 1 });

    const milestones = await RoadmapMilestone.find({ roadmapId: roadmap._id, userId: req.user._id });
    const enriched = phases.map(phase => {
      const pm = milestones.filter(m => String(m.phaseId) === String(phase._id));
      const total = pm.length;
      const completed = pm.filter(m => m.status === 'completed').length;
      return {
        ...phase.toObject(),
        milestoneTotal: total,
        milestoneCompleted: completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/roadmaps/:roadmapId/phases
router.post('/:roadmapId/phases', validate(phaseCreateSchema), async (req, res, next) => {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.roadmapId, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const phase = await RoadmapPhase.create({
      ...req.body,
      userId: req.user._id,
      roadmapId: roadmap._id,
    });

    res.status(201).json({ ...phase.toObject(), milestoneTotal: 0, milestoneCompleted: 0, progress: 0 });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/phases/:id
router.patch('/phases/:id', validate(phasePatchSchema), async (req, res, next) => {
  try {
    const phase = await RoadmapPhase.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const patch = buildPatch(req.body, ALLOWED_PHASE_PATCH);
    const updated = await RoadmapPhase.findByIdAndUpdate(phase._id, patch, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/phases/:id
router.delete('/phases/:id', async (req, res, next) => {
  try {
    const phase = await RoadmapPhase.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const milestones = await RoadmapMilestone.find({ phaseId: phase._id });
    const milestoneIds = milestones.map(m => m._id);

    await Promise.all([
      Task.updateMany({ phaseRef: phase._id, userId: req.user._id }, { $set: { phaseRef: null, milestoneRef: null } }),
      RoadmapMilestone.deleteMany({ phaseId: phase._id, userId: req.user._id }),
      RoadmapPhase.findByIdAndDelete(phase._id),
    ]);

    res.json({ message: 'Phase deleted' });
  } catch (err) {
    next(err);
  }
});

// ── MILESTONE CRUD ────────────────────────────────────────────────────────────

// GET /api/phases/:phaseId/milestones
router.get('/phases/:phaseId/milestones', async (req, res, next) => {
  try {
    const phase = await RoadmapPhase.findOne({ _id: req.params.phaseId, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const milestones = await RoadmapMilestone.find({ phaseId: phase._id, userId: req.user._id }).sort({ order: 1 });

    const milestoneIds = milestones.map(m => m._id);
    const tasks = await Task.find({ milestoneRef: { $in: milestoneIds }, userId: req.user._id });

    const enriched = milestones.map(m => {
      const mt = tasks.filter(t => String(t.milestoneRef) === String(m._id));
      return {
        ...m.toObject(),
        totalTasks: mt.length,
        completedTasks: mt.filter(t => t.status === 'completed').length,
        progress: mt.length > 0 ? Math.round((mt.filter(t => t.status === 'completed').length / mt.length) * 100) : 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/phases/:phaseId/milestones
router.post('/phases/:phaseId/milestones', validate(milestoneCreateSchema), async (req, res, next) => {
  try {
    const phase = await RoadmapPhase.findOne({ _id: req.params.phaseId, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const milestone = await RoadmapMilestone.create({
      ...req.body,
      userId: req.user._id,
      roadmapId: phase.roadmapId,
      phaseId: phase._id,
    });

    res.status(201).json({ ...milestone.toObject(), totalTasks: 0, completedTasks: 0, progress: 0 });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/milestones/:id
router.patch('/milestones/:id', validate(milestonePatchSchema), async (req, res, next) => {
  try {
    const milestone = await RoadmapMilestone.findOne({ _id: req.params.id, userId: req.user._id });
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    const patch = buildPatch(req.body, ALLOWED_MILESTONE_PATCH);
    const updated = await RoadmapMilestone.findByIdAndUpdate(milestone._id, patch, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/milestones/:id
router.delete('/milestones/:id', async (req, res, next) => {
  try {
    const milestone = await RoadmapMilestone.findOne({ _id: req.params.id, userId: req.user._id });
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    await Promise.all([
      Task.updateMany({ milestoneRef: milestone._id, userId: req.user._id }, { $set: { milestoneRef: null } }),
      RoadmapMilestone.findByIdAndDelete(milestone._id),
    ]);

    res.json({ message: 'Milestone deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

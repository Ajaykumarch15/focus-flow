const express = require('express');
const PersonalRoadmap = require('../models/PersonalRoadmap');
const PersonalRoadmapPhase = require('../models/PersonalRoadmapPhase');
const PersonalRoadmapMilestone = require('../models/PersonalRoadmapMilestone');
const PersonalTask = require('../models/PersonalTask');
const protect = require('../middleware/auth');
const { z, objectId, dateInput, requiredString, validate } = require('../utils/validation');
const { buildPatch } = require('../utils/patchSanitizer');
const {
  ROADMAP_TRANSITIONS,
  PHASE_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  canTransition,
  completeChildrenForRoadmap,
  completeMilestonesForPhase,
} = require('../utils/roadmapLifecycle');
const {
  milestoneProgress,
  phaseProgress,
  roadmapProgress,
  serializeProgress,
} = require('../utils/roadmapProgress');

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
  order: z.number().finite('Invalid order').optional(),
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
  order: z.number().finite('Invalid order').optional(),
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

const phaseReorderSchema = z.object({
  phaseIds: z.array(objectId).min(1),
}).passthrough();

const milestoneReorderSchema = z.object({
  milestoneIds: z.array(objectId).min(1),
}).passthrough();

const ALLOWED_ROADMAP_PATCH = { title: true, description: true, type: true, startDate: true, targetDate: true, status: true, icon: true, color: true };
const ALLOWED_PHASE_PATCH = { title: true, description: true, startDate: true, targetDate: true, status: true };
const ALLOWED_MILESTONE_PATCH = { title: true, description: true, targetDate: true, status: true };

// ── TASK LINKING ─────────────────────────────────────────────────────────────

const linkTaskSchema = z.object({
  taskId: objectId,
  roadmapId: objectId,
  phaseId: objectId,
  milestoneId: objectId,
}).passthrough();

// GET /api/personal-roadmaps/available-tasks
router.get('/available-tasks', async (req, res, next) => {
  try {
    const tasks = await PersonalTask.find({
      userId: req.user._id,
      personalMilestoneRef: null,
      status: { $ne: 'completed' },
    }).select('title priority status category totalTime deadline').sort({ createdAt: -1 }).limit(100);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-roadmaps/link-task
router.post('/link-task', validate(linkTaskSchema), async (req, res, next) => {
  try {
    const { taskId, roadmapId, phaseId, milestoneId } = req.body;

    const [task, roadmap, phase, milestone] = await Promise.all([
      PersonalTask.findOne({ _id: taskId, userId: req.user._id }),
      PersonalRoadmap.findOne({ _id: roadmapId, userId: req.user._id }),
      PersonalRoadmapPhase.findOne({ _id: phaseId, userId: req.user._id, roadmapId }),
      PersonalRoadmapMilestone.findOne({ _id: milestoneId, userId: req.user._id, phaseId, roadmapId }),
    ]);

    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    const updated = await PersonalTask.findByIdAndUpdate(
      task._id,
      { $set: { personalRoadmapRef: roadmap._id, personalPhaseRef: phase._id, personalMilestoneRef: milestone._id } },
      { new: true, runValidators: true },
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personal-roadmaps/unlink-task/:taskId
router.delete('/unlink-task/:taskId', async (req, res, next) => {
  try {
    const task = await PersonalTask.findOne({ _id: req.params.taskId, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await PersonalTask.findByIdAndUpdate(task._id, {
      $set: { personalRoadmapRef: null, personalPhaseRef: null, personalMilestoneRef: null },
    });

    res.json({ message: 'Task unlinked' });
  } catch (err) {
    next(err);
  }
});

// ── ANALYTICS ────────────────────────────────────────────────────────────────

// GET /api/personal-roadmaps/analytics?days=30
router.get('/analytics', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 0;
    const sinceDate = days > 0 ? new Date(Date.now() - days * 86400000) : null;
    const userId = req.user._id;

    const roadmaps = await PersonalRoadmap.find({ userId }).sort({ createdAt: -1 });
    const roadmapIds = roadmaps.map(r => r._id);

    if (roadmapIds.length === 0) {
      return res.json({
        overview: { progress: 0, activeRoadmaps: 0, completedMilestones: 0, totalMilestones: 0, completedTasks: 0, totalTasks: 0, focusedTimeMs: 0 },
        today: { tasksCompleted: 0, milestonesCompleted: 0, activeRoadmaps: 0 },
        roadmaps: [],
        phases: [],
        activity: { activeDays: 0, completedMilestones: 0, completedTasks: 0 },
        recentActivity: [],
      });
    }

    const idIn = { $in: roadmapIds };
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      phases,
      msByRoadmap,
      msByPhase,
      tasksByRoadmap,
      completedTaskDays,
      recentTasks,
      recentMilestones,
      todayTasks,
      todayMilestones,
      windowedMilestones,
    ] = await Promise.all([
      PersonalRoadmapPhase.find({ userId, roadmapId: idIn }),
      PersonalRoadmapMilestone.aggregate([
        { $match: { userId, roadmapId: idIn } },
        { $group: { _id: '$roadmapId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      ]),
      PersonalRoadmapMilestone.aggregate([
        { $match: { userId, roadmapId: idIn } },
        { $group: { _id: '$phaseId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      ]),
      PersonalTask.aggregate([
        { $match: { userId, personalRoadmapRef: idIn } },
        { $group: {
          _id: '$personalRoadmapRef',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          focusedTimeMs: { $sum: { $ifNull: ['$totalTime', 0] } },
        } },
      ]),
      PersonalTask.aggregate([
        { $match: {
          userId,
          personalRoadmapRef: idIn,
          status: 'completed',
          updatedAt: { $ne: null, ...(sinceDate ? { $gte: sinceDate } : {}) },
        } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, count: { $sum: 1 } } },
      ]),
      PersonalTask.find({ userId, personalRoadmapRef: idIn, status: 'completed' })
        .sort({ updatedAt: -1 }).limit(15).select('title updatedAt personalRoadmapRef'),
      PersonalRoadmapMilestone.find({ userId, roadmapId: idIn, status: 'completed' })
        .sort({ updatedAt: -1 }).limit(15).select('title updatedAt roadmapId'),
      PersonalTask.aggregate([
        { $match: { userId, personalRoadmapRef: idIn, status: 'completed', updatedAt: { $gte: startOfToday } } },
        { $group: { _id: null, count: { $sum: 1 }, roadmapIds: { $addToSet: '$personalRoadmapRef' } } },
      ]),
      PersonalRoadmapMilestone.aggregate([
        { $match: { userId, roadmapId: idIn, status: 'completed', updatedAt: { $gte: startOfToday } } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
      PersonalRoadmapMilestone.aggregate([
        { $match: {
          userId,
          roadmapId: idIn,
          status: 'completed',
          ...(sinceDate ? { updatedAt: { $gte: sinceDate } } : {}),
        } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
    ]);

    const msRoadmapMap = Object.fromEntries(msByRoadmap.map(b => [String(b._id), b]));
    const msPhaseMap = Object.fromEntries(msByPhase.map(b => [String(b._id), b]));
    const taskRoadmapMap = Object.fromEntries(tasksByRoadmap.map(b => [String(b._id), b]));

    const sumOf = (buckets, field) => buckets.reduce((acc, b) => acc + (b[field] || 0), 0);
    const totalMilestones = sumOf(msByRoadmap, 'total');
    const completedMilestones = sumOf(msByRoadmap, 'completed');
    const totalTasks = sumOf(tasksByRoadmap, 'total');
    const completedTasks = sumOf(tasksByRoadmap, 'completed');
    const focusedTimeMs = sumOf(tasksByRoadmap, 'focusedTimeMs');
    const activeRoadmaps = roadmaps.filter(r => r.status === 'active' || r.status === 'planning').length;
    const overallProgress = roadmapProgress(completedMilestones, totalMilestones) || 0;

    const roadmapStats = roadmaps.map(r => {
      const key = String(r._id);
      const ms = msRoadmapMap[key] || { total: 0, completed: 0 };
      const ts = taskRoadmapMap[key] || { total: 0, completed: 0, focusedTimeMs: 0 };
      const ph = phases.filter(p => String(p.roadmapId) === key);
      return {
        _id: r._id,
        title: r.title,
        description: r.description,
        status: r.status,
        color: r.color,
        icon: r.icon,
        targetDate: r.targetDate,
        progress: roadmapProgress(ms.completed, ms.total) || 0,
        phaseTotal: ph.length,
        phaseCompleted: ph.filter(p => p.status === 'completed').length,
        milestoneTotal: ms.total,
        milestoneCompleted: ms.completed,
        taskTotal: ts.total,
        taskCompleted: ts.completed,
        focusedTimeMs: ts.focusedTimeMs || 0,
      };
    });

    const phaseOrder = new Map(roadmapIds.map((id, i) => [String(id), i]));
    const phaseStats = phases
      .sort((a, b) => {
        const ri = phaseOrder.get(String(a.roadmapId)) ?? 0;
        const rj = phaseOrder.get(String(b.roadmapId)) ?? 0;
        if (ri !== rj) return ri - rj;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .map(p => {
        const ms = msPhaseMap[String(p._id)] || { total: 0, completed: 0 };
        const roadmap = roadmaps.find(r => String(r._id) === String(p.roadmapId));
        return {
          _id: p._id,
          title: p.title,
          status: p.status,
          order: p.order,
          roadmapId: p.roadmapId,
          roadmapTitle: roadmap?.title || '',
          progress: phaseProgress(ms.completed, ms.total) || 0,
          milestoneTotal: ms.total,
          milestoneCompleted: ms.completed,
        };
      });

    const recentActivity = [
      ...recentTasks.map(t => ({ type: 'task', title: t.title, date: t.updatedAt, roadmapId: t.personalRoadmapRef })),
      ...recentMilestones.map(m => ({ type: 'milestone', title: m.title, date: m.updatedAt, roadmapId: m.roadmapId })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);

    const todayTaskBucket = todayTasks[0] || { count: 0, roadmapIds: [] };
    const todayActiveRoadmapIds = new Set(
      (todayTaskBucket.roadmapIds || []).map(id => String(id)),
    );
    const todayActiveRoadmaps = roadmaps.filter(
      r => (r.status === 'active' || r.status === 'planning') && todayActiveRoadmapIds.has(String(r._id)),
    ).length;

    res.json({
      overview: {
        progress: overallProgress,
        activeRoadmaps,
        completedMilestones,
        totalMilestones,
        completedTasks,
        totalTasks,
        focusedTimeMs,
      },
      today: {
        tasksCompleted: todayTaskBucket.count || 0,
        milestonesCompleted: (todayMilestones[0] || {}).count || 0,
        activeRoadmaps: todayActiveRoadmaps,
      },
      roadmaps: roadmapStats,
      phases: phaseStats,
      activity: {
        activeDays: completedTaskDays.length,
        completedMilestones: sinceDate
          ? sumOf(windowedMilestones, 'count')
          : completedMilestones,
        completedTasks: sinceDate
          ? completedTaskDays.reduce((acc, b) => acc + (b.count || 0), 0)
          : completedTasks,
      },
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

// ── ROADMAP CRUD ──────────────────────────────────────────────────────────────

// GET /api/personal-roadmaps
router.get('/', async (req, res, next) => {
  try {
    const roadmaps = await PersonalRoadmap.find({ userId: req.user._id }).sort({ createdAt: -1 });

    const roadmapIds = roadmaps.map(r => r._id);

    const [phaseCounts, milestoneCounts, taskData] = await Promise.all([
      PersonalRoadmapPhase.aggregate([
        { $match: { roadmapId: { $in: roadmapIds } } },
        { $group: { _id: '$roadmapId', count: { $sum: 1 } } },
      ]),
      PersonalRoadmapMilestone.aggregate([
        { $match: { roadmapId: { $in: roadmapIds } } },
        { $group: { _id: '$roadmapId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      ]),
      PersonalTask.aggregate([
        { $match: { userId: req.user._id, personalRoadmapRef: { $in: roadmapIds } } },
        { $group: { _id: '$personalRoadmapRef', totalTasks: { $sum: 1 }, completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, totalTime: { $sum: '$totalTime' } } },
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
        ...serializeProgress(roadmapProgress(ms.completed, ms.total)),
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-roadmaps
router.post('/', validate(roadmapCreateSchema), async (req, res, next) => {
  try {
    const roadmap = await PersonalRoadmap.create({ ...req.body, userId: req.user._id });
    res.status(201).json({ ...roadmap.toObject(), phaseCount: 0, milestoneTotal: 0, milestoneCompleted: 0, totalTasks: 0, completedTasks: 0, totalTime: 0, progress: 0 });
  } catch (err) {
    next(err);
  }
});

// GET /api/personal-roadmaps/:id
router.get('/:id', validate(null, { params: roadmapParamsSchema }), async (req, res, next) => {
  try {
    const roadmap = await PersonalRoadmap.findOne({ _id: req.params.id, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const [phases, milestones, tasks] = await Promise.all([
      PersonalRoadmapPhase.find({ roadmapId: roadmap._id, userId: req.user._id }).sort({ order: 1 }),
      PersonalRoadmapMilestone.find({ roadmapId: roadmap._id, userId: req.user._id }).sort({ order: 1 }),
      PersonalTask.find({ personalRoadmapRef: roadmap._id, userId: req.user._id }),
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
        ...serializeProgress(phaseProgress(phaseMilestoneCompleted, phaseMilestoneTotal)),
      };
    });

    const milestonesWithProgress = milestones.map(milestone => {
      const milestoneTasks = tasks.filter(t => String(t.personalMilestoneRef) === String(milestone._id));
      const mtTotal = milestoneTasks.length;
      const mtCompleted = milestoneTasks.filter(t => t.status === 'completed').length;
      return {
        ...milestone.toObject(),
        totalTasks: mtTotal,
        completedTasks: mtCompleted,
        ...serializeProgress(milestoneProgress(mtCompleted, mtTotal)),
      };
    });

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
        personalMilestoneRef: t.personalMilestoneRef,
        personalPhaseRef: t.personalPhaseRef,
        deadline: t.deadline,
      })),
      ...serializeProgress(roadmapProgress(milestoneCompleted, milestoneTotal)),
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

// PATCH /api/personal-roadmaps/:id
router.patch('/:id', validate(roadmapPatchSchema), async (req, res, next) => {
  try {
    const roadmap = await PersonalRoadmap.findOne({ _id: req.params.id, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const patch = buildPatch(req.body, ALLOWED_ROADMAP_PATCH);
    if (!canTransition(ROADMAP_TRANSITIONS, roadmap.status, patch.status)) {
      return res.status(400).json({
        message: `Cannot move roadmap from '${roadmap.status}' to '${patch.status}'`,
      });
    }
    const updated = await PersonalRoadmap.findByIdAndUpdate(roadmap._id, patch, { new: true, runValidators: true });
    if (patch.status === 'completed' && roadmap.status !== 'completed') {
      await completeChildrenForRoadmap(PersonalRoadmapPhase, PersonalRoadmapMilestone, roadmap._id, req.user._id);
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personal-roadmaps/:id
router.delete('/:id', validate(null, { params: roadmapParamsSchema }), async (req, res, next) => {
  try {
    const roadmap = await PersonalRoadmap.findOne({ _id: req.params.id, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    await Promise.all([
      PersonalRoadmapPhase.deleteMany({ roadmapId: roadmap._id, userId: req.user._id }),
      PersonalRoadmapMilestone.deleteMany({ roadmapId: roadmap._id, userId: req.user._id }),
      PersonalTask.updateMany({ personalRoadmapRef: roadmap._id, userId: req.user._id }, { $set: { personalRoadmapRef: null, personalPhaseRef: null, personalMilestoneRef: null } }),
      PersonalRoadmap.findByIdAndDelete(roadmap._id),
    ]);

    res.json({ message: 'Roadmap deleted' });
  } catch (err) {
    next(err);
  }
});

// ── PHASE CRUD ────────────────────────────────────────────────────────────────

// GET /api/personal-roadmaps/:roadmapId/phases
router.get('/:roadmapId/phases', async (req, res, next) => {
  try {
    const roadmap = await PersonalRoadmap.findOne({ _id: req.params.roadmapId, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const phases = await PersonalRoadmapPhase.find({ roadmapId: roadmap._id, userId: req.user._id }).sort({ order: 1 });

    const milestones = await PersonalRoadmapMilestone.find({ roadmapId: roadmap._id, userId: req.user._id });
    const enriched = phases.map(phase => {
      const pm = milestones.filter(m => String(m.phaseId) === String(phase._id));
      const total = pm.length;
      const completed = pm.filter(m => m.status === 'completed').length;
      return {
        ...phase.toObject(),
        milestoneTotal: total,
        milestoneCompleted: completed,
        ...serializeProgress(phaseProgress(completed, total)),
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-roadmaps/:roadmapId/phases
router.post('/:roadmapId/phases', validate(phaseCreateSchema), async (req, res, next) => {
  try {
    const roadmap = await PersonalRoadmap.findOne({ _id: req.params.roadmapId, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    let { order } = req.body;
    if (order === undefined) {
      const last = await PersonalRoadmapPhase.findOne({ roadmapId: roadmap._id, userId: req.user._id })
        .sort({ order: -1 })
        .select('order')
        .lean();
      order = last && Number.isFinite(Number(last.order)) ? Number(last.order) + 1 : 0;
    }

    const phase = await PersonalRoadmapPhase.create({
      ...req.body,
      order,
      userId: req.user._id,
      roadmapId: roadmap._id,
    });

    res.status(201).json({ ...phase.toObject(), milestoneTotal: 0, milestoneCompleted: 0, progress: 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-roadmaps/:roadmapId/phases/reorder
router.post('/:roadmapId/phases/reorder', validate(phaseReorderSchema), async (req, res, next) => {
  try {
    const roadmap = await PersonalRoadmap.findOne({ _id: req.params.roadmapId, userId: req.user._id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const phases = await PersonalRoadmapPhase.find({ roadmapId: roadmap._id, userId: req.user._id }).select('_id');
    const existingIds = new Set(phases.map(p => String(p._id)));
    const requested = req.body.phaseIds;

    if (
      requested.length !== phases.length ||
      new Set(requested.map(String)).size !== requested.length ||
      !requested.every(id => existingIds.has(String(id)))
    ) {
      return res.status(400).json({ message: 'phaseIds must contain every phase of this roadmap exactly once' });
    }

    await PersonalRoadmapPhase.bulkWrite(
      requested.map((id, index) => ({
        updateOne: { filter: { _id: id, roadmapId: roadmap._id }, update: { $set: { order: index } } },
      })),
    );

    res.json({ message: 'Phases reordered' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-roadmaps/phases/:id
router.patch('/phases/:id', validate(phasePatchSchema), async (req, res, next) => {
  try {
    const phase = await PersonalRoadmapPhase.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const patch = buildPatch(req.body, ALLOWED_PHASE_PATCH);
    if (!canTransition(PHASE_TRANSITIONS, phase.status, patch.status)) {
      return res.status(400).json({
        message: `Cannot move phase from '${phase.status}' to '${patch.status}'`,
      });
    }
    const updated = await PersonalRoadmapPhase.findByIdAndUpdate(phase._id, patch, { new: true, runValidators: true });
    if (patch.status === 'completed' && phase.status !== 'completed') {
      await completeMilestonesForPhase(PersonalRoadmapMilestone, phase._id, req.user._id);
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personal-roadmaps/phases/:id
router.delete('/phases/:id', async (req, res, next) => {
  try {
    const phase = await PersonalRoadmapPhase.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    await Promise.all([
      PersonalTask.updateMany({ personalPhaseRef: phase._id, userId: req.user._id }, { $set: { personalPhaseRef: null, personalMilestoneRef: null } }),
      PersonalRoadmapMilestone.deleteMany({ phaseId: phase._id, userId: req.user._id }),
      PersonalRoadmapPhase.findByIdAndDelete(phase._id),
    ]);

    res.json({ message: 'Phase deleted' });
  } catch (err) {
    next(err);
  }
});

// ── MILESTONE CRUD ────────────────────────────────────────────────────────────

// GET /api/personal-roadmaps/phases/:phaseId/milestones
router.get('/phases/:phaseId/milestones', async (req, res, next) => {
  try {
    const phase = await PersonalRoadmapPhase.findOne({ _id: req.params.phaseId, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const milestones = await PersonalRoadmapMilestone.find({ phaseId: phase._id, userId: req.user._id }).sort({ order: 1 });

    const milestoneIds = milestones.map(m => m._id);
    const tasks = await PersonalTask.find({ personalMilestoneRef: { $in: milestoneIds }, userId: req.user._id });

    const enriched = milestones.map(m => {
      const mt = tasks.filter(t => String(t.personalMilestoneRef) === String(m._id));
      const mtCompleted = mt.filter(t => t.status === 'completed').length;
      return {
        ...m.toObject(),
        totalTasks: mt.length,
        completedTasks: mtCompleted,
        ...serializeProgress(milestoneProgress(mtCompleted, mt.length)),
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-roadmaps/phases/:phaseId/milestones
router.post('/phases/:phaseId/milestones', validate(milestoneCreateSchema), async (req, res, next) => {
  try {
    const phase = await PersonalRoadmapPhase.findOne({ _id: req.params.phaseId, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    let { order } = req.body;
    if (order === undefined) {
      const last = await PersonalRoadmapMilestone.findOne({ phaseId: phase._id, userId: req.user._id })
        .sort({ order: -1 })
        .select('order')
        .lean();
      order = last && Number.isFinite(Number(last.order)) ? Number(last.order) + 1 : 0;
    }

    const milestone = await PersonalRoadmapMilestone.create({
      ...req.body,
      order,
      userId: req.user._id,
      roadmapId: phase.roadmapId,
      phaseId: phase._id,
    });

    res.status(201).json({ ...milestone.toObject(), totalTasks: 0, completedTasks: 0, progress: 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-roadmaps/phases/:phaseId/milestones/reorder
router.post('/phases/:phaseId/milestones/reorder', validate(milestoneReorderSchema), async (req, res, next) => {
  try {
    const phase = await PersonalRoadmapPhase.findOne({ _id: req.params.phaseId, userId: req.user._id });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const milestones = await PersonalRoadmapMilestone.find({ phaseId: phase._id, userId: req.user._id }).select('_id');
    const existingIds = new Set(milestones.map(m => String(m._id)));
    const requested = req.body.milestoneIds;

    if (
      requested.length !== milestones.length ||
      new Set(requested.map(String)).size !== requested.length ||
      !requested.every(id => existingIds.has(String(id)))
    ) {
      return res.status(400).json({ message: 'milestoneIds must contain every milestone of this phase exactly once' });
    }

    await PersonalRoadmapMilestone.bulkWrite(
      requested.map((id, index) => ({
        updateOne: { filter: { _id: id, phaseId: phase._id }, update: { $set: { order: index } } },
      })),
    );

    res.json({ message: 'Milestones reordered' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-roadmaps/milestones/:id
router.patch('/milestones/:id', validate(milestonePatchSchema), async (req, res, next) => {
  try {
    const milestone = await PersonalRoadmapMilestone.findOne({ _id: req.params.id, userId: req.user._id });
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    const patch = buildPatch(req.body, ALLOWED_MILESTONE_PATCH);
    if (!canTransition(MILESTONE_TRANSITIONS, milestone.status, patch.status)) {
      return res.status(400).json({
        message: `Cannot move milestone from '${milestone.status}' to '${patch.status}'`,
      });
    }
    const updated = await PersonalRoadmapMilestone.findByIdAndUpdate(milestone._id, patch, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personal-roadmaps/milestones/:id
router.delete('/milestones/:id', async (req, res, next) => {
  try {
    const milestone = await PersonalRoadmapMilestone.findOne({ _id: req.params.id, userId: req.user._id });
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    await Promise.all([
      PersonalTask.updateMany({ personalMilestoneRef: milestone._id, userId: req.user._id }, { $set: { personalMilestoneRef: null } }),
      PersonalRoadmapMilestone.findByIdAndDelete(milestone._id),
    ]);

    res.json({ message: 'Milestone deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

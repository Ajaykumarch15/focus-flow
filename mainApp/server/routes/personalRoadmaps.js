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

const ALLOWED_ROADMAP_PATCH = { title: true, description: true, type: true, startDate: true, targetDate: true, status: true, icon: true, color: true };
const ALLOWED_PHASE_PATCH = { title: true, description: true, order: true, startDate: true, targetDate: true, status: true };
const ALLOWED_MILESTONE_PATCH = { title: true, description: true, order: true, targetDate: true, status: true };

// ── TASK LINKING ─────────────────────────────────────────────────────────────

const linkTaskSchema = z.object({
  taskId: objectId,
  roadmapId: objectId,
  phaseId: objectId,
  milestoneId: objectId,
}).passthrough();

// GET /api/roadmaps/available-tasks — unlinked tasks for the user
router.get('/available-tasks', async (req, res, next) => {
  try {
    const tasks = await Task.find({
      userId: req.user._id,
      milestoneRef: null,
      status: { $ne: 'completed' },
    }).select('title priority status category totalTime deadline').sort({ createdAt: -1 }).limit(100);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/roadmaps/link-task — link an existing task to a milestone
router.post('/link-task', validate(linkTaskSchema), async (req, res, next) => {
  try {
    const { taskId, roadmapId, phaseId, milestoneId } = req.body;

    const [task, roadmap, phase, milestone] = await Promise.all([
      Task.findOne({ _id: taskId, userId: req.user._id }),
      Roadmap.findOne({ _id: roadmapId, userId: req.user._id }),
      RoadmapPhase.findOne({ _id: phaseId, userId: req.user._id, roadmapId }),
      RoadmapMilestone.findOne({ _id: milestoneId, userId: req.user._id, phaseId, roadmapId }),
    ]);

    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    const updated = await Task.findByIdAndUpdate(
      task._id,
      { $set: { roadmapRef: roadmap._id, phaseRef: phase._id, milestoneRef: milestone._id } },
      { new: true, runValidators: true },
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roadmaps/unlink-task/:taskId — unlink a task from its roadmap
router.delete('/unlink-task/:taskId', async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await Task.findByIdAndUpdate(task._id, {
      $set: { roadmapRef: null, phaseRef: null, milestoneRef: null },
    });

    res.json({ message: 'Task unlinked' });
  } catch (err) {
    next(err);
  }
});

// ── PERSONAL ANALYTICS ──────────────────────────────────────────────────────

// GET /api/roadmaps/analytics?days=30
router.get('/analytics', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 0;
    const sinceDate = days > 0 ? new Date(Date.now() - days * 86400000) : null;

    const roadmaps = await Roadmap.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const roadmapIds = roadmaps.map(r => r._id);

    if (roadmapIds.length === 0) {
      return res.json({
        overview: { progress: 0, activeRoadmaps: 0, completedMilestones: 0, totalMilestones: 0, completedTasks: 0, totalTasks: 0 },
        today: { tasksCompleted: 0, milestonesCompleted: 0, activeRoadmaps: 0 },
        roadmaps: [],
        phases: [],
        activity: { activeDays: 0, completedMilestones: 0, completedTasks: 0 },
        recentActivity: [],
      });
    }

    const [allPhases, allMilestones, allTasks] = await Promise.all([
      RoadmapPhase.find({ roadmapId: { $in: roadmapIds }, userId: req.user._id }),
      RoadmapMilestone.find({ roadmapId: { $in: roadmapIds }, userId: req.user._id }),
      Task.find({ roadmapRef: { $in: roadmapIds }, userId: req.user._id }),
    ]);

    // Overview
    const totalMilestones = allMilestones.length;
    const completedMilestones = allMilestones.filter(m => m.status === 'completed').length;
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const activeRoadmaps = roadmaps.filter(r => r.status === 'active' || r.status === 'planning').length;
    const overallProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    // Per-roadmap breakdown
    const roadmapStats = roadmaps.map(r => {
      const rPhases = allPhases.filter(p => String(p.roadmapId) === String(r._id));
      const rMilestones = allMilestones.filter(m => String(m.roadmapId) === String(r._id));
      const rTasks = allTasks.filter(t => String(t.roadmapRef) === String(r._id));
      const rCompletedMilestones = rMilestones.filter(m => m.status === 'completed').length;
      const rCompletedTasks = rTasks.filter(t => t.status === 'completed').length;
      const rProgress = rMilestones.length > 0 ? Math.round((rCompletedMilestones / rMilestones.length) * 100) : 0;
      const completedPhases = rPhases.filter(p => p.status === 'completed').length;
      return {
        _id: r._id,
        title: r.title,
        description: r.description,
        status: r.status,
        color: r.color,
        icon: r.icon,
        targetDate: r.targetDate,
        progress: rProgress,
        phaseTotal: rPhases.length,
        phaseCompleted: completedPhases,
        milestoneTotal: rMilestones.length,
        milestoneCompleted: rCompletedMilestones,
        taskTotal: rTasks.length,
        taskCompleted: rCompletedTasks,
      };
    });

    // Phase progress (all phases across all roadmaps, sorted by roadmap then order)
    const phaseStats = allPhases
      .sort((a, b) => {
        const ri = roadmapIds.indexOf(String(a.roadmapId));
        const rj = roadmapIds.indexOf(String(b.roadmapId));
        if (ri !== rj) return ri - rj;
        return a.order - b.order;
      })
      .map(p => {
        const pMilestones = allMilestones.filter(m => String(m.phaseId) === String(p._id));
        const pCompleted = pMilestones.filter(m => m.status === 'completed').length;
        const pTotal = pMilestones.length;
        const roadmap = roadmaps.find(r => String(r._id) === String(p.roadmapId));
        return {
          _id: p._id,
          title: p.title,
          status: p.status,
          order: p.order,
          roadmapId: p.roadmapId,
          roadmapTitle: roadmap?.title || '',
          progress: pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0,
          milestoneTotal: pTotal,
          milestoneCompleted: pCompleted,
        };
      });

    // Activity / consistency (derived from task updatedAt timestamps)
    const completedTaskDates = allTasks
      .filter(t => t.status === 'completed' && t.updatedAt)
      .map(t => {
        const d = new Date(t.updatedAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
    const uniqueActiveDays = new Set(completedTaskDates);

    // Milestone completion dates (from updatedAt)
    const completedMilestoneDates = allMilestones
      .filter(m => m.status === 'completed' && m.updatedAt)
      .map(m => {
        const d = new Date(m.updatedAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });

    // Filter by time range if specified
    let filteredActiveDays = uniqueActiveDays;
    let filteredCompletedMilestones = completedMilestones;
    let filteredCompletedTasks = completedTasks;
    if (sinceDate) {
      const sinceStr = `${sinceDate.getFullYear()}-${String(sinceDate.getMonth() + 1).padStart(2, '0')}-${String(sinceDate.getDate()).padStart(2, '0')}`;
      filteredActiveDays = new Set([...uniqueActiveDays].filter(d => d >= sinceStr));
      filteredCompletedMilestones = completedMilestoneDates.filter(d => d >= sinceStr).length;
      filteredCompletedTasks = completedTaskDates.filter(d => d >= sinceStr).length;
    }

    // Recent activity (last 10 completions from tasks and milestones)
    const recentTaskActivity = allTasks
      .filter(t => t.status === 'completed' && t.updatedAt)
      .map(t => ({
        type: 'task',
        title: t.title,
        date: t.updatedAt,
        roadmapId: t.roadmapRef,
      }));
    const recentMilestoneActivity = allMilestones
      .filter(m => m.status === 'completed' && m.updatedAt)
      .map(m => ({
        type: 'milestone',
        title: m.title,
        date: m.updatedAt,
        roadmapId: m.roadmapId,
      }));
    const recentActivity = [...recentTaskActivity, ...recentMilestoneActivity]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);

    // Today's stats
    const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const todayTasksCompleted = allTasks.filter(t => t.status === 'completed' && t.updatedAt && (() => { const d = new Date(t.updatedAt); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr; })()).length;
    const todayMilestonesCompleted = allMilestones.filter(m => m.status === 'completed' && m.updatedAt && (() => { const d = new Date(m.updatedAt); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr; })()).length;
    const todayActiveRoadmaps = roadmaps.filter(r => {
      if (r.status !== 'active' && r.status !== 'planning') return false;
      const rTasks = allTasks.filter(t => String(t.roadmapRef) === String(r._id));
      return rTasks.some(t => t.updatedAt && (() => { const d = new Date(t.updatedAt); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr; })());
    }).length;

    res.json({
      overview: {
        progress: overallProgress,
        activeRoadmaps,
        completedMilestones,
        totalMilestones,
        completedTasks,
        totalTasks,
      },
      today: {
        tasksCompleted: todayTasksCompleted,
        milestonesCompleted: todayMilestonesCompleted,
        activeRoadmaps: todayActiveRoadmaps,
      },
      roadmaps: roadmapStats,
      phases: phaseStats,
      activity: {
        activeDays: filteredActiveDays.size,
        completedMilestones: filteredCompletedMilestones,
        completedTasks: filteredCompletedTasks,
      },
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

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

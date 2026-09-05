const express = require('express');
const PersonalTask = require('../models/PersonalTask');
const PersonalSession = require('../models/PersonalSession');
const protect = require('../middleware/auth');
const { buildPatch } = require('../utils/patchSanitizer');
const { localDateToUtc, userTimezone } = require('../utils/dates');
const { logger } = require('../utils/logger');
const { z, objectId, dateInput, requiredString, validate } = require('../utils/validation');
const { resolvePersonalRoadmapLink } = require('../utils/personalRoadmapLinks');
const { cascadePersonalTaskStatusChange } = require('../utils/personalRoadmapCascade');

const router = express.Router();
router.use(protect);

const optObjectId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  objectId.optional()
);

function encodeDeadline(value, timeZone) {
  if (value === null || value === '') return null;
  if (value === undefined) return undefined;
  const raw = String(value);
  let dateKey;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    dateKey = raw;
  } else {
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return undefined;
    dateKey = new Date(ts).toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return undefined;
  return localDateToUtc(dateKey, timeZone);
}

async function loadTask(id, userId, selectFields) {
  const task = await PersonalTask.findOne({ _id: id }).select(selectFields || 'userId');
  if (!task) return { error: true, status: 404, message: 'Task not found' };
  if (task.userId && String(task.userId) !== String(userId)) {
    return { error: true, status: 404, message: 'Task not found' };
  }
  return { error: false, task };
}

const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'];
const TASK_STATUS = ['todo', 'active', 'paused', 'completed'];

const taskBase = {
  title: requiredString(200, 'title', 'Title is required'),
  description: z.string().max(5000, 'Description too long'),
  priority: z.enum(TASK_PRIORITY),
  status: z.enum(TASK_STATUS),
  category: z.string().trim().max(50, 'Category too long'),
  deadline: dateInput.optional(),
  color: z.string().trim().max(20, 'Color too long').optional(),
  tags: z.array(z.string().trim().max(50, 'Tag too long')).max(50, 'Too many tags'),
};

const subtaskItem = z.object({
  title: requiredString(200, 'Subtask title', 'Subtask title required'),
});

const gitContextSchema = z.object({
  repository: z.string().max(500, 'Too long').optional(),
  branch: z.string().max(200, 'Too long').optional(),
  commitHash: z.string().max(100, 'Too long').optional(),
  prNumber: z.number().int().min(0).optional(),
  prUrl: z.string().max(2000, 'Too long').optional(),
  reviewStatus: z.enum(['pending', 'approved', 'changes_requested']).optional(),
  reviewerName: z.string().max(200, 'Too long').optional(),
  mergeStatus: z.enum(['open', 'merged', 'closed']).optional(),
  deploymentStatus: z.enum(['staging', 'production', 'failed', 'not_deployed']).optional(),
}).passthrough();

const taskCreateSchema = z.object({
  ...taskBase,
  subtasks: z.array(subtaskItem).max(100, 'Too many subtasks').optional().default([]),
  scheduledDate: dateInput.optional(),
  personalRoadmapRef: optObjectId,
  personalPhaseRef: optObjectId,
  personalMilestoneRef: optObjectId,
}).passthrough();

const taskPatchSchema = z.object({
  ...taskBase,
  deadline: dateInput.nullable(),
  scheduledDate: dateInput.nullable(),
  personalRoadmapRef: optObjectId,
  personalPhaseRef: optObjectId,
  personalMilestoneRef: optObjectId,
}).partial().passthrough();

const taskParamsSchema = z.object({ id: objectId });
const subtaskParamsSchema = z.object({ id: objectId, subId: objectId });
const subtaskCreateSchema = z.object({
  title: requiredString(200, 'Subtask title', 'Subtask title required'),
});
const subtaskPatchSchema = z.object({ completed: z.boolean('completed must be a boolean') });

const TASK_PATCH_FIELDS = {
  title: true,
  description: true,
  priority: true,
  status: true,
  category: true,
  deadline: true,
  scheduledDate: true,
  color: true,
  tags: true,
  completedAt: true,
};

const reorderSchema = z.object({
  ids: z.array(objectId).min(1, 'ids must contain at least one task').max(500, 'Too many tasks'),
});

// GET /api/personal-tasks
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.scheduledDate) {
      const dayStart = new Date(req.query.scheduledDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      filter.scheduledDate = { $gte: dayStart, $lt: dayEnd };
    }
    const tasks = await PersonalTask.find(filter).sort({ createdAt: -1 });
    logger.debug({ count: tasks.length }, 'personal tasks fetched');
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-tasks
router.post('/', validate(taskCreateSchema), async (req, res, next) => {
  try {
    const { title, description, priority, status, category, deadline, color, tags, subtasks } = req.body;
    const { scheduledDate, personalRoadmapRef, personalPhaseRef, personalMilestoneRef } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const roadmapLink = await resolvePersonalRoadmapLink(req.user._id, { roadmapRef: personalRoadmapRef, phaseRef: personalPhaseRef, milestoneRef: personalMilestoneRef });
    if (!roadmapLink.ok) return res.status(roadmapLink.status).json({ message: roadmapLink.message });

    const task = await PersonalTask.create({
      userId: req.user._id,
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      status: status || 'todo',
      category: category || 'Work',
      color: color || '#0ea5e9',
      tags: tags || [],
      subtasks: subtasks || [],
      deadline: encodeDeadline(deadline, userTimezone(req.user)) || undefined,
      scheduledDate: scheduledDate || undefined,
      personalRoadmapRef: personalRoadmapRef || undefined,
      personalPhaseRef: personalPhaseRef || undefined,
      personalMilestoneRef: personalMilestoneRef || undefined,
    });

    logger.debug('personal task created');
    res.status(201).json(task);
    // Cascade if task created with completed status and linked to a milestone
    if (task.status === 'completed' && task.personalMilestoneRef) {
      await cascadePersonalTaskStatusChange(task).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-tasks/reorder
router.post('/reorder', validate(reorderSchema), async (req, res, next) => {
  try {
    const { ids } = req.body;
    const tasks = await PersonalTask.find({ _id: { $in: ids } });
    if (tasks.length !== ids.length) {
      return res.status(404).json({ message: 'Some tasks were not found' });
    }

    const owned = tasks.every((t) => t.userId && String(t.userId) === String(req.user._id));
    if (!owned) {
      return res.status(403).json({ message: 'You can only reorder your own tasks' });
    }

    await PersonalTask.bulkWrite(
      ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      })),
    );
    const updated = await PersonalTask.find({ _id: { $in: ids } }).sort({ order: 1 });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-tasks/:id
router.patch('/:id', validate(taskPatchSchema, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const patch = buildPatch(req.body, TASK_PATCH_FIELDS);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }
    if ('deadline' in patch) {
      patch.deadline = encodeDeadline(patch.deadline, userTimezone(req.user));
      if (patch.deadline === undefined) delete patch.deadline;
    }

    const loaded = await loadTask(req.params.id, req.user._id, 'userId personalMilestoneRef status');
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });
    const existing = loaded.task;

    if (patch.status === 'completed' && existing.status !== 'completed') {
      patch.completedAt = new Date();
    } else if (patch.status && patch.status !== 'completed' && existing.status === 'completed') {
      patch.completedAt = null;
    }

    const task = await PersonalTask.findOneAndUpdate(
      { _id: req.params.id },
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (patch.status && patch.status !== existing.status) {
      await cascadePersonalTaskStatusChange(task).catch(() => {});
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-tasks/:id/git
router.patch('/:id/git', validate(gitContextSchema, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadTask(req.params.id, req.user._id, 'userId');
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await PersonalTask.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { gitContext: req.body } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personal-tasks/:id
router.delete('/:id', validate(null, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadTask(req.params.id, req.user._id, 'userId');
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await PersonalTask.findOneAndDelete({ _id: req.params.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Cascade status update after task deletion
    if (task.personalMilestoneRef) {
      await cascadePersonalTaskStatusChange(task).catch(() => {});
    }

    await PersonalSession.deleteMany({ personalTaskId: req.params.id, userId: req.user._id });

    logger.debug('personal task deleted');
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-tasks/:id/subtasks
router.post('/:id/subtasks', validate(subtaskCreateSchema, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadTask(req.params.id, req.user._id, 'userId');
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await PersonalTask.findOneAndUpdate(
      { _id: req.params.id },
      { $push: { subtasks: { title: req.body.title } } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-tasks/:id/subtasks/:subId
router.patch('/:id/subtasks/:subId', validate(subtaskPatchSchema, { params: subtaskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadTask(req.params.id, req.user._id, 'userId');
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await PersonalTask.findOneAndUpdate(
      { _id: req.params.id, 'subtasks._id': req.params.subId },
      { $set: { 'subtasks.$.completed': req.body.completed } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task or subtask not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personal-tasks/:id/subtasks/:subId
router.delete('/:id/subtasks/:subId', validate(null, { params: subtaskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadTask(req.params.id, req.user._id, 'userId');
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await PersonalTask.findOneAndUpdate(
      { _id: req.params.id },
      { $pull: { subtasks: { _id: req.params.subId } } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

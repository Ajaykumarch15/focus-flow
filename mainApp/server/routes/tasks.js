const express = require('express');
const Task = require('../models/Task');
const Session = require('../models/Session');
const Journal = require('../models/Journal');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { buildPatch } = require('../utils/patchSanitizer');
const { syncWorkLog } = require('../utils/worklogSync');
const { localDateToUtc, userTimezone } = require('../utils/dates');
const { logger } = require('../utils/logger');
const { z, objectId, dateInput, requiredString, validate } = require('../utils/validation');
const { cascadeTaskStatusChange } = require('../utils/roadmapCascade');
const { resolveRoadmapLink } = require('../utils/roadmapLinks');

const router = express.Router();
router.use(protect);

// Clients sometimes send empty-string refs ("") — treat those as absent.
const optObjectId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  objectId.optional()
);

// Deadlines are calendar dates ("YYYY-MM-DD") in the user's timezone, stored
// as that day's tz-midnight instant so dayKey(deadline, tz) round-trips.
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

const taskCreateSchema = z.object({
  ...taskBase,
  subtasks: z.array(subtaskItem).max(100, 'Too many subtasks').optional().default([]),
  labels: z.array(z.string().trim().max(50, 'Label too long')).max(50, 'Too many labels').optional(),
  dependencies: z.array(objectId).max(100, 'Too many dependencies').optional(),
  // Personal roadmap refs
  roadmapRef: optObjectId,
  phaseRef: optObjectId,
  milestoneRef: optObjectId,
}).passthrough();

const taskPatchSchema = z.object({
  ...taskBase,
  deadline: dateInput.nullable(),
  labels: z.array(z.string().trim().max(50, 'Label too long')).max(50, 'Too many labels').optional(),
  dependencies: z.array(objectId).max(100, 'Too many dependencies').optional(),
  // Personal roadmap refs
  roadmapRef: optObjectId,
  phaseRef: optObjectId,
  milestoneRef: optObjectId,
}).partial().passthrough();

const taskParamsSchema = z.object({ id: objectId });
const subtaskParamsSchema = z.object({ id: objectId, subId: objectId });
const subtaskCreateSchema = z.object({
  title: requiredString(200, 'Subtask title', 'Subtask title required'),
});
const subtaskPatchSchema = z.object({ completed: z.boolean('completed must be a boolean') });

// Fields a client may update on a Task via PATCH. Everything else is rejected.
const TASK_PATCH_FIELDS = {
  title: true,
  description: true,
  priority: true,
  status: true,
  category: true,
  deadline: true,
  color: true,
  tags: true,
  labels: true,
  dependencies: true,
  completedAt: true,
};

// Personal tasks are private to their owner.
async function loadOwnedTask(id, user) {
  const task = await Task.findOne({ _id: id }).select('userId dependencies');
  if (!task) return { error: true, status: 404, message: 'Task not found' };
  if (task.userId && String(task.userId) !== String(user._id)) {
    return { error: true, status: 404, message: 'Task not found' };
  }
  return { error: false, task };
}

// Cycle guard for `dependencies`: walk each candidate's transitive deps and
// reject the moment one reaches the parent (a self-dependency is trivial).
async function wouldCreateDependencyCycle(taskId, dependencyIds) {
  const seen = new Set();
  const stack = [...dependencyIds];
  let queries = 0;
  const MAX_QUERIES = 200;
  while (stack.length) {
    const id = stack.pop();
    const key = String(id);
    if (key === String(taskId)) return true;
    if (seen.has(key)) continue;
    seen.add(key);
    if (++queries > MAX_QUERIES) break;
    const dep = await Task.findById(id).select('dependencies');
    if (dep && Array.isArray(dep.dependencies)) stack.push(...dep.dependencies);
  }
  return false;
}

// Dependencies must reference existing tasks owned by the same user.
async function validateDependencySet({ parentTaskId, ownerUserId, dependencyIds }) {
  const raw = Array.isArray(dependencyIds) ? dependencyIds.filter((d) => d != null) : [];
  const ids = [...new Set(raw.map((d) => String(d)))];
  if (ids.length === 0) return { error: false, ids: [] };

  const deps = await Task.find({ _id: { $in: ids } });
  if (deps.length !== ids.length) {
    return { error: true, status: 404, message: 'Some dependency tasks were not found' };
  }
  const owned = deps.every((d) => d.userId && String(d.userId) === String(ownerUserId));
  if (!owned) {
    return { error: true, status: 400, message: 'You can only depend on your own tasks' };
  }
  if (parentTaskId && (await wouldCreateDependencyCycle(parentTaskId, ids))) {
    return { error: true, status: 400, message: 'This dependency would create a cycle' };
  }
  return { error: false, ids };
}

// GET /api/tasks — the signed-in user's tasks.
router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });
    logger.debug({ count: tasks.length }, 'tasks fetched');
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/', validate(taskCreateSchema), async (req, res, next) => {
  try {
    const { title, description, priority, status, category, deadline, color, tags } = req.body;
    const { labels, dependencies, roadmapRef, phaseRef, milestoneRef, skipWorkLogCreation } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const roadmapLink = await resolveRoadmapLink(req.user._id, { roadmapRef, phaseRef, milestoneRef });
    if (!roadmapLink.ok) return res.status(roadmapLink.status).json({ message: roadmapLink.message });

    if (dependencies && dependencies.length) {
      const depErr = await validateDependencySet({
        parentTaskId: null,
        ownerUserId: req.user._id,
        dependencyIds: dependencies,
      });
      if (depErr.error) return res.status(depErr.status).json({ message: depErr.message });
    }

    const task = await Task.create({
      userId: req.user._id,
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      status: status || 'todo',
      category: category || 'Work',
      color: color || '#0ea5e9',
      tags: tags || [],
      labels: labels || [],
      dependencies: dependencies || [],
      subtasks: req.body.subtasks || [],
      deadline: encodeDeadline(deadline, userTimezone(req.user)) || undefined,
      roadmapRef: roadmapRef || undefined,
      phaseRef: phaseRef || undefined,
      milestoneRef: milestoneRef || undefined,
    });

    logger.debug('task created');
    res.status(201).json(task);
    if (task.status === 'completed' && task.milestoneRef) {
      await cascadeTaskStatusChange(task).catch(() => {});
    }
    Activity.create({ userId: req.user._id, action: 'task.created', details: { taskTitle: task.title, taskId: task._id } }).catch(() => {});
    if (!skipWorkLogCreation) {
      WorkLog.create({
        userId: req.user._id,
        title: `Work on ${task.title}`,
        taskRef: task._id,
        isActive: true,
        status: 'in-progress',
        totalActiveMs: 0,
        workEntries: [],
      }).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/reorder — personal tasks in display order.
const reorderSchema = z.object({
  ids: z.array(objectId).min(1, 'ids must contain at least one task').max(500, 'Too many tasks'),
});

router.post('/reorder', validate(reorderSchema), async (req, res, next) => {
  try {
    const { ids } = req.body;
    const tasks = await Task.find({ _id: { $in: ids } });
    if (tasks.length !== ids.length) {
      return res.status(404).json({ message: 'Some tasks were not found' });
    }
    const owned = tasks.every((t) => t.userId && String(t.userId) === String(req.user._id));
    if (!owned) {
      return res.status(403).json({ message: 'You can only reorder your own tasks' });
    }

    await Task.bulkWrite(
      ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      })),
    );
    const updated = await Task.find({ _id: { $in: ids } }).sort({ order: 1 });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id
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

    const loaded = await loadOwnedTask(req.params.id, req.user);
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });
    const existing = loaded.task;

    if (patch.dependencies !== undefined) {
      const depErr = await validateDependencySet({
        parentTaskId: req.params.id,
        ownerUserId: req.user._id,
        dependencyIds: patch.dependencies,
      });
      if (depErr.error) return res.status(depErr.status).json({ message: depErr.message });
      patch.dependencies = depErr.ids;
    }

    if (patch.status === 'completed' && existing.status !== 'completed') {
      patch.completedAt = new Date();
    } else if (patch.status && patch.status !== 'completed' && existing.status === 'completed') {
      patch.completedAt = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.milestoneRef && patch.status && patch.status !== existing.status) {
      await cascadeTaskStatusChange(task).catch(() => {});
    }
    res.json(task);
    if (req.body.status === 'completed') {
      Activity.create({ userId: req.user._id, action: 'task.completed', details: { taskTitle: task.title, taskId: task._id } }).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', validate(null, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadOwnedTask(req.params.id, req.user);
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.milestoneRef) {
      await cascadeTaskStatusChange(task).catch(() => {});
    }

    const workLogs = await WorkLog.find({ taskRef: req.params.id, userId: req.user._id });
    await Promise.all([
      Session.deleteMany({ taskId: req.params.id, userId: req.user._id }),
      Journal.deleteMany({ taskId: req.params.id, userId: req.user._id }),
    ]);

    const timeZone = userTimezone(req.user);
    await Promise.all(workLogs.map(async (log) => {
      await syncWorkLog(log, req.user._id, { timeZone, persist: false });
      log.taskRef = undefined;
      await log.save();
    }));

    logger.debug('task deleted');
    res.json({ message: 'Task deleted' });
    Activity.create({ userId: req.user._id, action: 'task.deleted', details: { taskTitle: task.title } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', validate(subtaskCreateSchema, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadOwnedTask(req.params.id, req.user);
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { subtasks: { title: req.body.title } } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/subtasks/:subId
router.patch('/:id/subtasks/:subId', validate(subtaskPatchSchema, { params: subtaskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadOwnedTask(req.params.id, req.user);
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, 'subtasks._id': req.params.subId, userId: req.user._id },
      { $set: { 'subtasks.$.completed': req.body.completed } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task or subtask not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id/subtasks/:subId
router.delete('/:id/subtasks/:subId', validate(null, { params: subtaskParamsSchema }), async (req, res, next) => {
  try {
    const loaded = await loadOwnedTask(req.params.id, req.user);
    if (loaded.error) return res.status(loaded.status).json({ message: loaded.message });

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
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

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

const router = express.Router();
router.use(protect);

// IES-P1-06: deadlines are calendar dates ("YYYY-MM-DD") in the user's timezone,
// stored as that day's tz-midnight instant so `dayKey(deadline, tz)` always
// round-trips to the picked date. A raw "YYYY-MM-DD" from a date input is used
// verbatim; anything else (epoch ms / ISO) represents a picked UTC calendar date
// from the legacy client, so it is decoded via the instant's UTC day to avoid
// drifting a day early in negative-offset timezones.
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

// IES-P0-16: body/param schemas.
const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'];
const TASK_STATUS = ['todo', 'active', 'paused', 'completed'];

const taskBase = {
  title: requiredString(200, 'title', 'Title is required'),
  description: z.string().max(5000, 'Description too long'),
  priority: z.enum(TASK_PRIORITY),
  status: z.enum(TASK_STATUS),
  category: z.string().trim().max(50, 'Category too long'),
  deadline: dateInput,
  color: z.string().trim().max(20, 'Color too long'),
  tags: z.array(z.string().trim().max(50, 'Tag too long')).max(50, 'Too many tags'),
};

const subtaskItem = z.object({
  title: requiredString(200, 'Subtask title', 'Subtask title required'),
});

const taskCreateSchema = z.object({
  ...taskBase,
  subtasks: z.array(subtaskItem).max(100, 'Too many subtasks'),
}).passthrough();

const taskPatchSchema = z.object({
  ...taskBase,
  deadline: dateInput.nullable(),
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
};

// GET /api/tasks
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
    const { title, description, priority, status, category, deadline, color, tags, subtasks } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
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
      subtasks: subtasks || [],
      deadline: encodeDeadline(deadline, userTimezone(req.user)) || undefined,
    });

    logger.debug('task created');
    res.status(201).json(task);
    Activity.create({ userId: req.user._id, action: 'task.created', details: { taskTitle: task.title, taskId: task._id } }).catch(() => {});
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

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
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
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // IES-P1-09: the cascade removes the task's sessions/journal, and any
    // worklog linked via taskRef must not keep dangling `sessionIds` or a stale
    // `totalActiveMs`. Recompute each affected log against its (now-deleted)
    // sessions — the single source of truth — which strips the orphaned ids and
    // zeroes the derived totals, then unlink the task.
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
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, 'subtasks._id': req.params.subId },
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

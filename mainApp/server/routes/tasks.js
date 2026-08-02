const express = require('express');
const Task = require('../models/Task');
const Session = require('../models/Session');
const Journal = require('../models/Journal');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { buildPatch } = require('../utils/patchSanitizer');

const router = express.Router();
router.use(protect);

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
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });
    console.log(`📋 Fetched ${tasks.length} tasks for user ${req.user._id}`);
    res.json(tasks);
  } catch (err) {
    console.error('GET /tasks error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
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
      deadline: deadline ? new Date(deadline) : undefined,
    });

    console.log(`✅ Task created: "${task.title}" (${task._id}) for user ${req.user._id}`);
    res.status(201).json(task);
    Activity.create({ userId: req.user._id, action: 'task.created', details: { taskTitle: task.title, taskId: task._id } }).catch(() => {});
  } catch (err) {
    console.error('POST /tasks error:', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  try {
    const patch = buildPatch(req.body, TASK_PATCH_FIELDS);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
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
    console.error('PATCH /tasks/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    await Promise.all([
      Session.deleteMany({ taskId: req.params.id, userId: req.user._id }),
      Journal.deleteMany({ taskId: req.params.id, userId: req.user._id }),
      WorkLog.updateMany(
        { taskRef: req.params.id, userId: req.user._id },
        { $unset: { taskRef: '' } }
      ),
    ]);
    console.log(`🗑 Task deleted: ${req.params.id}`);
    res.json({ message: 'Task deleted' });
    Activity.create({ userId: req.user._id, action: 'task.deleted', details: { taskTitle: task.title } }).catch(() => {});
  } catch (err) {
    console.error('DELETE /tasks/:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { subtasks: { title: req.body.title } } },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/tasks/:id/subtasks/:subId
router.patch('/:id/subtasks/:subId', async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, 'subtasks._id': req.params.subId },
      { $set: { 'subtasks.$.completed': req.body.completed } },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task or subtask not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/tasks/:id/subtasks/:subId
router.delete('/:id/subtasks/:subId', async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { subtasks: { _id: req.params.subId } } },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

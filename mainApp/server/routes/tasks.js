const express = require('express');
const Task = require('../models/Task');
const Session = require('../models/Session');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

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
  } catch (err) {
    console.error('POST /tasks error:', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
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
    await Session.deleteMany({ taskId: req.params.id });
    console.log(`🗑 Task deleted: ${req.params.id}`);
    res.json({ message: 'Task deleted' });
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

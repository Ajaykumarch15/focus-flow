const express = require('express');
const Habit = require('../models/Habit');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function findTodayEntry(habit) {
  const today = todayMidnight().getTime();
  return habit.entries.find(entry => {
    const d = new Date(entry.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today;
  });
}

router.get('/', async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.user._id, archived: false }).sort({ updatedAt: -1 });
    res.json(habits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, color, targetMinutes, checklist } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Title is required' });

    const habit = await Habit.create({
      userId: req.user._id,
      title: title.trim(),
      description: description || '',
      color: color || '#22c55e',
      targetMinutes: Number(targetMinutes) || 20,
      checklist: (checklist || [])
        .filter(item => item?.text?.trim())
        .map((item, index) => ({ text: item.text.trim(), order: index })),
      entries: [],
    });

    res.status(201).json(habit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['title', 'description', 'color', 'targetMinutes', 'archived'];
    const patch = {};
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key];
    }

    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!habit) return res.status(404).json({ message: 'Habit not found' });
    res.json(habit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const habit = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/checklist', async (req, res) => {
  try {
    if (!req.body.text?.trim()) return res.status(400).json({ message: 'Checklist text is required' });
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });

    habit.checklist.push({ text: req.body.text.trim(), order: habit.checklist.length });
    await habit.save();
    res.json(habit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/checklist/:itemId', async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });

    const item = habit.checklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Checklist item not found' });
    if (req.body.text !== undefined) item.text = req.body.text;
    if (req.body.order !== undefined) item.order = req.body.order;

    await habit.save();
    res.json(habit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id/checklist/:itemId', async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });

    habit.checklist.pull({ _id: req.params.itemId });
    for (const entry of habit.entries) {
      entry.completedItems = entry.completedItems.filter(item => item.toString() !== req.params.itemId);
    }
    await habit.save();
    res.json(habit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/today', async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });

    let entry = findTodayEntry(habit);
    if (!entry) {
      habit.entries.push({ date: todayMidnight(), completedItems: [], minutes: 0, feeling: 'okay', note: '' });
      entry = habit.entries[habit.entries.length - 1];
    }

    if (Array.isArray(req.body.completedItems)) entry.completedItems = req.body.completedItems;
    if (req.body.minutes !== undefined) entry.minutes = Math.max(0, Number(req.body.minutes) || 0);
    if (req.body.feeling !== undefined) entry.feeling = req.body.feeling;
    if (req.body.note !== undefined) entry.note = req.body.note;

    await habit.save();
    res.json(habit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

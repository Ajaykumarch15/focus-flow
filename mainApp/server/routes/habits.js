const express = require('express');
const Habit = require('../models/Habit');
const protect = require('../middleware/auth');
const { dayKey, localDateToUtc, userTimezone } = require('../utils/dates');
const { z, objectId, intInRange, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param schemas.
const HABIT_FEELINGS = ['rough', 'okay', 'good', 'great', 'energized'];

const habitBase = {
  title: requiredString(100, 'title', 'Title is required'),
  description: z.string().max(2000, 'Description too long').optional(),
  color: z.string().trim().max(20, 'Color too long').optional(),
  targetMinutes: intInRange(0, 1440, 'targetMinutes').optional(),
};

const habitCreateSchema = z.object({
  ...habitBase,
  checklist: z.array(
    z.object({ text: requiredString(100, 'checklist item', 'Checklist item text is required') })
  ).max(50, 'Too many checklist items').optional(),
}).passthrough();

const habitPatchSchema = z.object({ ...habitBase, archived: z.boolean() }).partial().passthrough();

const habitParamsSchema = z.object({ id: objectId });
const habitItemParamsSchema = z.object({ id: objectId, itemId: objectId });

const checklistCreateSchema = z.object({
  text: requiredString(100, 'checklist item', 'Checklist text is required'),
});
const checklistPatchSchema = z.object({
  text: requiredString(100, 'checklist item', 'Checklist item text is required').optional(),
  order: intInRange(0, 1000, 'order').optional(),
});
const habitTodaySchema = z.object({
  completedItems: z.array(objectId).max(100, 'Too many completed items'),
  minutes: z.coerce.number().finite('minutes must be a number').min(0, 'minutes must be at least 0').max(1440, 'minutes too large'),
  feeling: z.enum(HABIT_FEELINGS),
  note: z.string().max(2000, 'Note too long'),
}).partial().passthrough();

// IES-P1-06: "today" for habit entries is the calendar day in the user's
// timezone. Entry dates are stored as the tz-midnight instant (`localDateToUtc`)
// so `dayKey(entry.date.getTime(), tz)` round-trips to the same day.
function todayMidnight(user) {
  const timeZone = userTimezone(user);
  return localDateToUtc(dayKey(Date.now(), timeZone), timeZone);
}

function findTodayEntry(habit, user) {
  const timeZone = userTimezone(user);
  const today = dayKey(Date.now(), timeZone);
  return habit.entries.find(entry => dayKey(entry.date.getTime(), timeZone) === today);
}

router.get('/', async (req, res, next) => {
  try {
    const habits = await Habit.find({ userId: req.user._id, archived: false }).sort({ updatedAt: -1 });
    res.json(habits);
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(habitCreateSchema), async (req, res, next) => {
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
    next(err);
  }
});

router.patch('/:id', validate(habitPatchSchema, { params: habitParamsSchema }), async (req, res, next) => {
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
    next(err);
  }
});

router.delete('/:id', validate(null, { params: habitParamsSchema }), async (req, res, next) => {
  try {
    const habit = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/checklist', validate(checklistCreateSchema, { params: habitParamsSchema }), async (req, res, next) => {
  try {
    if (!req.body.text?.trim()) return res.status(400).json({ message: 'Checklist text is required' });
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });

    habit.checklist.push({ text: req.body.text.trim(), order: habit.checklist.length });
    await habit.save();
    res.json(habit);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/checklist/:itemId', validate(checklistPatchSchema, { params: habitItemParamsSchema }), async (req, res, next) => {
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
    next(err);
  }
});

router.delete('/:id/checklist/:itemId', validate(null, { params: habitItemParamsSchema }), async (req, res, next) => {
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
    next(err);
  }
});

router.patch('/:id/today', validate(habitTodaySchema, { params: habitParamsSchema }), async (req, res, next) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ message: 'Habit not found' });

    let entry = findTodayEntry(habit, req.user);
    if (!entry) {
      habit.entries.push({ date: todayMidnight(req.user), completedItems: [], minutes: 0, feeling: 'okay', note: '' });
      entry = habit.entries[habit.entries.length - 1];
    }

    if (Array.isArray(req.body.completedItems)) entry.completedItems = req.body.completedItems;
    if (req.body.minutes !== undefined) entry.minutes = Math.max(0, Number(req.body.minutes) || 0);
    if (req.body.feeling !== undefined) entry.feeling = req.body.feeling;
    if (req.body.note !== undefined) entry.note = req.body.note;

    await habit.save();
    res.json(habit);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

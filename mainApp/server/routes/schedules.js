const express = require('express');
const Schedule = require('../models/Schedule');
const Task = require('../models/Task');
const Session = require('../models/Session');
const protect = require('../middleware/auth');
const { z, objectId, dateKey, validate, httpError } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// Helper to convert "HH:mm" string to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Check for overlapping schedule entries for the user on a date
async function checkScheduleConflict(userId, date, startTime, endTime, excludeId = null) {
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);

  const query = {
    userId,
    date,
    status: { $ne: 'cancelled' },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingSchedules = await Schedule.find(query).populate('taskId', 'title');

  for (const item of existingSchedules) {
    const exStart = timeToMinutes(item.startTime);
    const exEnd = timeToMinutes(item.endTime);

    if (newStart < exEnd && newEnd > exStart) {
      const taskTitle = item.taskId?.title || 'Another task';
      return {
        hasConflict: true,
        conflictingSchedule: item,
        warning: `Schedule conflict: You already have "${taskTitle}" scheduled from ${item.startTime} to ${item.endTime}.`,
      };
    }
  }

  return { hasConflict: false };
}

// GET /api/schedules?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { date, from, to } = req.query;
    const filter = { userId: req.user._id };

    if (date) {
      filter.date = date;
    } else if (from && to) {
      filter.date = { $gte: from, $lte: to };
    }

    const schedules = await Schedule.find(filter)
      .populate('taskId')
      .sort({ date: 1, startTime: 1 });

    // Collect all valid task IDs for batched Session querying (eliminating N+1)
    const taskIds = Array.from(
      new Set(
        schedules
          .map((s) => s.taskId && s.taskId._id ? s.taskId._id.toString() : null)
          .filter(Boolean)
      )
    );

    let sessionMap = new Map();
    if (taskIds.length > 0) {
      // Find all sessions for these tasks belonging to the user
      const sessions = await Session.find({
        userId: req.user._id,
        taskId: { $in: taskIds },
      });

      // Group sessions by `${taskId}:${date}` matching exact calendar day in local offset
      for (const s of sessions) {
        if (!s.startTime) continue;
        const dt = new Date(s.startTime);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const key = `${s.taskId.toString()}:${dateStr}`;
        const current = sessionMap.get(key) || 0;
        sessionMap.set(key, current + (s.activeTime || 0));
      }
    }

    const populated = schedules.map((doc) => {
      const item = doc.toObject();
      if (item.taskId && item.taskId._id) {
        const key = `${item.taskId._id.toString()}:${item.date}`;
        item.actualTimeMs = sessionMap.get(key) || 0;
      } else {
        item.actualTimeMs = 0;
      }
      return item;
    });

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

const scheduleSchema = z.object({
  taskId: objectId,
  date: dateKey,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:mm'),
  notes: z.string().optional().default(''),
  status: z.enum(['scheduled', 'in-progress', 'completed', 'missed', 'cancelled']).optional().default('scheduled'),
  recurrence: z.enum(['none', 'daily', 'weekly', 'custom']).optional().default('none'),
});

// POST /api/schedules - Create a schedule entry
router.post('/', validate(scheduleSchema), async (req, res, next) => {
  try {
    const { taskId, date, startTime, endTime, notes, status, recurrence } = req.body;

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      throw httpError(400, 'BAD_REQUEST', 'endTime must be after startTime');
    }

    // Verify task belongs to user
    const task = await Task.findOne({ _id: taskId, userId: req.user._id });
    if (!task) {
      throw httpError(404, 'NOT_FOUND', 'Task not found or unauthorized');
    }

    const conflictResult = await checkScheduleConflict(req.user._id, date, startTime, endTime);

    const schedule = await Schedule.create({
      userId: req.user._id,
      taskId,
      date,
      startTime,
      endTime,
      notes,
      status,
      recurrence,
    });

    const populated = await Schedule.findById(schedule._id).populate('taskId');

    res.status(201).json({
      schedule: populated,
      warning: conflictResult.hasConflict ? conflictResult.warning : undefined,
    });
  } catch (err) {
    next(err);
  }
});

const schedulePatchSchema = scheduleSchema.partial();

// PATCH /api/schedules/:id - Edit a schedule entry
router.patch('/:id', validate(schedulePatchSchema, { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id, userId: req.user._id });
    if (!schedule) {
      throw httpError(404, 'NOT_FOUND', 'Schedule entry not found');
    }

    if (req.body.taskId) {
      const task = await Task.findOne({ _id: req.body.taskId, userId: req.user._id });
      if (!task) {
        throw httpError(404, 'NOT_FOUND', 'Task not found');
      }
      schedule.taskId = req.body.taskId;
    }

    if (req.body.date) schedule.date = req.body.date;
    if (req.body.startTime) schedule.startTime = req.body.startTime;
    if (req.body.endTime) schedule.endTime = req.body.endTime;
    if (req.body.notes !== undefined) schedule.notes = req.body.notes;
    if (req.body.status) schedule.status = req.body.status;
    if (req.body.recurrence) schedule.recurrence = req.body.recurrence;

    if (timeToMinutes(schedule.endTime) <= timeToMinutes(schedule.startTime)) {
      throw httpError(400, 'BAD_REQUEST', 'endTime must be after startTime');
    }

    const conflictResult = await checkScheduleConflict(
      req.user._id,
      schedule.date,
      schedule.startTime,
      schedule.endTime,
      schedule._id
    );

    await schedule.save();
    const populated = await Schedule.findById(schedule._id).populate('taskId');

    res.json({
      schedule: populated,
      warning: conflictResult.hasConflict ? conflictResult.warning : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/schedules/:id - Delete a schedule entry (Task is NOT deleted)
router.delete('/:id', validate(null, { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const schedule = await Schedule.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!schedule) {
      throw httpError(404, 'NOT_FOUND', 'Schedule entry not found');
    }

    res.json({ success: true, message: 'Schedule entry deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

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
// Also supports: ?workspaceId=, ?projectId=, ?userIds=comma-separated
router.get('/', async (req, res, next) => {
  try {
    const { date, from, to, workspaceId, projectId, userIds } = req.query;
    const filter = {};

    // Workspace/project scoping (omitting userId = team view)
    if (workspaceId) {
      filter.workspaceId = workspaceId;
      if (projectId) filter.projectId = projectId;
      if (userIds) {
        filter.userId = { $in: userIds.split(',') };
      }
    } else {
      filter.userId = req.user._id;
    }

    if (date) {
      filter.date = date;
    } else if (from && to) {
      filter.date = { $gte: from, $lte: to };
    }

    const schedules = await Schedule.find(filter)
      .populate('taskId')
      .populate('userId', 'name email avatar')
      .sort({ date: 1, startTime: 1 });

    const taskIds = Array.from(
      new Set(
        schedules
          .map((s) => s.taskId && s.taskId._id ? s.taskId._id.toString() : null)
          .filter(Boolean)
      )
    );

    const ownerIds = Array.from(
      new Set(schedules.map((s) => s.userId?._id?.toString() || s.userId?.toString()).filter(Boolean))
    );

    let sessionMap = new Map();
    if (taskIds.length > 0) {
      const sessionFilter = { taskId: { $in: taskIds } };
      if (!workspaceId) sessionFilter.userId = req.user._id;
      else if (ownerIds.length > 0) sessionFilter.userId = { $in: ownerIds };

      const sessions = await Session.find(sessionFilter);

      for (const s of sessions) {
        if (!s.startTime) continue;
        const dt = new Date(s.startTime);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const key = `${s.taskId.toString()}:${s.userId.toString()}:${dateStr}`;
        const current = sessionMap.get(key) || 0;
        sessionMap.set(key, current + (s.activeTime || 0));
      }
    }

    const populated = schedules.map((doc) => {
      const item = doc.toObject();
      const ownerKey = (item.userId?._id || item.userId)?.toString();
      if (item.taskId && item.taskId._id) {
        const key = `${item.taskId._id.toString()}:${ownerKey}:${item.date}`;
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

// GET /api/schedules/team?workspaceId=&date=YYYY-MM-DD
// Returns all schedules for all members in a workspace on a given date (or date range)
router.get('/team', async (req, res, next) => {
  try {
    const { workspaceId, date, from, to } = req.query;
    if (!workspaceId) {
      throw httpError(400, 'BAD_REQUEST', 'workspaceId is required');
    }

    const filter = { workspaceId };
    if (date) {
      filter.date = date;
    } else if (from && to) {
      filter.date = { $gte: from, $lte: to };
    }

    const schedules = await Schedule.find(filter)
      .populate('taskId')
      .populate('userId', 'name email avatar')
      .sort({ date: 1, startTime: 1 });

    const taskIds = Array.from(
      new Set(schedules.map((s) => s.taskId?._id?.toString()).filter(Boolean))
    );
    const ownerIds = Array.from(
      new Set(schedules.map((s) => s.userId?._id?.toString()).filter(Boolean))
    );

    let sessionMap = new Map();
    if (taskIds.length > 0 && ownerIds.length > 0) {
      const sessions = await Session.find({
        taskId: { $in: taskIds },
        userId: { $in: ownerIds },
      });

      for (const s of sessions) {
        if (!s.startTime) continue;
        const dt = new Date(s.startTime);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const key = `${s.taskId.toString()}:${s.userId.toString()}:${dateStr}`;
        const current = sessionMap.get(key) || 0;
        sessionMap.set(key, current + (s.activeTime || 0));
      }
    }

    const populated = schedules.map((doc) => {
      const item = doc.toObject();
      const ownerKey = item.userId?._id?.toString();
      if (item.taskId && item.taskId._id) {
        const key = `${item.taskId._id.toString()}:${ownerKey}:${item.date}`;
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
  userId: objectId.optional(),
  date: dateKey,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:mm'),
  notes: z.string().optional().default(''),
  status: z.enum(['scheduled', 'in-progress', 'completed', 'missed', 'cancelled']).optional().default('scheduled'),
  recurrence: z.enum(['none', 'daily', 'weekly', 'custom']).optional().default('none'),
  workspaceId: objectId.nullable().optional(),
  projectId: objectId.nullable().optional(),
});

// POST /api/schedules - Create a schedule entry
router.post('/', validate(scheduleSchema), async (req, res, next) => {
  try {
    const { taskId, date, startTime, endTime, notes, status, recurrence, workspaceId, projectId, userId } = req.body;

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      throw httpError(400, 'BAD_REQUEST', 'endTime must be after startTime');
    }

    // For workspace scheduling, assign to specified user; otherwise current user
    const targetUserId = userId || req.user._id;

    const schedule = await Schedule.create({
      userId: targetUserId,
      taskId,
      date,
      startTime,
      endTime,
      notes,
      status,
      recurrence,
      workspaceId: workspaceId || null,
      projectId: projectId || null,
      assignedBy: workspaceId ? req.user._id : null,
    });

    const populated = await Schedule.findById(schedule._id)
      .populate('taskId')
      .populate('userId', 'name email avatar');

    res.status(201).json({ schedule: populated });
  } catch (err) {
    next(err);
  }
});

const schedulePatchSchema = scheduleSchema.partial();

// PATCH /api/schedules/:id - Edit a schedule entry
router.patch('/:id', validate(schedulePatchSchema, { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id });
    if (!schedule) {
      throw httpError(404, 'NOT_FOUND', 'Schedule entry not found');
    }

    // For personal schedules, verify ownership; for workspace schedules, allow assigned user or assigner
    if (!schedule.workspaceId && schedule.userId.toString() !== req.user._id.toString()) {
      throw httpError(403, 'FORBIDDEN', 'Not authorized');
    }

    if (req.body.userId) schedule.userId = req.body.userId;
    if (req.body.taskId) schedule.taskId = req.body.taskId;
    if (req.body.date) schedule.date = req.body.date;
    if (req.body.startTime) schedule.startTime = req.body.startTime;
    if (req.body.endTime) schedule.endTime = req.body.endTime;
    if (req.body.notes !== undefined) schedule.notes = req.body.notes;
    if (req.body.status) schedule.status = req.body.status;
    if (req.body.recurrence) schedule.recurrence = req.body.recurrence;

    if (timeToMinutes(schedule.endTime) <= timeToMinutes(schedule.startTime)) {
      throw httpError(400, 'BAD_REQUEST', 'endTime must be after startTime');
    }

    await schedule.save();
    const populated = await Schedule.findById(schedule._id)
      .populate('taskId')
      .populate('userId', 'name email avatar');

    res.json({ schedule: populated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/schedules/:id - Delete a schedule entry (Task is NOT deleted)
router.delete('/:id', validate(null, { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id });
    if (!schedule) {
      throw httpError(404, 'NOT_FOUND', 'Schedule entry not found');
    }

    if (!schedule.workspaceId && schedule.userId.toString() !== req.user._id.toString()) {
      throw httpError(403, 'FORBIDDEN', 'Not authorized');
    }

    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Schedule entry deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

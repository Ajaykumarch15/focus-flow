const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const Team = require('../models/Team');
const ReportShare = require('../models/ReportShare');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const reportsRouter = require('./reports');
const { buildDayReport, buildSummaryDays, resolveSummaryRange, userTimezone, dayKey, isValidDateKey } = reportsRouter.helpers;
const { runSystemAnalytics } = require('../utils/adminAnalytics');
const { logger } = require('../utils/logger');
const { z, objectId, email, validate } = require('../utils/validation');

const router = express.Router();

// IES-P0-16: body/param/query schemas.
//
// IES-P1-22: the `settings` object is whitelisted field-by-field so hostile or
// misshapen values can't be persisted. Bounds mirror the User model settings
// sub-schema and the Settings UI (dailyGoal 0–24h, pomodoro 1–120/1–60 min,
// 6-digit hex accent, fixed enums). `.strict()` rejects unknown keys entirely.
const settingsNumber = (label, { min, max, int = false } = {}) => {
  let schema = z.coerce.number({ message: `${label} must be a number` });
  if (int) schema = schema.int(`${label} must be an integer`);
  if (min !== undefined) schema = schema.min(min, `${label} must be at least ${min}`);
  if (max !== undefined) schema = schema.max(max, `${label} must be at most ${max}`);
  // Number(null) === 0 and Number('') === 0 — pre-process those into NaN so a
  // junk value is rejected instead of silently becoming the minimum.
  return z.preprocess((value) => (value === null || value === '' ? NaN : value), schema);
};

const adminSettingsSchema = z.object({
  mode: z.enum(['dark', 'light']),
  dailyGoal: settingsNumber('dailyGoal', { min: 0, max: 24 }),
  pomodoroWork: settingsNumber('pomodoroWork', { min: 1, max: 120, int: true }),
  pomodoroBreak: settingsNumber('pomodoroBreak', { min: 1, max: 60, int: true }),
  timezone: z.string().trim().min(1, 'Timezone cannot be empty').max(50, 'Timezone too long'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid accent color'),
  fontSize: z.enum(['sm', 'md', 'lg']),
  glassmorphism: z.boolean(),
  animatedBg: z.boolean(),
  reducedMotion: z.boolean(),
}).partial().strict();

const adminUserPatchSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name too long'),
  email,
  role: z.enum(['user', 'admin']),
  settings: adminSettingsSchema,
}).partial().passthrough();

const userParamsSchema = z.object({ userId: objectId });
const analyticsQuerySchema = z.object({
  from: z.coerce.number().finite('from must be a valid timestamp'),
  to: z.coerce.number().finite('to must be a valid timestamp'),
}).partial();

// ── Cursor pagination (IES-P1-18) ─────────────────────────────────────────────
// Keyset pagination keeps admin lists bounded and the ordering stable:
//   - `limit`  caps the page size (default 50, max 100).
//   - `cursor` is an opaque base64url token encoding { t, id } — the last item's
//     primary timestamp and _id — so the next page is fetched with
//     (t < cursor.t) OR (t == cursor.t AND _id < cursor.id), which matches the
//     (t: -1, _id: -1) sort exactly.
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parsePageSize(value) {
  const n = parseInt(value, 10);
  if (Number.isFinite(n) && n > 0) return Math.min(n, MAX_PAGE_SIZE);
  return DEFAULT_PAGE_SIZE;
}

function encodeCursor(t, id) {
  return Buffer.from(JSON.stringify({ t, id })).toString('base64url');
}

// Returns null when no cursor was provided, { t, id } when valid, or { error: true }.
function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed.t === 'number' && typeof parsed.id === 'string') return parsed;
  } catch { /* fallthrough */ }
  return { error: true };
}

// Mongo filter selecting docs strictly after (t, id) in a (t: -1, _id: -1) sort.
function cursorFilter(tField, cursor) {
  if (!cursor) return {};
  return {
    $or: [
      { [tField]: { $lt: cursor.t } },
      { [tField]: cursor.t, _id: { $lt: cursor.id } },
    ],
  };
}

async function paginateCursor({ model, filter, tField, limit, cursor, select }) {
  let query = model.find({ ...filter, ...cursorFilter(tField, cursor) })
    .sort({ [tField]: -1, _id: -1 })
    .limit(limit + 1);
  if (select) query = query.select(select);
  const docs = await query;
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last
      ? encodeCursor(last[tField] instanceof Date ? last[tField].getTime() : Number(last[tField]), last._id.toString())
      : null,
  };
}

// Apply protect and admin middleware to all routes in this router
router.use(protect);
router.use(admin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ts = today.getTime();

    const [users, activeSessions, todaySessions] = await Promise.all([
      // IES-P1-23: soft-deleted accounts don't count as users in the headline stat.
      User.countDocuments({ deletedAt: null }),
      Session.countDocuments({ isActive: true }),
      Session.find({ isActive: false, startTime: { $gte: ts } })
    ]);

    const todayTotalMs = todaySessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);

    res.json({
      totalUsers: users,
      activeUsers: activeSessions, // Number of people currently timing
      todayTotalMs,
      todaySessionCount: todaySessions.length
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const limit = parsePageSize(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    if (cursor && cursor.error) return res.status(400).json({ message: 'Invalid cursor' });
    const filter = req.query.includeDeleted ? {} : { deletedAt: null };
    res.json(await paginateCursor({ model: User, filter, tField: 'createdAt', limit, cursor, select: '-googleTokens' }));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/deleted ─────────────────────────────────────────────
router.get('/users/deleted', async (req, res, next) => {
  try {
    const limit = parsePageSize(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    if (cursor && cursor.error) return res.status(400).json({ message: 'Invalid cursor' });
    res.json(await paginateCursor({
      model: User,
      filter: { deletedAt: { $ne: null } },
      tField: 'deletedAt',
      limit,
      cursor,
      select: '-googleTokens',
    }));
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/users/:userId ──────────────────────────────────────────
router.patch('/users/:userId', validate(adminUserPatchSchema, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, email, role, settings } = req.body;

    const update = {};
    if (name !== undefined)  update.name = name;
    if (email !== undefined) update.email = email.toLowerCase().trim();
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      update.role = role;
    }
    // IES-P1-22: write only the whitelisted fields as dotted paths, so an admin
    // editing one setting doesn't wipe the user's other settings (e.g. timezone
    // drives report day boundaries).
    if (settings !== undefined) {
      for (const [key, value] of Object.entries(settings)) {
        update[`settings.${key}`] = value;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const ops = { $set: update };
    // Role change invalidates any previously-issued tokens (IES-P0-08).
    if (role !== undefined) ops.$inc = { tokenVersion: 1 };

    const user = await User.findByIdAndUpdate(userId, ops, { new: true, runValidators: true }).select('-googleTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
    const details = { targetUserId: userId, targetName: user.name };
    if (role !== undefined) {
      const oldUser = await User.findById(userId).select('role');
      details.oldRole = oldUser?.role;
      details.newRole = role;
      Activity.create({ userId: req.user._id, action: 'user.role_changed', details }).catch(() => {});
    } else {
      Activity.create({ userId: req.user._id, action: 'user.updated', details }).catch(() => {});
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    next(err);
  }
});

// ── DELETE /api/admin/users/:userId (soft delete) ───────────────────────────
router.delete('/users/:userId', validate(null, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndUpdate(
      userId,
      // Soft-delete also bumps tokenVersion so the deleted user's sessions die immediately.
      { $set: { deletedAt: new Date() }, $inc: { tokenVersion: 1 } },
      { new: true }
    ).select('-googleTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // IES-P1-23 · soft-delete cascade + data retention. A deleted user is
    // scrubbed from shared surfaces so they can't keep showing up in team
    // analytics or token-gated reports:
    //   - pulled out of every Team.members array (membership is dissolved),
    //   - all their report shares are revoked (they stay until the TTL index
    //     retires them, but can never render again).
    // The account row, its child data (sessions/tasks/worklogs), and audit
    // history are retained for forensic/audit purposes; a deleted user is
    // excluded from every aggregate query via `deletedAt: null` filters and
    // can never authenticate (protect + login both reject `deletedAt` set).
    await Promise.all([
      Team.updateMany({ members: userId }, { $pull: { members: userId } }),
      ReportShare.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),
    ]);

    res.json({ message: 'User soft-deleted', user });
    Activity.create({ userId: req.user._id, action: 'user.deleted', details: { targetUserId: userId, targetName: user.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/users/:userId/restore ────────────────────────────────────
router.post('/users/:userId/restore', validate(null, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { deletedAt: null } },
      { new: true }
    ).select('-googleTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
    Activity.create({ userId: req.user._id, action: 'user.restored', details: { targetUserId: userId, targetName: user.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/:userId/analytics ──────────────────────────────────
router.get('/users/:userId/analytics', validate(null, { params: userParamsSchema, query: analyticsQuerySchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { from, to } = req.query;

    const query = { userId };
    const sessionQuery = { userId, isActive: false };
    const workLogQuery = { userId };

    if (from || to) {
      const dateRange = {};
      if (from) dateRange.$gte = Number(from);
      if (to)   dateRange.$lte = Number(to);
      
      sessionQuery.startTime = dateRange;
      // WorkLogs don't have a single startTime in the model usually, 
      // they have entries. But they have updatedAt.
      // Let's assume the user wants logs updated in this range.
      workLogQuery.updatedAt = {
        $gte: new Date(Number(from) || 0),
        $lte: new Date(Number(to) || Date.now())
      };
    }
    
    const [tasks, completedSessions, activeSessions, workLogs] = await Promise.all([
      Task.find({ userId }),
      Session.find({ ...sessionQuery, isActive: false }),
      Session.find({ userId, isActive: true }),
      WorkLog.find(workLogQuery).sort({ updatedAt: -1 })
    ]);

    // Calculate time from completed sessions
    let totalTimeMs = completedSessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);

    // ADD LIVE PROGRESS: Calculate current elapsed time for any active sessions
    const now = Date.now();
    activeSessions.forEach(s => {
      // Check if session falls within filter range
      if ((!from || s.startTime >= Number(from)) && (!to || s.startTime <= Number(to))) {
        // liveActive = now - startTime - totalPause
        const liveActive = Math.max(0, now - s.startTime - (s.totalPauseDuration || 0));
        totalTimeMs += liveActive;
      }
    });

    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    res.json({
      summary: {
        totalTasks: tasks.length,
        completedTasks,
        totalTimeMs,
        workLogCount: workLogs.length,
        sessionCount: completedSessions.length + activeSessions.length
      },
      tasks,
      sessions: [...completedSessions, ...activeSessions],
      workLogs
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/:userId/reports/summary ──────────────────────────────────
// IES-P1-17: the per-day summary is the shared `buildSummaryDays` implementation
// (same as GET /reports/summary), so the admin copy inherits the IES-P1-14
// completed-item-per-day attribution instead of its old per-log "length" bug.
router.get('/users/:userId/reports/summary', validate(null, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const timeZone = userTimezone(user);
    const { fromKey, toKey } = resolveSummaryRange(req.query, timeZone);
    res.json(await buildSummaryDays({ userId, fromKey, toKey, timeZone }));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/:userId/reports/day ──────────────────────────────────────
router.get('/users/:userId/reports/day', validate(null, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const requestedDate = req.query.date || dayKey(Date.now(), userTimezone(user));
    if (!isValidDateKey(requestedDate)) {
      return res.status(400).json({ message: 'Invalid report date' });
    }
    res.json(await buildDayReport(userId, requestedDate, userTimezone(user)));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/system-analytics ─────────────────────────────────────────
// IES-P1-17: aggregation pipelines in server/utils/adminAnalytics.js replace the
// old find()-based, in-memory aggregation (no full-collection loads into JS).
router.get('/system-analytics', async (req, res, next) => {
  try {
    const period = req.query.period || 'month';
    res.json(await runSystemAnalytics({ period }));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/activity ─────────────────────────────────────────────────
router.get('/activity', async (req, res, next) => {
  try {
    const limit = parsePageSize(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    if (cursor && cursor.error) return res.status(400).json({ message: 'Invalid cursor' });

    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.before && !req.query.cursor) {
      let beforeTs = Number(req.query.before);
      if (Number.isNaN(beforeTs)) beforeTs = new Date(req.query.before).getTime();
      if (Number.isFinite(beforeTs)) filter.createdAt = { $lt: new Date(beforeTs) };
    }

    const docs = await Activity.find({ ...filter, ...cursorFilter('createdAt', cursor) })
      .populate('userId', 'name email avatar role')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const last = items[items.length - 1];
    res.json({
      items,
      hasMore,
      nextCursor: hasMore && last
        ? encodeCursor(last.createdAt instanceof Date ? last.createdAt.getTime() : Number(last.createdAt), last._id.toString())
        : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const User = require('../models/User');
const Role = require('../models/Role');
const Task = require('../models/Task');
const Session = require('../models/Session');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const Team = require('../models/Team');
const ReportShare = require('../models/ReportShare');
const Workspace = require('../models/Workspace');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const reportsRouter = require('./reports');
const { buildDayReport, buildSummaryDays, resolveSummaryRange, userTimezone, dayKey, isValidDateKey } = reportsRouter.helpers;
const { runSystemAnalytics } = require('../utils/adminAnalytics');
const { logger } = require('../utils/logger');
const { z, objectId, email, validate } = require('../utils/validation');
const { parsePageSize, encodeCursor, decodeCursor, paginateCursor } = require('../utils/pagination');

const router = express.Router();

// IES-P0-16: body/param/query schemas.
//
// IES-P1-22: the `settings` object is whitelisted field-by-field so hostile or
// misshapen values can't be persisted. Bounds mirror the User model settings
// sub-schema and the Settings UI (dailyGoal / personalDailyGoal 0–24h,
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
  personalDailyGoal: settingsNumber('personalDailyGoal', { min: 0, max: 24 }),
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
  role: z.enum(['nonadmin', 'admin', 'superadmin']),
  settings: adminSettingsSchema,
}).partial().passthrough();

const userParamsSchema = z.object({ userId: objectId });
const analyticsQuerySchema = z.object({
  from: z.coerce.number().finite('from must be a valid timestamp'),
  to: z.coerce.number().finite('to must be a valid timestamp'),
}).partial();

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
    res.json(await paginateCursor({ model: User, filter, tField: 'createdAt', limit, cursor, select: '-googleTokens', populate: { path: 'roleId', select: 'name level' } }));
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
      populate: { path: 'roleId', select: 'name level' },
    }));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/:userId/owner-status ────────────────────────────────
router.get('/users/:userId/owner-status', validate(null, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const ownedWorkspaces = await Workspace.find({ createdBy: userId }).select('name type').lean();
    res.json({ isOwner: ownedWorkspaces.length > 0, workspaces: ownedWorkspaces });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users/:userId/workspaces ──────────────────────────────────
router.get('/users/:userId/workspaces', validate(null, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const workspaces = await Workspace.find({ 'members.userId': userId })
      .select('name type icon description createdBy members createdAt')
      .lean();
    const result = workspaces.map(ws => {
      const member = ws.members.find(m => String(m.userId) === String(userId));
      return {
        workspaceId: ws._id,
        name: ws.name,
        type: ws.type,
        icon: ws.icon,
        description: ws.description,
        memberRole: member ? member.role : null,
        joinedAt: member?.joinedAt,
        isCreator: String(ws.createdBy) === String(userId),
        createdAt: ws.createdAt,
      };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/users/:userId/workspace-role ────────────────────────────
const workspaceRoleSchema = z.object({
  workspaceId: objectId,
  role: z.enum(['superadmin', 'admin', 'nonadmin']),
}).strict();

router.patch('/users/:userId/workspace-role', validate(workspaceRoleSchema, { params: userParamsSchema }), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { workspaceId, role } = req.body;
    const isSuperAdmin = req.user.roleId?.level === 100;

    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    const memberIdx = ws.members.findIndex(m => String(m.userId) === String(userId));
    if (memberIdx === -1) {
      return res.status(404).json({ message: 'User is not a member of this workspace' });
    }

    const currentRole = ws.members[memberIdx].role;
    const isTargetOwner = String(ws.createdBy) === String(userId);

    if (isTargetOwner && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only super admins can change the workspace owner role' });
    }

    const allowedRoles = isSuperAdmin ? ['superadmin', 'admin', 'nonadmin'] : ['admin', 'nonadmin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    ws.members[memberIdx].role = role;
    await ws.save();

    Activity.create({
      userId: req.user._id,
      action: 'workspace.member.roleChanged',
      details: {
        workspaceId: ws._id,
        workspaceName: ws.name,
        member: userId,
        oldRole: currentRole,
        newRole: role,
        source: 'admin_console',
      },
    }).catch(() => {});

    Notification.create({
      userId,
      actor: { id: req.user._id, name: req.user.name, email: req.user.email, avatar: req.user.avatar || '' },
      type: 'role_changed',
      title: `Your role changed to ${role} in ${ws.name}`,
      body: `${req.user.name} changed your workspace role to ${role}.`,
      targetUrl: `/w/${ws._id}/overview`,
    }).catch(() => {});

    res.json({ workspaceId: ws._id, name: ws.name, memberRole: role, oldRole: currentRole });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/users ─────────────────────────────────────────────────
const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  email,
  password: z.string().min(12, 'Password must be at least 12 characters'),
  role: z.enum(['nonadmin', 'admin', 'superadmin']).default('nonadmin'),
});

router.post('/users', validate(createUserSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists' });

    // Find or create the Role document for the assigned role
    const level = role === 'superadmin' ? 100 : role === 'admin' ? 60 : 0;
    const roleName = role === 'superadmin' ? 'superadmin' : role === 'admin' ? 'admin' : 'nonadmin';
    let roleDoc = await Role.findOne({ name: roleName });
    if (!roleDoc) roleDoc = await Role.create({ name: roleName, level });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash, role, roleId: roleDoc._id });

    const details = { targetUserId: user._id, targetName: user.name, targetEmail: user.email };
    Activity.create({ userId: req.user._id, action: 'user.provisioned', details }).catch(() => {});

    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already in use' });
    }
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
      if (!['nonadmin', 'admin', 'superadmin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      // Only super admins can assign the superadmin role
      if (role === 'superadmin' && req.user.roleId?.level !== 100) {
        return res.status(403).json({ message: 'Only super admins can assign the Super Admin role' });
      }
      // Check if target user is a workspace owner
      const isOwner = await Workspace.exists({ createdBy: userId });
      if (isOwner && req.user.roleId?.level !== 100) {
        return res.status(403).json({ message: 'Only super admins can change the role of a workspace owner' });
      }
      update.role = role;
      // Also update the roleId reference to the Role model
      const level = role === 'superadmin' ? 100 : role === 'admin' ? 60 : 0;
      const roleName = role === 'superadmin' ? 'superadmin' : role === 'admin' ? 'admin' : 'nonadmin';
      let roleDoc = await Role.findOne({ name: roleName });
      if (!roleDoc) roleDoc = await Role.create({ name: roleName, level });
      update.roleId = roleDoc._id;
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

    const user = await User.findByIdAndUpdate(userId, ops, { new: true, runValidators: true }).select('-googleTokens').populate('roleId', 'name level');
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

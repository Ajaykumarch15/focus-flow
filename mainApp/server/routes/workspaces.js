// IES-P2-01 · Workspace surface for regular users — CRUD + membership (invite /
// self-join / role / removal) + team & project scoping. IES-P2-03 pushes the
// role checks into middleware/workspace.js. UNIFIED ROLE SYSTEM:
//   • read          → any workspace member
//   • mutate         → admin | superadmin
//   • delete / owner → superadmin only
// The admin surface (server/routes/admin.js + teams.js analytics) is untouched.
const express = require('express');
const Workspace = require('../models/Workspace');
const Team = require('../models/Team');
const Project = require('../models/Project');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');
const {
  memberUserId,
  memberRole,
  MANAGER_ROLES,
  loadWorkspace,
  requireMember,
  requireManager,
  requireOwner,
} = require('../middleware/workspace');
const { z, objectId, requiredString, validate } = require('../utils/validation');
const { parsePageSize, decodeCursor, paginateCursor } = require('../utils/pagination');

const { MEMBER_ROLES, WORKSPACE_TYPES } = Workspace;
const router = express.Router();
router.use(protect);

// Populate embedded members with only non-deleted users; entries whose user was
// excluded come back as `userId: null` and are dropped by `activeMembers`.
const MEMBERS_POPULATE = { path: 'members.userId', select: 'name email avatar role', match: { deletedAt: null } };

const DEFAULT_ICONS = {
  Startup: '⚡',
  Personal: '🚀',
  'Open Source': '🌐',
  'College Project': '🎓',
  Internship: '💼',
  Enterprise: '🏢',
};

// ── body/param schemas (IES-P0-16) ────────────────────────────────────────────
const settingsSchema = z
  .object({
    allowMemberInvites: z.boolean().optional(),
    requireReviewForDone: z.boolean().optional(),
    autoSyncTimerWorkLogs: z.boolean().optional(),
    defaultVisibility: z.enum(['Private', 'Team', 'Project', 'Workspace']).optional(),
  })
  .passthrough();

const NEW_MEMBER_ROLES = ['admin', 'nonadmin'];

const workspaceCreateSchema = z
  .object({
    name: requiredString(100, 'name', 'Workspace name is required'),
    type: z.enum(WORKSPACE_TYPES).optional(),
    icon: z.string().max(20, 'Icon too long').optional(),
    description: z.string().max(2000, 'Description too long').optional(),
    settings: settingsSchema.optional(),
    members: z.array(z.object({
      userId: objectId,
      role: z.enum(NEW_MEMBER_ROLES).optional(),
      isProjectManager: z.boolean().optional(),
    })).max(200).optional(),
  })
  .passthrough();

const workspacePatchSchema = workspaceCreateSchema.partial().passthrough();

const workspaceParamsSchema = z.object({ id: objectId });
const memberParamsSchema = z.object({ id: objectId, userId: objectId });

// IES-P2-04: keyset-cursor pagination for the activity feed (shared with admin).
const activityQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1, 'limit must be at least 1').max(100, 'limit must be at most 100').optional(),
    cursor: z.string().max(500, 'cursor too long').optional(),
  })
  .passthrough();

// UNIFIED ROLE SYSTEM: new invites use unified roles.
const NEW_INVITE_ROLES = ['admin', 'nonadmin'];
const SUPER_ADMIN_ROLES = ['admin', 'nonadmin', 'superadmin'];

const memberInviteSchema = z
  .object({
    userId: objectId.optional(),
    email: z.string().trim().max(255).optional(),
    role: z.string().optional(),
  })
  .refine((d) => d.userId || d.email, 'Provide userId or email')
  .passthrough();

// Phase 2: role PATCH only allows Admin or Member — Owner transfer is a
// separate high-privilege operation and must NOT go through this endpoint.
const memberRoleSchema = z.object({ role: z.string() }).passthrough();

// ── membership helpers ────────────────────────────────────────────────────────
function activeMembers(ws) {
  return (ws && Array.isArray(ws.members) ? ws.members : []).filter((m) => memberUserId(m));
}

// IES-P2-05: actor snapshot embedded in notifications. Captured at write time so
// a later profile rename/deletion never rewrites the historical notification.
function toActorJson(u) {
  return { id: u._id, name: u.name || 'Unknown', email: u.email || '', avatar: u.avatar || '' };
}

function toMemberJson(m) {
  const raw = memberUserId(m);
  const u = m.userId && m.userId._id ? m.userId : { _id: raw, name: 'User', email: '', avatar: '' };
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    avatar: u.avatar || undefined,
    role: m.role,
    joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : undefined,
  };
}

// Serializes a workspace doc in the frontend `Workspace` shape
// (src/types/collaboration.ts) plus the caller's `role` and the member list.
function toWorkspaceJson(ws, userId, projectsCount) {
  const members = activeMembers(ws);
  return {
    id: ws._id.toString(),
    name: ws.name,
    type: ws.type,
    icon: ws.icon,
    description: ws.description,
    membersCount: members.length,
    projectsCount,
    createdAt: ws.createdAt,
    settings: ws.settings,
    role: memberRole(ws, userId),
    members: members.map(toMemberJson),
  };
}

async function projectCounts(workspaces) {
  const ids = workspaces.map((w) => w._id);
  if (ids.length === 0) return new Map();
  const rows = await Project.aggregate([
    { $match: { workspaceRef: { $in: ids } } },
    { $group: { _id: '$workspaceRef', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

const loadWorkspacePopulated = (id) => Workspace.findById(id).populate(MEMBERS_POPULATE);

// ── GET /api/workspaces ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const workspaces = await Workspace.find({ $or: [{ createdBy: userId }, { 'members.userId': userId }] })
      .sort({ createdAt: -1 })
      .populate(MEMBERS_POPULATE);
    const counts = await projectCounts(workspaces);
    res.json(workspaces.map((ws) => toWorkspaceJson(ws, userId, counts.get(String(ws._id)) || 0)));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/workspaces ──────────────────────────────────────────────────────
router.post('/', validate(workspaceCreateSchema), async (req, res, next) => {
  try {
    if ((req.user.roleId?.level ?? 0) < 60) {
      return res.status(403).json({ message: 'Only admins can create workspaces' });
    }
    const { name, type, icon, description, settings, members: requestedMembers } = req.body;
    const workspaceType = type || 'Personal';

    // Build members list: creator always admin + selected members
    const memberDocs = [{ userId: req.user._id, role: 'admin', isProjectManager: true, joinedAt: new Date() }];

    if (Array.isArray(requestedMembers) && requestedMembers.length > 0) {
      const userIds = requestedMembers.map((m) => m.userId);
      const validUsers = await User.find({ _id: { $in: userIds }, deletedAt: null }).select('_id');
      const validIds = new Set(validUsers.map((u) => String(u._id)));

      for (const m of requestedMembers) {
        if (String(m.userId) === String(req.user._id)) continue; // creator already added
        if (!validIds.has(String(m.userId))) continue;
        memberDocs.push({
          userId: m.userId,
          role: m.role || 'nonadmin',
          isProjectManager: !!m.isProjectManager,
          joinedAt: new Date(),
        });
      }
    }

    const ws = await Workspace.create({
      name,
      type: workspaceType,
      icon: icon || DEFAULT_ICONS[workspaceType] || '🚀',
      description: description || '',
      createdBy: req.user._id,
      settings: settings || {},
      members: memberDocs,
    });
    const populated = await loadWorkspacePopulated(ws._id);
    res.status(201).json(toWorkspaceJson(populated, req.user._id, 0));
    Activity.create({ userId: req.user._id, action: 'workspace.created', workspaceRef: ws._id, details: { workspaceName: ws.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/workspaces/:id ───────────────────────────────────────────────────
router.get('/:id', validate(null, { params: workspaceParamsSchema }), loadWorkspace, requireMember, async (req, res, next) => {
  try {
    const ws = await loadWorkspacePopulated(req.params.id);
    const count = await Project.countDocuments({ workspaceRef: ws._id });
    res.json(toWorkspaceJson(ws, req.user._id, count));
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/workspaces/:id ─────────────────────────────────────────────────
router.patch('/:id', validate(workspacePatchSchema, { params: workspaceParamsSchema }), loadWorkspace, requireManager, async (req, res, next) => {
  try {
    const ws = req.workspace;
    const { name, type, icon, description, settings } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (icon !== undefined) updates.icon = icon;
    if (description !== undefined) updates.description = description;
    if (settings) {
      const current = ws.settings && typeof ws.settings.toObject === 'function' ? ws.settings.toObject() : ws.settings || {};
      updates.settings = { ...current, ...settings };
    }

    const updated = await Workspace.findByIdAndUpdate(ws._id, updates, { new: true }).populate(MEMBERS_POPULATE);
    const count = await Project.countDocuments({ workspaceRef: ws._id });
    res.json(toWorkspaceJson(updated, req.user._id, count));
    Activity.create({ userId: req.user._id, action: 'workspace.updated', workspaceRef: ws._id, details: { workspaceName: ws.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/workspaces/:id ────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: workspaceParamsSchema }), loadWorkspace, requireOwner, async (req, res, next) => {
  try {
    const ws = req.workspace;

    // Find all projects in this workspace so we can cascade-delete their sub-collections
    const projectIds = (await Project.find({ workspaceRef: ws._id }).select('_id').lean()).map(p => p._id);

    await Promise.all([
      // Delete workspace-scoped data
      Team.deleteMany({ workspaceRef: ws._id }),
      Activity.deleteMany({ workspaceRef: ws._id }),
      Notification.deleteMany({ workspaceRef: ws._id }),
      // Delete project sub-collections (tasks, sprints, features, etc.)
      ...(projectIds.length > 0 ? [
        require('../models/Task').deleteMany({ projectRef: { $in: projectIds } }),
        require('../models/Sprint').deleteMany({ projectRef: { $in: projectIds } }),
        require('../models/Feature').deleteMany({ projectRef: { $in: projectIds } }),
        require('../models/Milestone').deleteMany({ projectRef: { $in: projectIds } }),
        require('../models/Module').deleteMany({ projectRef: { $in: projectIds } }),
        require('../models/Phase').deleteMany({ projectRef: { $in: projectIds } }),
        require('../models/WorkLog').deleteMany({ projectRef: { $in: projectIds } }),
        require('../models/Session').deleteMany({ projectRef: { $in: projectIds } }),
      ] : []),
      // Delete projects and workspace
      Project.deleteMany({ workspaceRef: ws._id }),
      Workspace.findByIdAndDelete(ws._id),
    ]);

    res.json({ message: 'Workspace deleted' });
    Activity.create({ userId: req.user._id, action: 'workspace.deleted', details: { workspaceName: ws.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/workspaces/:id/available-users ─────────────────────────────────
// Returns all active system users NOT already in this workspace.
router.get('/:id/available-users', validate(null, { params: workspaceParamsSchema }), loadWorkspace, requireMember, async (req, res, next) => {
  try {
    const ws = req.workspace;
    const memberUserIds = (ws.members || []).map((m) => String(m.userId));
    const users = await User.find({ deletedAt: null, _id: { $nin: memberUserIds } })
      .select('name email avatar role')
      .sort({ name: 1 })
      .limit(200);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/workspaces/:id/members ───────────────────────────────────────────
router.get('/:id/members', validate(null, { params: workspaceParamsSchema }), loadWorkspace, requireMember, async (req, res, next) => {
  try {
    const ws = await loadWorkspacePopulated(req.params.id);
    res.json(activeMembers(ws).map(toMemberJson));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/workspaces/:id/members — owner/admin invites by userId or email ─
router.post('/:id/members', validate(memberInviteSchema, { params: workspaceParamsSchema }), loadWorkspace, requireManager, async (req, res, next) => {
  try {
    const ws = req.workspace;
    const isSuperAdmin = req.user.roleId && req.user.roleId.level === 100;
    const role = req.body.role || 'nonadmin';

    // Non-super-admins can only assign nonadmin or admin
    const allowedRoles = isSuperAdmin ? SUPER_ADMIN_ROLES : NEW_INVITE_ROLES;
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    let target = null;
    if (req.body.userId) {
      target = await User.findOne({ _id: req.body.userId, deletedAt: null }).select('_id');
    } else if (req.body.email) {
      target = await User.findOne({ email: req.body.email.toLowerCase(), deletedAt: null }).select('_id');
    }
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (memberRole(ws, target._id) !== null) {
      return res.status(409).json({ message: 'User is already a member of this workspace' });
    }

    ws.members.push({ userId: target._id, role, joinedAt: new Date() });
    await ws.save();
    const updated = await loadWorkspacePopulated(ws._id);
    res.status(201).json(activeMembers(updated).map(toMemberJson));
    Activity.create({ userId: req.user._id, action: 'workspace.member.invited', workspaceRef: ws._id, details: { workspaceName: ws.name, invited: target._id } }).catch(() => {});
    Notification.create({
      userId: target._id,
      workspaceRef: ws._id,
      actor: toActorJson(req.user),
      type: 'invited',
      title: `You were invited to ${ws.name}`,
      body: `${req.user.name} added you to the ${ws.name} workspace.`,
      targetUrl: `/w/${ws._id}/overview`,
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/workspaces/:id/join — self-join when invites are enabled ────────
router.post('/:id/join', validate(null, { params: workspaceParamsSchema }), loadWorkspace, async (req, res, next) => {
  try {
    const ws = req.workspace;

    if (memberRole(ws, req.user._id) !== null) {
      const updated = await loadWorkspacePopulated(ws._id);
      const count = await Project.countDocuments({ workspaceRef: ws._id });
      return res.json(toWorkspaceJson(updated, req.user._id, count));
    }
    if (!ws.settings.allowMemberInvites) {
      return res.status(403).json({ message: 'This workspace does not accept self-join requests' });
    }

    ws.members.push({ userId: req.user._id, role: 'nonadmin', joinedAt: new Date() });
    await ws.save();
    const updated = await loadWorkspacePopulated(ws._id);
    const count = await Project.countDocuments({ workspaceRef: ws._id });
    res.json(toWorkspaceJson(updated, req.user._id, count));
    Activity.create({ userId: req.user._id, action: 'workspace.member.joined', workspaceRef: ws._id, details: { workspaceName: ws.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/workspaces/:id/members/:userId — change a member's role ────────
router.patch('/:id/members/:userId', validate(memberRoleSchema, { params: memberParamsSchema }), loadWorkspace, requireManager, async (req, res, next) => {
  try {
    const ws = req.workspace;
    const isSuperAdmin = req.user.roleId && req.user.roleId.level === 100;

    // Phase 2: Owner role cannot be changed through this endpoint (unless super admin).
    if (!isSuperAdmin && String(ws.createdBy) === String(req.params.userId)) {
      return res.status(400).json({ message: 'The workspace owner role cannot be changed' });
    }

    // UNIFIED ROLE SYSTEM: only admin or superadmin may change roles (defense-in-depth alongside
    // the requireManager middleware above).
    const callerRole = memberRole(ws, req.user._id);
    if (callerRole !== 'admin' && callerRole !== 'superadmin') {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }

    // Phase 2: target must be an existing member.
    const idx = ws.members.findIndex((m) => m && String(memberUserId(m)) === String(req.params.userId));
    if (idx === -1) return res.status(404).json({ message: 'Member not found' });

    // Super admins can assign any role; others can only assign Admin or Member.
    const allowedRoles = isSuperAdmin ? SUPER_ADMIN_ROLES : NEW_INVITE_ROLES;
    if (!allowedRoles.includes(req.body.role)) {
      return res.status(400).json({ message: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    ws.members[idx].role = req.body.role;
    await ws.save();
    const updated = await loadWorkspacePopulated(ws._id);
    res.json(activeMembers(updated).map(toMemberJson));
    Activity.create({ userId: req.user._id, action: 'workspace.member.roleChanged', workspaceRef: ws._id, details: { workspaceName: ws.name, member: req.params.userId, role: req.body.role } }).catch(() => {});
    Notification.create({
      userId: req.params.userId,
      workspaceRef: ws._id,
      actor: toActorJson(req.user),
      type: 'role_changed',
      title: `Your role changed to ${req.body.role} in ${ws.name}`,
      body: `${req.user.name} changed your workspace role to ${req.body.role}.`,
      targetUrl: `/w/${ws._id}/overview`,
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/workspaces/:id/members/:userId — remove a member ──────────────
router.delete('/:id/members/:userId', validate(null, { params: memberParamsSchema }), loadWorkspace, requireManager, async (req, res, next) => {
  try {
    const ws = req.workspace;
    if (String(ws.createdBy) === String(req.params.userId)) {
      return res.status(400).json({ message: 'The workspace owner cannot be removed' });
    }
    if (memberRole(ws, req.params.userId) === null) {
      return res.status(404).json({ message: 'Member not found' });
    }

    ws.members = ws.members.filter((m) => m && String(memberUserId(m)) !== String(req.params.userId));
    await ws.save();
    await Team.updateMany({ workspaceRef: ws._id }, { $pull: { members: req.params.userId } });
    const updated = await loadWorkspacePopulated(ws._id);
    res.json(activeMembers(updated).map(toMemberJson));
    Activity.create({ userId: req.user._id, action: 'workspace.member.removed', workspaceRef: ws._id, details: { workspaceName: ws.name, member: req.params.userId } }).catch(() => {});
    Notification.create({
      userId: req.params.userId,
      workspaceRef: ws._id,
      actor: toActorJson(req.user),
      type: 'removed',
      title: `You were removed from ${ws.name}`,
      body: `${req.user.name} removed you from the ${ws.name} workspace.`,
      targetUrl: '',
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/workspaces/:id/activity — real, workspace-scoped feed (IES-P2-04) ─
// Member-scoped, newest-first, keyset-paginated. Replaces the fabricated timeline
// the TeamWorkspace page used to render from demo data.
router.get('/:id/activity', validate(null, { params: workspaceParamsSchema, query: activityQuerySchema }), loadWorkspace, requireMember, async (req, res, next) => {
  try {
    const limit = parsePageSize(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    if (cursor && cursor.error) return res.status(400).json({ message: 'Invalid cursor' });

    const page = await paginateCursor({
      model: Activity,
      filter: { workspaceRef: req.params.id },
      tField: 'createdAt',
      limit,
      cursor,
      populate: { path: 'userId', select: 'name email avatar' },
    });
    res.json(page);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

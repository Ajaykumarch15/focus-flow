// IES-P1-23 admin team analytics + IES-P2-01 workspace-scoped team CRUD.
//
// Ownership model (IES-P2-01): admins keep full control (analytics + any team).
// Non-admins can only read teams inside workspaces they belong to, and only
// create / manage teams inside workspaces where they hold Owner/Admin role.
// Legacy teams without a workspaceRef (created pre-P2-01 by admins) remain
// admin-only for non-admins.
const express = require('express');
const Team = require('../models/Team');
const User = require('../models/User');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const Workspace = require('../models/Workspace');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const { findMember } = require('../middleware/workspace');
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();

// IES-P0-16: body/param/query schemas.
const teamFields = {
  name: requiredString(100, 'name', 'Team name is required'),
  description: z.string().max(2000, 'Description too long'),
  members: z.array(objectId).max(100, 'Too many members'),
};
const teamCreateSchema = z.object({
  ...teamFields,
  workspaceId: objectId.optional(),
  leaderId: objectId.optional(),
  color: z.string().max(20, 'Color too long').optional(),
}).passthrough();
const teamPatchSchema = z.object({
  ...teamFields,
  leaderId: objectId.optional(),
  color: z.string().max(20, 'Color too long').optional(),
}).partial().passthrough();
const teamParamsSchema = z.object({ id: objectId });
const teamMemberParamsSchema = z.object({ id: objectId, userId: objectId });
const teamMemberSchema = z.object({ userId: objectId }).passthrough();
// IES-P2-02: member-based queries — `GET /api/teams?memberId=<id>` lists the
// teams a user belongs to. Admins may target any user; non-admins can only
// query their own memberships (enforced in the route).
const teamQuerySchema = z.object({ memberId: objectId.optional() }).passthrough();
const teamAnalyticsQuerySchema = z.object({
  from: z.coerce.number().finite('from must be a valid timestamp'),
  to: z.coerce.number().finite('to must be a valid timestamp'),
}).partial();

router.use(protect);

// ── IES-P1-23: membership only ever references active users ──────────────────
// Populate `members` with a `deletedAt: null` match so soft-deleted users are
// never rendered as team members. On soft-delete the admin cascade `$pull`s the
// user out of every team. `keepActiveMembers` also drops the `null`s that
// mongoose's populate-match leaves in place of excluded members.
const ACTIVE_MEMBERS_POPULATE = { path: 'members', select: 'name email avatar role', match: { deletedAt: null } };

function keepActiveMembers(team) {
  if (team && Array.isArray(team.members)) {
    team.members = team.members.filter((m) => m && m._id);
  }
  return team;
}

// IES-P2-02: membership writes are validated — every provided member id must
// resolve to an existing, active (not soft-deleted) user. A bad id is rejected
// (404) instead of being silently dropped, so the stored `members` array always
// reflects exactly what the caller asked for and analytics never silently skip
// a member who was believed to be added.
async function resolveMemberIds(members) {
  if (!members || members.length === 0) return { ok: true, ids: [] };
  const active = await User.find({ _id: { $in: members }, deletedAt: null }).select('_id');
  const found = new Set(active.map((m) => String(m._id)));
  const missing = members.filter((id) => !found.has(String(id)));
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, ids: active.map((m) => m._id) };
}

// ── IES-P2-01 ownership helpers ───────────────────────────────────────────────
// Non-admin team reads are scoped to the workspaces the caller belongs to.
async function workspaceIdsFor(userId) {
  const ws = await Workspace.find({ 'members.userId': userId }).select('_id');
  return ws.map((w) => w._id);
}

// Non-admin team mutations require the caller to be Owner/Admin of the workspace.
async function requireWorkspaceManager(workspaceId, userId) {
  const ws = await Workspace.findById(workspaceId).select('members createdBy');
  if (!ws) return { ok: false, status: 404, message: 'Workspace not found' };
  const m = findMember(ws, userId);
  if (!m || !['Owner', 'Admin'].includes(m.role)) {
    return { ok: false, status: 403, message: 'Only workspace owners and admins can manage teams' };
  }
  return { ok: true };
}

function isAdmin(user) {
  return user && user.role === 'admin';
}

async function canReadTeam(team, user) {
  if (isAdmin(user)) return true;
  if (!team.workspaceRef) return false;
  const ws = await Workspace.findById(team.workspaceRef).select('members');
  if (!ws) return false;
  return !!findMember(ws, user._id);
}

async function canManageTeam(team, user) {
  if (isAdmin(user)) return true;
  if (!team.workspaceRef) return false;
  return requireWorkspaceManager(team.workspaceRef, user._id).then((r) => r.ok);
}

// ── GET /api/teams ────────────────────────────────────────────────────────────
router.get('/', validate(null, { query: teamQuerySchema }), async (req, res, next) => {
  try {
    const { memberId } = req.query;
    let query = {};
    if (!isAdmin(req.user)) {
      // IES-P2-02: a non-admin may only ask about their own memberships.
      if (memberId && String(memberId) !== String(req.user._id)) {
        return res.status(403).json({ message: 'You can only list your own team memberships' });
      }
      const ids = await workspaceIdsFor(req.user._id);
      query = ids.length > 0 ? { workspaceRef: { $in: ids } } : { _id: { $in: [] } };
      if (memberId) query.members = memberId;
    } else if (memberId) {
      query.members = memberId;
    }
    const teams = await Team.find(query).populate(ACTIVE_MEMBERS_POPULATE);
    res.json(teams.map(keepActiveMembers));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/teams ───────────────────────────────────────────────────────────
router.post('/', validate(teamCreateSchema), async (req, res, next) => {
  try {
    const { name, description, members, workspaceId, leaderId, color } = req.body;

    // IES-P2-02: validate every provided member before touching the DB.
    const resolved = await resolveMemberIds(members || []);
    if (!resolved.ok) {
      return res.status(404).json({ message: 'One or more team members do not exist' });
    }

    let team;
    if (workspaceId) {
      const canManage = await requireWorkspaceManager(workspaceId, req.user._id);
      if (!canManage.ok) return res.status(canManage.status).json({ message: canManage.message });
      team = new Team({
        name,
        description,
        members: resolved.ids,
        createdBy: req.user._id,
        workspaceRef: workspaceId,
        leaderId,
        color,
      });
    } else {
      if (!isAdmin(req.user)) {
        return res.status(400).json({ message: 'workspaceId is required to create a team' });
      }
      team = new Team({
        name,
        description,
        members: resolved.ids,
        createdBy: req.user._id,
        leaderId,
        color,
      });
    }

    await team.save();
    const populated = keepActiveMembers(await team.populate(ACTIVE_MEMBERS_POPULATE));
    res.status(201).json(populated);
    Activity.create({ userId: req.user._id, action: 'team.created', workspaceRef: team.workspaceRef, teamRef: team._id, details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/teams/:id ────────────────────────────────────────────────────────
router.get('/:id', validate(null, { params: teamParamsSchema }), async (req, res, next) => {
  try {
    const team = keepActiveMembers(await Team.findById(req.params.id).populate(ACTIVE_MEMBERS_POPULATE));
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!(await canReadTeam(team, req.user))) {
      return res.status(403).json({ message: 'You do not have access to this team' });
    }
    res.json(team);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/teams/:id ──────────────────────────────────────────────────────
router.patch('/:id', validate(teamPatchSchema, { params: teamParamsSchema }), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!(await canManageTeam(team, req.user))) {
      return res.status(403).json({ message: 'Only workspace owners and admins can update this team' });
    }

    const { name, description, members, leaderId, color } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (members) {
      const resolved = await resolveMemberIds(members);
      if (!resolved.ok) {
        return res.status(404).json({ message: 'One or more team members do not exist' });
      }
      updates.members = resolved.ids;
    }
    if (leaderId !== undefined) updates.leaderId = leaderId;
    if (color !== undefined) updates.color = color;

    // workspaceRef is deliberately absent: a PATCH can never move a team between workspaces.
    const updated = keepActiveMembers(await Team.findByIdAndUpdate(team._id, updates, { new: true })
      .populate(ACTIVE_MEMBERS_POPULATE));

    res.json(updated);
    Activity.create({ userId: req.user._id, action: 'team.updated', workspaceRef: team.workspaceRef, teamRef: team._id, details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/teams/:id ─────────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: teamParamsSchema }), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!(await canManageTeam(team, req.user))) {
      return res.status(403).json({ message: 'Only workspace owners and admins can delete this team' });
    }
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted' });
    Activity.create({ userId: req.user._id, action: 'team.deleted', workspaceRef: team.workspaceRef, teamRef: team._id, details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/teams/:id/members — add a member (admin / workspace manager) ────
router.post('/:id/members', validate(teamMemberSchema, { params: teamParamsSchema }), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!(await canManageTeam(team, req.user))) {
      return res.status(403).json({ message: 'Only workspace owners and admins can manage team members' });
    }

    const resolved = await resolveMemberIds([req.body.userId]);
    if (!resolved.ok) return res.status(404).json({ message: 'User not found' });
    if (team.members.some((m) => m && String(m) === String(resolved.ids[0]))) {
      return res.status(409).json({ message: 'User is already a member of this team' });
    }

    team.members.push(resolved.ids[0]);
    await team.save();
    const populated = keepActiveMembers(await team.populate(ACTIVE_MEMBERS_POPULATE));
    res.status(201).json(populated);
    Activity.create({ userId: req.user._id, action: 'team.member.added', workspaceRef: team.workspaceRef, teamRef: team._id, details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/teams/:id/members/:userId — remove a member ───────────────────
router.delete('/:id/members/:userId', validate(null, { params: teamMemberParamsSchema }), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!(await canManageTeam(team, req.user))) {
      return res.status(403).json({ message: 'Only workspace owners and admins can manage team members' });
    }
    if (!team.members.some((m) => m && String(m) === String(req.params.userId))) {
      return res.status(404).json({ message: 'Member not found' });
    }

    team.members = team.members.filter((m) => m && String(m) !== String(req.params.userId));
    await team.save();
    const populated = keepActiveMembers(await team.populate(ACTIVE_MEMBERS_POPULATE));
    res.json(populated);
    Activity.create({ userId: req.user._id, action: 'team.member.removed', workspaceRef: team.workspaceRef, teamRef: team._id, details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── GET /api/teams/:id/analytics ──────────────────────────────────────────────
// IES-P1-23: admin-only analytics surface (used by the Admin console).
router.get('/:id/analytics', admin, validate(null, { params: teamParamsSchema, query: teamAnalyticsQuerySchema }), async (req, res, next) => {
  try {
    const team = keepActiveMembers(await Team.findById(req.params.id).populate({ path: 'members', select: 'name email', match: { deletedAt: null } }));
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const memberIds = team.members.map(m => m._id);
    const { from, to } = req.query;

    const sessionQuery = { userId: { $in: memberIds }, isActive: false };
    if (from || to) {
      sessionQuery.startTime = {};
      if (from) sessionQuery.startTime.$gte = Number(from);
      if (to)   sessionQuery.startTime.$lte = Number(to);
    }

    const [completedSessions, activeSessions, tasks] = await Promise.all([
      Session.find({ ...sessionQuery, isActive: false }).populate('userId', 'name email'),
      Session.find({ userId: { $in: memberIds }, isActive: true }).populate('userId', 'name email'),
      Task.find({ userId: { $in: memberIds } })
    ]);

    // Aggregate by member
    const memberStats = {};
    const now = Date.now();

    team.members.forEach(m => {
      memberStats[m._id] = {
        userId: m._id,
        name: m.name,
        totalTimeMs: 0,
        completedTasks: 0,
        sessionCount: 0
      };
    });

    completedSessions.forEach(s => {
      const uid = s.userId._id.toString();
      if (memberStats[uid]) {
        memberStats[uid].totalTimeMs += (s.activeTime || 0);
        memberStats[uid].sessionCount += 1;
      }
    });

    // ADD LIVE PROGRESS: Include ongoing sessions for members
    activeSessions.forEach(s => {
      const uid = s.userId._id.toString();
      if (memberStats[uid]) {
        const liveActive = Math.max(0, now - s.startTime - (s.totalPauseDuration || 0));
        memberStats[uid].totalTimeMs += liveActive;
        memberStats[uid].sessionCount += 1;
      }
    });

    tasks.forEach(t => {
      if (t.status === 'completed' && memberStats[t.userId]) {
        memberStats[t.userId].completedTasks += 1;
      }
    });

    const totalTimeMs = Object.values(memberStats).reduce((acc, m) => acc + m.totalTimeMs, 0);

    res.json({
      teamName: team.name,
      summary: {
        totalTimeMs,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        activeMembers: team.members.length
      },
      memberBreakdown: Object.values(memberStats)
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;

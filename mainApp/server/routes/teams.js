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
const Project = require('../models/Project');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');
const { can } = require('../authorization/authorization');
const { TEAM } = require('../authorization/permissions');
const { requireTeamPermission } = require('../authorization/middleware');
const { getProjectRole } = require('../authorization/relationships');
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
  projectId: objectId.optional(),
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

// Phase 5: validate that team members belong to the workspace (and project if
// project-scoped). Returns { ok, message } for route handlers.
function validateTeamMemberRefs(memberIds, workspace, project) {
  if (!workspace) return { ok: false, message: 'Workspace not found' };
  if (!Array.isArray(workspace.members)) return { ok: false, message: 'Invalid workspace' };

  const wsMemberIds = new Set(workspace.members.map((m) => String(m.userId)));
  const notInWorkspace = memberIds.filter((id) => !wsMemberIds.has(String(id)));
  if (notInWorkspace.length > 0) {
    return { ok: false, message: 'One or more users are not members of this workspace' };
  }

  // If project-scoped, members must also belong to the project
  if (project) {
    const projectMemberIds = new Set([String(project.userId)]);
    if (Array.isArray(project.members)) {
      project.members.forEach((m) => {
        const mId = m._id ? String(m._id) : String(m);
        projectMemberIds.add(mId);
      });
    }
    const notInProject = memberIds.filter((id) => !projectMemberIds.has(String(id)));
    if (notInProject.length > 0) {
      return { ok: false, message: 'One or more users are not members of this project' };
    }
  }

  return { ok: true };
}

// ── IES-P2-01 ownership helpers ───────────────────────────────────────────────
// Non-admin team reads are scoped to the workspaces the caller belongs to.
async function workspaceIdsFor(userId) {
  const ws = await Workspace.find({ 'members.userId': userId }).select('_id');
  return ws.map((w) => w._id);
}

// ── GET /api/teams ────────────────────────────────────────────────────────────
router.get('/', validate(null, { query: teamQuerySchema }), async (req, res, next) => {
  try {
    const { memberId } = req.query;
    let query = {};
    if (!req.user.roleId || req.user.roleId.level < 60) {
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
    const { name, description, members, workspaceId, projectId, leaderId, color } = req.body;

    // IES-P2-02: validate every provided member before touching the DB.
    const resolved = await resolveMemberIds(members || []);
    if (!resolved.ok) {
      return res.status(404).json({ message: 'One or more team members do not exist' });
    }

    let team;
    if (workspaceId) {
      const ws = await Workspace.findById(workspaceId).select('members createdBy');
      if (!ws) {
        return res.status(404).json({ message: 'Workspace not found' });
      }

      // Phase 5: load project context for PM access and member validation
      let project = null;
      if (projectId) {
        project = await Project.findById(projectId);
        if (!project || String(project.workspaceRef) !== String(workspaceId)) {
          return res.status(400).json({ message: 'Project not found in this workspace' });
        }
      }

      if (!can(req.user, TEAM.CREATE, { workspace: ws, project })) {
        return res.status(403).json({ message: 'You do not have permission to create teams in this workspace' });
      }

      // Phase 5: validate members belong to workspace (and project if project-scoped)
      const memberCheck = validateTeamMemberRefs(resolved.ids, ws, project);
      if (!memberCheck.ok) {
        return res.status(400).json({ message: memberCheck.message });
      }

      team = new Team({
        name,
        description,
        members: resolved.ids,
        createdBy: req.user._id,
        workspaceRef: workspaceId,
        projectRef: projectId || undefined,
        leaderId,
        color,
      });
    } else {
      if (!req.user.roleId || req.user.roleId.level < 60) {
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
router.get('/:id', validate(null, { params: teamParamsSchema }), requireTeamPermission(TEAM.VIEW), async (req, res, next) => {
  try {
    res.json(keepActiveMembers(await req.team.populate(ACTIVE_MEMBERS_POPULATE)));
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/teams/:id ──────────────────────────────────────────────────────
router.patch('/:id', validate(teamPatchSchema, { params: teamParamsSchema }), requireTeamPermission(TEAM.EDIT), async (req, res, next) => {
  try {
    const team = req.team;
    const { name, description, members, leaderId, color } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (members) {
      const resolved = await resolveMemberIds(members);
      if (!resolved.ok) {
        return res.status(404).json({ message: 'One or more team members do not exist' });
      }

      // Phase 5: validate members belong to workspace (and project if project-scoped)
      if (team.workspaceRef) {
        const ws = req.workspace || await Workspace.findById(team.workspaceRef).select('members createdBy');
        let project = null;
        if (team.projectRef) {
          project = req.project || await Project.findById(team.projectRef);
        }
        const memberCheck = validateTeamMemberRefs(resolved.ids, ws, project);
        if (!memberCheck.ok) {
          return res.status(400).json({ message: memberCheck.message });
        }
      }

      updates.members = resolved.ids;
    }
    if (leaderId !== undefined) {
      // Phase 5: leader must be a team member
      const effectiveMembers = updates.members || team.members;
      const leaderIsMember = effectiveMembers.some((m) => {
        const mId = m._id ? String(m._id) : String(m);
        return mId === String(leaderId);
      });
      if (!leaderIsMember) {
        return res.status(400).json({ message: 'Team leader must be a member of the team' });
      }
      updates.leaderId = leaderId;
    }
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
router.delete('/:id', validate(null, { params: teamParamsSchema }), requireTeamPermission(TEAM.DELETE), async (req, res, next) => {
  try {
    const team = req.team;
    await Team.findByIdAndDelete(team._id);
    res.json({ message: 'Team deleted' });
    Activity.create({ userId: req.user._id, action: 'team.deleted', workspaceRef: team.workspaceRef, teamRef: team._id, details: { teamName: team.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/teams/:id/members — add a member (admin / workspace manager) ────
router.post('/:id/members', validate(teamMemberSchema, { params: teamParamsSchema }), requireTeamPermission(TEAM.MANAGE_MEMBERS), async (req, res, next) => {
  try {
    const team = req.team;

    const resolved = await resolveMemberIds([req.body.userId]);
    if (!resolved.ok) return res.status(404).json({ message: 'User not found' });
    if (team.members.some((m) => m && String(m) === String(resolved.ids[0]))) {
      return res.status(409).json({ message: 'User is already a member of this team' });
    }

    // Phase 5: validate new member belongs to workspace (and project if project-scoped)
    if (team.workspaceRef) {
      const ws = req.workspace || await Workspace.findById(team.workspaceRef).select('members createdBy');
      let project = null;
      if (team.projectRef) {
        project = req.project || await Project.findById(team.projectRef);
      }
      const memberCheck = validateTeamMemberRefs(resolved.ids, ws, project);
      if (!memberCheck.ok) {
        return res.status(400).json({ message: memberCheck.message });
      }
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
router.delete('/:id/members/:userId', validate(null, { params: teamMemberParamsSchema }), requireTeamPermission(TEAM.MANAGE_MEMBERS), async (req, res, next) => {
  try {
    const team = req.team;
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

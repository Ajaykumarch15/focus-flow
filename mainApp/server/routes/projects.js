const express = require('express');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Team = require('../models/Team');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { memberUserId } = require('../middleware/workspace');
const { can } = require('../authorization/authorization');
const { PROJECT, WORKSPACE, PROJECT_ROLES } = require('../authorization/permissions');
const { requireProjectPermission } = require('../authorization/middleware');
const { getAuthorizedClient, createProjectFolders, setDriveError, clearDriveError } = require('../utils/googleDrive');
const { logger } = require('../utils/logger');
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param/query schemas.
const PROJECT_STATUS = ['planning', 'active', 'completed', 'on_hold'];
const PROJECT_MEMBER_ROLES = ['admin', 'nonadmin'];

const projectCreateSchema = z.object({
  name: requiredString(100, 'name', 'Project name is required'),
  workspaceId: objectId.optional(),
  description: z.string().max(2000).optional(),
  members: z.array(z.object({
    userId: objectId,
    role: z.enum(PROJECT_MEMBER_ROLES).default('nonadmin'),
    isProjectManager: z.boolean().optional(),
  })).max(500).optional(),
});
const projectParamsSchema = z.object({ id: objectId });
const projectQuerySchema = z.object({ workspaceId: objectId.optional() });

// EEP2-P2.2.2: PATCH body — the DDS §4.4 Project Information fields. Meta fields
// (`description`/`key`/`status`) are editor-gated; `members[]`/`teamIds[]`/
// `settings` are Owner/Admin-gated (checked in the handler). `.passthrough()`
// tolerates future fields without silently failing known ones.
const projectPatchSchema = z
  .object({
    description: z.string().max(2000, 'Description too long (max 2000)').optional(),
    key: z.string().trim().max(10, 'Project key must be 10 characters or fewer').optional(),
    status: z.enum(PROJECT_STATUS).optional(),
    members: z.array(z.object({
      userId: objectId,
      role: z.enum(PROJECT_MEMBER_ROLES).default('nonadmin'),
      isProjectManager: z.boolean().optional(),
    })).max(500, 'Too many members').optional(),
    teamIds: z.array(objectId).max(500, 'Too many teams').optional(),
    settings: z.record(z.any()).optional(),
  })
  .passthrough();

// EEP2-P2.2.2: `members[]` must reference active users who belong to the
// workspace (or, for personal projects, any active user).
async function validateMemberRefs(members, { ws, personal }) {
  if (!members || members.length === 0) return { ok: true, members: [] };
  const userIds = members.map(m => m.userId);
  const active = await User.find({ _id: { $in: userIds }, deletedAt: null }).select('_id');
  const found = new Set(active.map((u) => String(u._id)));
  const allowed = personal
    ? null
    : new Set((ws?.members || []).map((m) => String(memberUserId(m))));
  const missing = userIds.filter(
    (id) => !found.has(String(id)) || (allowed && !allowed.has(String(id)))
  );
  if (missing.length) {
    return { ok: false, message: personal ? 'Member not found' : 'members must belong to the workspace' };
  }
  // Preserve role assignments, default to Editor
  const memberMap = new Map(members.map(m => [m.userId, m.role || 'nonadmin']));
  return {
    ok: true,
    members: active.map((u) => ({ userId: u._id, role: memberMap.get(String(u._id)) || 'nonadmin', addedAt: new Date() })),
  };
}

// EEP2-P2.2.2: `teamIds[]` must reference teams scoped to the project's
// workspace (workspaceRef always matches the owning project's).
async function validateTeamRefs(teamIds, workspaceRef) {
  if (!teamIds || teamIds.length === 0) return { ok: true, ids: [] };
  const teams = await Team.find({ _id: { $in: teamIds }, workspaceRef }).select('_id');
  const found = new Set(teams.map((t) => String(t._id)));
  const missing = teamIds.filter((id) => !found.has(String(id)));
  if (missing.length) {
    return { ok: false, message: 'teamIds must reference teams in this workspace' };
  }
  return { ok: true, ids: teams.map((t) => t._id) };
}

// ── GET /api/projects ──────────────────────────────────────────────────────────
router.get('/', validate(null, { query: projectQuerySchema }), async (req, res, next) => {
  try {
    // IES-P2-01: ?workspaceId= returns that workspace's projects (project-scoped);
    // otherwise the caller's personal projects.
    if (req.query.workspaceId) {
      const ws = await Workspace.findById(req.query.workspaceId).select('members createdBy');
      if (!ws || !can(req.user, WORKSPACE.VIEW, { workspace: ws })) {
        return res.status(403).json({ message: 'You are not a member of this workspace' });
      }
      // Workspace membership already verified above — return all workspace projects.
      const projects = await Project.find({
        workspaceRef: req.query.workspaceId,
      }).sort({ name: 1 });
      return res.json(projects);
    }
    const projects = await Project.find({ userId: req.user._id, workspaceRef: null }).sort({ name: 1 });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects ─────────────────────────────────────────────────────────
router.post('/', validate(projectCreateSchema), async (req, res, next) => {
  try {
    const { name, workspaceId, description, members } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const trimmedName = name.trim();

    // IES-P2-01: workspace project — unique per workspace (workspaceRef + nameKey).
    if (workspaceId) {
      const ws = await Workspace.findById(workspaceId).select('members createdBy');
      if (!ws || !can(req.user, WORKSPACE.VIEW, { workspace: ws })) {
        return res.status(403).json({ message: 'Only workspace members can create projects' });
      }
      // Role check: only workspace admins/superadmins can create projects
      const wsMember = ws.members.find(m => String(m.userId) === String(req.user._id));
      if (!wsMember || (wsMember.role !== 'admin' && wsMember.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Only workspace admins can create projects' });
      }
      const existing = await Project.findOne({ workspaceRef: workspaceId, nameKey: trimmedName.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'A project with this name already exists in the workspace' });
      }

      // Build members array — ensure creator is included, apply isProjectManager flags
      const memberDocs = [];
      if (members && Array.isArray(members)) {
        for (const m of members) {
          // Verify each member is a workspace member
          const wsMember = ws.members.find(wm => String(wm.userId) === String(m.userId));
          if (!wsMember) continue;
          memberDocs.push({
            userId: m.userId,
            role: m.role || 'nonadmin',
            isProjectManager: !!m.isProjectManager,
            addedAt: new Date(),
          });
        }
      }
      // Ensure creator is in the members list
      const creatorInMembers = memberDocs.some(m => String(m.userId) === String(req.user._id));
      if (!creatorInMembers) {
        memberDocs.push({ userId: req.user._id, role: 'admin', isProjectManager: true, addedAt: new Date() });
      }

      try {
        const project = await Project.create({
          userId: req.user._id,
          name: trimmedName,
          description: description || '',
          workspaceRef: workspaceId,
          members: memberDocs,
        });
        Activity.create({
          userId: req.user._id,
          action: 'project.created',
          workspaceRef: workspaceId,
          details: { projectName: trimmedName },
        }).catch(() => {});
        return res.status(201).json(project);
      } catch (err) {
        if (err && err.code === 11000) {
          return res.status(400).json({ message: 'A project with this name already exists in the workspace' });
        }
        throw err;
      }
    }

    // IES-P1-12: exact-match pre-check on the lowercased `nameKey` (never a
    // `$regex` over user input). The DB unique index `{ userId, nameKey }` is
    // the authoritative guard — the E11000 catch below keeps the same friendly
    // 400 for the race where two creates slip past this check simultaneously.
    const existing = await Project.findOne({ userId: req.user._id, workspaceRef: null, nameKey: trimmedName.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'A project with this name already exists' });
    }

    let folderIds = {};

    // If Google Drive is connected, create folders automatically
    if (req.user.googleConnected && req.user.googleTokens && req.user.googleTokens.refreshToken) {
      try {
        const oauth2Client = await getAuthorizedClient(req.user);
        folderIds = await createProjectFolders(oauth2Client, trimmedName);
        await clearDriveError(req.user); // IES-P1-24: Drive worked — reset the flag.
      } catch (driveErr) {
        logger.warn('Google Drive folder creation failed during project setup');
        // IES-P1-24: surface the failure so the client can prompt a reconnect.
        await setDriveError(req.user, 'Drive folder creation failed. Please reconnect in settings.');
      }
    }

    let project;
    try {
      project = await Project.create({
        userId: req.user._id,
        name: trimmedName,
        ...folderIds,
      });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(400).json({ message: 'A project with this name already exists' });
      }
      throw err;
    }

    logger.debug('project created');
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// ── EEP2-P2.2.1 · GET /api/projects/:id ───────────────────────────────────────
// Single-project read (closes the DDS §4.4 Project Info gap). Member-gated:
// personal = creator only, workspace = any member.
router.get('/:id', validate(null, { params: projectParamsSchema }), requireProjectPermission(PROJECT.VIEW), async (req, res, next) => {
  try {
    res.json(req.project);
  } catch (err) {
    next(err);
  }
});

// ── EEP2-P2.2.2 · PATCH /api/projects/:id ─────────────────────────────────────
// Persists the DDS §4.4 Project Information. Role split enforced in the handler:
//   • description/key/status          → Project Manager or workspace Admin/Owner
//   • members[]/teamIds[]/settings    → workspace Owner | Admin
// member/team refs are validated against the workspace before saving; every
// mutation writes an Activity('project.updated') row.
router.patch('/:id', validate(projectPatchSchema, { params: projectParamsSchema }), requireProjectPermission(PROJECT.EDIT), async (req, res, next) => {
  try {
    const project = req.project;
    const { description, key, status, members, teamIds, settings } = req.body;

    const wantsMembership =
      members !== undefined || teamIds !== undefined || settings !== undefined;

    if (wantsMembership) {
      const context = { workspace: req.workspace || null, project };
      if (!can(req.user, PROJECT.MANAGE_MEMBERS, context)) {
        return res.status(403).json({ message: 'Only workspace owners and admins can manage project members, teams and settings' });
      }
    }

    if (members !== undefined) {
      const gate = { ws: req.workspace, personal: !project.workspaceRef };
      const checked = await validateMemberRefs(members, gate);
      if (!checked.ok) return res.status(400).json({ message: checked.message });
      project.members = checked.members;
    }
    if (teamIds !== undefined) {
      const checked = await validateTeamRefs(teamIds, project.workspaceRef);
      if (!checked.ok) return res.status(400).json({ message: checked.message });
      project.teamIds = checked.ids;
    }
    if (description !== undefined) project.description = description;
    if (key !== undefined) project.key = key;
    if (status !== undefined) project.status = status;
    if (settings !== undefined) project.settings = settings;

    await project.save();

    Activity.create({
      userId: req.user._id,
      action: 'project.updated',
      workspaceRef: project.workspaceRef || undefined,
      details: {
        projectId: String(project._id),
        projectName: project.name,
        changed: Object.keys(req.body),
      },
    }).catch(() => {});

    res.json(project);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects/:id/members ──────────────────────────────────────────
// Add a member to a project by email or userId with a role.
const addMemberSchema = z.object({
  email: z.string().email().optional(),
  userId: objectId.optional(),
  role: z.enum(PROJECT_MEMBER_ROLES).default('nonadmin'),
  isProjectManager: z.boolean().optional(),
}).refine((data) => data.email || data.userId, { message: 'email or userId is required' });

router.post('/:id/members', validate(addMemberSchema, { params: projectParamsSchema }), requireProjectPermission(PROJECT.MANAGE_MEMBERS), async (req, res, next) => {
  try {
    const project = req.project;
    const { email, userId: bodyUserId, role, isProjectManager } = req.body;

    // Resolve user by email or userId
    let targetUser;
    if (email) {
      targetUser = await User.findOne({ email: email.toLowerCase(), deletedAt: null }).select('_id name email');
    } else {
      targetUser = await User.findOne({ _id: bodyUserId, deletedAt: null }).select('_id name email');
    }
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Check if already a member
    const existing = project.members.find(m => String(m.userId) === String(targetUser._id));
    if (existing) return res.status(409).json({ message: 'User is already a project member' });

    // For workspace projects, verify user belongs to the workspace
    if (project.workspaceRef && req.workspace) {
      const isWsMember = req.workspace.members.some(m => String(memberUserId(m)) === String(targetUser._id));
      if (!isWsMember) return res.status(400).json({ message: 'User must be a workspace member first' });
    }

    project.members.push({ userId: targetUser._id, role, isProjectManager: !!isProjectManager, addedAt: new Date() });
    await project.save();

    Activity.create({
      userId: req.user._id,
      action: 'project.member.added',
      workspaceRef: project.workspaceRef || undefined,
      details: { projectId: String(project._id), projectName: project.name, addedUserId: String(targetUser._id), addedUserName: targetUser.name, role },
    }).catch(() => {});

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/projects/:id/members/:userId ──────────────────────────────────
// Change a member's role in a project.
const updateMemberSchema = z.object({
  role: z.enum(PROJECT_MEMBER_ROLES),
  isProjectManager: z.boolean().optional(),
});

router.patch('/:id/members/:userId', validate(updateMemberSchema, { params: z.object({ id: objectId, userId: objectId }) }), requireProjectPermission(PROJECT.MANAGE_MEMBERS), async (req, res, next) => {
  try {
    const project = req.project;
    const { userId } = req.params;
    const { role, isProjectManager } = req.body;

    const member = project.members.find(m => String(m.userId) === userId);
    if (!member) return res.status(404).json({ message: 'User is not a project member' });

    member.role = role;
    if (isProjectManager !== undefined) {
      member.isProjectManager = isProjectManager;
    }
    await project.save();

    Activity.create({
      userId: req.user._id,
      action: 'project.member.role_changed',
      workspaceRef: project.workspaceRef || undefined,
      details: { projectId: String(project._id), projectName: project.name, targetUserId: userId, newRole: role },
    }).catch(() => {});

    res.json(project);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/projects/:id/members/:userId ──────────────────────────────────
// Remove a member from a project.
router.delete('/:id/members/:userId', validate(null, { params: z.object({ id: objectId, userId: objectId }) }), requireProjectPermission(PROJECT.MANAGE_MEMBERS), async (req, res, next) => {
  try {
    const project = req.project;
    const { userId } = req.params;

    // Cannot remove the project manager
    if (String(project.userId) === userId) {
      return res.status(400).json({ message: 'Cannot remove the project manager' });
    }

    const memberIndex = project.members.findIndex(m => String(m.userId) === userId);
    if (memberIndex === -1) return res.status(404).json({ message: 'User is not a project member' });

    project.members.splice(memberIndex, 1);
    await project.save();

    Activity.create({
      userId: req.user._id,
      action: 'project.member.removed',
      workspaceRef: project.workspaceRef || undefined,
      details: { projectId: String(project._id), projectName: project.name, removedUserId: userId },
    }).catch(() => {});

    res.json(project);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────
// Hard-delete a project and all its sub-collections. Workspace admin or superadmin only.
router.delete('/:id', validate(null, { params: projectParamsSchema }), requireProjectPermission(PROJECT.DELETE), async (req, res, next) => {
  try {
    const project = req.project;
    const projectId = project._id;

    await Promise.all([
      require('../models/Task').deleteMany({ projectRef: projectId }),
      require('../models/Sprint').deleteMany({ projectRef: projectId }),
      require('../models/Feature').deleteMany({ projectRef: projectId }),
      require('../models/Milestone').deleteMany({ projectRef: projectId }),
      require('../models/Module').deleteMany({ projectRef: projectId }),
      require('../models/Phase').deleteMany({ projectRef: projectId }),
      require('../models/WorkLog').deleteMany({ projectRef: projectId }),
      require('../models/Session').deleteMany({ projectRef: projectId }),
      Project.findByIdAndDelete(projectId),
    ]);

    // Update workspace project count
    if (project.workspaceRef) {
      const count = await Project.countDocuments({ workspaceRef: project.workspaceRef });
      Workspace.findByIdAndUpdate(project.workspaceRef, { projectsCount: count }).catch(() => {});
    }

    res.json({ message: 'Project deleted' });
    Activity.create({ userId: req.user._id, action: 'project.deleted', workspaceRef: project.workspaceRef || undefined, details: { projectId: String(projectId), projectName: project.name } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects/:id/sync-drive ──────────────────────────────────────────
// Manual trigger to create folders if Google Drive was connected AFTER project creation
router.post('/:id/sync-drive', validate(null, { params: projectParamsSchema }), requireProjectPermission(PROJECT.EDIT), async (req, res, next) => {
  try {
    const project = req.project;

    if (!req.user.googleConnected) {
      return res.status(400).json({ message: 'Google Drive is not connected' });
    }

    if (project.googleFolderId) {
      return res.json({ message: 'Project folders already created in Google Drive', project });
    }

    const oauth2Client = await getAuthorizedClient(req.user);
    const folderIds = await createProjectFolders(oauth2Client, project.name);

    project.googleFolderId = folderIds.googleFolderId;
    project.workLogsFolderId = folderIds.workLogsFolderId;
    project.designDocsFolderId = folderIds.designDocsFolderId;
    project.meetingNotesFolderId = folderIds.meetingNotesFolderId;
    project.reportsFolderId = folderIds.reportsFolderId;

    await project.save();
    await clearDriveError(req.user); // IES-P1-24: sync succeeded — reset the flag.

    logger.debug('project drive folders synced');
    res.json(project);
  } catch (err) {
    // IES-P1-24: sync-drive failures reach the client as a 500 AND set the flag.
    await setDriveError(req.user, 'Drive sync failed. Please reconnect in settings.').catch(() => {});
    next(err);
  }
});

module.exports = router;

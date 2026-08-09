const express = require('express');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Team = require('../models/Team');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { findMember, memberUserId } = require('../middleware/workspace');
const { canEdit, canManage } = require('../utils/permissions');
const { getAuthorizedClient, createProjectFolders, setDriveError, clearDriveError } = require('../utils/googleDrive');
const { logger } = require('../utils/logger');
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param/query schemas.
const projectCreateSchema = z.object({
  name: requiredString(100, 'name', 'Project name is required'),
  workspaceId: objectId.optional(),
});
const projectParamsSchema = z.object({ id: objectId });
const projectQuerySchema = z.object({ workspaceId: objectId.optional() });

// EEP2-P2.2.2: PATCH body — the DDS §4.4 Project Information fields. Meta fields
// (`description`/`key`/`status`) are editor-gated; `members[]`/`teamIds[]`/
// `settings` are Owner/Admin-gated (checked in the handler). `.passthrough()`
// tolerates future fields without silently failing known ones.
const PROJECT_STATUS = ['planning', 'active', 'completed', 'on_hold'];
const projectPatchSchema = z
  .object({
    description: z.string().max(2000, 'Description too long (max 2000)').optional(),
    key: z.string().trim().max(10, 'Project key must be 10 characters or fewer').optional(),
    status: z.enum(PROJECT_STATUS).optional(),
    members: z.array(objectId).max(500, 'Too many members').optional(),
    teamIds: z.array(objectId).max(500, 'Too many teams').optional(),
    settings: z.record(z.any()).optional(),
  })
  .passthrough();

// ── IES-P2-01 / IES-P2-03 workspace access helpers ─────────────────────────────
// Reads require membership; creating requires any role except Viewer. Role checks
// reuse the shared member lookup from middleware/workspace.js (SAD §10.3).
async function canAccessWorkspace(workspaceId, user) {
  if (user.role === 'admin') return true;
  const ws = await Workspace.findById(workspaceId).select('members');
  return !!ws && !!findMember(ws, user._id);
}

async function canCreateInWorkspace(workspaceId, user) {
  if (user.role === 'admin') return true;
  const ws = await Workspace.findById(workspaceId).select('members');
  const m = ws && findMember(ws, user._id);
  return !!m && m.role !== 'Viewer';
}

// EEP2-P2.2.1/P2.2.2: resolves the caller's access to a single project.
// Personal projects (workspaceRef null) are creator-only; workspace projects
// require membership (any role, incl. Viewer — DDS §4.4 "Reads = workspace
// members"). Platform admin keeps the admin bypass used across this router.
async function resolveProjectGate(req, project) {
  if (!project.workspaceRef) {
    const isOwner = String(project.userId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') {
      return { ok: false, status: 403, message: 'You do not have access to this project' };
    }
    return { ok: true, personal: true, member: null, ws: null };
  }
  const ws = await Workspace.findById(project.workspaceRef).select('members');
  if (!ws) return { ok: false, status: 404, message: 'Workspace not found' };
  const member = ws ? findMember(ws, req.user._id) : null;
  if (!member && req.user.role !== 'admin') {
    return { ok: false, status: 403, message: 'You are not a member of this workspace' };
  }
  return { ok: true, personal: false, member, ws };
}

// EEP2-P2.2.2: `members[]` must reference active users who belong to the
// workspace (or, for personal projects, any active user).
async function validateMemberRefs(memberIds, { ws, personal }) {
  if (!memberIds || memberIds.length === 0) return { ok: true, ids: [] };
  const active = await User.find({ _id: { $in: memberIds }, deletedAt: null }).select('_id');
  const found = new Set(active.map((u) => String(u._id)));
  const allowed = personal
    ? null
    : new Set((ws?.members || []).map((m) => String(memberUserId(m))));
  const missing = memberIds.filter(
    (id) => !found.has(String(id)) || (allowed && !allowed.has(String(id)))
  );
  if (missing.length) {
    return { ok: false, message: personal ? 'Member not found' : 'members must belong to the workspace' };
  }
  return { ok: true, ids: active.map((u) => u._id) };
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
    // IES-P2-01: ?workspaceId= returns that workspace's projects (member-scoped);
    // otherwise the caller's personal projects.
    if (req.query.workspaceId) {
      if (!(await canAccessWorkspace(req.query.workspaceId, req.user))) {
        return res.status(403).json({ message: 'You are not a member of this workspace' });
      }
      const projects = await Project.find({ workspaceRef: req.query.workspaceId }).sort({ name: 1 });
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
    const { name, workspaceId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const trimmedName = name.trim();

    // IES-P2-01: workspace project — unique per workspace (workspaceRef + nameKey).
    if (workspaceId) {
      if (!(await canCreateInWorkspace(workspaceId, req.user))) {
        return res.status(403).json({ message: 'Only workspace members (non-viewers) can create projects' });
      }
      const existing = await Project.findOne({ workspaceRef: workspaceId, nameKey: trimmedName.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'A project with this name already exists in the workspace' });
      }
      try {
        const project = await Project.create({
          userId: req.user._id,
          name: trimmedName,
          workspaceRef: workspaceId,
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
router.get('/:id', validate(null, { params: projectParamsSchema }), async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const gate = await resolveProjectGate(req, project);
    if (!gate.ok) {
      return res.status(gate.status).json({ message: gate.message });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// ── EEP2-P2.2.2 · PATCH /api/projects/:id ─────────────────────────────────────
// Persists the DDS §4.4 Project Information. Role split enforced in the handler:
//   • description/key/status          → editors (any non-Viewer member)
//   • members[]/teamIds[]/settings    → Owner | Admin
// member/team refs are validated against the workspace before saving; every
// mutation writes an Activity('project.updated') row.
router.patch('/:id', validate(projectPatchSchema, { params: projectParamsSchema }), async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const gate = await resolveProjectGate(req, project);
    if (!gate.ok) {
      return res.status(gate.status).json({ message: gate.message });
    }

    // Personal projects grant the creator full Owner privileges; platform admin
    // is treated as the Admin workspace role (full read/edit/manage).
    const role = gate.personal ? 'Owner' : gate.member ? gate.member.role : 'Admin';
    const { description, key, status, members, teamIds, settings } = req.body;

    const wantsMeta = description !== undefined || key !== undefined || status !== undefined;
    const wantsMembership =
      members !== undefined || teamIds !== undefined || settings !== undefined;

    if (wantsMeta && !canEdit(role)) {
      return res.status(403).json({ message: 'You do not have permission to edit this project' });
    }
    if (wantsMembership && !canManage(role)) {
      return res.status(403).json({ message: 'Only workspace owners and admins can manage project members, teams and settings' });
    }

    if (members !== undefined) {
      const checked = await validateMemberRefs(members, gate);
      if (!checked.ok) return res.status(400).json({ message: checked.message });
      project.members = checked.ids;
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

// ── POST /api/projects/:id/sync-drive ──────────────────────────────────────────
// Manual trigger to create folders if Google Drive was connected AFTER project creation
router.post('/:id/sync-drive', validate(null, { params: projectParamsSchema }), async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

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

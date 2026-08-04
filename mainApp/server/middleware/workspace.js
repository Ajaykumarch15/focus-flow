// IES-P2-03: workspace-role authorization middleware — the workspace analogue of
// middleware/admin.js. Loads the workspace for `:id` routes, verifies the caller
// is a member, and enforces role gates on workspace/project/member routes.
//
// Semantics:
//   • loadWorkspace + requireMember → any workspace member (read surface)
//   • requireManager (Owner|Admin) → workspace settings + membership management
//   • requireOwner → workspace deletion / owner-role mutation
// Role checks are pure role checks (no implicit platform-admin bypass): an admin
// who is not a member of the workspace is treated like any other non-member,
// matching the workspace surface semantics in workspaces.js.
//
// Must run AFTER `protect`. See SAD §10.3 for the permission matrix.
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');

const ROLE_TIERS = ['Owner', 'Admin', 'Manager', 'Developer', 'Viewer'];
const MANAGER_ROLES = ['Owner', 'Admin'];
// IES-R1: any role except Viewer may create/update workspace resources.
const EDITOR_ROLES = ['Owner', 'Admin', 'Manager', 'Developer'];

// userId may be a raw ObjectId (unpopulated doc) or a populated user subdoc.
function memberUserId(m) {
  if (!m) return null;
  return m.userId && m.userId._id ? m.userId._id : m.userId;
}

function findMember(ws, userId) {
  if (!ws || !Array.isArray(ws.members)) return null;
  const userIdStr = String(userId);
  return ws.members.find((m) => m && String(memberUserId(m)) === userIdStr) || null;
}

function memberRole(ws, userId) {
  const m = findMember(ws, userId);
  return m ? m.role : null;
}

// Loads the workspace (unpopulated) into req.workspace and the caller's
// membership into req.member. 404 when the workspace doesn't exist.
async function loadWorkspace(req, res, next) {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });
    req.workspace = ws;
    req.member = findMember(ws, req.user && req.user._id);
    next();
  } catch (err) {
    next(err);
  }
}

// 403 unless the caller is a member of the loaded workspace.
function requireMember(req, res, next) {
  if (req.member) return next();
  return res.status(403).json({ message: 'You are not a member of this workspace' });
}

// Middleware factory: 403 unless the caller's workspace role is in `roles`.
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.member && roles.includes(req.member.role)) return next();
    return res.status(403).json({ message: 'You do not have permission to perform this action' });
  };
}

const requireManager = requireRole(...MANAGER_ROLES);
const requireOwner = requireRole('Owner');

// ── IES-R1: shared gates for the flat sprint/feature routes ───────────────────
// The requireWorkspace* gates are the requireRole factories above — they only
// need `req.member`, which the loaders below populate. Role semantics:
//   • requireWorkspaceMember    — any role incl. Viewer (reads)
//   • requireWorkspaceEditor    — any role except Viewer (create/update)
//   • requireWorkspaceOwnerAdmin — Owner|Admin (delete/settings)
const requireWorkspaceMember = requireMember;
const requireWorkspaceEditor = requireRole(...EDITOR_ROLES);
const requireWorkspaceOwnerAdmin = requireRole(...MANAGER_ROLES);

// Middleware factory for `:id` routes on workspace-scoped resources (sprint /
// feature / workspace task): loads the resource's workspace into `req.workspace`
// and the caller's membership into `req.member` so the requireWorkspace* gates
// can run. `getRef(req)` returns the owning resource's workspaceRef.
function scopeToWorkspace(getRef) {
  return async (req, res, next) => {
    try {
      const ref = getRef(req);
      const ws = ref ? await Workspace.findById(ref).select('members') : null;
      req.workspace = ws;
      req.member = ws ? findMember(ws, req.user && req.user._id) : null;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// IES-R1 ownership invariant: `workspaceRef` on Sprint/Feature/Task is always
// derived from the owning Project here — never trusted from the client body.
// Middleware for project-driven routes (GET list / POST create): resolves the
// owning Project (from query.projectId / body.projectId / params.projectId),
// then loads its workspace + the caller's membership into req.project /
// req.workspace / req.member.
async function resolveProjectWorkspace(req, res, next) {
  try {
    const projectId = req.query.projectId || req.body.projectId || req.params.projectId;
    if (!projectId) return res.status(400).json({ message: 'projectId is required' });
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!project.workspaceRef) {
      return res.status(400).json({ message: 'Project is not workspace-scoped' });
    }
    req.project = project;
    const ws = await Workspace.findById(project.workspaceRef).select('members');
    req.workspace = ws;
    req.member = ws ? findMember(ws, req.user && req.user._id) : null;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ROLE_TIERS,
  MANAGER_ROLES,
  EDITOR_ROLES,
  memberUserId,
  findMember,
  memberRole,
  loadWorkspace,
  requireMember,
  requireRole,
  requireManager,
  requireOwner,
  requireWorkspaceMember,
  requireWorkspaceEditor,
  requireWorkspaceOwnerAdmin,
  scopeToWorkspace,
  resolveProjectWorkspace,
};

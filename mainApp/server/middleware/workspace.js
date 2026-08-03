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

const ROLE_TIERS = ['Owner', 'Admin', 'Manager', 'Developer', 'Viewer'];
const MANAGER_ROLES = ['Owner', 'Admin'];

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

module.exports = {
  ROLE_TIERS,
  MANAGER_ROLES,
  memberUserId,
  findMember,
  memberRole,
  loadWorkspace,
  requireMember,
  requireRole,
  requireManager,
  requireOwner,
};

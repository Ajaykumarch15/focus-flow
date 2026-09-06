// authorization/policies/project.policy.js — Project authorization policy.
//
// Centralizes all project-level authorization decisions. Project authorization
// considers both workspace role and project relationship (manager/member).
//
// Two code paths:
//   1. Personal projects (workspaceRef null): creator-only access. Platform
//      admin receives a blanket bypass.
//   2. Workspace projects: workspace role + project relationship determine
//      the effective permission.
//
// Permission matrix (workspace role + project relationship):
//   ┌─────────────────────┬──────┬──────┬──────┬─────────┬──────────┐
//   │ Permission          │ Ownr │ Admn │ PM   │ PMember │ unrelated│
//   ├─────────────────────┼──────┼──────┼──────┼─────────┼──────────┤
//   │ project.view        │  ✓   │  ✓   │  ✓   │   ✓     │    ✗     │
//   │ project.create      │  ✓   │  ✓   │  ✓   │   ✓     │    ✗     │
//   │ project.edit        │  ✓   │  ✓   │  ✓   │   ✗     │    ✗     │
//   │ project.delete      │  ✓   │  ✓   │  ✗   │   ✗     │    ✗     │
//   │ project.archive     │  ✓   │  ✓   │  ✓   │   ✗     │    ✗     │
//   │ project.manage_mbrs │  ✓   │  ✓   │  ✓   │   ✗     │    ✗     │
//   │ project.assign_mgr  │  ✓   │  ✓   │  ✗   │   ✗     │    ✗     │
//   └─────────────────────┴──────┴──────┴──────┴─────────┴──────────┘

const { PROJECT } = require('../permissions');
const { getWorkspaceRole, getProjectRole } = require('../relationships');

/**
 * Evaluate a project permission.
 *
 * @param {object} user      - The authenticated user.
 * @param {string} permission - A project.* permission constant.
 * @param {object} context    - Must contain `project`.  For workspace projects
 *                              `context.workspace` is also required.
 * @returns {boolean}
 */
function can(user, permission, context) {
  if (!user || !context || !context.project) return false;

  // Platform admin bypass — covers every permission including personal projects.
  if (user.role === 'admin') return true;

  const project = context.project;

  // ── Personal projects (no workspaceRef) ────────────────────────────────────
  // The creator is the sole authorized user.  All permissions are granted
  // because there are no other participants to protect against.
  if (!project.workspaceRef) {
    const isCreator = String(project.userId) === String(user._id);
    return isCreator;
  }

  // ── Workspace projects ─────────────────────────────────────────────────────
  if (!context.workspace) return false;

  const wsRole = getWorkspaceRole(user, context.workspace);
  if (!wsRole) return false;

  const projectRole = getProjectRole(user, project);
  const isWsAdmin = wsRole === 'Owner' || wsRole === 'Admin';
  const isProjectMgr = projectRole === 'manager';
  const isProjectMbr = projectRole !== null;

  switch (permission) {
    // Owner/Admin can always view. Project Manager/Member can view their projects.
    // Unrelated workspace members CANNOT view.
    case PROJECT.VIEW:
      return isWsAdmin || isProjectMbr;

    // Owner/Admin/Member can create projects (preserve existing behavior)
    case PROJECT.CREATE:
      return true;

    // Project Manager or workspace Admin/Owner can edit project metadata
    case PROJECT.EDIT:
      return isProjectMgr || isWsAdmin;

    // workspace Owner/Admin can delete projects
    case PROJECT.DELETE:
      return isWsAdmin;

    // workspace Owner/Admin or Project Manager can archive projects
    case PROJECT.ARCHIVE:
      return isProjectMgr || isWsAdmin;

    // workspace Owner/Admin or Project Manager can manage project members
    case PROJECT.MANAGE_MEMBERS:
      return isProjectMgr || isWsAdmin;

    // workspace Owner/Admin can reassign project manager
    case PROJECT.ASSIGN_MANAGER:
      return isWsAdmin;

    default:
      return false;
  }
}

module.exports = { can };

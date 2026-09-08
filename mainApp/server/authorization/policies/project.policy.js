// authorization/policies/project.policy.js — Project authorization policy.
//
// Centralizes all project-level authorization decisions. Project authorization
// considers both workspace role and project role (unified: superadmin/admin/nonadmin).
//
// Two code paths:
//   1. Personal projects (workspaceRef null): creator-only access. Platform
//      admin receives a blanket bypass.
//   2. Workspace projects: workspace role + project role determine
//      the effective permission.
//
// UNIFIED ROLE SYSTEM:
//   - superadmin: blanket bypass
//   - admin: full project management
//   - nonadmin: can view/edit tasks, cannot delete/archive projects
//   - project manager (nonadmin+): admin-level permissions within their project

const { PROJECT, ROLE_LEVELS } = require('../permissions');
const { getWorkspaceRole, getProjectRole, isProjectManager } = require('../relationships');

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
  if (user.roleId?.level >= 60) return true;

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
  const isWsAdmin = wsRole === 'admin' || wsRole === 'superadmin';
  const isProjectMgr = isProjectManager(user, project);
  const isProjectMbr = projectRole !== null;

  switch (permission) {
    // Admin/superadmin can always view. Project members can view their projects.
    // Unrelated workspace members CANNOT view.
    case PROJECT.VIEW:
      return isWsAdmin || isProjectMbr;

    // All workspace members can create projects
    case PROJECT.CREATE:
      return true;

    // Project Manager, or workspace admin/superadmin can edit project metadata
    case PROJECT.EDIT:
      return isProjectMgr || isWsAdmin;

    // workspace admin/superadmin can delete projects
    case PROJECT.DELETE:
      return isWsAdmin;

    // workspace admin/superadmin or Project Manager can archive projects
    case PROJECT.ARCHIVE:
      return isProjectMgr || isWsAdmin;

    // workspace admin/superadmin or Project Manager can manage project members
    case PROJECT.MANAGE_MEMBERS:
      return isProjectMgr || isWsAdmin;

    // workspace admin/superadmin can reassign project manager
    case PROJECT.ASSIGN_MANAGER:
      return isWsAdmin;

    default:
      return false;
  }
}

module.exports = { can };

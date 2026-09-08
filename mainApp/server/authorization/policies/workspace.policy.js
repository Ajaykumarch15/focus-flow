// authorization/policies/workspace.policy.js — Workspace authorization policy.
//
// Centralizes all workspace-level authorization decisions. Each function
// evaluates whether a user can perform a specific action on a workspace,
// given the current context.
//
// UNIFIED ROLE SYSTEM:
//   - superadmin: full control
//   - admin: can edit settings, manage members, manage project managers
//   - nonadmin: can view only (unless designated as project manager)

const { WORKSPACE, ROLE_LEVELS } = require('../permissions');
const { getWorkspaceRole, isWorkspaceProjectManager } = require('../relationships');

/**
 * Evaluate a workspace permission.
 *
 * @param {object} user      - The authenticated user.
 * @param {string} permission - A workspace.* permission constant.
 * @param {object} context    - Must contain `workspace`.
 * @returns {boolean}
 */
function can(user, permission, context) {
  if (!user || !context || !context.workspace) return false;

  const role = getWorkspaceRole(user, context.workspace);
  if (!role) return false;

  const isSuperadmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperadmin;
  const isPM = isWorkspaceProjectManager(user, context.workspace);

  switch (permission) {
    // Any workspace member can view
    case WORKSPACE.VIEW:
      return true;

    // Admin and superadmin can edit workspace settings
    // Project managers can also edit settings
    case WORKSPACE.EDIT:
      return isAdmin || isPM;

    // Superadmin only can delete workspace
    case WORKSPACE.DELETE:
      return isSuperadmin;

    // Admin and superadmin can manage members
    // Project managers can also manage members
    case WORKSPACE.MANAGE_MEMBERS:
      return isAdmin || isPM;

    // Superadmin only can manage roles
    case WORKSPACE.MANAGE_ROLES:
      return isSuperadmin;

    // Superadmin only can manage billing
    case WORKSPACE.MANAGE_BILLING:
      return isSuperadmin;

    // Superadmin only can transfer ownership
    case WORKSPACE.TRANSFER_OWNERSHIP:
      return isSuperadmin;

    default:
      return false;
  }
}

module.exports = { can };

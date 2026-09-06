// authorization/policies/workspace.policy.js — Workspace authorization policy.
//
// Centralizes all workspace-level authorization decisions. Each function
// evaluates whether a user can perform a specific action on a workspace,
// given the current context.

const { WORKSPACE } = require('../permissions');
const { getWorkspaceRole } = require('../relationships');

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

  switch (permission) {
    // Any workspace member can view
    case WORKSPACE.VIEW:
      return true;

    // Owner and Admin can edit workspace settings
    case WORKSPACE.EDIT:
      return role === 'Owner' || role === 'Admin';

    // Owner only can delete workspace
    case WORKSPACE.DELETE:
      return role === 'Owner';

    // Owner and Admin can manage members
    case WORKSPACE.MANAGE_MEMBERS:
      return role === 'Owner' || role === 'Admin';

    // Owner and Admin can manage roles
    case WORKSPACE.MANAGE_ROLES:
      return role === 'Owner' || role === 'Admin';

    // Owner only can manage billing
    case WORKSPACE.MANAGE_BILLING:
      return role === 'Owner';

    // Owner only can transfer ownership
    case WORKSPACE.TRANSFER_OWNERSHIP:
      return role === 'Owner';

    default:
      return false;
  }
}

module.exports = { can };

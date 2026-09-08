// authorization/policies/team.policy.js — Team authorization policy.
//
// Centralizes all team-level authorization decisions. Team authorization
// considers workspace role, project relationship, and team leadership.
//
// Access hierarchy:
//   1. Platform admin — blanket bypass.
//   2. Workspace superadmin — full access to all teams in workspace.
//   3. Workspace admin — full access to all teams in workspace.
//   4. Project Manager — create/manage teams belonging to their project.
//   5. Team Leader — access/manage their own team.
//   6. Team Member — view/participate in their team.
//   7. Unrelated — no access.
//
// Two code paths:
//   1. Legacy teams (workspaceRef null): admin-only access.
//   2. Workspace teams: workspace role + project relationship + team
//      leadership determine the effective permission.
//
// UNIFIED ROLE SYSTEM:
//   - superadmin: blanket bypass
//   - admin: full team management
//   - project manager (nonadmin+): can create/manage teams within their project
//   - team leader: can edit/manage their own team
//   - team member: can view their own team

const { TEAM, ROLE_LEVELS } = require('../permissions');
const { getWorkspaceRole, getProjectRole, isProjectManager, isTeamLeader, isTeamMember } = require('../relationships');

/**
 * Evaluate a team permission.
 *
 * @param {object} user      - The authenticated user.
 * @param {string} permission - A team.* permission constant.
 * @param {object} context    - Must contain `workspace` (for workspace teams).
 *                              May contain `team` for non-CREATE checks.
 *                              May contain `project` for project-scoped teams.
 * @returns {boolean}
 */
function can(user, permission, context) {
  if (!user || !context) return false;

  // Platform admin bypass — covers every permission.
  if (user.roleId?.level >= 60) return true;

  // ── CREATE does not require an existing team ──────────────────────────────
  if (permission === TEAM.CREATE) {
    // Legacy teams (no workspace) are admin-only (handled above)
    if (!context.workspace) return false;
    const wsRole = getWorkspaceRole(user, context.workspace);
    if (!wsRole) return false;
    const isWsAdmin = wsRole === 'admin' || wsRole === 'superadmin';
    // Admin/superadmin can always create
    if (isWsAdmin) return true;
    // Project Manager can create teams within their project
    if (context.project) {
      if (isProjectManager(user, context.project)) return true;
    }
    return false;
  }

  // ── For all other permissions, need both workspace and team ────────────────
  if (!context.workspace || !context.team) return false;

  const wsRole = getWorkspaceRole(user, context.workspace);
  if (!wsRole) return false;

  const isWsAdmin = wsRole === 'admin' || wsRole === 'superadmin';
  const leader = isTeamLeader(user, context.team);
  const member = isTeamMember(user, context.team);

  // Project Manager access (only for project-scoped teams)
  let isProjectMgr = false;
  if (context.team.projectRef && context.project) {
    isProjectMgr = isProjectManager(user, context.project);
  }

  switch (permission) {
    // Admin/superadmin can always view. PM can view project-scoped teams.
    // Team Leader/Member can view their own team.
    case TEAM.VIEW:
      return isWsAdmin || isProjectMgr || leader || member;

    // Admin/superadmin or Team Leader can edit team
    case TEAM.EDIT:
      return isWsAdmin || leader;

    // Admin/superadmin can delete teams
    case TEAM.DELETE:
      return isWsAdmin;

    // Admin/superadmin or Team Leader can manage team members
    case TEAM.MANAGE_MEMBERS:
      return isWsAdmin || leader;

    // Admin/superadmin can assign team leader
    case TEAM.ASSIGN_LEADER:
      return isWsAdmin;

    default:
      return false;
  }
}

module.exports = { can };

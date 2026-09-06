// authorization/policies/team.policy.js — Team authorization policy.
//
// Centralizes all team-level authorization decisions. Team authorization
// considers workspace role, project relationship, and team leadership.
//
// Access hierarchy:
//   1. Platform admin — blanket bypass.
//   2. Workspace Owner/Admin — full access to all teams in workspace.
//   3. Project Manager — access teams belonging to their project.
//   4. Team Leader — access/manage their own team.
//   5. Team Member — view/participate in their team.
//   6. Unrelated — no access.
//
// Two code paths:
//   1. Legacy teams (workspaceRef null): admin-only access.
//   2. Workspace teams: workspace role + project relationship + team
//      leadership determine the effective permission.
//
// Permission matrix:
//   ┌───────────────────┬──────┬──────┬──────┬──────┬──────┬─────────┐
//   │ Permission        │ Ownr │ Admn │ PM   │ TL   │ TM   │ unrelated│
//   ├───────────────────┼──────┼──────┼──────┼──────┼──────┼─────────┤
//   │ team.view         │  ✓   │  ✓   │  ✓¹  │  ✓²  │  ✓²  │    ✗    │
//   │ team.create       │  ✓   │  ✓   │  ✓¹  │  ✗   │  ✗   │    ✗    │
//   │ team.edit         │  ✓   │  ✓   │  ✗   │  ✓²  │  ✗   │    ✗    │
//   │ team.delete       │  ✓   │  ✓   │  ✗   │  ✗   │  ✗   │    ✗    │
//   │ team.manage_mbrs  │  ✓   │  ✓   │  ✗   │  ✓²  │  ✗   │    ✗    │
//   │ team.assign_leader│  ✓   │  ✓   │  ✗   │  ✗   │  ✗   │    ✗    │
//   └───────────────────┴──────┴──────┴──────┴──────┴──────┴─────────┘
//   ¹ PM access only for project-scoped teams (team.projectRef set).
//   ² TL/TM access only for their own team (team membership check).

const { TEAM } = require('../permissions');
const { getWorkspaceRole, getProjectRole, isTeamLeader, isTeamMember } = require('../relationships');

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
  if (user.role === 'admin') return true;

  // ── CREATE does not require an existing team ──────────────────────────────
  if (permission === TEAM.CREATE) {
    // Legacy teams (no workspace) are admin-only (handled above)
    if (!context.workspace) return false;
    const wsRole = getWorkspaceRole(user, context.workspace);
    if (!wsRole) return false;
    // Owner/Admin can always create
    if (wsRole === 'Owner' || wsRole === 'Admin') return true;
    // Project Manager can create teams within their project
    if (context.project) {
      const projectRole = getProjectRole(user, context.project);
      if (projectRole === 'manager') return true;
    }
    return false;
  }

  // ── For all other permissions, need both workspace and team ────────────────
  if (!context.workspace || !context.team) return false;

  const wsRole = getWorkspaceRole(user, context.workspace);
  if (!wsRole) return false;

  const isWsAdmin = wsRole === 'Owner' || wsRole === 'Admin';
  const leader = isTeamLeader(user, context.team);
  const member = isTeamMember(user, context.team);

  // Project Manager access (only for project-scoped teams)
  let isProjectMgr = false;
  if (context.team.projectRef && context.project) {
    const projectRole = getProjectRole(user, context.project);
    isProjectMgr = projectRole === 'manager';
  }

  switch (permission) {
    // Owner/Admin can always view. PM can view project-scoped teams.
    // Team Leader/Member can view their own team.
    case TEAM.VIEW:
      return isWsAdmin || isProjectMgr || leader || member;

    // Owner/Admin or Team Leader can edit team
    case TEAM.EDIT:
      return isWsAdmin || leader;

    // Owner/Admin can delete teams
    case TEAM.DELETE:
      return isWsAdmin;

    // Owner/Admin or Team Leader can manage team members
    case TEAM.MANAGE_MEMBERS:
      return isWsAdmin || leader;

    // Owner/Admin can assign team leader
    case TEAM.ASSIGN_LEADER:
      return isWsAdmin;

    default:
      return false;
  }
}

module.exports = { can };

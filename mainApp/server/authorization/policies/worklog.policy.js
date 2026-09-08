// authorization/policies/worklog.policy.js — WorkLog authorization policy.
//
// Centralizes authorization for WorkLog operations. The policy distinguishes
// between Personal WorkLogs (no company context — private to owner) and
// Company WorkLogs (associated with a workspace task/project — visible to
// authorized users based on relationships).
//
// Scope derivation:
//   WorkLog → Task → Project → Workspace
//   WorkLog → Project → Workspace
//
// A WorkLog is "company" if its task has a workspaceRef OR it has a projectRef.
// A WorkLog is "personal" otherwise (standalone or task with workspaceRef null).
//
// UNIFIED ROLE SYSTEM:
//   - superadmin: blanket bypass
//   - admin: full worklog management
//   - project manager (nonadmin+): can review/approve worklogs in their project
//   - team leader: can view/review worklogs of their team members
//   - owner: can view/edit/delete their own worklogs

const { WORKLOG, ROLE_LEVELS } = require('../permissions');
const {
  getWorkspaceRole,
  getProjectRole,
  isProjectManager,
  isTeamLeader,
  isResourceOwner,
  isUserIdInTeam,
} = require('../relationships');

/**
 * Evaluate a worklog permission.
 *
 * Context may contain:
 *   resource  {object} - The WorkLog document (required for ownership checks).
 *   workspace {object} - The workspace document (from task.workspaceRef or project.workspaceRef).
 *   project   {object} - The project document (from worklog.projectRef or task.projectRef).
 *   team      {object} - The team document (optional, for team-scoped queries).
 *   task      {object} - The task document (optional, for scope derivation).
 *
 * @param {object} user       - The authenticated user.
 * @param {string} permission - A worklog.* permission constant.
 * @param {object} context    - Resource context.
 * @returns {boolean}
 */
function can(user, permission, context) {
  if (!user || !context) return false;

  // Platform admin bypass — covers every permission.
  if (user.roleId?.level >= 60) return true;

  const log = context.resource;
  const isOwner = log ? isResourceOwner(user, log) : false;

  // ── Workspace role ────────────────────────────────────────────────────────
  const wsRole = context.workspace ? getWorkspaceRole(user, context.workspace) : null;
  const isWsAdmin = wsRole === 'admin' || wsRole === 'superadmin';

  // ── Project role ──────────────────────────────────────────────────────────
  const isProjectMgr = context.project ? isProjectManager(user, context.project) : false;

  // ── Team role ─────────────────────────────────────────────────────────────
  const isLeader = context.team ? isTeamLeader(user, context.team) : false;

  // ── Scope derivation ──────────────────────────────────────────────────────
  // Determine whether this is a company WorkLog (has workspace context) or
  // a personal WorkLog (no workspace context).
  const logOwnerId = log ? log.userId : null;

  // A WorkLog is "company" if:
  //   - It has a projectRef (projects are always workspace-scoped or personal,
  //     but the presence of projectRef implies company context), OR
  //   - Its task has a workspaceRef (task is in a workspace)
  const hasWorkspaceScope = Boolean(
    (log && log.projectRef) ||
    (context.task && context.task.workspaceRef)
  );

  // ── Permission switch ─────────────────────────────────────────────────────
  switch (permission) {
    // ── Own-worklog permissions (always allowed for the owner) ────────────
    case WORKLOG.VIEW_OWN:
      return isOwner;

    case WORKLOG.CREATE:
      return true;

    case WORKLOG.EDIT_OWN:
      return isOwner;

    case WORKLOG.DELETE_OWN:
      return isOwner;

    case WORKLOG.SUBMIT:
      return isOwner;

    // ── Team visibility ───────────────────────────────────────────────────
    // Allowed for: Team Leader (of a team the worklog owner belongs to),
    //   workspace admin/superadmin, Project Manager (of the worklog's project).
    // Denied for: plain nonadmins, Team Leaders of unrelated teams.
    case WORKLOG.VIEW_TEAM: {
      if (!hasWorkspaceScope) return false;
      // Admin/superadmin: blanket workspace access
      if (isWsAdmin) return true;
      // PM: can view worklogs in their project
      if (isProjectMgr) return true;
      // Team Leader: can view worklogs of their team members
      if (isLeader && logOwnerId && isUserIdInTeam(logOwnerId, context.team)) return true;
      return false;
    }

    // ── Project visibility ────────────────────────────────────────────────
    // Allowed for: Project Manager (of the worklog's project),
    //   workspace admin/superadmin.
    // Denied for: plain nonadmins, PMs of unrelated projects.
    case WORKLOG.VIEW_PROJECT: {
      if (!hasWorkspaceScope) return false;
      if (isWsAdmin) return true;
      // PM: only if the worklog actually belongs to their project
      if (isProjectMgr && context.project) {
        const logProjId = log && log.projectRef ? String(log.projectRef) : null;
        const taskProjId = context.task && context.task.projectRef ? String(context.task.projectRef) : null;
        const pmProjId = String(context.project._id);
        if (logProjId === pmProjId || taskProjId === pmProjId) return true;
      }
      return false;
    }

    // ── Review / Approve / Request Changes ────────────────────────────────
    // Allowed for: Team Leader (of the owner's team), PM (of the worklog's
    //   project), workspace admin/superadmin.
    // Denied for: the worklog owner themselves (self-approval prevention),
    //   plain nonadmins, unrelated Leaders/PMs.
    case WORKLOG.REVIEW:
    case WORKLOG.REQUEST_CHANGES: {
      if (!hasWorkspaceScope) return false;
      if (isOwner) return false;
      if (isWsAdmin) return true;
      // PM: only if the worklog actually belongs to their project
      if (isProjectMgr && context.project) {
        const logProjId = log && log.projectRef ? String(log.projectRef) : null;
        const taskProjId = context.task && context.task.projectRef ? String(context.task.projectRef) : null;
        const pmProjId = String(context.project._id);
        if (logProjId === pmProjId || taskProjId === pmProjId) return true;
      }
      // Team Leader: only if the worklog owner is on their team
      if (isLeader && logOwnerId && isUserIdInTeam(logOwnerId, context.team)) return true;
      return false;
    }

    case WORKLOG.APPROVE: {
      if (!hasWorkspaceScope) return false;
      if (isOwner) return false;
      if (isWsAdmin) return true;
      // PM: only if the worklog actually belongs to their project
      if (isProjectMgr && context.project) {
        const logProjId = log && log.projectRef ? String(log.projectRef) : null;
        const taskProjId = context.task && context.task.projectRef ? String(context.task.projectRef) : null;
        const pmProjId = String(context.project._id);
        if (logProjId === pmProjId || taskProjId === pmProjId) return true;
      }
      // Team Leader: only if the worklog owner is on their team
      if (isLeader && logOwnerId && isUserIdInTeam(logOwnerId, context.team)) return true;
      return false;
    }

    default:
      return false;
  }
}

module.exports = { can };

// authorization/policies/task.policy.js — Task authorization policy.
//
// Centralizes all task-level authorization decisions. Task authorization
// considers workspace role, project relationship, team leadership, and
// task assignment/review.
//
// Scope derivation:
//   Task → Project → Workspace
//
// A Task is "personal" if workspaceRef is null.
// A Task is "company" if workspaceRef is set.
//
// UNIFIED ROLE SYSTEM:
//   - superadmin: blanket bypass
//   - admin: full task management
//   - project manager (nonadmin+): admin-level permissions within their project
//   - team leader: can edit/manage tasks in their team
//   - assignee/reviewer: can edit/submit/review their assigned tasks

const { TASK, ROLE_LEVELS } = require('../permissions');
const {
  getWorkspaceRole,
  getProjectRole,
  isProjectManager,
  isTeamLeader,
  isTeamMember,
  isTaskAssignee,
  isTaskReviewer,
  isResourceOwner,
} = require('../relationships');

/**
 * Evaluate a task permission.
 *
 * Context may contain:
 *   resource  {object} - The Task document (required).
 *   workspace {object} - The workspace document.
 *   project   {object} - The project document (from task.projectRef).
 *   team      {object} - The team document (optional).
 *
 * @param {object} user       - The authenticated user.
 * @param {string} permission - A task.* permission constant.
 * @param {object} context    - Resource context.
 * @returns {boolean}
 */
function can(user, permission, context) {
  if (!user || !context) return false;

  const task = context.resource || context.task;

  // ── Personal tasks (no workspace) — owner-only ───────────────────────────
  // Personal tasks are owner-only, even for platform admins.
  if (task && !task.workspaceRef) {
    return handlePersonalTask(user, permission, task);
  }

  // Platform admin bypass — covers every permission for company tasks.
  if (user.roleId?.level >= 60) return true;

  // ── Company tasks require workspace context ──────────────────────────────
  if (!context.workspace) return false;

  const wsRole = getWorkspaceRole(user, context.workspace);
  if (!wsRole) return false;

  const isWsAdmin = wsRole === 'admin' || wsRole === 'superadmin';
  const isWsMember = wsRole !== null;

  // ── Project relationship ─────────────────────────────────────────────────
  let isProjectMgr = false;
  let isProjectMbr = false;
  if (context.project) {
    isProjectMgr = isProjectManager(user, context.project);
    isProjectMbr = getProjectRole(user, context.project) !== null;
  }

  // ── Task-specific relationships ──────────────────────────────────────────
  const assignee = task ? isTaskAssignee(user, task) : false;
  const reviewer = task ? isTaskReviewer(user, task) : false;
  const isOwner = task ? isResourceOwner(user, task) : false;

  // ── Scope checks ────────────────────────────────────────────────────────
  // A user can access a task if they have a relationship to it:
  //   - Owner/Admin of workspace
  //   - PM or Member of the task's project
  //   - Assignee or Reviewer of the task
  //   - Team Leader of the task's team
  //   - Follower of the task
  const isTeamLdr = context.team && isTeamLeader(user, context.team);
  const hasTaskRelationship = isWsAdmin || isProjectMgr || isProjectMbr || isTeamLdr || assignee || reviewer || isOwner;
  const isFollower = task && Array.isArray(task.followerIds) && task.followerIds.some((id) => String(id) === String(user._id));

  switch (permission) {
    // ── VIEW ─────────────────────────────────────────────────────────────
    // Personal: owner only.
    // Company: Owner/Admin, PM/Member of project, Team Leader, Assignee, Reviewer, Follower.
    case TASK.VIEW:
      return hasTaskRelationship || isFollower;

    // ── CREATE ───────────────────────────────────────────────────────────
    // Owner/Admin, PM, Team Leader, Project Member can create tasks.
    case TASK.CREATE: {
      if (isWsAdmin) return true;
      if (isProjectMgr) return true;
      if (isProjectMbr) return true;
      // Team Leader can create tasks in their team's project
      if (context.team && isTeamLeader(user, context.team)) return true;
      return false;
    }

    // ── EDIT ─────────────────────────────────────────────────────────────
    // Owner/Admin, PM, Assignee (execution fields), Reviewer (review fields).
    // Team Leader can edit tasks in their team.
    case TASK.EDIT: {
      if (isWsAdmin) return true;
      if (isProjectMgr) return true;
      if (assignee) return true;
      if (reviewer) return true;
      if (context.team && isTeamLeader(user, context.team)) return true;
      return false;
    }

    // ── DELETE ───────────────────────────────────────────────────────────
    // Owner/Admin, PM of the task's project.
    case TASK.DELETE: {
      if (isWsAdmin) return true;
      if (isProjectMgr) return true;
      return false;
    }

    // ── ASSIGN / REASSIGN ────────────────────────────────────────────────
    // Owner/Admin, PM, Team Leader.
    case TASK.ASSIGN:
    case TASK.REASSIGN: {
      if (isWsAdmin) return true;
      if (isProjectMgr) return true;
      if (context.team && isTeamLeader(user, context.team)) return true;
      return false;
    }

    // ── SUBMIT ───────────────────────────────────────────────────────────
    // Assignee can submit their own task.
    case TASK.SUBMIT:
      return assignee;

    // ── REVIEW ───────────────────────────────────────────────────────────
    // Reviewer, PM, Owner/Admin.
    case TASK.REVIEW: {
      if (reviewer) return true;
      if (isProjectMgr) return true;
      if (isWsAdmin) return true;
      return false;
    }

    // ── APPROVE ──────────────────────────────────────────────────────────
    // Reviewer, PM, Owner/Admin. Self-approval prevented.
    case TASK.APPROVE: {
      if (assignee) return false; // self-approval prevention
      if (reviewer) return true;
      if (isProjectMgr) return true;
      if (isWsAdmin) return true;
      return false;
    }

    // ── REQUEST_CHANGES ──────────────────────────────────────────────────
    // Reviewer, PM, Owner/Admin.
    case TASK.REQUEST_CHANGES: {
      if (reviewer) return true;
      if (isProjectMgr) return true;
      if (isWsAdmin) return true;
      return false;
    }

    // ── REOPEN ───────────────────────────────────────────────────────────
    // Assignee, Reviewer, PM, Owner/Admin.
    case TASK.REOPEN: {
      if (assignee) return true;
      if (reviewer) return true;
      if (isProjectMgr) return true;
      if (isWsAdmin) return true;
      return false;
    }

    default:
      return false;
  }
}

/**
 * Handle authorization for personal tasks (no workspace scope).
 * Personal tasks are owner-only for all operations.
 */
function handlePersonalTask(user, permission, task) {
  if (!user || !task) return false;
  const isOwner = isResourceOwner(user, task);
  if (!isOwner) return false;

  switch (permission) {
    case TASK.VIEW:
    case TASK.CREATE:
    case TASK.EDIT:
    case TASK.DELETE:
    case TASK.SUBMIT:
    case TASK.REOPEN:
      return true;

    // Personal tasks cannot be assigned, reviewed, or approved
    case TASK.ASSIGN:
    case TASK.REASSIGN:
    case TASK.REVIEW:
    case TASK.APPROVE:
    case TASK.REQUEST_CHANGES:
      return false;

    default:
      return false;
  }
}

module.exports = { can };

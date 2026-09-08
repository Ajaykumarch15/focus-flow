// authorization/policies/collab.policy.js — Collaboration authorization policy.
//
// Centralizes authorization for discussions, comments, files, and attachments.
// Collab resources inherit access from their parent resource scope.
//
// Authorization principle:
//   A user must first be authorized to access the parent resource (task/project)
//   before accessing its comments, discussions, or attachments.
//
// Parent resource resolution:
//   Comment/Attachment → targetType/targetRef → Task/Project/WorkLog
//   Task → Project → Workspace
//
// UNIFIED ROLE SYSTEM:
//   - superadmin: blanket bypass
//   - admin: full collab management
//   - project manager (nonadmin+): can moderate within their project
//   - team leader: can moderate within their team scope
//   - workspace member: can view/create/comment
//   - resource owner: can edit/delete own resources

const { DISCUSSION, FILE, ROLE_LEVELS } = require('../permissions');
const {
  getWorkspaceRole,
  getProjectRole,
  isProjectManager,
  isTeamLeader,
  isResourceOwner,
} = require('../relationships');

// ── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Determine if a user has admin-level workspace access (admin or superadmin).
 */
function isWsAdmin(user, workspace) {
  if (!workspace) return false;
  const wsRole = getWorkspaceRole(user, workspace);
  return wsRole === 'admin' || wsRole === 'superadmin';
}

/**
 * Determine if a user has project-level access (PM or Member).
 */
function hasProjectAccess(user, project) {
  if (!project) return false;
  const projectRole = getProjectRole(user, project);
  return projectRole !== null;
}

/**
 * Determine if a user can moderate collab resources.
 * Admin/superadmin can moderate anywhere. PM can moderate within their project.
 * Team Leader can moderate within their team scope.
 */
function canModerate(user, context) {
  if (isWsAdmin(user, context.workspace)) return true;
  if (context.project && isProjectManager(user, context.project)) return true;
  if (context.team && isTeamLeader(user, context.team)) return true;
  return false;
}

// ── Discussion / Comment policy ─────────────────────────────────────────────

/**
 * Evaluate a discussion/comment permission.
 *
 * @param {object} user       - The authenticated user.
 * @param {string} permission - A discussion.* permission constant.
 * @param {object} context    - May contain `workspace`, `project`, `resource`.
 * @returns {boolean}
 */
function canDiscussion(user, permission, context) {
  if (!user || !context) return false;

  // Platform admin bypass
  if (user.roleId?.level >= 60) return true;

  const resource = context.resource;
  const isOwner = resource ? isResourceOwner(user, resource) : false;
  const isWsMember = context.workspace ? getWorkspaceRole(user, context.workspace) !== null : isOwner;
  const hasAccess = isWsMember || isOwner;

  switch (permission) {
    // VIEW: Must have access to the parent resource (workspace membership or personal ownership)
    case DISCUSSION.VIEW:
      return hasAccess;

    // CREATE: Must have access to the parent resource
    case DISCUSSION.CREATE:
      return hasAccess;

    // COMMENT: Must have access to the parent resource
    case DISCUSSION.COMMENT:
      return hasAccess;

    // EDIT_OWN: Author can edit own comment
    case DISCUSSION.EDIT_OWN:
      return isOwner;

    // DELETE_OWN: Author can delete own comment
    case DISCUSSION.DELETE_OWN:
      return isOwner;

    // DELETE_ANY: Admin/superadmin, PM, or Team Leader can moderate
    case DISCUSSION.DELETE_ANY:
      return canModerate(user, context);

    // PIN: Admin/superadmin, PM, or Team Leader can pin
    case DISCUSSION.PIN:
      return canModerate(user, context);

    // MODERATE: Admin/superadmin, PM, or Team Leader can moderate
    case DISCUSSION.MODERATE:
      return canModerate(user, context);

    default:
      return false;
  }
}

// ── File / Attachment policy ────────────────────────────────────────────────

/**
 * Evaluate a file/attachment permission.
 *
 * @param {object} user       - The authenticated user.
 * @param {string} permission - A file.* permission constant.
 * @param {object} context    - May contain `workspace`, `project`, `resource`.
 * @returns {boolean}
 */
function canFile(user, permission, context) {
  if (!user || !context) return false;

  // Platform admin bypass
  if (user.roleId?.level >= 60) return true;

  const resource = context.resource;
  const isOwner = resource ? isResourceOwner(user, resource) : false;
  const isWsMember = context.workspace ? getWorkspaceRole(user, context.workspace) !== null : isOwner;
  const hasAccess = isWsMember || isOwner;

  switch (permission) {
    // VIEW: Must have access to the parent resource
    case FILE.VIEW:
      return hasAccess;

    // UPLOAD: Must have access to the parent resource
    case FILE.UPLOAD:
      return hasAccess;

    // SHARE: Must have access to the parent resource
    case FILE.SHARE:
      return hasAccess;

    // DELETE_OWN: Uploader can delete own file
    case FILE.DELETE_OWN:
      return isOwner;

    // DELETE_ANY: Admin/superadmin, PM, or Team Leader can moderate
    case FILE.DELETE_ANY:
      return canModerate(user, context);

    default:
      return false;
  }
}

module.exports = { canDiscussion, canFile };

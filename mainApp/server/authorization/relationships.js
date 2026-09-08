// authorization/relationships.js — Centralized relationship-resolution helpers.
//
// Each function resolves a specific user↔resource relationship and returns
// the relationship value (role string, boolean, or null). These helpers use
// the actual field names from the existing Mongoose models so callers do not
// need to know the schema details.
//
// UNIFIED ROLE SYSTEM: All roles use the same three levels: superadmin, admin, nonadmin.
// Project manager is a designation granted to nonadmin users, not a separate role level.

const { LEGACY_ROLE_MAP, ROLE_LEVELS } = require('./permissions');

// ── Workspace membership ─────────────────────────────────────────────────────

/**
 * Resolve a user's effective workspace role.
 *
 * Reads from workspace.members[] (the canonical membership array) and maps
 * legacy role values to the new unified roles via LEGACY_ROLE_MAP.
 *
 * @param {object} user      - The user document (must have _id).
 * @param {object} workspace - The workspace document (must have members[]).
 * @returns {string|null}    - 'superadmin', 'admin', 'nonadmin', or null if not a member.
 */
function getWorkspaceRole(user, workspace) {
  if (!user || !workspace) return null;
  if (!Array.isArray(workspace.members)) return null;

  const userId = String(user._id);
  const member = workspace.members.find((m) => {
    if (!m) return false;
    const mUserId = m.userId && m.userId._id ? String(m.userId._id) : String(m.userId);
    return mUserId === userId;
  });

  if (!member) return null;

  // Map legacy roles to unified roles
  return LEGACY_ROLE_MAP[member.role] || member.role;
}

/**
 * Get the raw (unmapped) workspace role for a user.
 * Returns the actual stored role string, which may be a legacy value.
 *
 * @param {object} user
 * @param {object} workspace
 * @returns {string|null}
 */
function getRawWorkspaceRole(user, workspace) {
  if (!user || !workspace) return null;
  if (!Array.isArray(workspace.members)) return null;

  const userId = String(user._id);
  const member = workspace.members.find((m) => {
    if (!m) return false;
    const mUserId = m.userId && m.userId._id ? String(m.userId._id) : String(m.userId);
    return mUserId === userId;
  });

  return member ? member.role : null;
}

/**
 * Check if a user is a project manager in a workspace.
 *
 * @param {object} user      - The user document.
 * @param {object} workspace - The workspace document.
 * @returns {boolean}
 */
function isWorkspaceProjectManager(user, workspace) {
  if (!user || !workspace) return false;
  if (!Array.isArray(workspace.members)) return false;

  const userId = String(user._id);
  const member = workspace.members.find((m) => {
    if (!m) return false;
    const mUserId = m.userId && m.userId._id ? String(m.userId._id) : String(m.userId);
    return mUserId === userId;
  });

  return member ? member.isProjectManager === true : false;
}

/**
 * Check whether a user is a member of a workspace (any role).
 *
 * @param {object} user
 * @param {object} workspace
 * @returns {boolean}
 */
function isWorkspaceMember(user, workspace) {
  return getWorkspaceRole(user, workspace) !== null;
}

/**
 * Check if a user has admin-level access in a workspace.
 * Admin level = role level >= 60 (admin or superadmin).
 *
 * @param {object} user
 * @param {object} workspace
 * @returns {boolean}
 */
function isWorkspaceAdmin(user, workspace) {
  const role = getWorkspaceRole(user, workspace);
  if (!role) return false;
  return ROLE_LEVELS[role] >= 60;
}

// ── Project relationships ────────────────────────────────────────────────────

/**
 * Resolve a user's project role.
 *
 * Project members use unified roles: superadmin, admin, nonadmin.
 * The project.userId field is the admin (creator/assigned PM).
 * Falls back to flat ObjectId[] for backward compatibility during migration.
 *
 * @param {object} user    - The user document.
 * @param {object} project - The project document.
 * @returns {string|null}  - 'superadmin', 'admin', 'nonadmin', or null.
 */
function getProjectRole(user, project) {
  if (!user || !project) return null;

  const userId = String(user._id);

  // Project admin = project.userId (the creator or assigned PM)
  if (String(project.userId) === userId) return 'admin';

  // Project member = project.members[] contains the userId
  if (Array.isArray(project.members)) {
    for (const m of project.members) {
      if (!m) continue;
      // New structure: { userId, role, isProjectManager, addedAt }
      if (m.userId && m.role) {
        const mId = m.userId._id ? String(m.userId._id) : String(m.userId);
        if (mId === userId) return m.role;
      }
      // Legacy structure: flat ObjectId (backward compatibility)
      const mId = m._id ? String(m._id) : String(m);
      if (mId === userId) return 'nonadmin';
    }
  }

  return null;
}

/**
 * Check if a user is a project manager.
 *
 * @param {object} user
 * @param {object} project
 * @returns {boolean}
 */
function isProjectManager(user, project) {
  if (!user || !project) return false;

  const userId = String(user._id);

  // Check if user is the project creator (implicit manager)
  if (String(project.userId) === userId) return true;

  // Check project.members[] for explicit manager flag
  if (Array.isArray(project.members)) {
    for (const m of project.members) {
      if (!m) continue;
      const mId = m.userId && m.userId._id ? String(m.userId._id) : String(m.userId);
      if (mId === userId && m.isProjectManager) return true;
    }
  }

  return false;
}

/**
 * Check whether a user is a project member (including admin).
 *
 * @param {object} user
 * @param {object} project
 * @returns {boolean}
 */
function isProjectMember(user, project) {
  return getProjectRole(user, project) !== null;
}

// ── Team relationships ───────────────────────────────────────────────────────

/**
 * Check whether a user is the team leader.
 *
 * Uses team.leaderId as the authoritative field.
 *
 * @param {object} user - The user document.
 * @param {object} team - The team document.
 * @returns {boolean}
 */
function isTeamLeader(user, team) {
  if (!user || !team || !team.leaderId) return false;
  return String(team.leaderId) === String(user._id);
}

/**
 * Check whether a user is a team member.
 *
 * Uses team.members[] (flat ObjectId array).
 *
 * @param {object} user - The user document.
 * @param {object} team - The team document.
 * @returns {boolean}
 */
function isTeamMember(user, team) {
  if (!user || !team) return false;
  if (!Array.isArray(team.members)) return false;

  const userId = String(user._id);
  return team.members.some((m) => {
    if (!m) return false;
    const mId = m._id ? String(m._id) : String(m);
    return mId === userId;
  });
}

/**
 * Check whether a userId is in a team's members array.
 *
 * Unlike isTeamMember, this accepts a raw userId string/ObjectId rather than
 * a full user document. Useful for checking whether a WorkLog owner belongs
 * to a team without constructing a temporary user object.
 *
 * @param {string|ObjectId} userId - The user ID to check.
 * @param {object} team - The team document.
 * @returns {boolean}
 */
function isUserIdInTeam(userId, team) {
  if (!userId || !team) return false;
  if (!Array.isArray(team.members)) return false;

  const uid = String(userId);
  return team.members.some((m) => {
    if (!m) return false;
    const mId = m._id ? String(m._id) : String(m);
    return mId === uid;
  });
}

// ── Task relationships ───────────────────────────────────────────────────────

/**
 * Check whether a user is the task assignee.
 *
 * Uses task.assigneeId.
 *
 * @param {object} user - The user document.
 * @param {object} task - The task document.
 * @returns {boolean}
 */
function isTaskAssignee(user, task) {
  if (!user || !task || !task.assigneeId) return false;
  return String(task.assigneeId) === String(user._id);
}

/**
 * Check whether a user is the task reviewer.
 *
 * Uses task.reviewerId.
 *
 * @param {object} user
 * @param {object} task
 * @returns {boolean}
 */
function isTaskReviewer(user, task) {
  if (!user || !task || !task.reviewerId) return false;
  return String(task.reviewerId) === String(user._id);
}

// ── Resource ownership ───────────────────────────────────────────────────────

/**
 * Check whether a user is the owner/creator of a resource.
 *
 * Checks common ownership fields: userId, createdBy, authorId, uploadedBy.
 * Returns true if ANY of these match the user's _id.
 *
 * @param {object} user     - The user document.
 * @param {object} resource - The resource document.
 * @returns {boolean}
 */
function isResourceOwner(user, resource) {
  if (!user || !resource) return false;

  const userId = String(user._id);

  // Check common ownership fields
  if (resource.userId && String(resource.userId) === userId) return true;
  if (resource.createdBy && String(resource.createdBy) === userId) return true;
  if (resource.authorId && String(resource.authorId) === userId) return true;
  if (resource.uploadedBy && String(resource.uploadedBy) === userId) return true;

  return false;
}

module.exports = {
  getWorkspaceRole,
  getRawWorkspaceRole,
  isWorkspaceProjectManager,
  isWorkspaceMember,
  isWorkspaceAdmin,
  getProjectRole,
  isProjectManager,
  isProjectMember,
  isTeamLeader,
  isTeamMember,
  isUserIdInTeam,
  isTaskAssignee,
  isTaskReviewer,
  isResourceOwner,
};

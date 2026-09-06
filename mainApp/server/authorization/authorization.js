// authorization/authorization.js — Central authorization entry point.
//
// Provides the `can(user, permission, context)` function that all authorization
// decisions flow through. It identifies the relevant resource type from the
// permission prefix and delegates to the appropriate policy.
//
// Phase 1: Boolean results only. Deny is the safe default.

const { isValidPermission, WORKSPACE, PROJECT, TEAM, TASK, DISCUSSION, FILE, WORKLOG } = require('./permissions');
const workspacePolicy = require('./policies/workspace.policy');
const projectPolicy = require('./policies/project.policy');
const teamPolicy = require('./policies/team.policy');
const taskPolicy = require('./policies/task.policy');
const { canDiscussion, canFile } = require('./policies/collab.policy');
const worklogPolicy = require('./policies/worklog.policy');

// Map permission prefixes to their policy handlers
const POLICY_MAP = {
  'workspace':   workspacePolicy,
  'project':     projectPolicy,
  'team':        teamPolicy,
  'task':        taskPolicy,
  'discussion':  { can: canDiscussion },
  'channel':     { can: () => false }, // No channel model exists yet
  'file':        { can: canFile },
  'worklog':     worklogPolicy,
};

/**
 * Central authorization check.
 *
 * Evaluates whether `user` can perform `permission` given the `context`.
 *
 * @param {object} user       - The authenticated user document.
 * @param {string} permission - A permission identifier (e.g. 'task.edit').
 * @param {object} context    - Resource context. May contain:
 *   - workspace {object}  - The workspace document
 *   - project   {object}  - The project document
 *   - team      {object}  - The team document
 *   - task      {object}  - The task document
 *   - resource  {object}  - The specific resource being accessed (comment, attachment, worklog)
 *
 * @returns {boolean} true if allowed, false if denied (deny by default).
 */
function can(user, permission, context = {}) {
  // Missing user = deny
  if (!user) return false;

  // Unknown permission = deny
  if (!isValidPermission(permission)) return false;

  // Extract the resource type from the permission prefix
  const resourceType = permission.split('.')[0];

  // Find the appropriate policy
  const policy = POLICY_MAP[resourceType];
  if (!policy) return false;

  // Delegate to the policy
  return policy.can(user, permission, context);
}

module.exports = { can };

// authorization/permissions.js — Single-source permission vocabulary.
//
// This module defines every permission identifier used across FocusFlow's
// authorization system. Permissions follow the `resource.action` convention.
//
// UNIFIED ROLE SYSTEM: All roles (system, workspace, project) use the same
// three levels: superadmin, admin, nonadmin. Project manager is a designation
// granted to nonadmin users, not a separate role level.

// ── Unified roles ────────────────────────────────────────────────────────────
// Three role levels used across the entire platform.

const UNIFIED_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  NONADMIN:   'nonadmin',
};

// Role levels for numeric comparisons (higher = more privileges)
const ROLE_LEVELS = {
  superadmin: 100,
  admin:      60,
  nonadmin:   10,
};

// Role hierarchy for comparison helpers
const ROLE_HIERARCHY = ['nonadmin', 'admin', 'superadmin'];

// ── Legacy role mapping ──────────────────────────────────────────────────────
// Maps old workspace/system role strings to the new unified roles.

const LEGACY_ROLE_MAP = {
  // System roles
  'SUPERADMIN': 'superadmin',
  'OWNER':      'admin',
  'ADMIN':      'admin',
  'MEMBER':     'nonadmin',
  'user':       'nonadmin',
  // Workspace roles
  'Owner':      'admin',
  'Admin':      'admin',
  'Member':     'nonadmin',
  // Legacy workspace roles
  'Manager':    'nonadmin',
  'Developer':  'nonadmin',
  'Viewer':     'nonadmin',
  // Project roles
  'Manager':    'admin',
  'Editor':     'nonadmin',
  'Viewer':     'nonadmin',
};

// ── Workspace permissions ────────────────────────────────────────────────────

const WORKSPACE = {
  VIEW:               'workspace.view',
  EDIT:               'workspace.edit',
  DELETE:             'workspace.delete',
  MANAGE_MEMBERS:     'workspace.manage_members',
  MANAGE_ROLES:       'workspace.manage_roles',
  MANAGE_BILLING:     'workspace.manage_billing',
  TRANSFER_OWNERSHIP: 'workspace.transfer_ownership',
};

// ── Project permissions ──────────────────────────────────────────────────────

const PROJECT = {
  VIEW:             'project.view',
  CREATE:           'project.create',
  EDIT:             'project.edit',
  DELETE:           'project.delete',
  ARCHIVE:          'project.archive',
  MANAGE_MEMBERS:   'project.manage_members',
  ASSIGN_MANAGER:   'project.assign_manager',
};

// ── Project member roles ────────────────────────────────────────────────────
// UNIFIED ROLE SYSTEM: Project roles use the same three levels.

const PROJECT_ROLES = {
  ADMIN:    'admin',
  NONADMIN: 'nonadmin',
};

// ── Team permissions ─────────────────────────────────────────────────────────

const TEAM = {
  VIEW:             'team.view',
  CREATE:           'team.create',
  EDIT:             'team.edit',
  DELETE:           'team.delete',
  MANAGE_MEMBERS:   'team.manage_members',
  ASSIGN_LEADER:    'team.assign_leader',
};

// ── Task permissions ─────────────────────────────────────────────────────────

const TASK = {
  VIEW:             'task.view',
  CREATE:           'task.create',
  EDIT:             'task.edit',
  DELETE:           'task.delete',
  ASSIGN:           'task.assign',
  REASSIGN:         'task.reassign',
  SUBMIT:           'task.submit',
  REVIEW:           'task.review',
  APPROVE:          'task.approve',
  REQUEST_CHANGES:  'task.request_changes',
  REOPEN:           'task.reopen',
};

// ── Discussion permissions ───────────────────────────────────────────────────

const DISCUSSION = {
  VIEW:             'discussion.view',
  CREATE:           'discussion.create',
  COMMENT:          'discussion.comment',
  EDIT_OWN:         'discussion.edit_own',
  DELETE_OWN:       'discussion.delete_own',
  DELETE_ANY:       'discussion.delete_any',
  PIN:              'discussion.pin',
  MODERATE:         'discussion.moderate',
};

// ── Channel permissions ──────────────────────────────────────────────────────

const CHANNEL = {
  VIEW:             'channel.view',
  CREATE:           'channel.create',
  EDIT:             'channel.edit',
  DELETE:           'channel.delete',
  MANAGE_MEMBERS:   'channel.manage_members',
  ARCHIVE:          'channel.archive',
};

// ── File permissions ─────────────────────────────────────────────────────────

const FILE = {
  VIEW:             'file.view',
  UPLOAD:           'file.upload',
  SHARE:            'file.share',
  DELETE_OWN:       'file.delete_own',
  DELETE_ANY:       'file.delete_any',
};

// ── Worklog permissions ──────────────────────────────────────────────────────

const WORKLOG = {
  VIEW_OWN:         'worklog.view_own',
  CREATE:           'worklog.create',
  EDIT_OWN:         'worklog.edit_own',
  DELETE_OWN:       'worklog.delete_own',
  SUBMIT:           'worklog.submit',
  VIEW_TEAM:        'worklog.view_team',
  REVIEW:           'worklog.review',
  APPROVE:          'worklog.approve',
  REQUEST_CHANGES:  'worklog.request_changes',
  VIEW_PROJECT:     'worklog.view_project',
};

// ── All permissions (flat set for validation) ────────────────────────────────

const ALL_PERMISSIONS = new Set([
  ...Object.values(WORKSPACE),
  ...Object.values(PROJECT),
  ...Object.values(TEAM),
  ...Object.values(TASK),
  ...Object.values(DISCUSSION),
  ...Object.values(CHANNEL),
  ...Object.values(FILE),
  ...Object.values(WORKLOG),
]);

/**
 * Check whether a string is a known permission identifier.
 * @param {string} permission
 * @returns {boolean}
 */
function isValidPermission(permission) {
  return typeof permission === 'string' && ALL_PERMISSIONS.has(permission);
}

module.exports = {
  UNIFIED_ROLES,
  ROLE_LEVELS,
  ROLE_HIERARCHY,
  LEGACY_ROLE_MAP,
  WORKSPACE,
  PROJECT,
  PROJECT_ROLES,
  TEAM,
  TASK,
  DISCUSSION,
  CHANNEL,
  FILE,
  WORKLOG,
  ALL_PERMISSIONS,
  isValidPermission,
};

// authorization/permissions.js — Single-source permission vocabulary.
//
// This module defines every permission identifier used across FocusFlow's
// authorization system. Permissions follow the `resource.action` convention.
//
// These identifiers define the future authorization vocabulary. Only permissions
// that correspond to actual existing functionality are enforced in policies;
// the rest are declared here for vocabulary completeness and future use.
//
// Phase 1: Vocabulary definition only. No enforcement logic lives here.

// ── Workspace roles ──────────────────────────────────────────────────────────
// The three canonical workspace roles. During the transition period, legacy
// role values (Manager, Developer, Viewer) stored in the database are mapped
// to these by the relationship-resolution layer, not by this vocabulary module.

const WORKSPACE_ROLES = {
  OWNER:  'Owner',
  ADMIN:  'Admin',
  MEMBER: 'Member',
};

// ── Legacy role mapping ──────────────────────────────────────────────────────
// Maps old workspace role strings to the new canonical roles. Used by
// relationship-resolution helpers so callers do not need to know about the
// transition. This mapping is NOT authoritative for stored data — it is a
// read-time translation only.

const LEGACY_ROLE_MAP = {
  'Owner':     'Owner',
  'Admin':     'Admin',
  'Member':    'Member',
  'Manager':   'Member',
  'Developer': 'Member',
  'Viewer':    'Member',
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

const PROJECT_ROLES = {
  MANAGER: 'Manager',
  EDITOR:  'Editor',
  VIEWER:  'Viewer',
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
  WORKSPACE_ROLES,
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

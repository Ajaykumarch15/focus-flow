// EEP2-P1.2.1 · Single-source permission vocabulary (DDS §7 Permission Matrix).
//
// COMPATIBILITY LAYER — This file preserves the legacy permission API consumed
// by middleware/workspace.js, routes/projects.js, and the permissionMatrix
// test suite. New code should import from ../authorization/ instead.
//
// UNIFIED ROLE SYSTEM: All roles use the same three levels: superadmin, admin, nonadmin.
// Project manager is a designation granted to nonadmin users, not a separate role level.

const { ROLE_LEVELS, LEGACY_ROLE_MAP } = require('../authorization/permissions');

// Unified role constants
const UNIFIED_ROLES = ['superadmin', 'admin', 'nonadmin'];

// Role tiers for backward compatibility
const ROLE_TIERS = UNIFIED_ROLES;

// Admin roles: admin, superadmin
const ADMIN_ROLES = ['admin', 'superadmin'];

// Superadmin roles: superadmin only
const SUPERADMIN_ROLES = ['superadmin'];

// Editor roles: admin, superadmin (nonadmin cannot edit workspace resources)
const EDITOR_ROLES = ['admin', 'superadmin'];

// Manager roles: admin, superadmin (workspace settings + membership management)
const MANAGER_ROLES = ['admin', 'superadmin'];

// Owner roles: superadmin only (workspace deletion / role mutation)
const OWNER_ROLES = ['superadmin'];

const hasRole = (role, allowed) => allowed.includes(role);

// DDS §7 row 1 — any workspace member may read.
function canRead(role) {
  return UNIFIED_ROLES.includes(role);
}

// DDS §7 rows 2 & 4 — create/update entities + edit project meta: admin/superadmin.
function canEdit(role) {
  return hasRole(role, EDITOR_ROLES);
}

// DDS §7 row 3 — delete Milestone/Phase/Module/Feature/Sprint: admin/superadmin.
function canDeleteStructure(role) {
  return hasRole(role, MANAGER_ROLES);
}

// DDS §7 rows 5 & 6 — edit project members/teamIds/settings + manage workspace.
function canManage(role) {
  return hasRole(role, MANAGER_ROLES);
}

// DDS §7 row 7 — delete the workspace: superadmin only.
function canDeleteWorkspace(role) {
  return hasRole(role, OWNER_ROLES);
}

// Permitted roles per gate — one-to-one with the requireWorkspace* factories.
const GATE_ROLES = {
  member: UNIFIED_ROLES,
  editor: EDITOR_ROLES,
  ownerAdmin: MANAGER_ROLES,
  owner: OWNER_ROLES,
};

module.exports = {
  UNIFIED_ROLES,
  ROLE_TIERS,
  ADMIN_ROLES,
  SUPERADMIN_ROLES,
  EDITOR_ROLES,
  MANAGER_ROLES,
  OWNER_ROLES,
  canRead,
  canEdit,
  canDeleteStructure,
  canManage,
  canDeleteWorkspace,
  GATE_ROLES,
};

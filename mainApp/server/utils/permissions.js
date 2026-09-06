// EEP2-P1.2.1 · Single-source permission vocabulary (DDS §7 Permission Matrix).
//
// COMPATIBILITY LAYER — This file preserves the legacy permission API consumed
// by middleware/workspace.js, routes/projects.js, and the permissionMatrix
// test suite. New code should import from ../authorization/ instead.
//
// Phase 2: EDITOR_ROLES updated to reflect the new Owner/Admin/Member model.
// Legacy role values (Manager, Developer) are included during the transition
// period so that existing database documents with those roles can still be
// processed by legacy middleware routes. These will be removed once all
// consumers are migrated to the new authorization package.

const ROLE_TIERS = ['Owner', 'Admin', 'Member', 'Manager', 'Developer', 'Viewer'];

// IES-R1: any role except Viewer may create/update workspace resources.
// Phase 2: 'Member' is the new canonical role; legacy Manager/Developer are
// included for backward compatibility during the data migration period.
const EDITOR_ROLES = ['Owner', 'Admin', 'Member', 'Manager', 'Developer'];

// Owner | Admin — workspace settings + membership management + structural deletes.
const MANAGER_ROLES = ['Owner', 'Admin'];

// Owner only — workspace deletion / owner-role mutation.
const OWNER_ROLES = ['Owner'];

const hasRole = (role, allowed) => allowed.includes(role);

// DDS §7 row 1 — any workspace member may read.
function canRead(role) {
  return ROLE_TIERS.includes(role);
}

// DDS §7 rows 2 & 4 — create/update entities + edit project meta: any except Viewer.
function canEdit(role) {
  return hasRole(role, EDITOR_ROLES);
}

// DDS §7 row 3 — delete Milestone/Phase/Module/Feature/Sprint: Owner | Admin.
function canDeleteStructure(role) {
  return hasRole(role, MANAGER_ROLES);
}

// DDS §7 rows 5 & 6 — edit project members/teamIds/settings + manage workspace.
function canManage(role) {
  return hasRole(role, MANAGER_ROLES);
}

// DDS §7 row 7 — delete the workspace: Owner only.
function canDeleteWorkspace(role) {
  return hasRole(role, OWNER_ROLES);
}

// Permitted roles per gate — one-to-one with the requireWorkspace* factories.
const GATE_ROLES = {
  member: ROLE_TIERS,
  editor: EDITOR_ROLES,
  ownerAdmin: MANAGER_ROLES,
  owner: OWNER_ROLES,
};

module.exports = {
  ROLE_TIERS,
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

// EEP2-P1.2.1 · Single-source permission vocabulary (DDS §7 Permission Matrix).
// The role constants and predicates below are THE canonical copy consumed by
// every role-gate middleware and by the matrix spec (__tests__/permissionMatrix
// .test.js) — so the enforced matrix can never drift from the tested one.
//
// Matrix rows (DDS §7): roles are workspace roles on the membership record.
//   • read                 → any member (incl. Viewer)
//   • create/update        → any except Viewer (EDITOR_ROLES)
//   • delete structure     → Owner | Admin (MANAGER_ROLES)
//   • edit project meta    → any except Viewer
//   • edit project members → Owner | Admin
//   • manage workspace     → Owner | Admin
//   • delete workspace     → Owner only
// Platform admin (user.role === 'admin') is orthogonal: it has NO implicit
// workspace membership — workspace gates are pure role checks (SAD §10.3).

const ROLE_TIERS = ['Owner', 'Admin', 'Manager', 'Developer', 'Viewer'];

// IES-R1: any role except Viewer may create/update workspace resources.
const EDITOR_ROLES = ['Owner', 'Admin', 'Manager', 'Developer'];

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

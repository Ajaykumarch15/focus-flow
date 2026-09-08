// @vitest-environment node
// UNIFIED ROLE SYSTEM · Permission Matrix tests
// The vocabulary in utils/permissions.js must match the unified role system.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  UNIFIED_ROLES,
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
} = require('../utils/permissions');

// Unified role names
const SUPERADMIN = 'superadmin';
const ADMIN = 'admin';
const NONADMIN = 'nonadmin';
const ROLES = [NONADMIN, ADMIN, SUPERADMIN];

const allRoles = () => ROLES.slice();

describe('Unified Role System · role tier ordering & groups', () => {
  it('exposes every unified role', () => {
    expect(UNIFIED_ROLES).toEqual([SUPERADMIN, ADMIN, NONADMIN]);
  });

  it('ROLE_TIERS matches UNIFIED_ROLES', () => {
    expect(ROLE_TIERS).toEqual(UNIFIED_ROLES);
  });

  it('EDITOR_ROLES = admin | superadmin', () => {
    expect(EDITOR_ROLES).toEqual([ADMIN, SUPERADMIN]);
  });

  it('MANAGER_ROLES = admin | superadmin', () => {
    expect(MANAGER_ROLES).toEqual([ADMIN, SUPERADMIN]);
  });

  it('OWNER_ROLES = superadmin only', () => {
    expect(OWNER_ROLES).toEqual([SUPERADMIN]);
  });

  it('GATE_ROLES mirrors the four requireWorkspace* gates exactly', () => {
    expect(GATE_ROLES.member).toEqual(ROLE_TIERS);
    expect(GATE_ROLES.editor).toEqual(EDITOR_ROLES);
    expect(GATE_ROLES.ownerAdmin).toEqual(MANAGER_ROLES);
    expect(GATE_ROLES.owner).toEqual(OWNER_ROLES);
  });
});

describe('Unified Role System · row 1: read workspace/project/roadmap/sprint/feature/task/knowledge', () => {
  it('any member may read', () => {
    for (const role of allRoles()) expect(canRead(role)).toBe(true);
  });
});

describe('Unified Role System · rows 2 & 4: create/update entities + edit project meta', () => {
  const allowed = [ADMIN, SUPERADMIN];
  it('nonadmin is denied; admin and superadmin are allowed', () => {
    for (const role of allRoles()) {
      expect(canEdit(role)).toBe(allowed.includes(role));
    }
  });
});

describe('Unified Role System · row 3: delete Milestone/Phase/Module/Feature/Sprint', () => {
  const allowed = [ADMIN, SUPERADMIN];
  it('only admin | superadmin may delete structure', () => {
    for (const role of allRoles()) {
      expect(canDeleteStructure(role)).toBe(allowed.includes(role));
    }
  });
});

describe('Unified Role System · rows 5 & 6: edit project members[]/teamIds[]/settings + manage workspace', () => {
  const allowed = [ADMIN, SUPERADMIN];
  it('only admin | superadmin may manage', () => {
    for (const role of allRoles()) {
      expect(canManage(role)).toBe(allowed.includes(role));
    }
  });
});

describe('Unified Role System · row 7: delete workspace', () => {
  it('superadmin only', () => {
    for (const role of allRoles()) {
      expect(canDeleteWorkspace(role)).toBe(role === SUPERADMIN);
    }
  });
});

describe('Unified Role System · unknown / absent role is denied everywhere', () => {
  const unknownRoles = [undefined, null, '', 'Superuser', 'member', 'owner', 'OWNER', 'Admin', 'Member'];
  for (const bad of unknownRoles) {
    it(`denies "${String(bad)}"`, () => {
      expect(canRead(bad)).toBe(false);
      expect(canEdit(bad)).toBe(false);
      expect(canDeleteStructure(bad)).toBe(false);
      expect(canManage(bad)).toBe(false);
      expect(canDeleteWorkspace(bad)).toBe(false);
    });
  }
});

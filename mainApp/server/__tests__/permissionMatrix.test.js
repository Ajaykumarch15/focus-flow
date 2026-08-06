// @vitest-environment node
// EEP2-P1.2.1 · DDS §7 Permission Matrix — the vocabulary in utils/permissions.js
// must match the documented matrix exactly, action-by-action and role-by-role.
// Any drift here (or in the module) means enforcement and spec disagree.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
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

// Workspace roles from DDS §7, most → least privileged.
const VIEWER = 'Viewer';
const DEVELOPER = 'Developer';
const MANAGER = 'Manager';
const ADMIN = 'Admin';
const OWNER = 'Owner';
const ROLES = [VIEWER, DEVELOPER, MANAGER, ADMIN, OWNER];

const allRoles = () => ROLES.slice();

describe('DDS §7 · role tier ordering & groups', () => {
  it('exposes every matrix role, ordered most → least privileged', () => {
    expect(ROLE_TIERS).toEqual([OWNER, ADMIN, MANAGER, DEVELOPER, VIEWER]);
  });

  it('EDITOR_ROLES = every role except Viewer', () => {
    expect(EDITOR_ROLES).toEqual([OWNER, ADMIN, MANAGER, DEVELOPER]);
  });

  it('MANAGER_ROLES = Owner | Admin', () => {
    expect(MANAGER_ROLES).toEqual([OWNER, ADMIN]);
  });

  it('OWNER_ROLES = Owner only', () => {
    expect(OWNER_ROLES).toEqual([OWNER]);
  });

  it('GATE_ROLES mirrors the four requireWorkspace* gates exactly', () => {
    expect(GATE_ROLES.member).toEqual(ROLE_TIERS);
    expect(GATE_ROLES.editor).toEqual(EDITOR_ROLES);
    expect(GATE_ROLES.ownerAdmin).toEqual(MANAGER_ROLES);
    expect(GATE_ROLES.owner).toEqual(OWNER_ROLES);
  });
});

describe('DDS §7 · row 1: read workspace/project/roadmap/sprint/feature/task/knowledge', () => {
  it('any member, including Viewer, may read', () => {
    for (const role of allRoles()) expect(canRead(role)).toBe(true);
  });
});

describe('DDS §7 · rows 2 & 4: create/update entities + edit project meta', () => {
  const allowed = [OWNER, ADMIN, MANAGER, DEVELOPER];
  it('Viewer is denied; every other role is allowed', () => {
    for (const role of allRoles()) {
      expect(canEdit(role)).toBe(allowed.includes(role));
    }
  });
});

describe('DDS §7 · row 3: delete Milestone/Phase/Module/Feature/Sprint', () => {
  const allowed = [OWNER, ADMIN];
  it('only Owner | Admin may delete structure', () => {
    for (const role of allRoles()) {
      expect(canDeleteStructure(role)).toBe(allowed.includes(role));
    }
  });
});

describe('DDS §7 · rows 5 & 6: edit project members[]/teamIds[]/settings + manage workspace', () => {
  const allowed = [OWNER, ADMIN];
  it('only Owner | Admin may manage', () => {
    for (const role of allRoles()) {
      expect(canManage(role)).toBe(allowed.includes(role));
    }
  });
});

describe('DDS §7 · row 7: delete workspace', () => {
  it('Owner only', () => {
    for (const role of allRoles()) {
      expect(canDeleteWorkspace(role)).toBe(role === OWNER);
    }
  });
});

describe('DDS §7 · unknown / absent role is denied everywhere', () => {
  const unknownRoles = [undefined, null, '', 'Superuser', 'member', 'owner', 'OWNER'];
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

describe('DDS §7 · platform admin carries no implicit workspace privileges', () => {
  it("platform role 'admin' is not a workspace role and passes no gate", () => {
    expect(ROLE_TIERS).not.toContain('admin');
    expect(canRead('admin')).toBe(false);
    expect(canEdit('admin')).toBe(false);
    expect(canManage('admin')).toBe(false);
    expect(canDeleteWorkspace('admin')).toBe(false);
  });
});

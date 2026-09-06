// Phase 9.3: Test for legacy workspace role migration.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const migration = require('../migrations/migrations/0016_migrate_legacy_workspace_roles');

function makeWorkspace(members) {
  return {
    _id: `ws_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Workspace',
    members,
  };
}

// Minimal in-memory DB mock for migration testing.
function createMockDb(workspaces = []) {
  const store = workspaces.map((w) => ({ ...w, members: [...w.members] }));
  return {
    collection: () => ({
      find: (query) => ({
        toArray: async () => {
          // Simple filter: check if any member has a legacy role
          const legacyRoles = ['Manager', 'Developer', 'Viewer'];
          return store.filter((ws) =>
            ws.members.some((m) => legacyRoles.includes(m.role))
          );
        },
      }),
      updateOne: async (filter, update) => {
        const idx = store.findIndex((ws) => String(ws._id) === String(filter._id));
        if (idx >= 0 && update.$set && update.$set.members) {
          store[idx].members = update.$set.members;
        }
      },
    }),
    _store: store,
  };
}

describe('Phase 9.3 · 0016_migrate_legacy_workspace_roles', () => {
  it('migrates Manager → Member', async () => {
    const ws = makeWorkspace([
      { userId: 'owner1', role: 'Owner' },
      { userId: 'mgr1', role: 'Manager' },
    ]);
    const db = createMockDb([ws]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(1);
    expect(result.documents).toBe(1);
    const updated = db._store[0].members.find((m) => m.userId === 'mgr1');
    expect(updated.role).toBe('Member');
  });

  it('migrates Developer → Member', async () => {
    const ws = makeWorkspace([
      { userId: 'dev1', role: 'Developer' },
    ]);
    const db = createMockDb([ws]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(1);
    const updated = db._store[0].members.find((m) => m.userId === 'dev1');
    expect(updated.role).toBe('Member');
  });

  it('migrates Viewer → Member', async () => {
    const ws = makeWorkspace([
      { userId: 'viewer1', role: 'Viewer' },
    ]);
    const db = createMockDb([ws]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(1);
    const updated = db._store[0].members.find((m) => m.userId === 'viewer1');
    expect(updated.role).toBe('Member');
  });

  it('does not modify Owner, Admin, or Member', async () => {
    const ws = makeWorkspace([
      { userId: 'owner1', role: 'Owner' },
      { userId: 'admin1', role: 'Admin' },
      { userId: 'member1', role: 'Member' },
    ]);
    const db = createMockDb([ws]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(0);
    expect(result.documents).toBe(0);
    expect(db._store[0].members).toEqual([
      { userId: 'owner1', role: 'Owner' },
      { userId: 'admin1', role: 'Admin' },
      { userId: 'member1', role: 'Member' },
    ]);
  });

  it('migrates multiple legacy roles in one workspace', async () => {
    const ws = makeWorkspace([
      { userId: 'owner1', role: 'Owner' },
      { userId: 'mgr1', role: 'Manager' },
      { userId: 'dev1', role: 'Developer' },
      { userId: 'viewer1', role: 'Viewer' },
      { userId: 'member1', role: 'Member' },
    ]);
    const db = createMockDb([ws]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(3);
    expect(result.documents).toBe(1);
    const roles = db._store[0].members.map((m) => m.role);
    expect(roles).toEqual(['Owner', 'Member', 'Member', 'Member', 'Member']);
  });

  it('handles multiple workspaces', async () => {
    const ws1 = makeWorkspace([{ userId: 'u1', role: 'Manager' }]);
    const ws2 = makeWorkspace([{ userId: 'u2', role: 'Developer' }]);
    const db = createMockDb([ws1, ws2]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(2);
    expect(result.documents).toBe(2);
  });

  it('returns 0 when no legacy roles exist (idempotent)', async () => {
    const ws = makeWorkspace([
      { userId: 'owner1', role: 'Owner' },
      { userId: 'member1', role: 'Member' },
    ]);
    const db = createMockDb([ws]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(0);
    expect(result.documents).toBe(0);
  });

  it('returns 0 when no workspaces exist', async () => {
    const db = createMockDb([]);

    const result = await migration.up({ db });

    expect(result.migrated).toBe(0);
    expect(result.documents).toBe(0);
  });
});

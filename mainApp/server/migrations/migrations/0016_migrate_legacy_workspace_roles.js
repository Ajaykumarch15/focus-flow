// Phase 9.3: Migrate legacy workspace roles to canonical 3-role model.
//
// Mapping:
//   Owner     → Owner     (unchanged)
//   Admin     → Admin     (unchanged)
//   Member    → Member    (unchanged)
//   Manager   → Member
//   Developer → Member
//   Viewer    → Member
//
// Safety:
//   - Idempotent: only updates documents that still contain legacy roles
//   - Does not add or remove members
//   - Does not alter unrelated fields
//   - Uses bulkWrite for efficiency
//   - Reports affected document count
'use strict';

const LEGACY_ROLE_MAP = {
  Manager:   'Member',
  Developer: 'Member',
  Viewer:    'Member',
};

const LEGACY_ROLES = Object.keys(LEGACY_ROLE_MAP);

module.exports = {
  async up({ db }) {
    const workspaces = db.collection('workspaces');

    // Find all workspaces that have at least one member with a legacy role.
    // We use $or to match any member in the array with a legacy role.
    const orConditions = LEGACY_ROLES.map((role) => ({
      'members.role': role,
    }));

    const affectedWorkspaces = await workspaces
      .find({ $or: orConditions }, { projection: { _id: 1, members: 1 } })
      .toArray();

    if (affectedWorkspaces.length === 0) {
      return { migrated: 0, documents: 0 };
    }

    let totalMembersMigrated = 0;

    // Process each workspace individually to safely update array elements.
    for (const ws of affectedWorkspaces) {
      let changed = false;
      const updatedMembers = ws.members.map((m) => {
        if (LEGACY_ROLES.includes(m.role)) {
          changed = true;
          totalMembersMigrated += 1;
          return { ...m, role: LEGACY_ROLE_MAP[m.role] };
        }
        return m;
      });

      if (changed) {
        await workspaces.updateOne(
          { _id: ws._id },
          { $set: { members: updatedMembers } }
        );
      }
    }

    return {
      migrated: totalMembersMigrated,
      documents: affectedWorkspaces.length,
    };
  },
};

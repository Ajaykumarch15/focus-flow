// Migration 0017: Unify all roles into superadmin/admin/nonadmin
//
// This migration converts:
// 1. System roles in Role collection to unified roles
// 2. User.roleId references to new unified roles
// 3. User.role legacy field to unified roles
// 4. Workspace.members[].role to unified roles
// 5. Project.members[].role to unified roles
//
// Role mapping:
//   System: SUPERADMIN → superadmin, OWNER → admin, ADMIN → admin, MEMBER → nonadmin
//   Workspace: Owner → admin, Admin → admin, Member → nonadmin
//   Legacy: Manager → nonadmin, Developer → nonadmin, Viewer → nonadmin
//   Project: Manager → admin (with isProjectManager: true), Editor → nonadmin, Viewer → nonadmin

module.exports = {
  async up(db) {
    console.log('[0017] Starting role unification migration...');

    // 1. Update Role collection
    const roleUpdates = [
      { name: 'SUPERADMIN', newName: 'superadmin', level: 100 },
      { name: 'OWNER', newName: 'admin', level: 60 },
      { name: 'ADMIN', newName: 'admin', level: 60 },
      { name: 'MEMBER', newName: 'nonadmin', level: 10 },
    ];

    for (const update of roleUpdates) {
      const existing = await db.collection('roles').findOne({ name: update.newName });
      if (existing) {
        // Role already exists, merge references
        const usersWithOldRole = await db.collection('users')
          .find({ roleId: existing._id })
          .toArray();
        console.log(`[0017] Found ${usersWithOldRole.length} users with role ${update.newName} (already exists)`);
      } else {
        // Check if old role exists and rename it
        const oldRole = await db.collection('roles').findOne({ name: update.name });
        if (oldRole) {
          await db.collection('roles').updateOne(
            { _id: oldRole._id },
            { $set: { name: update.newName, level: update.level } }
          );
          console.log(`[0017] Renamed role ${update.name} → ${update.newName}`);
        } else {
          // Create new role
          await db.collection('roles').insertOne({
            name: update.newName,
            level: update.level,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`[0017] Created role ${update.newName} with level ${update.level}`);
        }
      }
    }

    // Remove duplicate roles if any (keep the first one)
    const roleGroups = await db.collection('roles').aggregate([
      { $group: { _id: '$name', ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    for (const group of roleGroups) {
      const keepId = group.ids[0];
      const removeIds = group.ids.slice(1);
      console.log(`[0017] Removing ${removeIds.length} duplicate ${group._id} roles`);
      await db.collection('roles').deleteMany({ _id: { $in: removeIds } });
    }

    // 2. Update User.roleId references
    const unifiedRoles = await db.collection('roles').find({}).toArray();
    const roleMap = {};
    for (const role of unifiedRoles) {
      roleMap[role.name] = role._id;
    }

    // Update users with old roleId references
    if (roleMap['superadmin']) {
      await db.collection('users').updateMany(
        { roleId: { $exists: true, $ne: null } },
        [
          {
            $set: {
              roleId: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$roleId', roleMap['superadmin']] }, then: roleMap['superadmin'] },
                  ],
                  default: '$roleId'
                }
              }
            }
          }
        ]
      );
    }

    // 3. Update User.role legacy field
    await db.collection('users').updateMany(
      { role: 'user' },
      { $set: { role: 'nonadmin' } }
    );
    await db.collection('users').updateMany(
      { role: 'admin' },
      { $set: { role: 'admin' } }
    );
    await db.collection('users').updateMany(
      { role: 'superadmin' },
      { $set: { role: 'superadmin' } }
    );

    // 4. Update Workspace.members[].role
    const workspaceRoleMap = {
      'Owner': 'admin',
      'Admin': 'admin',
      'Member': 'nonadmin',
      'Manager': 'nonadmin',
      'Developer': 'nonadmin',
      'Viewer': 'nonadmin',
    };

    for (const [oldRole, newRole] of Object.entries(workspaceRoleMap)) {
      await db.collection('workspaces').updateMany(
        { 'members.role': oldRole },
        { $set: { 'members.$[elem].role': newRole } },
        { arrayFilters: [{ 'elem.role': oldRole }] }
      );
      console.log(`[0017] Updated workspace members with role ${oldRole} → ${newRole}`);
    }

    // 5. Update Project.members[].role
    const projectRoleMap = {
      'Manager': 'admin',
      'Editor': 'nonadmin',
      'Viewer': 'nonadmin',
    };

    for (const [oldRole, newRole] of Object.entries(projectRoleMap)) {
      await db.collection('projects').updateMany(
        { 'members.role': oldRole },
        { $set: { 'members.$[elem].role': newRole } },
        { arrayFilters: [{ 'elem.role': oldRole }] }
      );
      console.log(`[0017] Updated project members with role ${oldRole} → ${newRole}`);
    }

    // 6. Set isProjectManager flag for project members with admin role who were originally Managers
    await db.collection('projects').updateMany(
      { 'members.role': 'admin' },
      { $set: { 'members.$[elem].isProjectManager': true } },
      { arrayFilters: [{ 'elem.role': 'admin' }] }
    );
    console.log('[0017] Set isProjectManager flag for admin project members');

    // 7. Update workspace members who are admins to have isProjectManager if they were owners
    await db.collection('workspaces').updateMany(
      { 'members.role': 'admin' },
      { $set: { 'members.$[elem].isProjectManager': true } },
      { arrayFilters: [{ 'elem.role': 'admin' }] }
    );
    console.log('[0017] Set isProjectManager flag for admin workspace members');

    console.log('[0017] Role unification migration completed successfully');
  },

  async down(db) {
    console.log('[0017] Rolling back role unification migration...');

    // Reverse the role mapping
    const reverseRoleMap = {
      'superadmin': 'SUPERADMIN',
      'admin': 'ADMIN',
      'nonadmin': 'MEMBER',
    };

    // Update Role collection
    for (const [unifiedName, legacyName] of Object.entries(reverseRoleMap)) {
      await db.collection('roles').updateMany(
        { name: unifiedName },
        { $set: { name: legacyName } }
      );
    }

    // Update User.role legacy field
    await db.collection('users').updateMany(
      { role: 'nonadmin' },
      { $set: { role: 'user' } }
    );

    // Update Workspace.members[].role
    const reverseWorkspaceRoleMap = {
      'admin': 'Admin',
      'nonadmin': 'Member',
    };

    for (const [unifiedRole, legacyRole] of Object.entries(reverseWorkspaceRoleMap)) {
      await db.collection('workspaces').updateMany(
        { 'members.role': unifiedRole },
        { $set: { 'members.$[elem].role': legacyRole } },
        { arrayFilters: [{ 'elem.role': unifiedRole }] }
      );
    }

    // Update Project.members[].role
    const reverseProjectRoleMap = {
      'admin': 'Manager',
      'nonadmin': 'Editor',
    };

    for (const [unifiedRole, legacyRole] of Object.entries(reverseProjectRoleMap)) {
      await db.collection('projects').updateMany(
        { 'members.role': unifiedRole },
        { $set: { 'members.$[elem].role': legacyRole } },
        { arrayFilters: [{ 'elem.role': unifiedRole }] }
      );
    }

    // Remove isProjectManager flags
    await db.collection('workspaces').updateMany(
      {},
      { $unset: { 'members.$[elem].isProjectManager': '' } }
    );
    await db.collection('projects').updateMany(
      {},
      { $unset: { 'members.$[elem].isProjectManager': '' } }
    );

    console.log('[0017] Rollback completed');
  }
};

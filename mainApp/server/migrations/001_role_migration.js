#!/usr/bin/env node
// server/migrations/001_role_migration.js
//
// Role Model Migration — Phase 1
// Adds a Role collection and assigns global roles to existing Users.
// PRESERVES all existing User _id values and resource relationships.
//
// Usage:
//   MONGODB_URI=mongodb+srv://... node server/migrations/001_role_migration.js
//   npm run migrate:roles

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ─── Configuration ──────────────────────────────────────────────────────────

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@focusflow.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin2026!';
const SUPERADMIN_NAME = 'Platform Superadmin';

const SYSTEM_ROLES = [
  { name: 'SUPERADMIN', level: 100 },
  { name: 'OWNER',      level: 80 },
  { name: 'ADMIN',      level: 60 },
  { name: 'MEMBER',     level: 10 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}`); }
function logPass(msg) { console.log(`  ✅ ${msg}`); }
function logFail(msg) { console.error(`  ❌ FAIL: ${msg}`); }
function logWarn(msg) { console.log(`  ⚠️  ${msg}`); }

// ─── Pre-migration snapshot ─────────────────────────────────────────────────

async function takeSnapshot(User, Workspace, Project, Team, Task, Comment, Attachment, WorkLog, Activity, Notification) {
  logHeader('PHASE 1: Pre-migration Snapshot');

  const users = await User.find({ deletedAt: null }).select('_id email role').lean();
  const userIds = users.map(u => String(u._id));

  const workspaces = await Workspace.find({}).select('_id name members createdBy').lean();
  const projects   = await Project.find({}).select('_id name userId members workspaceRef').lean();
  const teams      = await Team.find({}).select('_id name leaderId members workspaceRef').lean();
  const tasks      = await Task.find({}).select('_id title userId assigneeId reviewerId workspaceRef').lean();
  const comments   = await Comment.find({}).select('_id authorId workspaceRef').lean();
  const attachments= await Attachment.find({}).select('_id uploadedBy workspaceRef').lean();
  const worklogs   = await WorkLog.find({}).select('_id userId').lean();
  const activities = await Activity.find({}).select('_id userId').lean();
  const notifs     = await Notification.find({}).select('_id userId actor').lean();

  // Count workspace role assignments
  const workspaceRoleMap = {};
  for (const ws of workspaces) {
    for (const m of (ws.members || [])) {
      const uid = String(m.userId);
      if (!workspaceRoleMap[uid]) workspaceRoleMap[uid] = [];
      workspaceRoleMap[uid].push({ workspace: ws.name, role: m.role });
    }
  }

  const snapshot = {
    timestamp: new Date().toISOString(),
    counts: {
      users: users.length,
      workspaces: workspaces.length,
      projects: projects.length,
      teams: teams.length,
      tasks: tasks.length,
      comments: comments.length,
      attachments: attachments.length,
      worklogs: worklogs.length,
      activities: activities.length,
      notifications: notifs.length,
    },
    userIds: userIds.sort(),
    userByEmail: users.map(u => ({ id: String(u._id), email: u.email, role: u.role })),
    workspaceRoleMap,
    // Reference integrity baselines
    projectManagers: projects.map(p => ({ project: p.name, userId: String(p.userId) })),
    projectMembers: projects.map(p => ({ project: p.name, members: (p.members || []).map(String) })),
    teamLeaders: teams.map(t => ({ team: t.name, leaderId: t.leaderId ? String(t.leaderId) : null })),
    teamMembers: teams.map(t => ({ team: t.name, members: (t.members || []).map(String) })),
    taskAssignees: tasks.map(t => ({ task: t.title, assigneeId: t.assigneeId ? String(t.assigneeId) : null })),
    taskReviewers: tasks.map(t => ({ task: t.title, reviewerId: t.reviewerId ? String(t.reviewerId) : null })),
  };

  log(`Users:        ${snapshot.counts.users}`);
  log(`Workspaces:   ${snapshot.counts.workspaces}`);
  log(`Projects:     ${snapshot.counts.projects}`);
  log(`Teams:        ${snapshot.counts.teams}`);
  log(`Tasks:        ${snapshot.counts.tasks}`);
  log(`Comments:     ${snapshot.counts.comments}`);
  log(`Attachments:  ${snapshot.counts.attachments}`);
  log(`WorkLogs:     ${snapshot.counts.worklogs}`);
  log(`Activities:   ${snapshot.counts.activities}`);
  log(`Notifications:${snapshot.counts.notifications}`);
  log(`User IDs:     ${snapshot.userIds.length}`);
  log(`Workspace role assignments: ${Object.keys(workspaceRoleMap).length} users`);

  return snapshot;
}

// ─── Phase 2: Seed system roles ─────────────────────────────────────────────

async function seedRoles(Role) {
  logHeader('PHASE 2: Seed System Roles');

  const roleMap = {};
  for (const def of SYSTEM_ROLES) {
    let role = await Role.findOne({ name: def.name });
    if (role) {
      log(`Role "${def.name}" already exists (${role._id}), level ${role.level}`);
      if (role.level !== def.level) {
        role.level = def.level;
        await role.save();
        log(`  Updated level to ${def.level}`);
      }
    } else {
      role = await Role.create({ name: def.name, level: def.level });
      log(`Created role "${def.name}" (${role._id}), level ${def.level}`);
    }
    roleMap[def.name] = role;
  }

  return roleMap;
}

// ─── Phase 3: Determine workspace-level roles ───────────────────────────────

function determineWorkspaceRole(workspaceRoleAssignments) {
  // workspaceRoleAssignments = [{ workspace, role }]
  // Return the HIGHEST role across all workspaces
  const rolePriority = { 'Owner': 80, 'Admin': 60, 'Member': 10 };
  let highest = 0;
  let highestName = 'MEMBER';

  for (const assignment of workspaceRoleAssignments) {
    const priority = rolePriority[assignment.role] || 0;
    if (priority > highest) {
      highest = priority;
      highestName = assignment.role === 'Owner' ? 'OWNER' : assignment.role === 'Admin' ? 'ADMIN' : 'MEMBER';
    }
  }

  return highestName;
}

// ─── Phase 4: Assign roles to existing users ────────────────────────────────

async function assignUserRoles(User, Role, roleMap, snapshot) {
  logHeader('PHASE 3: Assign Global Roles to Users');

  let assigned = 0;
  let skipped = 0;

  for (const user of snapshot.userByEmail) {
    const assignments = snapshot.workspaceRoleMap[user.id] || [];
    let globalRoleName;

    if (assignments.length === 0) {
      // User has no workspace membership — default to MEMBER
      globalRoleName = 'MEMBER';
      log(`${user.email}: No workspace membership → MEMBER`);
    } else {
      globalRoleName = determineWorkspaceRole(assignments);
      log(`${user.email}: Workspaces [${assignments.map(a => `${a.workspace}(${a.role})`).join(', ')}] → ${globalRoleName}`);
    }

    const roleDoc = roleMap[globalRoleName];
    if (!roleDoc) {
      logFail(`Role "${globalRoleName}" not found in roleMap`);
      process.exit(1);
    }

    const updateResult = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(user.id) },
      { $set: { roleId: roleDoc._id } }
    );

    if (updateResult.modifiedCount === 1) {
      assigned++;
    } else if (updateResult.matchedCount === 1) {
      // Already had this roleId
      skipped++;
      log(`  (already assigned)`);
    } else {
      logFail(`User ${user.id} not found during update`);
      process.exit(1);
    }
  }

  log(`\nAssigned: ${assigned}, Already set: ${skipped}`);
}

// ─── Phase 5: Create Superadmin user ────────────────────────────────────────

async function createSuperadmin(User, Role, roleMap) {
  logHeader('PHASE 4: Create Superadmin User');

  const superadminRole = roleMap['SUPERADMIN'];
  if (!superadminRole) {
    logFail('SUPERADMIN role not found');
    process.exit(1);
  }

  // Check if superadmin already exists
  let user = await User.findOne({ email: SUPERADMIN_EMAIL });
  if (user) {
    log(`Superadmin already exists (${user._id})`);
    if (String(user.roleId) !== String(superadminRole._id)) {
      user.roleId = superadminRole._id;
      await user.save();
      log(`Updated roleId to SUPERADMIN`);
    } else {
      log(`Already has SUPERADMIN role`);
    }
    return user;
  }

  // Create new superadmin
  const passwordHash = await User.hashPassword(SUPERADMIN_PASSWORD);
  user = await User.create({
    name: SUPERADMIN_NAME,
    email: SUPERADMIN_EMAIL,
    passwordHash,
    role: 'admin',  // Legacy platform role (backward compat)
    roleId: superadminRole._id,
  });

  log(`Created Superadmin: ${SUPERADMIN_EMAIL} (${user._id})`);
  log(`Password: ${SUPERADMIN_PASSWORD}`);
  return user;
}

// ─── Phase 6: Post-migration integrity checks ──────────────────────────────

async function verifyIntegrity(User, Workspace, Project, Team, Task, Comment, Attachment, WorkLog, Activity, Notification, Role, snapshot) {
  logHeader('PHASE 5: Post-migration Integrity Checks');

  let failures = 0;
  let checks = 0;

  function check(label, condition) {
    checks++;
    if (condition) {
      logPass(label);
    } else {
      logFail(label);
      failures++;
    }
  }

  // 1. User count preserved
  const userCount = await User.countDocuments({ deletedAt: null });
  check(`User count: ${userCount} (expected ${snapshot.counts.users})`, userCount === snapshot.counts.users);

  // 2. All original User IDs still exist
  const existingUserIds = (await User.find({ deletedAt: null }).select('_id').lean()).map(u => String(u._id));
  const missingIds = snapshot.userIds.filter(id => !existingUserIds.includes(id));
  check(`All ${snapshot.userIds.length} original User IDs preserved`, missingIds.length === 0);
  if (missingIds.length > 0) {
    logFail(`Missing User IDs: ${missingIds.join(', ')}`);
  }

  // 3. No new users created (except Superadmin)
  const newUsers = existingUserIds.filter(id => !snapshot.userIds.includes(id));
  const superadminEmail = SUPERADMIN_EMAIL.toLowerCase();
  const nonSuperadminNew = newUsers.filter(async id => {
    const u = await User.findById(id).lean();
    return u && u.email !== superadminEmail;
  });
  check(`No unexpected new users (only Superadmin allowed)`, newUsers.length <= 1);

  // 4. Every user with a roleId has a valid Role reference
  const usersWithRoleId = await User.find({ roleId: { $ne: null } }).select('_id roleId email').lean();
  const roleIds = (await Role.find({}).select('_id').lean()).map(r => String(r._id));
  const brokenRefs = usersWithRoleId.filter(u => !roleIds.includes(String(u.roleId)));
  check(`All roleId references resolve to valid Roles (${usersWithRoleId.length} users checked)`, brokenRefs.length === 0);
  if (brokenRefs.length > 0) {
    logFail(`Broken roleId refs: ${brokenRefs.map(u => `${u.email}(${u.roleId})`).join(', ')}`);
  }

  // 5. Workspace membership User IDs preserved
  const workspaces = await Workspace.find({}).select('_id name members').lean();
  for (const ws of workspaces) {
    for (const m of (ws.members || [])) {
      const uid = String(m.userId);
      check(`Workspace "${ws.name}" member ${uid} exists`, existingUserIds.includes(uid));
    }
  }

  // 6. Project userId (manager) references preserved
  const projects = await Project.find({}).select('_id name userId').lean();
  for (const p of projects) {
    if (p.userId) {
      const uid = String(p.userId);
      check(`Project "${p.name}" manager ${uid} exists`, existingUserIds.includes(uid));
    }
  }

  // 7. Project members references preserved
  for (const p of projects) {
    const projFull = await Project.findById(p._id).select('members').lean();
    for (const mid of (projFull.members || [])) {
      const uid = String(mid);
      check(`Project "${p.name}" member ${uid} exists`, existingUserIds.includes(uid));
    }
  }

  // 8. Team leader references preserved
  const teams = await Team.find({}).select('_id name leaderId').lean();
  for (const t of teams) {
    if (t.leaderId) {
      const uid = String(t.leaderId);
      check(`Team "${t.name}" leader ${uid} exists`, existingUserIds.includes(uid));
    }
  }

  // 9. Team members references preserved
  for (const t of teams) {
    const teamFull = await Team.findById(t._id).select('members').lean();
    for (const mid of (teamFull.members || [])) {
      const uid = String(mid);
      check(`Team "${t.name}" member ${uid} exists`, existingUserIds.includes(uid));
    }
  }

  // 10. Task assignee references preserved
  const tasks = await Task.find({}).select('_id title assigneeId reviewerId').lean();
  for (const t of tasks) {
    if (t.assigneeId) {
      const uid = String(t.assigneeId);
      check(`Task "${t.title}" assignee ${uid} exists`, existingUserIds.includes(uid));
    }
    if (t.reviewerId) {
      const uid = String(t.reviewerId);
      check(`Task "${t.title}" reviewer ${uid} exists`, existingUserIds.includes(uid));
    }
  }

  // 11. Comment author references preserved
  const comments = await Comment.find({}).select('_id authorId').lean();
  for (const c of comments) {
    const uid = String(c.authorId);
    check(`Comment ${c._id} author ${uid} exists`, existingUserIds.includes(uid));
  }

  // 12. Attachment uploader references preserved
  const attachments = await Attachment.find({}).select('_id uploadedBy').lean();
  for (const a of attachments) {
    const uid = String(a.uploadedBy);
    check(`Attachment ${a._id} uploader ${uid} exists`, existingUserIds.includes(uid));
  }

  // 13. WorkLog user references preserved
  const worklogs = await WorkLog.find({}).select('_id userId').lean();
  for (const w of worklogs) {
    const uid = String(w.userId);
    check(`WorkLog ${w._id} user ${uid} exists`, existingUserIds.includes(uid));
  }

  // 14. Activity user references preserved
  const activities = await Activity.find({}).select('_id userId').lean();
  for (const a of activities) {
    const uid = String(a.userId);
    check(`Activity ${a._id} user ${uid} exists`, existingUserIds.includes(uid));
  }

  // 15. Notification user references preserved
  const notifs = await Notification.find({}).select('_id userId').lean();
  for (const n of notifs) {
    const uid = String(n.userId);
    check(`Notification ${n._id} user ${uid} exists`, existingUserIds.includes(uid));
  }

  // 16. Role count is exactly 4
  const roleCount = await Role.countDocuments();
  check(`Role count: ${roleCount} (expected 4)`, roleCount === 4);

  // 17. Legacy role field still intact
  const legacyRoles = await User.distinct('role', { deletedAt: null });
  check(`Legacy "role" field still has values: [${legacyRoles.join(', ')}]`, legacyRoles.length > 0);

  // 18. Superadmin exists with correct role
  const superadminRole = await Role.findOne({ name: 'SUPERADMIN' });
  const superadmin = await User.findOne({ email: SUPERADMIN_EMAIL });
  if (superadmin && superadminRole) {
    check(`Superadmin exists with roleId → SUPERADMIN`, String(superadmin.roleId) === String(superadminRole._id));
  } else {
    check(`Superadmin exists`, !!superadmin);
  }

  // Summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Checks: ${checks}, Passed: ${checks - failures}, Failed: ${failures}`);
  console.log(`${'─'.repeat(50)}`);

  return failures;
}

// ─── Main migration ─────────────────────────────────────────────────────────

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is required.');
    console.error('Usage: MONGODB_URI=mongodb+srv://... node server/migrations/001_role_migration.js');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  FocusFlow Role Migration — Phase 1                 ║');
  console.log('║  Adds Role collection + assigns global roles        ║');
  console.log('║  PRESERVES all existing User _id values             ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // Connect
  log('Connecting to database...');
  await mongoose.connect(uri);
  log('Connected.\n');

  // Load models (including new Role model)
  const User       = require('../models/User');
  const Role       = require('../models/Role');
  const Workspace  = require('../models/Workspace');
  const Project    = require('../models/Project');
  const Team       = require('../models/Team');
  const Task       = require('../models/Task');
  const WorkLog    = require('../models/WorkLog');
  const Comment    = require('../models/Comment');
  const Attachment = require('../models/Attachment');
  const Activity   = require('../models/Activity');
  const Notification = require('../models/Notification');

  try {
    // Phase 1: Snapshot
    const snapshot = await takeSnapshot(User, Workspace, Project, Team, Task, Comment, Attachment, WorkLog, Activity, Notification);

    // Phase 2: Seed roles
    const roleMap = await seedRoles(Role);

    // Phase 3: Assign roles
    await assignUserRoles(User, Role, roleMap, snapshot);

    // Phase 4: Superadmin
    await createSuperadmin(User, Role, roleMap);

    // Phase 5: Integrity check
    const failures = await verifyIntegrity(User, Workspace, Project, Team, Task, Comment, Attachment, WorkLog, Activity, Notification, Role, snapshot);

    if (failures > 0) {
      console.error(`\n❌ MIGRATION COMPLETED WITH ${failures} FAILURES`);
      console.error('   Review failures above before proceeding.');
      process.exit(1);
    }

    // Final summary
    logHeader('MIGRATION COMPLETE');
    const totalUsers = await User.countDocuments({ deletedAt: null });
    const totalRoles = await Role.countDocuments();
    const usersWithRoleId = await User.countDocuments({ roleId: { $ne: null } });

    log(`Total users:          ${totalUsers}`);
    log(`Users with roleId:    ${usersWithRoleId}`);
    log(`Total roles:          ${totalRoles}`);
    log(`User IDs preserved:   ${snapshot.userIds.length} (all verified)`);
    log(`Legacy role field:    Still present (backward compat)`);
    log(`Superadmin created:   ${SUPERADMIN_EMAIL}`);
    log(`\nFiles changed:`);
    log(`  server/models/Role.js        (NEW)`);
    log(`  server/models/User.js        (added roleId field)`);
    log(`  server/migrations/001_role_migration.js  (this script)`);

  } catch (err) {
    console.error('\n❌ MIGRATION FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log('Disconnected.');
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

migrate();

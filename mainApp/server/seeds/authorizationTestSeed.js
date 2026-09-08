#!/usr/bin/env node
// server/seeds/authorizationTestSeed.js
//
// Authorization test data seed for FocusFlow.
// Creates a controlled dataset for manual and API authorization testing.
// Idempotent — safe to run repeatedly without creating duplicates.
//
// Usage:
//   MONGODB_URI=mongodb://... node server/seeds/authorizationTestSeed.js
//   npm run seed:authorization

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Configuration ──────────────────────────────────────────────────────────

const TEST_PASSWORD = 'AuthTest2026!';
const PREFIX = 'ff';
const EMAIL_DOMAIN = 'focusflow.test';

// ─── Deterministic user definitions ─────────────────────────────────────────

const USER_DEFS = [
  { key: 'owner-01',  name: 'Auth Test Owner 01',  email: `${PREFIX}-owner-01@${EMAIL_DOMAIN}`,  platformRole: 'user' },
  { key: 'owner-02',  name: 'Auth Test Owner 02',  email: `${PREFIX}-owner-02@${EMAIL_DOMAIN}`,  platformRole: 'user' },
  { key: 'admin-01',  name: 'Auth Test Admin 01',  email: `${PREFIX}-admin-01@${EMAIL_DOMAIN}`,  platformRole: 'user' },
  { key: 'admin-02',  name: 'Auth Test Admin 02',  email: `${PREFIX}-admin-02@${EMAIL_DOMAIN}`,  platformRole: 'user' },
  { key: 'member-01', name: 'Auth Test Member 01', email: `${PREFIX}-member-01@${EMAIL_DOMAIN}`, platformRole: 'user' },
  { key: 'member-02', name: 'Auth Test Member 02', email: `${PREFIX}-member-02@${EMAIL_DOMAIN}`, platformRole: 'user' },
  { key: 'member-03', name: 'Auth Test Member 03', email: `${PREFIX}-member-03@${EMAIL_DOMAIN}`, platformRole: 'user' },
  { key: 'member-04', name: 'Auth Test Member 04', email: `${PREFIX}-member-04@${EMAIL_DOMAIN}`, platformRole: 'user' },
  { key: 'pm-01',     name: 'Auth Test PM 01',     email: `${PREFIX}-pm-01@${EMAIL_DOMAIN}`,     platformRole: 'user' },
  { key: 'pm-02',     name: 'Auth Test PM 02',     email: `${PREFIX}-pm-02@${EMAIL_DOMAIN}`,     platformRole: 'user' },
  { key: 'tl-01',     name: 'Auth Test TL 01',     email: `${PREFIX}-tl-01@${EMAIL_DOMAIN}`,     platformRole: 'user' },
  { key: 'tl-02',     name: 'Auth Test TL 02',     email: `${PREFIX}-tl-02@${EMAIL_DOMAIN}`,     platformRole: 'user' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${msg}`); }

async function upsertUser(User, def, passwordHash) {
  let user = await User.findOne({ email: def.email });
  if (user) {
    log(`  User ${def.key} already exists (${user._id})`);
    return user;
  }
  user = await User.create({
    name: def.name,
    email: def.email,
    passwordHash,
    role: def.platformRole,
  });
  log(`  Created user ${def.key} (${user._id})`);
  return user;
}

async function upsertWorkspace(Workspace, { name, createdBy, members }) {
  let ws = await Workspace.findOne({ name, createdBy });
  if (ws) {
    // Update members if changed
    const currentMembers = ws.members.map(m => `${m.userId}:${m.role}`).sort().join(',');
    const targetMembers = members.map(m => `${m.userId}:${m.role}`).sort().join(',');
    if (currentMembers !== targetMembers) {
      ws.members = members;
      await ws.save();
      log(`  Updated workspace "${name}" members`);
    } else {
      log(`  Workspace "${name}" already exists (${ws._id})`);
    }
    return ws;
  }
  ws = await Workspace.create({ name, createdBy, members });
  log(`  Created workspace "${name}" (${ws._id})`);
  return ws;
}

async function upsertProject(Project, { userId, name, workspaceRef, members, teamIds }) {
  const nameKey = name.toLowerCase();
  let project = await Project.findOne({ workspaceRef, nameKey });
  if (project) {
    const currentMembers = (project.members || []).map(String).sort().join(',');
    const targetMembers = (members || []).map(String).sort().join(',');
    if (currentMembers !== targetMembers) {
      project.members = members || [];
      if (teamIds) project.teamIds = teamIds;
      await project.save();
      log(`  Updated project "${name}" members`);
    } else {
      log(`  Project "${name}" already exists (${project._id})`);
    }
    return project;
  }
  project = await Project.create({ userId, name, workspaceRef, members, teamIds: teamIds || [] });
  log(`  Created project "${name}" (${project._id})`);
  return project;
}

async function upsertTeam(Team, { name, createdBy, workspaceRef, projectRef, leaderId, members }) {
  let team = await Team.findOne({ name, workspaceRef });
  if (team) {
    const currentMembers = (team.members || []).map(String).sort().join(',');
    const targetMembers = (members || []).map(String).sort().join(',');
    if (currentMembers !== targetMembers || String(team.leaderId) !== String(leaderId)) {
      team.members = members || [];
      team.leaderId = leaderId;
      if (projectRef) team.projectRef = projectRef;
      await team.save();
      log(`  Updated team "${name}"`);
    } else {
      log(`  Team "${name}" already exists (${team._id})`);
    }
    return team;
  }
  team = await Team.create({ name, createdBy, workspaceRef, projectRef, leaderId, members });
  log(`  Created team "${name}" (${team._id})`);
  return team;
}

async function upsertTask(Task, { userId, title, workspaceRef, projectRef, assigneeId, reviewerId, followerIds, status }) {
  let task = await Task.findOne({ title, workspaceRef });
  if (task) {
    log(`  Task "${title}" already exists (${task._id})`);
    return task;
  }
  task = await Task.create({
    userId,
    title,
    workspaceRef,
    projectRef,
    assigneeId: assigneeId || null,
    reviewerId: reviewerId || null,
    followerIds: followerIds || [],
    status: status || 'todo',
    category: 'Work',
    priority: 'medium',
  });
  log(`  Created task "${title}" (${task._id})`);
  return task;
}

async function upsertWorkLog(WorkLog, { userId, taskRef, projectRef, title }) {
  let log_ = await WorkLog.findOne({ userId, taskRef });
  if (log_) {
    log(`  WorkLog for task ${taskRef} already exists (${log_._id})`);
    return log_;
  }
  log_ = await WorkLog.create({
    userId,
    taskRef,
    projectRef,
    title: title || 'Auth Test Work Log',
    status: 'in-progress',
    workEntries: [{
      date: new Date(),
      what: 'Authorization test work entry',
      activeMs: 3600000,
    }],
  });
  log(`  Created WorkLog for task ${taskRef} (${log_._id})`);
  return log_;
}

async function upsertComment(Comment, { workspaceRef, targetType, targetRef, authorId, authorName, content }) {
  let comment = await Comment.findOne({ targetRef, authorId, content });
  if (comment) {
    log(`  Comment by ${authorId} on ${targetRef} already exists (${comment._id})`);
    return comment;
  }
  comment = await Comment.create({
    workspaceRef,
    targetType,
    targetRef,
    authorId,
    authorName,
    content,
  });
  log(`  Created comment by ${authorId} on ${targetRef} (${comment._id})`);
  return comment;
}

async function upsertAttachment(Attachment, { workspaceRef, targetType, targetRef, uploadedBy, uploaderName, name, url }) {
  let attachment = await Attachment.findOne({ targetRef, uploadedBy, name });
  if (attachment) {
    log(`  Attachment "${name}" on ${targetRef} already exists (${attachment._id})`);
    return attachment;
  }
  attachment = await Attachment.create({
    workspaceRef,
    targetType,
    targetRef,
    name,
    type: 'file',
    url,
    uploadedBy,
    uploaderName,
  });
  log(`  Created attachment "${name}" on ${targetRef} (${attachment._id})`);
  return attachment;
}

// ─── Main seed function ─────────────────────────────────────────────────────

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is required.');
    console.error('Usage: MONGODB_URI=mongodb://... node server/seeds/authorizationTestSeed.js');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log(' FocusFlow Authorization Test Seed');
  console.log('========================================\n');

  // Connect
  log('Connecting to database...');
  await mongoose.connect(uri);
  log('Connected.\n');

  // Load models
  const User = require('../models/User');
  const Workspace = require('../models/Workspace');
  const Project = require('../models/Project');
  const Team = require('../models/Team');
  const Task = require('../models/Task');
  const WorkLog = require('../models/WorkLog');
  const Comment = require('../models/Comment');
  const Attachment = require('../models/Attachment');

  // Hash password once
  log('Hashing test password...');
  const passwordHash = await User.hashPassword(TEST_PASSWORD);

  // ── 1. Users ────────────────────────────────────────────────────────────
  logHeader('── Creating Users ──');
  const users = {};
  for (const def of USER_DEFS) {
    const user = await upsertUser(User, def, passwordHash);
    users[def.key] = user;
  }

  // ── 2. Workspaces ──────────────────────────────────────────────────────
  logHeader('── Creating Workspaces ──');

  const wsA = await upsertWorkspace(Workspace, {
    name: 'Authorization Test Workspace A',
    createdBy: users['owner-01']._id,
    members: [
      { userId: users['owner-01']._id,  role: 'admin', isProjectManager: true },
      { userId: users['admin-01']._id,  role: 'admin', isProjectManager: true },
      { userId: users['member-01']._id, role: 'nonadmin' },
      { userId: users['member-02']._id, role: 'nonadmin' },
      { userId: users['member-03']._id, role: 'nonadmin' },
      { userId: users['pm-01']._id,     role: 'nonadmin', isProjectManager: true },
      { userId: users['pm-02']._id,     role: 'nonadmin', isProjectManager: true },
      { userId: users['tl-01']._id,     role: 'nonadmin' },
      { userId: users['tl-02']._id,     role: 'nonadmin' },
    ],
  });

  const wsB = await upsertWorkspace(Workspace, {
    name: 'Authorization Test Workspace B',
    createdBy: users['owner-02']._id,
    members: [
      { userId: users['owner-02']._id,  role: 'admin', isProjectManager: true },
      { userId: users['admin-02']._id,  role: 'admin', isProjectManager: true },
      { userId: users['member-04']._id, role: 'nonadmin' },
    ],
  });

  // ── 3. Projects ────────────────────────────────────────────────────────
  logHeader('── Creating Projects ──');

  const projAlpha = await upsertProject(Project, {
    userId: users['pm-01']._id,
    name: 'Project Alpha',
    workspaceRef: wsA._id,
    members: [
      users['pm-01']._id,
      users['member-01']._id,
      users['member-02']._id,
      users['tl-01']._id,
    ],
  });

  const projBeta = await upsertProject(Project, {
    userId: users['pm-02']._id,
    name: 'Project Beta',
    workspaceRef: wsA._id,
    members: [
      users['pm-02']._id,
      users['member-03']._id,
      users['tl-02']._id,
    ],
  });

  // ── 4. Teams ────────────────────────────────────────────────────────────
  logHeader('── Creating Teams ──');

  const teamAlpha = await upsertTeam(Team, {
    name: 'Team Alpha',
    createdBy: users['tl-01']._id,
    workspaceRef: wsA._id,
    projectRef: projAlpha._id,
    leaderId: users['tl-01']._id,
    members: [
      users['tl-01']._id,
      users['member-01']._id,
      users['member-02']._id,
    ],
  });

  const teamBeta = await upsertTeam(Team, {
    name: 'Team Beta',
    createdBy: users['tl-02']._id,
    workspaceRef: wsA._id,
    projectRef: projBeta._id,
    leaderId: users['tl-02']._id,
    members: [
      users['tl-02']._id,
      users['member-03']._id,
    ],
  });

  // Link teams to projects
  projAlpha.teamIds = [teamAlpha._id];
  await projAlpha.save();
  projBeta.teamIds = [teamBeta._id];
  await projBeta.save();

  // ── 5. Tasks ────────────────────────────────────────────────────────────
  logHeader('── Creating Tasks ──');

  const taskAlpha1 = await upsertTask(Task, {
    userId: users['member-01']._id,
    title: 'Task Alpha-1: Feature implementation',
    workspaceRef: wsA._id,
    projectRef: projAlpha._id,
    assigneeId: users['member-01']._id,
    reviewerId: users['pm-01']._id,
    followerIds: [users['member-02']._id],
  });

  const taskAlpha2 = await upsertTask(Task, {
    userId: users['member-02']._id,
    title: 'Task Alpha-2: Bug fix',
    workspaceRef: wsA._id,
    projectRef: projAlpha._id,
    assigneeId: users['member-02']._id,
    reviewerId: users['tl-01']._id,
  });

  const taskBeta1 = await upsertTask(Task, {
    userId: users['member-03']._id,
    title: 'Task Beta-1: API endpoint',
    workspaceRef: wsA._id,
    projectRef: projBeta._id,
    assigneeId: users['member-03']._id,
    reviewerId: users['pm-02']._id,
  });

  const taskBeta2 = await upsertTask(Task, {
    userId: users['tl-02']._id,
    title: 'Task Beta-2: Team lead task',
    workspaceRef: wsA._id,
    projectRef: projBeta._id,
    assigneeId: users['tl-02']._id,
  });

  // ── 6. WorkLogs ────────────────────────────────────────────────────────
  logHeader('── Creating WorkLogs ──');

  await upsertWorkLog(WorkLog, {
    userId: users['member-01']._id,
    taskRef: taskAlpha1._id,
    projectRef: projAlpha._id,
    title: 'WorkLog Alpha-1: Feature work',
  });

  await upsertWorkLog(WorkLog, {
    userId: users['member-02']._id,
    taskRef: taskAlpha2._id,
    projectRef: projAlpha._id,
    title: 'WorkLog Alpha-2: Bug fix work',
  });

  await upsertWorkLog(WorkLog, {
    userId: users['member-03']._id,
    taskRef: taskBeta1._id,
    projectRef: projBeta._id,
    title: 'WorkLog Beta-1: API work',
  });

  // Personal WorkLog (no task/project — owner-only)
  let personalLog = await WorkLog.findOne({
    userId: users['member-01']._id,
    taskRef: { $exists: false },
    projectRef: { $exists: false },
  });
  if (!personalLog) {
    personalLog = await WorkLog.create({
      userId: users['member-01']._id,
      title: 'Personal WorkLog (auth test)',
      status: 'in-progress',
      workEntries: [{
        date: new Date(),
        what: 'Personal work — should not be visible to workspace members',
        activeMs: 1800000,
      }],
    });
    log(`  Created personal WorkLog (${personalLog._id})`);
  } else {
    log(`  Personal WorkLog already exists (${personalLog._id})`);
  }

  // ── 7. Collaboration (Comments & Attachments) ──────────────────────────
  logHeader('── Creating Collaboration Data ──');

  await upsertComment(Comment, {
    workspaceRef: wsA._id,
    targetType: 'task',
    targetRef: taskAlpha1._id,
    authorId: users['member-01']._id,
    authorName: 'Auth Test Member 01',
    content: 'Comment by assignee on Alpha-1 task',
  });

  await upsertComment(Comment, {
    workspaceRef: wsA._id,
    targetType: 'task',
    targetRef: taskAlpha1._id,
    authorId: users['member-03']._id,
    authorName: 'Auth Test Member 03',
    content: 'Cross-project comment on Alpha-1 task by Beta member',
  });

  await upsertComment(Comment, {
    workspaceRef: wsA._id,
    targetType: 'task',
    targetRef: taskBeta1._id,
    authorId: users['member-03']._id,
    authorName: 'Auth Test Member 03',
    content: 'Comment by assignee on Beta-1 task',
  });

  await upsertComment(Comment, {
    workspaceRef: wsA._id,
    targetType: 'project',
    targetRef: projAlpha._id,
    authorId: users['pm-01']._id,
    authorName: 'Auth Test PM 01',
    content: 'PM comment on Project Alpha',
  });

  await upsertAttachment(Attachment, {
    workspaceRef: wsA._id,
    targetType: 'task',
    targetRef: taskAlpha1._id,
    uploadedBy: users['member-01']._id,
    uploaderName: 'Auth Test Member 01',
    name: 'design-spec.pdf',
    url: 'https://example.com/auth-test/design-spec.pdf',
  });

  await upsertAttachment(Attachment, {
    workspaceRef: wsA._id,
    targetType: 'task',
    targetRef: taskBeta1._id,
    uploadedBy: users['member-03']._id,
    uploaderName: 'Auth Test Member 03',
    name: 'api-docs.pdf',
    url: 'https://example.com/auth-test/api-docs.pdf',
  });

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(' Seed Summary');
  console.log('========================================\n');

  const userCount = await User.countDocuments({ email: { $regex: `@${EMAIL_DOMAIN.replace('.', '\\.')}$` } });
  const wsCount = await Workspace.countDocuments({ name: { $regex: /^Authorization Test Workspace/ } });
  const projCount = await Project.countDocuments({ workspaceRef: { $in: [wsA._id, wsB._id] } });
  const teamCount = await Team.countDocuments({ workspaceRef: wsA._id });
  const taskCount = await Task.countDocuments({ workspaceRef: wsA._id });
  const worklogCount = await WorkLog.countDocuments({ userId: { $in: Object.values(users).map(u => u._id) } });
  const commentCount = await Comment.countDocuments({ workspaceRef: wsA._id });
  const attachmentCount = await Attachment.countDocuments({ workspaceRef: wsA._id });

  console.log('Users:');
  console.log(`  Owners:       2`);
  console.log(`  Admins:       2`);
  console.log(`  Members:      8`);
  console.log(`  Total:        ${userCount}\n`);

  console.log('Workspaces:');
  console.log(`  Workspace A   (${wsA._id})`);
  console.log(`    Members: Owner(1), Admin(1), Member(7)`);
  console.log(`  Workspace B   (${wsB._id})`);
  console.log(`    Members: Owner(1), Admin(1), Member(1)`);
  console.log(`  Total:        ${wsCount}\n`);

  console.log('Projects:');
  console.log(`  Project Alpha → PM: ff-pm-01, Members: 4`);
  console.log(`  Project Beta  → PM: ff-pm-02, Members: 3`);
  console.log(`  Total:        ${projCount}\n`);

  console.log('Teams:');
  console.log(`  Team Alpha → Leader: ff-tl-01, Members: 3`);
  console.log(`  Team Beta  → Leader: ff-tl-02, Members: 2`);
  console.log(`  Total:        ${teamCount}\n`);

  console.log('Tasks:');
  console.log(`  Task Alpha-1 → assignee: ff-member-01, reviewer: ff-pm-01`);
  console.log(`  Task Alpha-2 → assignee: ff-member-02, reviewer: ff-tl-01`);
  console.log(`  Task Beta-1  → assignee: ff-member-03, reviewer: ff-pm-02`);
  console.log(`  Task Beta-2  → assignee: ff-tl-02`);
  console.log(`  Total:        ${taskCount}\n`);

  console.log('WorkLogs:');
  console.log(`  3 workspace WorkLogs (linked to tasks)`);
  console.log(`  1 personal WorkLog (ff-member-01, no task/project)`);
  console.log(`  Total:        ${worklogCount}\n`);

  console.log('Collaboration:');
  console.log(`  Comments:     ${commentCount}`);
  console.log(`  Attachments:  ${attachmentCount}\n`);

  console.log('========================================');
  console.log(' Test Login Credentials');
  console.log('========================================');
  console.log(`  Password (all users): ${TEST_PASSWORD}`);
  console.log('');
  USER_DEFS.forEach(def => {
    console.log(`  ${def.email}`);
  });
  console.log('');

  console.log('========================================');
  console.log(' Seed completed successfully');
  console.log('========================================\n');

  await mongoose.disconnect();
  log('Disconnected.');
}

// ─── Run ────────────────────────────────────────────────────────────────────

seed().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});

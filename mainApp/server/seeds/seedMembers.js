#!/usr/bin/env node
// server/seeds/seedMembers.js
//
// Seeds 16 member users and adds them to the "Pending Tasks" workspace.
//
// Usage:
//   MONGODB_URI=mongodb+srv://... node server/seeds/seedMembers.js

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PASSWORD = 'SharedPass2026!';

const USERS = [
  { name: 'Prabhas Nizam', email: 'prabhas@focusflow.com' },
  { name: 'Seshu', email: 'seshu@focusflow.com' },
  { name: 'Aryan', email: 'aryan@focusflow.com' },
  { name: 'Likitha', email: 'likitha@focusflow.com' },
  { name: 'Mandy', email: 'mandy@focusflow.com' },
  { name: 'Akash', email: 'akash@focusflow.com' },
  { name: 'Bhargavi', email: 'bhargavi@focusflow.com' },
  { name: 'Dharnesh', email: 'dharnesh@focusflow.com' },
  { name: 'Reddy', email: 'reddy@focusflow.com' },
  { name: 'Shashank', email: 'shashank@focusflow.com' },
  { name: 'Hari', email: 'hari@focusflow.com' },
  { name: 'Pramod', email: 'pramod@focusflow.com' },
  { name: 'Bhavana', email: 'bhavana@focusflow.com' },
  { name: 'Hemanth', email: 'hemanth@focusflow.com' },
  { name: 'Hema', email: 'hema@focusflow.com' },
  { name: 'Joseph', email: 'joseph@focusflow.com' },
];

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}`); }
function logPass(msg) { console.log(`  ✅ ${msg}`); }
function logFail(msg) { console.error(`  ❌ FAIL: ${msg}`); }

async function run() {
  logHeader('Seed: Create 16 Member Users + Add to Workspace');

  const uri = process.env.MONGODB_URI;
  if (!uri) { logFail('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  log('Connected to MongoDB');

  const Role = mongoose.model('Role', new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    level: { type: Number, required: true },
  }, { collection: 'roles' }));

  const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, lowercase: true },
    passwordHash: String,
    role: String,
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  }, { collection: 'users', timestamps: true }));

  const Workspace = mongoose.model('Workspace', new mongoose.Schema({
    name: String,
    members: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, role: String, joinedAt: Date }],
  }, { collection: 'workspaces' }));

  // Find nonadmin role
  const memberRole = await Role.findOne({ name: 'nonadmin' });
  if (!memberRole) { logFail('nonadmin role not found'); process.exit(1); }
  log(`nonadmin role: ${memberRole._id} (level ${memberRole.level})`);

  // Find "Pending Tasks" workspace
  const workspace = await Workspace.findOne({ name: 'Pending Tasks' });
  if (!workspace) { logFail('Workspace "Pending Tasks" not found'); process.exit(1); }
  log(`Workspace: ${workspace.name} (${workspace._id})`);

  // Hash password once
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  log('Password hashed');

  let created = 0;
  let skipped = 0;
  let addedToWorkspace = 0;

  for (const u of USERS) {
    // Check if user already exists
    const existing = await User.findOne({ email: u.email.toLowerCase() });
    if (existing) {
      log(`  Skip: ${u.email} (already exists)`);
      skipped++;
      continue;
    }

    // Create user
    const user = await User.create({
      name: u.name,
      email: u.email.toLowerCase(),
      passwordHash,
      role: 'user',
      roleId: memberRole._id,
    });
    created++;

    // Add to workspace if not already a member
    const alreadyMember = workspace.members.some(m => m.userId.toString() === user._id.toString());
    if (!alreadyMember) {
      workspace.members.push({ userId: user._id, role: 'nonadmin', joinedAt: new Date() });
      addedToWorkspace++;
    }

    log(`  Created: ${u.name} <${u.email}> (roleId=${memberRole._id})`);
  }

  // Save workspace with new members
  if (addedToWorkspace > 0) {
    await workspace.save();
    log(`\nAdded ${addedToWorkspace} users to "${workspace.name}" workspace`);
  }

  logPass(`Done: ${created} created, ${skipped} skipped, ${addedToWorkspace} added to workspace`);

  // Verify
  const totalMembers = await User.countDocuments({ roleId: memberRole._id });
  log(`\nTotal MEMBER users in system: ${totalMembers}`);

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

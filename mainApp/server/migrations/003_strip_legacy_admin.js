#!/usr/bin/env node
// server/migrations/003_strip_legacy_admin.js
//
// Strips legacy role: 'admin' from users who are NOT SUPERADMIN.
// Only superadmin@focusflow.com and admin@focusflow.com keep role: 'admin'.
//
// Usage:
//   MONGODB_URI=mongodb+srv://... node server/migrations/003_strip_legacy_admin.js

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

function log(msg)  { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}`); }
function logPass(msg) { console.log(`  ✅ ${msg}`); }
function logFail(msg) { console.error(`  ❌ FAIL: ${msg}`); }

async function run() {
  logHeader('Migration 003: Strip legacy role: admin from non-superadmins');

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
    role: String,
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  }, { collection: 'users', timestamps: true }));

  // Find SUPERADMIN role
  const superadminRole = await Role.findOne({ name: 'SUPERADMIN' });
  if (!superadminRole) { logFail('SUPERADMIN role not found'); process.exit(1); }

  // Find all users with role: 'admin' who are NOT SUPERADMIN
  const legacyAdmins = await User.find({
    role: 'admin',
    $or: [
      { roleId: { $ne: superadminRole._id } },
      { roleId: null },
    ],
  }).select('name email role roleId');

  log(`Found ${legacyAdmins.length} non-superadmin users with legacy role: 'admin'`);

  if (legacyAdmins.length === 0) {
    logPass('No users to update');
  } else {
    for (const u of legacyAdmins) {
      await User.updateOne({ _id: u._id }, { $set: { role: 'user' } });
      log(`  ${u.name} <${u.email}>: role 'admin' → 'user' (roleId=${u.roleId || 'null'})`);
    }
    logPass(`Updated ${legacyAdmins.length} users`);
  }

  // Verify: only superadmins should have role: 'admin'
  const remaining = await User.find({ role: 'admin' }).select('name email roleId');
  log('\n--- Verification ---');
  log(`Users with role: 'admin' after migration: ${remaining.length}`);
  for (const u of remaining) {
    const isSuperadmin = u.roleId?.toString() === superadminRole._id.toString();
    log(`  ${u.name} <${u.email}> (roleId=${u.roleId}, isSuperadmin=${isSuperadmin})`);
  }

  logPass('Migration 003 complete');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

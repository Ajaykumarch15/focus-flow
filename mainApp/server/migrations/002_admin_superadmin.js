#!/usr/bin/env node
// server/migrations/002_admin_superadmin.js
//
// Promotes admin@focusflow.com to SUPERADMIN role.
// Both admin@focusflow.com and superadmin@focusflow.com will be SUPERADMINs.
//
// Usage:
//   MONGODB_URI=mongodb+srv://... node server/migrations/002_admin_superadmin.js

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ADMIN_EMAIL = 'admin@focusflow.com';

function log(msg)  { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}`); }
function logPass(msg) { console.log(`  ✅ ${msg}`); }
function logFail(msg) { console.error(`  ❌ FAIL: ${msg}`); }

async function run() {
  logHeader('Migration 002: Promote admin@focusflow.com to SUPERADMIN');

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
  if (!superadminRole) { logFail('SUPERADMIN role not found — run 001_role_migration.js first'); process.exit(1); }
  log(`SUPERADMIN role: ${superadminRole._id} (level ${superadminRole.level})`);

  // Find admin user
  const admin = await User.findOne({ email: ADMIN_EMAIL });
  if (!admin) { logFail(`${ADMIN_EMAIL} not found`); process.exit(1); }
  log(`Found ${ADMIN_EMAIL}: _id=${admin._id}, current roleId=${admin.roleId}, role=${admin.role}`);

  // Update roleId to SUPERADMIN
  if (admin.roleId?.toString() === superadminRole._id.toString()) {
    logPass(`${ADMIN_EMAIL} already has SUPERADMIN roleId — no change needed`);
  } else {
    const oldRoleId = admin.roleId;
    await User.updateOne({ _id: admin._id }, { $set: { roleId: superadminRole._id } });
    logPass(`${ADMIN_EMAIL} roleId: ${oldRoleId} → ${superadminRole._id} (SUPERADMIN)`);
  }

  // Verify both superadmins
  log('\n--- Verification ---');
  const superadmins = await User.find({ roleId: superadminRole._id }).select('name email role roleId');
  for (const u of superadmins) {
    log(`  SUPERADMIN: ${u.name} <${u.email}> (role=${u.role}, roleId=${u.roleId})`);
  }

  logPass('Migration 002 complete');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

#!/usr/bin/env node
// server/scripts/exportUsersCsv.js
//
// Exports all users to CSV: Name, Email, Platform Role, Global Role, Password
//
// Usage:
//   MONGODB_URI=mongodb+srv://... node server/scripts/exportUsersCsv.js

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Known passwords for seeded users
const KNOWN_PASSWORDS = {
  'prabhas@focusflow.com': 'SharedPass2026!',
  'seshu@focusflow.com': 'SharedPass2026!',
  'aryan@focusflow.com': 'SharedPass2026!',
  'likitha@focusflow.com': 'SharedPass2026!',
  'mandy@focusflow.com': 'SharedPass2026!',
  'akash@focusflow.com': 'SharedPass2026!',
  'bhargavi@focusflow.com': 'SharedPass2026!',
  'dharnesh@focusflow.com': 'SharedPass2026!',
  'reddy@focusflow.com': 'SharedPass2026!',
  'shashank@focusflow.com': 'SharedPass2026!',
  'hari@focusflow.com': 'SharedPass2026!',
  'pramod@focusflow.com': 'SharedPass2026!',
  'bhavana@focusflow.com': 'SharedPass2026!',
  'hemanth@focusflow.com': 'SharedPass2026!',
  'hema@focusflow.com': 'SharedPass2026!',
  'joseph@focusflow.com': 'SharedPass2026!',
  'admin@focusflow.com': 'Admin2026!',
  'superadmin@focusflow.com': 'SuperAdmin2026!',
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);

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

  const users = await User.find({}).populate({ path: 'roleId', select: 'name level' }).sort({ createdAt: 1 });

  const header = 'Name,Email,Platform Role,Global Role,Password';
  const rows = users.map(u => {
    const name = `"${(u.name || '').replace(/"/g, '""')}"`;
    const email = u.email || '';
    const platformRole = u.role || 'user';
    const globalRole = u.roleId?.name || 'NONE';
    const password = KNOWN_PASSWORDS[email] || 'CONTACT_ADMIN';
    return `${name},${email},${platformRole},${globalRole},${password}`;
  });

  const csv = [header, ...rows].join('\n');
  const outPath = path.join(__dirname, '..', '..', 'users_export.csv');
  fs.writeFileSync(outPath, csv, 'utf-8');

  console.log(`Exported ${users.length} users to ${outPath}`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

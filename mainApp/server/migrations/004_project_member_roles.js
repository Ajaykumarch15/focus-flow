#!/usr/bin/env node
// server/migrations/004_project_member_roles.js
//
// Migrates project members from flat ObjectId[] to subdocuments with roles.
// - project.userId (creator) stays as Manager
// - All existing members become Editor by default
//
// Usage:
//   MONGODB_URI=mongodb+srv://... node server/migrations/004_project_member_roles.js

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}`); }
function logPass(msg) { console.log(`  ✅ ${msg}`); }

async function run() {
  logHeader('Migration 004: Project Member Roles');

  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  log('Connected to MongoDB');

  const Project = mongoose.model('Project', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    members: mongoose.Schema.Types.Mixed,
    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  }, { collection: 'projects', timestamps: true }));

  // Find projects that need migration (members is an array of ObjectIds, not subdocuments)
  const projects = await Project.find({});
  let migrated = 0;
  let skipped = 0;

  for (const project of projects) {
    if (!Array.isArray(project.members) || project.members.length === 0) {
      skipped++;
      continue;
    }

    // Check if already migrated (first element has .userId property)
    const first = project.members[0];
    if (first && typeof first === 'object' && first.userId) {
      skipped++;
      continue;
    }

    // Migrate: convert flat ObjectIds to subdocuments
    const creatorId = String(project.userId);
    const newMembers = project.members.map(id => ({
      userId: id,
      role: String(id) === creatorId ? 'Manager' : 'Editor',
      addedAt: project.createdAt || new Date(),
    }));

    await Project.updateOne({ _id: project._id }, { $set: { members: newMembers } });
    migrated++;
    log(`  Migrated: ${project.name} (${newMembers.length} members)`);
  }

  logPass(`Done: ${migrated} projects migrated, ${skipped} skipped (already migrated or empty)`);

  // Verify
  const sample = await Project.findOne({ 'members.0.role': { $exists: true } }).select('name members');
  if (sample) {
    log(`\nVerification sample: ${sample.name}`);
    sample.members.forEach(m => log(`  ${m.userId} → ${m.role}`));
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

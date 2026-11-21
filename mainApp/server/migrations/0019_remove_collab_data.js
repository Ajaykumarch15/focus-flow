#!/usr/bin/env node
// server/migrations/0019_remove_collab_data.js
//
// Final step of the collab removal runbook. Drops collab-owned collections and
// removes dangling collab references from the collections that are kept.
//
// IMPORTANT: run `node server/scripts/archiveCollabData.js` first and verify
// the generated archive. This migration is intentionally destructive.
//
// Usage:
//   MONGODB_URI=mongodb://... node server/migrations/0019_remove_collab_data.js [--dry-run]

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const DROP_COLLECTIONS = [
  'workspaces',
  'teams',
  'activities',
  'notifications',
  'conversations',
  'messages',
  'comments',
  'attachments',
  'sprints',
  'features',
  'milestones',
  'phases',
  'modules',
  'roadmaps',
  'roadmapmilestones',
  'roadmapphases',
];

async function up({ db, dryRun = false, log = console.log } = {}) {
  for (const name of DROP_COLLECTIONS) {
    if (dryRun) {
      log(`[dry-run] would drop ${name}`);
      continue;
    }
    const exists = (await db.listCollections({ name }).toArray()).length > 0;
    if (exists) {
      await db.collection(name).drop();
      log(`Dropped ${name}`);
    } else {
      log(`Skipped ${name} (not present)`);
    }
  }

  // Collab projects only — personal projects (workspaceRef: null) are kept.
  const collabProjectQuery = { workspaceRef: { $ne: null, $exists: true } };
  const collabProjects = dryRun ? 0 : (await db.collection('projects').countDocuments(collabProjectQuery));
  log(`${dryRun ? '[dry-run] would delete' : 'Deleted'} ${collabProjects} collab projects`);
  if (!dryRun) await db.collection('projects').deleteMany(collabProjectQuery);

  // References on kept documents.
  const unsets = [
    ['projects', 'teamIds'],
    ['tasks', 'workspaceRef'],
    ['tasks', 'projectRef'],
    ['tasks', 'sprintRef'],
    ['tasks', 'featureRef'],
    ['tasks', 'assigneeIds'],
    ['tasks', 'reviewerId'],
    ['tasks', 'followerIds'],
    ['tasks', 'estimatedHours'],
    ['tasks', 'actualHours'],
    ['tasks', 'sprintStatus'],
    ['tasks', 'gitContext'],
    ['personaltasks', 'workspaceRef'],
    ['personaltasks', 'projectRef'],
    ['personaltasks', 'sprintRef'],
    ['personaltasks', 'featureRef'],
    ['personaltasks', 'assigneeId'],
    ['personaltasks', 'reviewerId'],
    ['personaltasks', 'followerIds'],
    ['personaltasks', 'sprintStatus'],
    ['meetings', 'workspaceId'],
    ['schedules', 'workspaceId'],
  ];
  for (const [collection, field] of unsets) {
    if (dryRun) {
      log(`[dry-run] would unset ${collection}.${field}`);
      continue;
    }
    const result = await db.collection(collection).updateMany(
      { [field]: { $exists: true } },
      { $unset: { [field]: '' } },
    );
    log(`Unset ${collection}.${field} on ${result.modifiedCount} documents`);
  }

  if (dryRun) return;

  const collabTasks = await db.collection('tasks').countDocuments({ workspaceContext: 'collab' });
  await db.collection('tasks').updateMany(
    { workspaceContext: 'collab' },
    { $set: { workspaceContext: 'work' } },
  );
  log(`Re-labelled ${collabTasks} collab tasks as work tasks`);

  const collabPersonalTasks = await db.collection('personaltasks').countDocuments({ workspaceContext: 'collab' });
  await db.collection('personaltasks').updateMany(
    { workspaceContext: 'collab' },
    { $set: { workspaceContext: 'personal' } },
  );
  log(`Re-labelled ${collabPersonalTasks} collab personal tasks as personal tasks`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(uri);
  try {
    await up({ db: mongoose.connection.db, dryRun });
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { up };

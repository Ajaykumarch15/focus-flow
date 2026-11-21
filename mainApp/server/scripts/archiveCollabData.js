#!/usr/bin/env node
// Archive every collab-owned MongoDB collection to JSON before it is dropped.
//
//   node server/scripts/archiveCollabData.js [--out=<dir>]
//
// Output: <repo>/backups/collab-archive-<timestamp>/<EJSON documents>.json
// plus a manifest.json recording the counts and the source database.
//
// Nothing is deleted by this script — it is the first, reversible step of the
// collab removal runbook. Run `node server/migrations/0019_remove_collab_data.js`
// only after verifying the archive.

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const COLLAB_COLLECTIONS = [
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

// Projects is shared: only workspace-backed (collab) projects are archived.
const COLLAB_PROJECT_QUERY = { workspaceRef: { $ne: null, $exists: true } };

function parseOut(argv) {
  const arg = argv.find((a) => a.startsWith('--out='));
  return arg ? arg.slice('--out='.length) : null;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = parseOut(process.argv.slice(2)) ||
    path.resolve(__dirname, '..', '..', 'backups', `collab-archive-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const manifest = {
    createdAt: new Date().toISOString(),
    database: db.databaseName,
    outDir,
    collections: {},
  };

  try {
    for (const name of COLLAB_COLLECTIONS) {
      const docs = await db.collection(name).find({}).toArray();
      fs.writeFileSync(path.join(outDir, `${name}.json`), EJSON.stringify(docs, null, 2));
      manifest.collections[name] = docs.length;
      console.log(`Archived ${name}: ${docs.length}`);
    }

    const collabProjects = await db.collection('projects').find(COLLAB_PROJECT_QUERY).toArray();
    fs.writeFileSync(path.join(outDir, 'projects.collab.json'), EJSON.stringify(collabProjects, null, 2));
    manifest.collections['projects (collab only)'] = collabProjects.length;
    console.log(`Archived projects (collab only): ${collabProjects.length}`);

    // Keep a copy of the task documents that still carry collab-only fields;
    // migration 0019 unsets those fields in place.
    for (const collection of ['tasks', 'personaltasks']) {
      const docs = await db.collection(collection).find({
        $or: [
          { workspaceRef: { $exists: true } },
          { sprintRef: { $exists: true } },
          { featureRef: { $exists: true } },
          { projectRef: { $exists: true } },
          { workspaceContext: 'collab' },
        ],
      }).toArray();
      fs.writeFileSync(path.join(outDir, `${collection}.collab-refs.json`), EJSON.stringify(docs, null, 2));
      manifest.collections[`${collection} (collab refs)`] = docs.length;
      console.log(`Archived ${collection} with collab refs: ${docs.length}`);
    }
  } finally {
    await mongoose.disconnect();
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nArchive complete: ${outDir}`);
}

main().catch((err) => {
  console.error('Archive failed:', err);
  process.exit(1);
});

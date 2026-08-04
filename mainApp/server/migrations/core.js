// IES-P0-17: versioned, idempotent migration core (DB-agnostic, unit-testable).
//
// Migrations are files in `./migrations/` named `<NNNN>_description.js` that
// export `{ up({ db }) }`. Applied migration names are recorded in the
// `schema_migrations` collection so re-running is a no-op.
'use strict';

const fs = require('fs');
const path = require('path');

const COLLECTION = 'schema_migrations';

function listMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => /^\d{4}.*\.js$/.test(file))
    .sort();
}

function parseArgs(argv) {
  const args = { apply: false, dryRun: false, db: process.env.MONGODB_URI || '' };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--db=')) args.db = arg.slice('--db='.length);
  }
  return args;
}

async function pendingMigrations({ db, migrationsDir }) {
  const files = listMigrations(migrationsDir);
  const appliedRows = await db.collection(COLLECTION).find({}).toArray();
  const applied = new Set(appliedRows.map((row) => row.name));
  return files.filter((name) => !applied.has(name));
}

async function runMigrations({ db, migrationsDir, dryRun = false, log = console.log }) {
  const pending = await pendingMigrations({ db, migrationsDir });

  for (const name of pending) {
    if (dryRun) {
      log(`[dry-run] would apply ${name}`);
      continue;
    }
    log(`Applying ${name}...`);
    const migration = require(path.join(migrationsDir, name));
    await migration.up({ db });
    await db.collection(COLLECTION).insertOne({ name, appliedAt: new Date() });
    log(`Applied ${name}.`);
  }

  return pending;
}

module.exports = { COLLECTION, listMigrations, parseArgs, pendingMigrations, runMigrations };

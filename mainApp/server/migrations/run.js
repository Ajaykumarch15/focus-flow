// IES-P0-17: migration runner CLI.
//
//   node migrations/run.js [--apply | --dry-run] [--db=<mongodb uri>]
//
// Refuses to run without an explicit flag, and refuses to APPLY in production
// without `--apply`. Never auto-applies on boot.
'use strict';

require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const { parseArgs, runMigrations, pendingMigrations } = require('./core');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function usage() {
  console.log(
    [
      'Usage: node migrations/run.js [--apply | --dry-run] [--db=<uri>]',
      '',
      '  --apply     apply pending migrations and record them',
      '  --dry-run   show pending migrations without applying',
      '',
      'Migrations only run when an explicit flag is given.',
    ].join('\n')
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.apply && !args.dryRun) {
    usage();
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && !args.apply) {
    console.error('Refusing to run migrations in production without --apply.');
    process.exit(1);
  }
  if (!args.db) {
    console.error('MONGODB_URI is not set and no --db provided.');
    process.exit(1);
  }

  await mongoose.connect(args.db);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const pending = await pendingMigrations({ db, migrationsDir: MIGRATIONS_DIR });
  if (pending.length === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`Pending migrations (${pending.length}):`);
    for (const name of pending) console.log(' -', name);
  }

  await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: args.dryRun });
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration run failed:', err);
  process.exit(1);
});

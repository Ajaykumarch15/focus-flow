// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { listMigrations, parseArgs, runMigrations, pendingMigrations } = require('../migrations/core');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations', 'migrations');

const silentLog = () => {};

function createFakeDb({ worklogIndexes = [] } = {}) {
  const schemaMigrations = { rows: [] };
  const worklogs = {
    indexList: [...worklogIndexes],
    indexes: () => Promise.resolve(worklogs.indexList),
    dropIndex: vi.fn(async (name) => {
      worklogs.indexList = worklogs.indexList.filter((i) => i.name !== name);
    }),
  };

  const collections = {
    schema_migrations: {
      find: () => ({ toArray: () => Promise.resolve(schemaMigrations.rows) }),
      insertOne: async (doc) => {
        schemaMigrations.rows.push(doc);
        return doc;
      },
    },
    worklogs,
  };

  return {
    db: { collection: (name) => collections[name] },
    schemaMigrations,
    worklogs,
  };
}

describe('IES-P0-17 · migration runner', () => {
  it('lists versioned migration files in sorted order', () => {
    const files = listMigrations(MIGRATIONS_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toBe('0001_drop_worklog_unique_index.js');
    expect(files.every((f) => /^\d{4}.*\.js$/.test(f))).toBe(true);
  });

  it('parses CLI flags and --db override', () => {
    expect(parseArgs([])).toMatchObject({ apply: false, dryRun: false });
    expect(parseArgs(['--apply'])).toMatchObject({ apply: true });
    expect(parseArgs(['--dry-run'])).toMatchObject({ dryRun: true });
    expect(parseArgs(['--db=mongodb://x']).db).toBe('mongodb://x');
  });

  it('dry-run lists pending migrations without applying them', async () => {
    const { db, schemaMigrations, worklogs } = createFakeDb({
      worklogIndexes: [{ name: 'userId_1_date_1' }],
    });

    const pending = await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: true, log: silentLog });

    expect(pending).toEqual(['0001_drop_worklog_unique_index.js']);
    expect(schemaMigrations.rows).toHaveLength(0);
    expect(worklogs.dropIndex).not.toHaveBeenCalled();
    expect(worklogs.indexList).toHaveLength(1);
  });

  it('applies a migration and records it in schema_migrations', async () => {
    const { db, schemaMigrations, worklogs } = createFakeDb({
      worklogIndexes: [{ name: 'userId_1_date_1' }],
    });

    const pending = await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });

    expect(pending).toEqual(['0001_drop_worklog_unique_index.js']);
    expect(schemaMigrations.rows.map((r) => r.name)).toEqual(['0001_drop_worklog_unique_index.js']);
    expect(worklogs.dropIndex).toHaveBeenCalledWith('userId_1_date_1');
    expect(worklogs.indexList).toHaveLength(0);
  });

  it('is idempotent — a second run has nothing pending', async () => {
    const { db, worklogs } = createFakeDb({ worklogIndexes: [{ name: 'userId_1_date_1' }] });

    await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });
    const secondRun = await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });

    expect(secondRun).toEqual([]);
    expect(worklogs.dropIndex).toHaveBeenCalledTimes(1);
  });

  it('0001 migration is a no-op when the index is already gone', async () => {
    const { db, worklogs } = createFakeDb({ worklogIndexes: [{ name: '_id_' }] });

    const migration = require(path.join(MIGRATIONS_DIR, '0001_drop_worklog_unique_index.js'));
    await migration.up({ db });

    expect(worklogs.dropIndex).not.toHaveBeenCalled();
  });
});

describe('IES-P0-17 · runner CLI guard', () => {
  const serverDir = path.join(__dirname, '..');

  function runCli(args, envOverrides = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['migrations/run.js', ...args], {
        cwd: serverDir,
        env: { ...process.env, ...envOverrides },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
  }

  it('refuses to run without an explicit flag', async () => {
    const { code, stdout } = await runCli([]);
    expect(code).toBe(1);
    expect(stdout).toContain('Usage:');
  });

  it('refuses to dry-run in production without --apply', async () => {
    const { code, stderr } = await runCli(['--dry-run'], { NODE_ENV: 'production' });
    expect(code).toBe(1);
    expect(stderr).toContain('Refusing to run migrations in production');
  });
});

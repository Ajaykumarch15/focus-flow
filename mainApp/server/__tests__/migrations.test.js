// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { listMigrations, parseArgs, runMigrations, pendingMigrations } = require('../migrations/core');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations', 'migrations');

const PENDING_ALL = [
  '0001_drop_worklog_unique_index.js',
  '0002_reconcile_worklog_totals.js',
  '0003_add_report_analytics_indexes.js',
  '0004_session_client_opid_unique.js',
  '0005_normalize_day_key_timezone.js',
  '0006_prune_worklog_arrays.js',
  '0007_project_name_key.js',
  '0008_ttl_activity_reportshare.js',
  '0009_fold_worklog_drift.js',
  '0010_create_sprint_feature_collections.js',
  '0011_task_collab_links.js',
];

const silentLog = () => {};

function createFakeDb({
  worklogIndexes = [],
  users = [],
  worklogs = [],
  sessions = [],
  habits = [],
  tasks = [],
  projects = [],
  projectIndexes = [],
  activityIndexes = [],
  sprintIndexes = [],
  featureIndexes = [],
} = {}) {
  const schemaMigrations = { rows: [] };
  const created = [];
  const makeIndexed = (name) => ({
    createIndex: vi.fn(async (spec, options = {}) => {
      created.push({ collection: name, spec, options });
      return options.name || 'index';
    }),
  });
  const makeIndexedWithState = (name, initial) => {
    const collection = {
      indexList: [...initial],
      indexes: () => Promise.resolve(collection.indexList),
      dropIndex: vi.fn(async (indexName) => {
        collection.indexList = collection.indexList.filter((i) => i.name !== indexName);
      }),
      ...makeIndexed(name),
    };
    return collection;
  };
  const worklogCollection = makeIndexedWithState('worklogs', worklogIndexes);
  worklogCollection.find = () => ({ toArray: () => Promise.resolve(worklogs) });
  worklogCollection.updateOne = vi.fn(async (filter, update) => ({ filter, update }));
  const projectsCollection = makeIndexedWithState('projects', projectIndexes);
  projectsCollection.find = () => ({ toArray: () => Promise.resolve(projects) });
  projectsCollection.updateOne = vi.fn(async (filter, update) => ({ filter, update }));
  const activitiesCollection = makeIndexedWithState('activities', activityIndexes);
  const sprintsCollection = makeIndexedWithState('sprints', sprintIndexes);
  const featuresCollection = makeIndexedWithState('features', featureIndexes);

  const collections = {
    schema_migrations: {
      find: () => ({ toArray: () => Promise.resolve(schemaMigrations.rows) }),
      insertOne: async (doc) => {
        schemaMigrations.rows.push(doc);
        return doc;
      },
    },
    users: {
      find: () => ({ toArray: () => Promise.resolve(users) }),
      ...makeIndexed('users'),
    },
    sessions: {
      find: () => ({ toArray: () => Promise.resolve(sessions) }),
      ...makeIndexed('sessions'),
    },
    worklogs: worklogCollection,
    tasks: {
      find: () => ({ toArray: () => Promise.resolve(tasks) }),
      updateOne: vi.fn(async (filter, update) => ({ filter, update })),
      updateMany: vi.fn(async (filter, update) => ({ filter, update, modifiedCount: 1 })),
      ...makeIndexed('tasks'),
    },
    habits: {
      find: () => ({ toArray: () => Promise.resolve(habits) }),
      updateOne: vi.fn(async (filter, update) => ({ filter, update })),
      ...makeIndexed('habits'),
    },
    journals: makeIndexed('journals'),
    projects: projectsCollection,
    activities: activitiesCollection,
    reportshares: makeIndexed('reportshares'),
    sprints: sprintsCollection,
    features: featuresCollection,
  };

  return {
    db: { collection: (name) => collections[name] },
    schemaMigrations,
    worklogs: worklogCollection,
    created,
  };
}

describe('IES-P0-17 · migration runner', () => {
  it('lists versioned migration files in sorted order', () => {
    const files = listMigrations(MIGRATIONS_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toBe('0001_drop_worklog_unique_index.js');
    expect(files[1]).toBe('0002_reconcile_worklog_totals.js');
    expect(files[2]).toBe('0003_add_report_analytics_indexes.js');
    expect(files[3]).toBe('0004_session_client_opid_unique.js');
    expect(files[4]).toBe('0005_normalize_day_key_timezone.js');
    expect(files[5]).toBe('0006_prune_worklog_arrays.js');
    expect(files[6]).toBe('0007_project_name_key.js');
    expect(files[7]).toBe('0008_ttl_activity_reportshare.js');
    expect(files[8]).toBe('0009_fold_worklog_drift.js');
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

    expect(pending).toEqual(PENDING_ALL);
    expect(schemaMigrations.rows).toHaveLength(0);
    expect(worklogs.dropIndex).not.toHaveBeenCalled();
    expect(worklogs.indexList).toHaveLength(1);
  });

  it('applies a migration and records it in schema_migrations', async () => {
    const { db, schemaMigrations, worklogs } = createFakeDb({
      worklogIndexes: [{ name: 'userId_1_date_1' }],
    });

    const pending = await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });

    expect(pending).toEqual(PENDING_ALL);
    expect(schemaMigrations.rows.map((r) => r.name)).toEqual(PENDING_ALL);
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

describe('IES-P1-04 · report/analytics index migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0003_add_report_analytics_indexes.js'));

  it('creates every hot-path compound index with the right spec and options', async () => {
    const { db, created } = createFakeDb();
    await migration.up({ db });

    expect(created.map((c) => `${c.collection}:${c.options.name}`)).toEqual([
      'sessions:userId_1_startTime_1_isActive_1',
      'sessions:userId_1_isActive_1_startTime_1',
      'worklogs:userId_1_taskRef_1',
      'worklogs:userId_1_workEntries.date_1',
      'tasks:userId_1_status_1',
      'tasks:userId_1_createdAt_1',
      'journals:userId_1_taskId_1_createdAt_1',
      'users:leaderboardOptIn_1_totalPoints_-1',
      'users:deletedAt_1',
    ]);

    const partial = created.find((c) => c.options.name === 'leaderboardOptIn_1_totalPoints_-1');
    expect(partial.options.partialFilterExpression).toEqual({
      leaderboardOptIn: true,
      deletedAt: null,
    });
  });

  it('schema declarations match the migration specs (no drift)', () => {
    const MODELS = {
      sessions: require('../models/Session'),
      worklogs: require('../models/WorkLog'),
      tasks: require('../models/Task'),
      journals: require('../models/Journal'),
      users: require('../models/User'),
    };

    for (const { collection, spec, options } of migration.INDEXES) {
      const found = MODELS[collection].schema.indexes().some(([key, opts]) =>
        JSON.stringify(key) === JSON.stringify(spec) &&
        JSON.stringify(opts.partialFilterExpression || null) ===
          JSON.stringify(options.partialFilterExpression || null)
      );
      expect(found, `${collection} is missing schema index ${JSON.stringify(spec)}`).toBe(true);
    }
  });

  it('is idempotent via the runner (applied once, recorded once)', async () => {
    const { db, created } = createFakeDb();
    await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });
    const secondRun = await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });

    expect(secondRun).toEqual([]);
    expect(created).toHaveLength(19);
  });
});

describe('IES-P1-05 · offline-replay opId dedupe migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0004_session_client_opid_unique.js'));

  it('creates the unique partial index with the right spec and options', async () => {
    const { db, created } = createFakeDb();
    await migration.up({ db });

    expect(created).toEqual([
      {
        collection: 'sessions',
        spec: { userId: 1, clientOpId: 1 },
        options: {
          name: 'userId_1_clientOpId_1',
          unique: true,
          partialFilterExpression: { clientOpId: { $exists: true } },
        },
      },
    ]);
  });

  it('schema declaration matches the migration spec (no drift)', () => {
    const Session = require('../models/Session');
    const { spec, options } = migration.INDEXES[0];
    const found = Session.schema.indexes().some(([key, opts]) =>
      JSON.stringify(key) === JSON.stringify(spec) &&
      JSON.stringify(opts.partialFilterExpression || null) ===
        JSON.stringify(options.partialFilterExpression || null) &&
      opts.unique === options.unique
    );
    expect(found, 'sessions schema is missing the (userId, clientOpId) unique index').toBe(true);
  });

  it('is included in the runner and idempotent (applied once, recorded once)', async () => {
    const { db, created } = createFakeDb();
    await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });
    const secondRun = await runMigrations({ db, migrationsDir: MIGRATIONS_DIR, dryRun: false, log: silentLog });

    expect(secondRun).toEqual([]);
    const opIdIndexes = created.filter((c) => c.options.name === 'userId_1_clientOpId_1');
    expect(opIdIndexes).toHaveLength(1);
  });
});

describe('IES-P1-06 · timezone day-key backfill migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0005_normalize_day_key_timezone.js'));
  const dates = require('../utils/dates');

  it('normalizes habit entry dates and task deadlines to the user-timezone midnight', async () => {
    const timeZone = 'Asia/Kolkata';
    const input = new Date('2026-07-10T00:00:00.000Z');
    const expected = dates.localDateToUtc(dates.dayKey(input.getTime(), timeZone), timeZone).getTime();

    const { db } = createFakeDb({
      users: [{ _id: 'u1', settings: { timezone: timeZone } }],
      habits: [{ _id: 'h1', userId: 'u1', entries: [{ _id: 'e1', date: input, minutes: 10 }] }],
      tasks: [{ _id: 't1', userId: 'u1', deadline: input }],
    });

    await migration.up({ db });

    const habitUpdate = await db.collection('habits').updateOne.mock.results[0].value;
    expect(habitUpdate.filter).toEqual({ _id: 'h1' });
    expect(habitUpdate.update.$set.entries[0].date.getTime()).toBe(expected);

    const taskUpdate = await db.collection('tasks').updateOne.mock.results[0].value;
    expect(taskUpdate.filter).toEqual({ _id: 't1' });
    expect(taskUpdate.update.$set.deadline.getTime()).toBe(expected);
  });

  it('re-encodes habit entries via the day they fall in (server-local midnight storage)', async () => {
    // Legacy habits were stored at SERVER-local midnight of day D. With the
    // server in the user's tz, the instant falls on day D there, so tzKey
    // round-trips without drift.
    const timeZone = 'Asia/Kolkata';
    const input = dates.localDateToUtc('2026-07-10', timeZone);
    const { db } = createFakeDb({
      users: [{ _id: 'u1', settings: { timezone: timeZone } }],
      habits: [{ _id: 'h1', userId: 'u1', entries: [{ _id: 'e1', date: input, minutes: 10 }] }],
    });

    await migration.up({ db });

    expect(db.collection('habits').updateOne).not.toHaveBeenCalled();
    expect(dates.dayKey(input.getTime(), timeZone)).toBe('2026-07-10');
  });

  it('preserves the picked calendar date for deadlines in negative-offset timezones', async () => {
    // Legacy deadlines encoded the picked date as UTC midnight. The UTC
    // calendar day IS the picked date, so it must survive in any timezone —
    // not drift a day early in negative-offset zones.
    const timeZone = 'America/New_York';
    const input = new Date('2026-07-10T00:00:00.000Z');

    const { db } = createFakeDb({
      users: [{ _id: 'u1', settings: { timezone: timeZone } }],
      tasks: [{ _id: 't1', userId: 'u1', deadline: input }],
    });

    await migration.up({ db });

    const { update } = await db.collection('tasks').updateOne.mock.results[0].value;
    expect(dates.dayKey(update.$set.deadline.getTime(), timeZone)).toBe('2026-07-10');
    expect(update.$set.deadline.getTime()).toBe(dates.localDateToUtc('2026-07-10', timeZone).getTime());
  });

  it('is a no-op when entries/deadlines already use the correct encoding', async () => {
    const ist = 'Asia/Kolkata';
    // Habit entry already at user-tz midnight (tzKey encoding round-trips).
    const legacyHabit = dates.localDateToUtc('2026-07-10', ist);
    // Task deadline already at the picked date's instant for a UTC-default user
    // (UTC midnight of the picked date IS the legacy/new encoding).
    const legacyUtcDeadline = new Date('2026-07-10T00:00:00.000Z');

    const { db } = createFakeDb({
      users: [
        { _id: 'u1', settings: { timezone: ist } },
        { _id: 'u2', settings: {} },
      ],
      habits: [{ _id: 'h1', userId: 'u1', entries: [{ _id: 'e1', date: legacyHabit, minutes: 10 }] }],
      tasks: [{ _id: 't1', userId: 'u2', deadline: legacyUtcDeadline }],
    });

    await migration.up({ db });

    expect(db.collection('habits').updateOne).not.toHaveBeenCalled();
    expect(db.collection('tasks').updateOne).not.toHaveBeenCalled();
  });

  it('defaults missing timezones to UTC', async () => {
    const input = new Date('2026-07-10T12:00:00.000Z'); // midday — needs normalizing to UTC midnight
    const expected = dates.localDateToUtc(dates.dayKey(input.getTime(), 'UTC'), 'UTC').getTime();

    const { db } = createFakeDb({
      users: [{ _id: 'u1', settings: {} }],
      tasks: [{ _id: 't1', userId: 'u1', deadline: input }],
    });

    await migration.up({ db });

    const taskUpdate = await db.collection('tasks').updateOne.mock.results[0].value;
    expect(taskUpdate.update.$set.deadline.getTime()).toBe(expected);
  });
});

describe('IES-P1-10 · worklog array cap backfill migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0006_prune_worklog_arrays.js'));

  it('trims oversized arrays to their caps, keeping the newest items', async () => {
    const { db } = createFakeDb({
      worklogs: [
        {
          _id: 'wl1',
          timelineEntries: Array.from({ length: 600 }, (_, i) => ({ title: `t${i}` })),
          completedItems: Array.from({ length: 2500 }, (_, i) => ({ text: `c${i}` })),
        },
      ],
    });

    const result = await migration.up({ db });
    expect(result).toEqual({ pruned: 1 });

    const { update } = await db.collection('worklogs').updateOne.mock.results[0].value;
    const { ARRAY_CAPS } = require('../utils/worklogLimits');
    expect(update.$set.timelineEntries).toHaveLength(ARRAY_CAPS.timelineEntries);
    expect(update.$set.completedItems).toHaveLength(ARRAY_CAPS.completedItems);
    // Newest kept: last element of the trimmed arrays matches the last pushed.
    expect(update.$set.timelineEntries[ARRAY_CAPS.timelineEntries - 1].title).toBe('t599');
    expect(update.$set.completedItems[ARRAY_CAPS.completedItems - 1].text).toBe('c2499');
  });

  it('recomputes totalActiveMs when workEntries are trimmed', async () => {
    const { db } = createFakeDb({
      worklogs: [
        {
          _id: 'wl1',
          workEntries: Array.from({ length: 4000 }, (_, i) => ({ date: new Date(), activeMs: 60_000 })),
          totalActiveMs: 999_999_999,
        },
      ],
    });

    await migration.up({ db });

    const { update } = await db.collection('worklogs').updateOne.mock.results[0].value;
    const { ARRAY_CAPS } = require('../utils/worklogLimits');
    expect(update.$set.workEntries).toHaveLength(ARRAY_CAPS.workEntries);
    expect(update.$set.totalActiveMs).toBe(ARRAY_CAPS.workEntries * 60_000);
  });

  it('is a no-op (nothing written) when every array is already within its cap', async () => {
    const { db } = createFakeDb({
      worklogs: [
        {
          _id: 'wl1',
          timelineEntries: [{ title: 'a' }, { title: 'b' }],
          workEntries: [{ date: new Date(), activeMs: 1000 }],
          totalActiveMs: 1000,
        },
      ],
    });

    const result = await migration.up({ db });
    expect(result).toEqual({ pruned: 0 });
    expect(db.collection('worklogs').updateOne).not.toHaveBeenCalled();
  });
});

describe('IES-P1-12 · project nameKey uniqueness migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0007_project_name_key.js'));

  it('backfills missing nameKey, drops the old case-sensitive index, and creates the unique index', async () => {
    const { db, created } = createFakeDb({
      projects: [
        { _id: 'p1', name: '  Alpha API ' },
        { _id: 'p2', name: 'Beta', nameKey: 'beta' },
      ],
      projectIndexes: [{ name: 'userId_1_name_1' }],
    });

    await migration.up({ db });

    const updates = await Promise.all(
      db.collection('projects').updateOne.mock.results.map((r) => r.value)
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].filter).toEqual({ _id: 'p1' });
    expect(updates[0].update.$set.nameKey).toBe('alpha api');
    expect(updates.some((u) => u.filter._id === 'p2')).toBe(false);

    expect(db.collection('projects').dropIndex).toHaveBeenCalledWith('userId_1_name_1');
    expect(created).toEqual([
      {
        collection: 'projects',
        spec: { userId: 1, nameKey: 1 },
        options: { unique: true, name: 'userId_1_nameKey_1' },
      },
    ]);
  });

  it('is a no-op when every project already has nameKey and the old index is gone', async () => {
    const { db, created } = createFakeDb({
      projects: [{ _id: 'p1', name: 'Foo', nameKey: 'foo' }],
    });

    await migration.up({ db });

    expect(db.collection('projects').updateOne).not.toHaveBeenCalled();
    expect(db.collection('projects').dropIndex).not.toHaveBeenCalled();
    expect(created).toHaveLength(1);
  });
});

describe('IES-P1-13 · Activity/ReportShare TTL retention migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0008_ttl_activity_reportshare.js'));

  it('drops the legacy createdAt_-1 index and creates both TTL indexes', async () => {
    const { db, created } = createFakeDb({ activityIndexes: [{ name: 'createdAt_-1' }] });

    await migration.up({ db });

    expect(db.collection('activities').dropIndex).toHaveBeenCalledWith('createdAt_-1');
    expect(created).toEqual([
      { collection: 'activities', spec: { createdAt: 1 }, options: { expireAfterSeconds: migration.ACTIVITY_TTL_SECONDS } },
      { collection: 'reportshares', spec: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    ]);
  });

  it('leaves the legacy index alone when it is already absent', async () => {
    const { db, created } = createFakeDb();

    await migration.up({ db });

    expect(db.collection('activities').dropIndex).not.toHaveBeenCalled();
    expect(created).toHaveLength(2);
  });

  it('schema declarations match the migration specs (no drift)', () => {
    const Activity = require('../models/Activity');
    const ReportShare = require('../models/ReportShare');

    expect(Activity.ACTIVITY_TTL_SECONDS).toBe(migration.ACTIVITY_TTL_SECONDS);

    const activityFound = Activity.schema.indexes().some(
      ([key, opts]) =>
        JSON.stringify(key) === JSON.stringify({ createdAt: 1 }) &&
        opts.expireAfterSeconds === migration.ACTIVITY_TTL_SECONDS
    );
    expect(activityFound, 'Activity is missing the createdAt TTL index').toBe(true);

    const reportShareFound = ReportShare.schema.indexes().some(
      ([key, opts]) =>
        JSON.stringify(key) === JSON.stringify({ expiresAt: 1 }) && opts.expireAfterSeconds === 0
    );
    expect(reportShareFound, 'ReportShare is missing the expiresAt TTL index').toBe(true);
  });
});

describe('IES-P1-27 · worklog drift fold migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0009_fold_worklog_drift.js'));

  it('folds a legacy top-level problem into problemFlow.problem and unsets it', async () => {
    const { db } = createFakeDb({
      worklogs: [
        { _id: 'wl1', problem: 'legacy bug', problemFlow: { problem: '' } },
        { _id: 'wl2', problem: 'ignored', problemFlow: { problem: 'real problem' } },
      ],
    });

    const result = await migration.up({ db });
    expect(result).toEqual({ folded: 2 });

    const updates = await Promise.all(db.collection('worklogs').updateOne.mock.results.map((r) => r.value));
    const wl1 = updates.find((u) => u.filter._id === 'wl1');
    const wl2 = updates.find((u) => u.filter._id === 'wl2');
    expect(wl1.update.$set['problemFlow.problem']).toBe('legacy bug');
    expect(wl1.update.$unset.problem).toBe('');
    // Existing problemFlow.problem wins — legacy `problem` is only dropped.
    expect(wl2.update.$set).toBeUndefined();
    expect(wl2.update.$unset.problem).toBe('');
  });

  it('folds legacy taskId/projectId into taskRef/projectRef and unsets the ids', async () => {
    const { db } = createFakeDb({
      worklogs: [
        { _id: 'wl1', taskId: 't1', projectId: 'p1' },
        { _id: 'wl2', taskId: 't-old', taskRef: 't-canon' },
      ],
    });

    await migration.up({ db });

    const updates = await Promise.all(db.collection('worklogs').updateOne.mock.results.map((r) => r.value));
    const wl1 = updates.find((u) => u.filter._id === 'wl1');
    const wl2 = updates.find((u) => u.filter._id === 'wl2');
    expect(wl1.update.$set).toEqual({ taskRef: 't1', projectRef: 'p1' });
    expect(wl1.update.$unset).toEqual({ taskId: '', projectId: '' });
    // Canonical ref wins; legacy id dropped without overwriting.
    expect(wl2.update.$set).toBeUndefined();
    expect(wl2.update.$unset).toEqual({ taskId: '' });
  });

  it('re-encodes Date-typed closedAt/reopenedAt as epoch-ms numbers', async () => {
    const closedAt = new Date('2026-07-15T10:00:00.000Z');
    const reopenedAt = new Date('2026-07-16T09:30:00.000Z');
    const { db } = createFakeDb({
      worklogs: [{ _id: 'wl1', closedAt, reopenedAt }],
    });

    await migration.up({ db });

    const { update } = await db.collection('worklogs').updateOne.mock.results[0].value;
    expect(update.$set.closedAt).toBe(closedAt.getTime());
    expect(update.$set.reopenedAt).toBe(reopenedAt.getTime());
  });

  it('leaves already-epoch-ms timestamps untouched', async () => {
    const { db } = createFakeDb({
      worklogs: [{ _id: 'wl1', closedAt: 1_000_000, reopenedAt: null }],
    });

    await migration.up({ db });

    expect(db.collection('worklogs').updateOne).not.toHaveBeenCalled();
  });

  it('is a no-op on clean docs and idempotent across a re-run', async () => {
    const { db, worklogs } = createFakeDb({
      worklogs: [
        {
          _id: 'wl1',
          problemFlow: { problem: 'clean' },
          taskRef: 't1',
          projectRef: 'p1',
          closedAt: 1_000_000,
          reopenedAt: null,
        },
      ],
    });

    const first = await migration.up({ db });
    expect(first).toEqual({ folded: 0 });
    expect(worklogs.updateOne).not.toHaveBeenCalled();

    const second = await migration.up({ db });
    expect(second).toEqual({ folded: 0 });
    expect(worklogs.updateOne).not.toHaveBeenCalled();
  });
});

describe('IES-R1 · sprint/feature collection migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0010_create_sprint_feature_collections.js'));

  it('creates every sprint/feature index in the right collections', async () => {
    const { db, created } = createFakeDb();
    await migration.up({ db });

    expect(created.map((c) => `${c.collection}:${c.options.name}`)).toEqual([
      'sprints:projectRef_1_startDate_-1',
      'sprints:workspaceRef_1_status_1',
      'features:projectRef_1_order_1',
      'features:sprintRef_1_status_1',
      'features:workspaceRef_1',
      'features:type_1',
    ]);
  });

  it('schema declarations match the migration specs (no drift)', () => {
    const MODELS = {
      sprints: require('../models/Sprint'),
      features: require('../models/Feature'),
    };

    for (const { collection, spec } of migration.INDEXES) {
      const found = MODELS[collection].schema.indexes().some(
        ([key]) => JSON.stringify(key) === JSON.stringify(spec)
      );
      expect(found, `${collection} is missing schema index ${JSON.stringify(spec)}`).toBe(true);
    }
  });

  it('skips indexes that already exist (idempotent guard)', async () => {
    const { db, created } = createFakeDb({
      sprintIndexes: [
        { name: 'projectRef_1_startDate_-1' },
        { name: 'workspaceRef_1_status_1' },
      ],
      featureIndexes: [
        { name: 'projectRef_1_order_1' },
        { name: 'sprintRef_1_status_1' },
        { name: 'workspaceRef_1' },
        { name: 'type_1' },
      ],
    });

    await migration.up({ db });
    expect(created).toHaveLength(0);
  });
});

describe('IES-R1 · task collaboration backfill migration', () => {
  const migration = require(path.join(MIGRATIONS_DIR, '0011_task_collab_links.js'));

  it('backfills collab defaults only onto legacy tasks missing workspaceRef', async () => {
    const { db } = createFakeDb();
    await migration.up({ db });

    const [filter, update] = db.collection('tasks').updateMany.mock.calls[0];
    expect(filter).toEqual({ workspaceRef: { $exists: false } });
    expect(update.$set).toEqual(migration.DEFAULTS);
    expect(update.$set.workspaceRef).toBeNull();
    expect(update.$set.sprintStatus).toBe('backlog');
  });

  it('reports the driver modified count', async () => {
    const { db } = createFakeDb();
    const result = await migration.up({ db });
    expect(result).toEqual({ modifiedCount: 1 });
  });

  it('defaults match the Task model schema (no drift)', () => {
    const Task = require('../models/Task');
    const schemaDefaults = {
      workspaceRef: Task.schema.path('workspaceRef').defaultValue,
      projectRef: Task.schema.path('projectRef').defaultValue,
      sprintRef: Task.schema.path('sprintRef').defaultValue,
      featureRef: Task.schema.path('featureRef').defaultValue,
      sprintStatus: Task.schema.path('sprintStatus').defaultValue,
    };
    for (const [field, value] of Object.entries(schemaDefaults)) {
      expect(migration.DEFAULTS[field], `${field} drifted from the model default`).toBe(value);
    }
  });
});

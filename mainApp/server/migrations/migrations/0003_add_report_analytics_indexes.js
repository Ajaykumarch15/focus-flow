// IES-P1-04: compound indexes for hot report/analytics paths (DB-4/5/6/20/21, BE-22).
//
// The model schemas declare these same indexes so mongoose autoIndex builds
// them in dev/test; this migration guarantees them in production, where index
// builds are controlled by the migration runner (low-traffic window) instead
// of process boot. `createIndex` is idempotent — re-running is a no-op when an
// index with the same name already exists.
'use strict';

const INDEXES = [
  // Session — day/week report range scans (reports.js), "active now" and
  // orphan-sweep lookups (sessions.js), admin analytics (admin.js).
  { collection: 'sessions', spec: { userId: 1, startTime: 1, isActive: 1 }, options: { name: 'userId_1_startTime_1_isActive_1' } },
  { collection: 'sessions', spec: { userId: 1, isActive: 1, startTime: 1 }, options: { name: 'userId_1_isActive_1_startTime_1' } },
  // WorkLog — session-stop lookups (sessions.js, worklogSync) and per-day
  // `workEntries.date` range reports (reports.js). Multikey on the array field.
  { collection: 'worklogs', spec: { userId: 1, taskRef: 1 }, options: { name: 'userId_1_taskRef_1' } },
  { collection: 'worklogs', spec: { userId: 1, 'workEntries.date': 1 }, options: { name: 'userId_1_workEntries.date_1' } },
  // Task — user-scoped lists (tasks.js) and admin analytics aggregations.
  { collection: 'tasks', spec: { userId: 1, status: 1 }, options: { name: 'userId_1_status_1' } },
  { collection: 'tasks', spec: { userId: 1, createdAt: 1 }, options: { name: 'userId_1_createdAt_1' } },
  // Journal — user/task listing (journals.js).
  { collection: 'journals', spec: { userId: 1, taskId: 1, createdAt: 1 }, options: { name: 'userId_1_taskId_1_createdAt_1' } },
  // User — leaderboard scoped to opted-in, non-deleted users (reports.js).
  {
    collection: 'users',
    spec: { leaderboardOptIn: 1, totalPoints: -1 },
    options: {
      name: 'leaderboardOptIn_1_totalPoints_-1',
      partialFilterExpression: { leaderboardOptIn: true, deletedAt: null },
    },
  },
  // User — soft-delete list queries (admin.js). Single-field index already
  // declared on the schema; ensured here so production never relies on autoIndex.
  { collection: 'users', spec: { deletedAt: 1 }, options: { name: 'deletedAt_1' } },
];

module.exports = {
  async up({ db }) {
    for (const { collection, spec, options } of INDEXES) {
      await db.collection(collection).createIndex(spec, options);
    }
  },
  INDEXES,
};

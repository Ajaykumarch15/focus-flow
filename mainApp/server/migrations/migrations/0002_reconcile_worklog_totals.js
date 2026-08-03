// IES-P1-02 / IES-P1-08: reconcile historical WorkLog workEntries/totalActiveMs.
//
// Before the unified sync, worklog totals were maintained by two divergent
// implementations (`syncSessionToWorkLogs` + `syncWorkEntries`) that grouped by
// different day boundaries and double-counted across timezones, so stored
// `totalActiveMs` drifted. This migration recomputes every linked worklog's
// entries from its task's sessions using the owner's timezone.
//
// - Logs without a taskRef cannot be derived and are left untouched.
// - Days with no session time are dropped (sessions are the single source of
//   truth); surviving days keep any user-authored `what` text.
// - Idempotent: re-running on an already-reconciled log yields the same totals.
'use strict';

const { applyEffectiveWorkEntries } = require('../../utils/worklogSyncCore');

// Native-driver ObjectIds pass through untouched; strings are left as-is.
function toObjectId(value) {
  if (value && typeof value === 'object' && /^[0-9a-f]{24}$/i.test(String(value))) return value;
  return value;
}

module.exports = {
  async up({ db }) {
    const users = await db
      .collection('users')
      .find({}, { projection: { _id: 1, settings: 1 } })
      .toArray();
    const timezoneByUser = new Map(
      users.map((u) => [u._id.toString(), u.settings?.timezone || 'UTC'])
    );

    const worklogs = await db.collection('worklogs').find({ taskRef: { $ne: null } }).toArray();
    if (worklogs.length === 0) return;

    // Group logs by (userId, taskId) so each task's sessions load once.
    const groups = new Map();
    for (const log of worklogs) {
      const key = `${log.userId.toString()}:${log.taskRef.toString()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(log);
    }

    const now = Date.now();
    for (const [key, logs] of groups.entries()) {
      const [userId, taskId] = key.split(':');
      const sessions = await db
        .collection('sessions')
        .find({ userId: toObjectId(userId), taskId: toObjectId(taskId) })
        .toArray();

      for (const log of logs) {
        const timeZone = timezoneByUser.get(log.userId.toString()) || 'UTC';
        const { workEntries, totalActiveMs } = applyEffectiveWorkEntries(log, sessions, timeZone, now);
        await db.collection('worklogs').updateOne(
          { _id: log._id },
          { $set: { workEntries, totalActiveMs } }
        );
      }
    }
  },
};

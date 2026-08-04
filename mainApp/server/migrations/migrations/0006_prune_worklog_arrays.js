// IES-P1-10: prune WorkLog arrays that exceeded their caps.
//
// Before P1-10, WorkLog documents held unbounded embedded arrays
// (`timelineEntries` grew by ~4 entries per focus session, `completedItems`,
// `workEntries`, etc.). Existing documents that already exceeded a cap are
// trimmed to keep the NEWEST N items so no document can sit near Mongo's
// 16 MB ceiling. `workEntries` is the only array whose value feeds the cached
// `totalActiveMs`, so when it is trimmed the total is recomputed from the
// surviving entries to stay consistent with the IES-P1-08 pre-save hook.
//
// Idempotent: re-running on already-pruned documents is a no-op (nothing is
// written).
'use strict';

const { pruneWorkLogArrays } = require('../../utils/worklogLimits');

module.exports = {
  async up({ db }) {
    const worklogs = db.collection('worklogs');
    const logs = await worklogs.find({}).toArray();
    let pruned = 0;

    for (const log of logs) {
      const changed = pruneWorkLogArrays(log);
      if (changed.length === 0) continue;

      const set = {};
      for (const field of changed) set[field] = log[field];
      if (changed.includes('workEntries')) {
        set.totalActiveMs = (log.workEntries || []).reduce((sum, e) => sum + (e.activeMs || 0), 0);
      }
      await worklogs.updateOne({ _id: log._id }, { $set: set });
      pruned += 1;
    }

    return { pruned };
  },
};

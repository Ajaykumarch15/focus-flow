// IES-P1-27: fold remaining naming/type drift on worklogs.
//
// Before P1-27 a WorkLog could carry BOTH a legacy top-level `problem` string
// and the structured `problemFlow.problem` (DB-25), `closedAt`/`reopenedAt`
// were stored as BSON Dates while every other timestamp on the doc is epoch-ms
// (DB-30), and legacy docs could hold `taskId`/`projectId` next to the
// canonical `taskRef`/`projectRef`.
//
// This migration:
//   - folds any non-empty top-level `problem` into `problemFlow.problem`
//     (preferring an existing `problemFlow.problem`), then unsets `problem`,
//   - folds `taskId` -> `taskRef` and `projectId` -> `projectRef` (preferring
//     the canonical ref), then unsets the legacy ids,
//   - re-encodes Date-typed `closedAt`/`reopenedAt` as epoch-ms numbers.
//
// Idempotent: a second run finds no legacy fields/dates and writes nothing.
'use strict';

// Returns the epoch-ms value only when the stored value is a Date (the legacy
// drift); already-epoch-ms numbers (or anything else) are left untouched.
function normalizeMs(value) {
  if (value == null) return undefined;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

module.exports = {
  async up({ db }) {
    const worklogs = await db.collection('worklogs').find({}).toArray();
    let folded = 0;

    for (const log of worklogs) {
      const set = {};
      const unset = {};
      let changed = false;

      const flowProblem = log.problemFlow?.problem;
      if (Object.prototype.hasOwnProperty.call(log, 'problem')) {
        if (!flowProblem && typeof log.problem === 'string' && log.problem.trim()) {
          set['problemFlow.problem'] = log.problem;
        }
        unset.problem = '';
        changed = true;
      }

      for (const [legacy, canonical] of [['taskId', 'taskRef'], ['projectId', 'projectRef']]) {
        if (Object.prototype.hasOwnProperty.call(log, legacy)) {
          if (!log[canonical] && log[legacy]) set[canonical] = log[legacy];
          unset[legacy] = '';
          changed = true;
        }
      }

      for (const field of ['closedAt', 'reopenedAt']) {
        const ms = normalizeMs(log[field]);
        if (ms !== undefined) {
          set[field] = ms;
          changed = true;
        }
      }

      if (changed) {
        const update = {};
        if (Object.keys(set).length) update.$set = set;
        if (Object.keys(unset).length) update.$unset = unset;
        await db.collection('worklogs').updateOne({ _id: log._id }, update);
        folded += 1;
      }
    }

    return { folded };
  },
};

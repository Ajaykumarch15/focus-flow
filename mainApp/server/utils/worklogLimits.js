// IES-P1-10: bounded array caps for WorkLog documents.
//
// WorkLog used to hold 8 unbounded embedded arrays that grew with every timer
// event, manual entry, and link — the `timelineEntries` array alone grows by 4
// entries per focus session (start/pause/resume/stop). Left unchecked a long-
// running log drifts toward Mongo's 16 MB document ceiling and list responses
// carry the whole history.
//
// Every capped array is pruned to keep the NEWEST N items (the current work is
// what the UI surfaces; history lives in the Sessions collection). This module
// is pure (no mongoose) so both the model pre-save hook and the migration can
// share one definition of the caps — one source of truth for the budget.
//
// IES-P1-11: `$push` routes bypass mongoose hooks, so routes enforce the same
// budget atomically with `$push: { $each: [...], $slice: -CAP }` — a single
// write that can never exceed the cap even without running validators.
'use strict';

const ARRAY_CAPS = {
  // Auto-generated from timer events (the heaviest array — one per event).
  timelineEntries: 500,
  // One entry per calendar day with active time (10 years of daily work).
  workEntries: 3650,
  // User-added "done" items.
  completedItems: 2000,
  decisions: 500,
  blockerList: 200,
  progressSnapshots: 500,
  links: 500,
  attachments: 200,
  tags: 100,
};

const GIT_COMMIT_IDS_CAP = 100;
const TOMORROW_UNFINISHED_CAP = 100;

/**
 * Prune every capped array on a WorkLog document (or plain object) to its cap,
 * keeping the newest items. Mutates `doc` in place.
 * @param {object} doc
 * @returns {string[]} the field paths that were trimmed (empty when unchanged)
 */
function pruneWorkLogArrays(doc) {
  const changed = [];
  for (const [field, cap] of Object.entries(ARRAY_CAPS)) {
    const arr = doc[field];
    if (Array.isArray(arr) && arr.length > cap) {
      doc[field] = arr.slice(-cap);
      changed.push(field);
    }
  }
  if (Array.isArray(doc.gitRef?.commitIds) && doc.gitRef.commitIds.length > GIT_COMMIT_IDS_CAP) {
    doc.gitRef.commitIds = doc.gitRef.commitIds.slice(-GIT_COMMIT_IDS_CAP);
    changed.push('gitRef.commitIds');
  }
  if (
    Array.isArray(doc.tomorrowPlan?.unfinishedItems) &&
    doc.tomorrowPlan.unfinishedItems.length > TOMORROW_UNFINISHED_CAP
  ) {
    doc.tomorrowPlan.unfinishedItems = doc.tomorrowPlan.unfinishedItems.slice(-TOMORROW_UNFINISHED_CAP);
    changed.push('tomorrowPlan.unfinishedItems');
  }
  return changed;
}

module.exports = {
  ARRAY_CAPS,
  GIT_COMMIT_IDS_CAP,
  TOMORROW_UNFINISHED_CAP,
  pruneWorkLogArrays,
};

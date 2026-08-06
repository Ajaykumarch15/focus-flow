// EEP2-P4.1.1 / EEP2-P4.1.3 (DDS §4.11): extend the Sprint collection for the
// sprint lifecycle.
//   • normalize legacy `future` status → `draft` — the new lifecycle
//     vocabulary is draft → planned → active → completed
//     (utils/sprintState.js).
//   • create the (projectRef, status, startDate) lookup index that powers
//     "current/active sprint per project" and status-filtered planning lists.
// Idempotent: updateMany only touches docs still at `future`; createIndex is
// guarded on the existing-index list (mirrors migration 0012).
'use strict';

const INDEX = {
  collection: 'sprints',
  spec: { projectRef: 1, status: 1, startDate: -1 },
  name: 'projectRef_1_status_1_startDate_-1',
};

module.exports = {
  async up({ db }) {
    const sprints = db.collection('sprints');
    const result = await sprints.updateMany({ status: 'future' }, { $set: { status: 'draft' } });
    const existing = await sprints.indexes();
    if (existing.some((idx) => idx.name === INDEX.name)) {
      return { normalized: result.modifiedCount || 0, created: 0 };
    }
    await sprints.createIndex(INDEX.spec, { name: INDEX.name });
    return { normalized: result.modifiedCount || 0, created: 1 };
  },
  INDEX,
};

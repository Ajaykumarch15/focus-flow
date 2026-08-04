// IES-R1 (R1-P3): backfill every legacy personal task with the collaboration
// link defaults so the new Task schema fields are present and the
// `{ userId, workspaceRef: null }` personal-task query can rely on them.
// Only docs missing `workspaceRef` are touched (already-migrated docs are
// skipped), so a re-run is a no-op. Matches plan §4 migration 0011.
'use strict';

const DEFAULTS = {
  workspaceRef: null,
  projectRef: null,
  sprintRef: null,
  featureRef: null,
  sprintStatus: 'backlog',
  labels: [],
  dependencies: [],
  followerIds: [],
  estimatedHours: 0,
  actualHours: 0,
};

module.exports = {
  async up({ db }) {
    const result = await db
      .collection('tasks')
      .updateMany({ workspaceRef: { $exists: false } }, { $set: DEFAULTS });
    return { modifiedCount: result.modifiedCount ?? result.n };
  },
  DEFAULTS,
};

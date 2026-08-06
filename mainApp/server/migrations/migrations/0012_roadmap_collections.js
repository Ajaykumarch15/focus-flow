// EEP2-P3.1.4 / DDS §4.5-4.7: create the `milestones`, `phases` and `modules`
// collections (via `createIndex`, which auto-creates the collection) so the
// Roadmap spine has its backing stores, plus the `features.moduleRef` lookup
// index. Index specs mirror the Milestone/Phase/Module/Feature model
// declarations exactly. `createIndex` is idempotent; each index is additionally
// guarded on the existing-index list so a re-run writes nothing extra.
'use strict';

const INDEXES = [
  { collection: 'milestones', spec: { projectRef: 1, order: 1, targetDate: 1 }, name: 'projectRef_1_order_1_targetDate_1' },
  { collection: 'milestones', spec: { workspaceRef: 1 },                       name: 'workspaceRef_1' },
  { collection: 'phases',     spec: { milestoneRef: 1, order: 1 },             name: 'milestoneRef_1_order_1' },
  { collection: 'phases',     spec: { projectRef: 1 },                         name: 'projectRef_1' },
  { collection: 'phases',     spec: { workspaceRef: 1 },                       name: 'workspaceRef_1' },
  { collection: 'modules',    spec: { phaseRef: 1, order: 1 },                 name: 'phaseRef_1_order_1' },
  { collection: 'modules',    spec: { projectRef: 1 },                         name: 'projectRef_1' },
  { collection: 'modules',    spec: { workspaceRef: 1 },                       name: 'workspaceRef_1' },
  { collection: 'features',   spec: { moduleRef: 1 },                          name: 'moduleRef_1' },
];

module.exports = {
  async up({ db }) {
    let created = 0;
    for (const { collection, spec, name } of INDEXES) {
      const coll = db.collection(collection);
      const existing = await coll.indexes();
      if (existing.some((idx) => idx.name === name)) continue;
      await coll.createIndex(spec, { name });
      created += 1;
    }
    return { created };
  },
  INDEXES,
};

// IES-R1 (R1-P2): create the `sprints` and `features` collections (via
// `createIndex`, which auto-creates the collection) so Recommendation 1 has its
// backing stores. Index specs mirror the Sprint/Feature model declarations
// exactly. `createIndex` is idempotent; each index is additionally guarded on
// the existing-index list so a re-run writes nothing extra.
'use strict';

const INDEXES = [
  { collection: 'sprints',  spec: { projectRef: 1, startDate: -1 }, name: 'projectRef_1_startDate_-1' },
  { collection: 'sprints',  spec: { workspaceRef: 1, status: 1 },   name: 'workspaceRef_1_status_1' },
  { collection: 'features', spec: { projectRef: 1, order: 1 },      name: 'projectRef_1_order_1' },
  { collection: 'features', spec: { sprintRef: 1, status: 1 },      name: 'sprintRef_1_status_1' },
  { collection: 'features', spec: { workspaceRef: 1 },              name: 'workspaceRef_1' },
  { collection: 'features', spec: { type: 1 },                      name: 'type_1' },
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

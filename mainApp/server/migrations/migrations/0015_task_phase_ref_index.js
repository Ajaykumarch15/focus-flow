// B2 (Basic Roadmap V1): complete the personal-roadmap task-link indexes.
// `roadmapRef` and `milestoneRef` were indexed when the feature shipped, but
// `phaseRef` was not despite phase-scoped queries filtering on it. Index specs
// mirror the Task model declarations exactly. Idempotent: guarded on the
// existing-index list so a re-run writes nothing extra.
'use strict';

const INDEXES = [
  { collection: 'tasks', spec: { userId: 1, phaseRef: 1 }, name: 'userId_1_phaseRef_1' },
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

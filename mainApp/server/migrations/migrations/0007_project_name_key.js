// IES-P1-12 (DB-24, BE-34): case-insensitive unique project names per user.
//
// Projects previously used a case-sensitive unique index `{ userId: 1, name: 1 }`
// while the route de-duplicated with a case-insensitive `$regex` — so the DB
// could not stop "Foo"/"foo" races. This migration:
//   1. Backfills `nameKey = lowercase(name)` for existing docs (idempotent).
//   2. Drops the old case-sensitive unique index.
//   3. Creates the unique `{ userId: 1, nameKey: 1 }` index that blocks
//      duplicates for any casing.
'use strict';

const INDEX_NAME = 'userId_1_nameKey_1';
const OLD_INDEX_NAME = 'userId_1_name_1';

module.exports = {
  async up({ db }) {
    const projects = db.collection('projects');

    const docs = await projects.find().toArray();
    for (const doc of docs) {
      if (doc.nameKey) continue;
      await projects.updateOne(
        { _id: doc._id },
        { $set: { nameKey: String(doc.name == null ? '' : doc.name).trim().toLowerCase() } }
      );
    }

    const indexes = await projects.indexes();
    if (indexes.some((idx) => idx.name === OLD_INDEX_NAME)) {
      await projects.dropIndex(OLD_INDEX_NAME);
    }

    await projects.createIndex({ userId: 1, nameKey: 1 }, { unique: true, name: INDEX_NAME });
  },
  INDEX_NAME,
  OLD_INDEX_NAME,
};

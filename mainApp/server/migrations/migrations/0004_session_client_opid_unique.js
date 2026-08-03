// IES-P1-05: unique (userId, clientOpId) partial index for idempotent offline
// replays (DB-20, CM-2/3/4). The offline queue tags every timer op with a
// client-generated `opId`; a replayed START must never create a second session,
// even under concurrent replays from multiple tabs. `clientOpId` is only stored
// on sessions created through the queue, so the index is partial (sparse in the
// schema) to leave ordinary interactive sessions untouched.
//
// The model schema declares this same index so mongoose autoIndex builds it in
// dev/test; this migration guarantees it in production. `createIndex` with the
// same name is idempotent.
'use strict';

const INDEXES = [
  {
    collection: 'sessions',
    spec: { userId: 1, clientOpId: 1 },
    options: {
      name: 'userId_1_clientOpId_1',
      unique: true,
      partialFilterExpression: { clientOpId: { $exists: true } },
    },
  },
];

module.exports = {
  async up({ db }) {
    for (const { collection, spec, options } of INDEXES) {
      await db.collection(collection).createIndex(spec, options);
    }
  },
  INDEXES,
};

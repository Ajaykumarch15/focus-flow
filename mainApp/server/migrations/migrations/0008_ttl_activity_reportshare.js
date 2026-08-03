// IES-P1-13 (DB-17, DB-18): TTL/retention for Activity and ReportShare.
//
//   activities   — TTL on `createdAt`, 90-day retention (DB-17).
//   reportshares — TTL on `expiresAt` with expireAfterSeconds:0, so every
//                  share (all have a bounded expiresAt) is purged on expiry
//                  even if it was never revoked (DB-18).
//
// The old `createdAt_-1` Activity index is replaced by the ascending TTL index
// (single-field indexes serve descending sorts via reverse scan). `createIndex`
// is idempotent; the drop is guarded on the index still existing.
'use strict';

const ACTIVITY_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const OLD_ACTIVITY_INDEX = 'createdAt_-1';

module.exports = {
  async up({ db }) {
    const activities = db.collection('activities');

    const indexes = await activities.indexes();
    if (indexes.some((idx) => idx.name === OLD_ACTIVITY_INDEX)) {
      await activities.dropIndex(OLD_ACTIVITY_INDEX);
    }

    await activities.createIndex({ createdAt: 1 }, { expireAfterSeconds: ACTIVITY_TTL_SECONDS });
    await db.collection('reportshares').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  },
  ACTIVITY_TTL_SECONDS,
  OLD_ACTIVITY_INDEX,
};

// IES-P0-17: drop the old unique `worklogs` index `userId_1_date_1`.
//
// This replaced the destructive `drop-worklog-index.js` one-off script. The
// index allowed only one worklog per user per day; dropping it is a no-op if
// it is already gone, so re-running this migration is safe.
'use strict';

module.exports = {
  async up({ db }) {
    const OLD_INDEX = 'userId_1_date_1';
    const indexes = await db.collection('worklogs').indexes();
    if (indexes.some((idx) => idx.name === OLD_INDEX)) {
      await db.collection('worklogs').dropIndex(OLD_INDEX);
    }
  },
};

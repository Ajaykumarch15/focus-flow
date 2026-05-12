/**
 * drop-worklog-index.js
 * Run once:  node drop-worklog-index.js
 * Delete after running.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅  Connected to Atlas');

  const db = mongoose.connection.db;

  // List current indexes so you can see what exists
  const indexes = await db.collection('worklogs').indexes();
  console.log('\nCurrent indexes on worklogs:');
  indexes.forEach(idx => console.log(' -', idx.name, JSON.stringify(idx.key)));

  // Drop the old unique index if it exists
  const OLD_INDEX = 'userId_1_date_1';
  const exists = indexes.some(idx => idx.name === OLD_INDEX);

  if (exists) {
    await db.collection('worklogs').dropIndex(OLD_INDEX);
    console.log(`\n✅  Dropped index: ${OLD_INDEX}`);
  } else {
    console.log(`\nℹ️   Index ${OLD_INDEX} not found — nothing to drop`);
  }

  await mongoose.disconnect();
  console.log('Done — you can delete this file now.');
}

run().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});

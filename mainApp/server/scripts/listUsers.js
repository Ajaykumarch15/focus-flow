const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  deletedAt: Date,
}, { strict: false });

const User = mongoose.model('User', userSchema);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  const users = await User.find({}).select('name email role deletedAt createdAt').sort({ createdAt: 1 });

  const active = users.filter(u => !u.deletedAt);
  const deleted = users.filter(u => u.deletedAt);

  console.log('=== ALL USERS ===');
  console.log(`Total: ${users.length} | Active: ${active.length} | Deleted: ${deleted.length}\n`);

  console.log('--- Active Users ---');
  console.log('No. | Name'.padEnd(35) + '| Email'.padEnd(40) + '| Role'.padEnd(10) + '| Created');
  console.log('-'.repeat(110));
  active.forEach((u, i) => {
    const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
    console.log(`${String(i + 1).padStart(3)} | ${u.name.padEnd(32)} | ${(u.email || '').padEnd(38)} | ${(u.role || '').padEnd(8)} | ${created}`);
  });

  if (deleted.length > 0) {
    console.log('\n--- Deleted Users ---');
    console.log('No. | Name'.padEnd(35) + '| Email'.padEnd(40) + '| Role');
    console.log('-'.repeat(90));
    deleted.forEach((u, i) => {
      console.log(`${String(i + 1).padStart(3)} | ${u.name.padEnd(32)} | ${(u.email || '').padEnd(38)} | ${(u.role || '')}`);
    });
  }

  await mongoose.disconnect();
  console.log('\nDisconnected.');
}

main().catch(err => { console.error(err); process.exit(1); });

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const WORKSPACE_NAME_REGEX = /^Authorization Test Workspace/;

async function cleanup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI is required'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false, collection: 'workspaces' }));
  const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false, collection: 'projects' }));
  const Team = mongoose.model('Team', new mongoose.Schema({}, { strict: false, collection: 'teams' }));
  const Task = mongoose.model('Task', new mongoose.Schema({}, { strict: false, collection: 'tasks' }));

  const testWorkspaces = await Workspace.find({ name: WORKSPACE_NAME_REGEX }).select('_id name');
  if (testWorkspaces.length === 0) {
    console.log('No test workspaces found. Nothing to clean.');
    await mongoose.disconnect();
    return;
  }

  const wsIds = testWorkspaces.map(w => w._id);
  console.log(`Found ${testWorkspaces.length} test workspace(s):`);
  testWorkspaces.forEach(w => console.log(`  - ${w.name} (${w._id})`));

  const [teams, tasks, projects] = await Promise.all([
    Team.deleteMany({ workspaceRef: { $in: wsIds } }),
    Task.deleteMany({ workspaceRef: { $in: wsIds } }),
    Project.deleteMany({ workspaceRef: { $in: wsIds } }),
  ]);

  const deletedWs = await Workspace.deleteMany({ _id: { $in: wsIds } });

  console.log('\nCleanup complete:');
  console.log(`  Teams deleted:      ${teams.deletedCount}`);
  console.log(`  Tasks deleted:      ${tasks.deletedCount}`);
  console.log(`  Projects deleted:   ${projects.deletedCount}`);
  console.log(`  Workspaces deleted: ${deletedWs.deletedCount}`);

  await mongoose.disconnect();
}

cleanup().catch(err => { console.error('Cleanup failed:', err); process.exit(1); });

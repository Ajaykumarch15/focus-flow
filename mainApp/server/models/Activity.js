const mongoose = require('mongoose');

// IES-P1-13 (DB-17): Activity is a write-heavy audit log; expire entries 90
// days after creation so the collection cannot grow unbounded. This replaces
// the old `{ createdAt: -1 }` index — a single-field ascending index serves
// descending sorts via reverse scan, so one TTL index covers both.
const ACTIVITY_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const activitySchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action:   { type: String, required: true, index: true },
    // IES-P2-04: workspace/team scoping for the collaboration activity feed.
    // Null on legacy events that are not tied to a workspace (e.g. user.created).
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    teamRef:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    details:  { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: ACTIVITY_TTL_SECONDS });
activitySchema.index({ action: 1, createdAt: -1 });
// IES-P2-04: the workspace feed reads newest-first for one workspace.
activitySchema.index({ workspaceRef: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
module.exports.ACTIVITY_TTL_SECONDS = ACTIVITY_TTL_SECONDS;

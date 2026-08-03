// IES-P2-01 · Workspace — top-level collaborative container (DDD §3.2, WPS §2.1).
// Mirrors the frontend `Workspace` type (src/types/collaboration.ts) so the
// store can consume it directly once wired (IES-P2-08). The creator becomes the
// sole `Owner` member; membership carries a per-member role that later phases
// (IES-P2-03) will enforce with a permission layer.
const mongoose = require('mongoose');

const MEMBER_ROLES = ['Owner', 'Admin', 'Manager', 'Developer', 'Viewer'];
const WORKSPACE_TYPES = ['Personal', 'Startup', 'College Project', 'Open Source', 'Internship', 'Enterprise'];

const workspaceSettingsSchema = new mongoose.Schema(
  {
    allowMemberInvites:      { type: Boolean, default: true },
    requireReviewForDone:    { type: Boolean, default: false },
    autoSyncTimerWorkLogs:   { type: Boolean, default: true },
    defaultVisibility: {
      type: String,
      enum: ['Private', 'Team', 'Project', 'Workspace'],
      default: 'Workspace',
    },
  },
  { _id: false }
);

const workspaceMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role:   { type: String, enum: MEMBER_ROLES, default: 'Developer' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    type:        { type: String, enum: WORKSPACE_TYPES, default: 'Personal' },
    icon:        { type: String, default: '🚀', maxlength: 20 },
    description: { type: String, default: '', maxlength: 2000 },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    settings:    { type: workspaceSettingsSchema, default: () => ({}) },
    members:     { type: [workspaceMemberSchema], default: [] },
  },
  { timestamps: true }
);

// Look up a user's own memberships + workspaces they created.
workspaceSchema.index({ createdBy: 1 });
workspaceSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
module.exports.MEMBER_ROLES = MEMBER_ROLES;
module.exports.WORKSPACE_TYPES = WORKSPACE_TYPES;

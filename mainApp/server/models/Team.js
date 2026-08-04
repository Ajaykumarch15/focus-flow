const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000 },
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // IES-P2-01: workspace-scoped teams (DDD §3.2 Team). Null = legacy admin team.
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    leaderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    color:        { type: String, default: '#8b5cf6', maxlength: 20 },
  },
  { timestamps: true }
);

// IES-P2-02: member-based queries (who is on which team) are index-backed, and
// createdBy/workspaceRef cover ownership and scoping lookups.
teamSchema.index({ workspaceRef: 1 });
teamSchema.index({ members: 1 });
teamSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Team', teamSchema);

const mongoose = require('mongoose');

// R1-P1: Sprint — time-boxed iteration belonging to exactly one Project
// (docs/migration-recommendation-1.md §3.1). `workspaceRef` is denormalized
// from the owning Project for permission gating (same pattern as Activity/Team).
const sprintSchema = new mongoose.Schema(
  {
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',  required: true },
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name:         { type: String, required: true, trim: true, maxlength: 150 },
    goal:         { type: String, default: '' },
    startDate:    { type: Date,   required: true },
    endDate:      { type: Date,   required: true },
    status:       { type: String, enum: ['future', 'active', 'completed'], default: 'future' },
    capacityHours: { type: Number, default: 0 },
    targetVelocity: { type: Number, default: 0 },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// IES-R1: project-scoped iteration lists + workspace-scoped permission scans.
sprintSchema.index({ projectRef: 1, startDate: -1 });
sprintSchema.index({ workspaceRef: 1, status: 1 });

module.exports = mongoose.model('Sprint', sprintSchema);

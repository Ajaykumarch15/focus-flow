const mongoose = require('mongoose');
const { SPRINT_STATUSES } = require('../utils/sprintState');

// R1-P1: Sprint — time-boxed iteration belonging to exactly one Project
// (docs/migration-recommendation-1.md §3.1). `workspaceRef` is denormalized
// from the owning Project for permission gating (same pattern as Activity/Team).
//
// EEP2-P4.1.1/P4.1.3: the lifecycle vocabulary is draft → planned → active →
// completed (the machine lives in utils/sprintState.js). `committed` +
// `commitmentDate` + `committedBy` are written exactly once by the commit
// endpoint (P4.1.4) and are immutable afterwards.
const sprintSchema = new mongoose.Schema(
  {
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',  required: true },
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name:         { type: String, required: true, trim: true, maxlength: 150 },
    goal:         { type: String, default: '' },
    startDate:    { type: Date,   required: true },
    endDate:      { type: Date,   required: true },
    status:       { type: String, enum: SPRINT_STATUSES, default: 'draft' },
    capacityHours: { type: Number, default: 0 },
    targetVelocity: { type: Number, default: 0 },
    committed:      { type: Boolean, default: false },
    commitmentDate: { type: Date, default: null },
    committedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// IES-R1: project-scoped iteration lists + workspace-scoped permission scans.
sprintSchema.index({ projectRef: 1, startDate: -1 });
sprintSchema.index({ workspaceRef: 1, status: 1 });
// EEP2-P4.1.1: lifecycle-status lookups (active sprint per project,
// status-filtered planning lists).
sprintSchema.index({ projectRef: 1, status: 1, startDate: -1 });

module.exports = mongoose.model('Sprint', sprintSchema);

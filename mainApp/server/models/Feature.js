const mongoose = require('mongoose');

// R1-P2: Feature/work-item belonging to exactly one Project, optionally planned
// into a Sprint. `sprintRef: null` ⇒ Project Backlog (a query, not a collection —
// docs/migration-recommendation-1.md §3.2/§9.1). `workspaceRef` is denormalized
// from the owning Project for permission gating.
const featureSchema = new mongoose.Schema(
  {
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',  required: true },
    sprintRef:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint',   default: null },
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name:         { type: String, required: true, trim: true, maxlength: 150 },
    description:  { type: String, default: '' },
    type:         { type: String, enum: ['feature','bug','spike','chore','research','debt','improvement'], default: 'feature' },
    labels:       [{ type: String }],
    ownerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    estimatedHours: { type: Number, default: 0 },
    status:       { type: String, enum: ['backlog','ready','in_progress','review','done'], default: 'backlog' },
    order:        { type: Number, default: 0 },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// IES-R1: backlog ordering per project, sprint boards, workspace permission scans,
// and work-item-type filters.
featureSchema.index({ projectRef: 1, order: 1 });
featureSchema.index({ sprintRef: 1, status: 1 });
featureSchema.index({ workspaceRef: 1 });
featureSchema.index({ type: 1 });

module.exports = mongoose.model('Feature', featureSchema);

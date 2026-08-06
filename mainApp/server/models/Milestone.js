const mongoose = require('mongoose');

// EEP2-P3.1.1 / DDS §4.5: Milestone — a dated, outcome-level commitment on the
// Roadmap ("GA launch"). The Roadmap is the ordered set of a project's
// Milestones (order asc, then targetDate asc). `workspaceRef` is denormalized
// from the owning Project for permission gating (same pattern as Sprint/Feature).
const milestoneSchema = new mongoose.Schema(
  {
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',  required: true },
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name:         { type: String, required: true, trim: true, maxlength: 150 },
    description:  { type: String, default: '' },
    targetDate:   { type: Date,   default: null },
    order:        { type: Number, default: 0 },
    status:       { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// DDS §4.5: roadmap ordering = order asc, then targetDate asc; the compound
// prefix also serves project-scoped lookups.
milestoneSchema.index({ projectRef: 1, order: 1, targetDate: 1 });
// Workspace-scoped permission scans.
milestoneSchema.index({ workspaceRef: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);

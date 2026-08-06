const mongoose = require('mongoose');

// EEP2-P3.1.2 / DDS §4.6: Phase — a delivery stage inside a Milestone
// ("Phase 1: Core platform"). Ownership is `milestoneRef`; `projectRef` and
// `workspaceRef` are denormalized from the owning Milestone/Project for
// permission gating (same pattern as Sprint/Feature). Lifecycle:
// planned → active → completed (reversible).
const phaseSchema = new mongoose.Schema(
  {
    milestoneRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', required: true },
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',   required: true },
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name:         { type: String, required: true, trim: true, maxlength: 150 },
    description:  { type: String, default: '' },
    status:       { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
    order:        { type: Number, default: 0 },
    startDate:    { type: Date,   default: null },
    endDate:      { type: Date,   default: null },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// DDS §4.6: within-milestone ordering; the milestoneRef prefix also serves
// milestone-scoped lookups.
phaseSchema.index({ milestoneRef: 1, order: 1 });
// Project/workspace-scoped permission scans.
phaseSchema.index({ projectRef: 1 });
phaseSchema.index({ workspaceRef: 1 });

// DDS §4.6: startDate must precede endDate when both are set.
phaseSchema.pre('validate', function (next) {
  if (
    this.startDate &&
    this.endDate &&
    new Date(this.startDate).getTime() >= new Date(this.endDate).getTime()
  ) {
    this.invalidate('endDate', 'endDate must be after startDate');
  }
  next();
});

module.exports = mongoose.model('Phase', phaseSchema);

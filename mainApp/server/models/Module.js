const mongoose = require('mongoose');

// EEP2-P3.1.2 / DDS §4.7: Module — a capability area inside a Phase
// ("Auth module"). Ownership is `phaseRef`; `projectRef` and `workspaceRef`
// are denormalized from the owning Phase/Project for permission gating.
// A Module's Features target its owner (route-level check: ownerId must be a
// workspace member). Deletion hard-deletes and nulls `feature.moduleRef`.
const moduleSchema = new mongoose.Schema(
  {
    phaseRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'Phase',    required: true },
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',   required: true },
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name:         { type: String, required: true, trim: true, maxlength: 150 },
    description:  { type: String, default: '' },
    status:       { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
    order:        { type: Number, default: 0 },
    ownerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// DDS §4.7: within-phase ordering; the phaseRef prefix also serves
// phase-scoped lookups.
moduleSchema.index({ phaseRef: 1, order: 1 });
// Project/workspace-scoped permission scans.
moduleSchema.index({ projectRef: 1 });
moduleSchema.index({ workspaceRef: 1 });

module.exports = mongoose.model('Module', moduleSchema);

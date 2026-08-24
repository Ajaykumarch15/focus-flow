const mongoose = require('mongoose');

const roadmapMilestoneSchema = new mongoose.Schema(
  {
        userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roadmapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    phaseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'RoadmapPhase', required: true, index: true },
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    order:       { type: Number, default: 0 },
    targetDate:  { type: Date },
    status:      { type: String, enum: ['todo', 'in-progress', 'completed'], default: 'todo' },
  },
  { timestamps: true }
);

roadmapMilestoneSchema.index({ phaseId: 1, order: 1 });
roadmapMilestoneSchema.index({ roadmapId: 1 });

// B2 referential integrity: a Milestone's phase must exist AND belong to the
// same roadmap, so milestone.phaseId/roadmapId can never disagree. Only fires
// when the refs change (status-only saves in the cascade skip it).
roadmapMilestoneSchema.pre('validate', async function () {
  if (!this.isModified('phaseId') && !this.isModified('roadmapId')) return;
  if (!this.phaseId || !this.roadmapId) return;
  const RoadmapPhase = mongoose.model('RoadmapPhase');
  const phase = await RoadmapPhase.findById(this.phaseId).select('roadmapId');
  if (!phase) {
    this.invalidate('phaseId', 'Phase does not exist');
    return;
  }
  if (String(phase.roadmapId) !== String(this.roadmapId)) {
    this.invalidate('phaseId', 'Phase does not belong to the given roadmap');
  }
});

module.exports = mongoose.model('RoadmapMilestone', roadmapMilestoneSchema);

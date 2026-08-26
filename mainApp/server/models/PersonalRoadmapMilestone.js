const mongoose = require('mongoose');

const personalRoadmapMilestoneSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roadmapId:  { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalRoadmap', required: true, index: true },
    phaseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalRoadmapPhase', required: true, index: true },
    title:      { type: String, required: true, trim: true, maxlength: 200 },
    description:{ type: String, default: '', maxlength: 1000 },
    order:      { type: Number, default: 0 },
    targetDate: { type: Date },
    status:     { type: String, enum: ['todo', 'in-progress', 'completed'], default: 'todo' },
  },
  { timestamps: true }
);

personalRoadmapMilestoneSchema.index({ phaseId: 1, order: 1 });
personalRoadmapMilestoneSchema.index({ roadmapId: 1 });

personalRoadmapMilestoneSchema.pre('validate', async function () {
  if (!this.isModified('phaseId') && !this.isModified('roadmapId')) return;
  if (!this.phaseId || !this.roadmapId) return;
  const PersonalRoadmapPhase = mongoose.model('PersonalRoadmapPhase');
  const phase = await PersonalRoadmapPhase.findById(this.phaseId).select('roadmapId');
  if (!phase) {
    this.invalidate('phaseId', 'Phase does not exist');
    return;
  }
  if (String(phase.roadmapId) !== String(this.roadmapId)) {
    this.invalidate('phaseId', 'Phase does not belong to the given roadmap');
  }
});

module.exports = mongoose.model('PersonalRoadmapMilestone', personalRoadmapMilestoneSchema);

const mongoose = require('mongoose');

const personalRoadmapPhaseSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roadmapId:  { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalRoadmap', required: true, index: true },
    title:      { type: String, required: true, trim: true, maxlength: 200 },
    description:{ type: String, default: '', maxlength: 1000 },
    order:      { type: Number, default: 0 },
    startDate:  { type: Date },
    targetDate: { type: Date },
    status:     { type: String, enum: ['upcoming', 'active', 'completed', 'paused'], default: 'upcoming' },
  },
  { timestamps: true }
);

personalRoadmapPhaseSchema.index({ roadmapId: 1, order: 1 });

personalRoadmapPhaseSchema.pre('validate', async function () {
  if (!this.isModified('roadmapId') || !this.roadmapId) return;
  const PersonalRoadmap = mongoose.model('PersonalRoadmap');
  const roadmap = await PersonalRoadmap.findById(this.roadmapId).select('_id');
  if (!roadmap) this.invalidate('roadmapId', 'PersonalRoadmap does not exist');
});

module.exports = mongoose.model('PersonalRoadmapPhase', personalRoadmapPhaseSchema);

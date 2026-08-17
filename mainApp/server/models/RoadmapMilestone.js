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

module.exports = mongoose.model('RoadmapMilestone', roadmapMilestoneSchema);

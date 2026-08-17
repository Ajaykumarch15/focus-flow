const mongoose = require('mongoose');

const roadmapPhaseSchema = new mongoose.Schema(
  {
        userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roadmapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    order:       { type: Number, default: 0 },
    startDate:   { type: Date },
    targetDate:  { type: Date },
    status:      { type: String, enum: ['upcoming', 'active', 'completed', 'paused'], default: 'upcoming' },
  },
  { timestamps: true }
);

roadmapPhaseSchema.index({ roadmapId: 1, order: 1 });

module.exports = mongoose.model('RoadmapPhase', roadmapPhaseSchema);

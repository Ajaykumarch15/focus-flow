const mongoose = require('mongoose');

const personalFutureGoalSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:         { type: String, required: true, trim: true, maxlength: 200 },
    description:   { type: String, default: '', maxlength: 2000 },
    category:      { type: String, enum: ['career', 'projects', 'learning', 'travel', 'personal', 'health', 'finance', 'creative', 'other'], default: 'other' },
    status:        { type: String, enum: ['someday', 'considering', 'active', 'completed', 'dropped'], default: 'someday' },
    priority:      { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    color:         { type: String, default: '#8b5cf6' },
    linkedRoadmapId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalRoadmap', default: null },
    lastReviewedAt: { type: Date, default: null },
    remindAt:      { type: Date, default: null },
  },
  { timestamps: true }
);

personalFutureGoalSchema.index({ userId: 1, status: 1 });
personalFutureGoalSchema.index({ userId: 1, createdAt: -1 });
personalFutureGoalSchema.index({ userId: 1, remindAt: 1 });

module.exports = mongoose.model('PersonalFutureGoal', personalFutureGoalSchema);

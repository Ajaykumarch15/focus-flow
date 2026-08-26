const mongoose = require('mongoose');

const personalRoadmapSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    type:        { type: String, enum: ['learning', 'project', 'career', 'certification', 'interview-prep', 'personal', 'custom'], default: 'custom' },
    startDate:   { type: Date },
    targetDate:  { type: Date },
    status:      { type: String, enum: ['planning', 'active', 'completed', 'paused', 'archived'], default: 'planning' },
    icon:        { type: String, default: 'Map' },
    color:       { type: String, default: '#0ea5e9' },
  },
  { timestamps: true }
);

personalRoadmapSchema.index({ userId: 1, status: 1 });
personalRoadmapSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PersonalRoadmap', personalRoadmapSchema);

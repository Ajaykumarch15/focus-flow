const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  completed: { type: Boolean, default: false },
}, { timestamps: true });

const personalTaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: ['todo', 'active', 'paused', 'completed'], default: 'todo' },
    category: { type: String, default: 'Work' },
    deadline: { type: Date },
    color: { type: String, default: '#0ea5e9' },
    tags: [{ type: String }],
    subtasks: [subtaskSchema],
    totalTime: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },

    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',   default: null },
    sprintRef:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint',    default: null },
    featureRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Feature',   default: null },
    assigneeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      default: null },
    reviewerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      default: null },
    followerIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    labels:       [{ type: String }],
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PersonalTask' }],
    estimatedHours: { type: Number, default: 0 },
    actualHours:    { type: Number, default: 0 },
    sprintStatus:   { type: String, enum: ['backlog', 'ready', 'in_progress', 'review', 'done'], default: 'backlog' },

    personalRoadmapRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalRoadmap', default: null },
    personalPhaseRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalRoadmapPhase', default: null },
    personalMilestoneRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalRoadmapMilestone', default: null },

    scheduledDate: { type: Date, default: null },

    workspaceContext: { type: String, enum: ['personal', 'work', 'collab'], default: 'personal', index: true },

    gitContext: {
      repository:     { type: String, default: '' },
      branch:         { type: String, default: '' },
      commitHash:     { type: String, default: '' },
      prNumber:       { type: Number, default: 0 },
      prUrl:          { type: String, default: '' },
      reviewStatus:   { type: String, enum: ['pending', 'approved', 'changes_requested'], default: 'pending' },
      reviewerName:   { type: String, default: '' },
      mergeStatus:    { type: String, enum: ['open', 'merged', 'closed'], default: 'open' },
      deploymentStatus: { type: String, enum: ['staging', 'production', 'failed', 'not_deployed'], default: 'not_deployed' },
    },
  },
  { timestamps: true }
);

personalTaskSchema.index({ userId: 1, status: 1 });
personalTaskSchema.index({ userId: 1, createdAt: 1 });
personalTaskSchema.index({ workspaceRef: 1, sprintRef: 1 });
personalTaskSchema.index({ featureRef: 1 });
personalTaskSchema.index({ projectRef: 1 });
personalTaskSchema.index({ personalRoadmapRef: 1 });
personalTaskSchema.index({ personalMilestoneRef: 1 });
personalTaskSchema.index({ userId: 1, personalPhaseRef: 1 });
personalTaskSchema.index({ userId: 1, scheduledDate: 1 });

module.exports = mongoose.model('PersonalTask', personalTaskSchema);

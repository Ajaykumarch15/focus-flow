const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  completed: { type: Boolean, default: false },
}, { timestamps: true });

const taskSchema = new mongoose.Schema(
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
    // Total ms of active (non-paused) work — updated on every session stop
    totalTime: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    // R1-P3: collaboration links (docs/migration-recommendation-1.md §3.3).
    // All default to null/empty so existing personal-task behavior is unchanged.
    // A personal task is exactly one with `userId` set AND `workspaceRef: null`.
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    projectRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project',   default: null },
    sprintRef:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint',    default: null },
    featureRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Feature',   default: null },
    assigneeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      default: null },
    reviewerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      default: null },
    followerIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    labels:       [{ type: String }],
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    estimatedHours: { type: Number, default: 0 },
    actualHours:    { type: Number, default: 0 },
    sprintStatus:   { type: String, enum: ['backlog', 'ready', 'in_progress', 'review', 'done'], default: 'backlog' },
    // R1-P3: git integration context — mirrors src/types/collaboration.ts GitContext.
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

// IES-P1-04: user-scoped lists and admin analytics aggregations.
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, createdAt: 1 });

// IES-R1: workspace sprint boards, feature drill-down, and project grouping.
taskSchema.index({ workspaceRef: 1, sprintRef: 1 });
taskSchema.index({ featureRef: 1 });
taskSchema.index({ projectRef: 1 });

module.exports = mongoose.model('Task', taskSchema);

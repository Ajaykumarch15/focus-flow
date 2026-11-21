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
    // Timestamp when the task was marked completed; cleared on reopen
    completedAt: { type: Date, default: null },
    labels:       [{ type: String }],
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

    // Personal Roadmap links — optional refs to the personal roadmap system.
    roadmapRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', default: null },
    phaseRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'RoadmapPhase', default: null },
    milestoneRef: { type: mongoose.Schema.Types.ObjectId, ref: 'RoadmapMilestone', default: null },

    // Workspace context: 'personal' | 'work'
    workspaceContext: { type: String, enum: ['personal', 'work'], default: 'work', index: true },
  },
  { timestamps: true }
);

// IES-P1-04: user-scoped lists and admin analytics aggregations.
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, createdAt: 1 });

// Personal roadmap integration indexes.
taskSchema.index({ roadmapRef: 1 });
taskSchema.index({ milestoneRef: 1 });
// B2: phaseRef is filtered in phase-detail task queries; scope by owner too.
taskSchema.index({ userId: 1, phaseRef: 1 });

module.exports = mongoose.model('Task', taskSchema);

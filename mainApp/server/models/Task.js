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
  },
  { timestamps: true }
);

// IES-P1-04: user-scoped lists and admin analytics aggregations.
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model('Task', taskSchema);

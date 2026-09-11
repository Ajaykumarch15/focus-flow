const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    date: { type: String, required: true, index: true }, // Format: "YYYY-MM-DD"
    startTime: { type: String, required: true }, // Format: "HH:mm" (24-hr e.g. "09:00")
    endTime: { type: String, required: true },   // Format: "HH:mm" (24-hr e.g. "10:30")
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'missed', 'cancelled'],
      default: 'scheduled',
    },
    notes: { type: String, default: '' },
    recurrence: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'custom'],
      default: 'none',
    },
    // Workspace scheduling fields
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

scheduleSchema.index({ userId: 1, date: 1 });
scheduleSchema.index({ workspaceId: 1, date: 1 });
scheduleSchema.index({ projectId: 1, date: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);

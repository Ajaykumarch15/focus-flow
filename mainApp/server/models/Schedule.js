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
    // Req 17: Recurring scheduling architecture preparation
    recurrence: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'custom'],
      default: 'none',
    },
  },
  { timestamps: true }
);

scheduleSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);

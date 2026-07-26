const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action:   { type: String, required: true, index: true },
    details:  { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);

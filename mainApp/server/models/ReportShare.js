const mongoose = require('mongoose');

const reportShareSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    expiresAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

reportShareSchema.index({ userId: 1, date: 1, revokedAt: 1 });

module.exports = mongoose.model('ReportShare', reportShareSchema);

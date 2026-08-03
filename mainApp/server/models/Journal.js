const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 20000 },
    mood: { type: Number, min: 1, max: 5, default: 3 },
    focusRating: { type: Number, min: 1, max: 5, default: 3 },
  },
  { timestamps: true }
);

// IES-P1-04: user/task journal listing (journals.js).
journalSchema.index({ userId: 1, taskId: 1, createdAt: 1 });

module.exports = mongoose.model('Journal', journalSchema);

const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    content: { type: String, required: true },
    mood: { type: Number, min: 1, max: 5, default: 3 },
    focusRating: { type: Number, min: 1, max: 5, default: 3 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Journal', journalSchema);

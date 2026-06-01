const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
}, { _id: true });

const habitEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  completedItems: [{ type: mongoose.Schema.Types.ObjectId }],
  minutes: { type: Number, default: 0, min: 0 },
  feeling: {
    type: String,
    enum: ['rough', 'okay', 'good', 'great', 'energized'],
    default: 'okay',
  },
  note: { type: String, default: '' },
}, { _id: true, timestamps: true });

const habitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#22c55e' },
  targetMinutes: { type: Number, default: 20, min: 0 },
  checklist: [checklistItemSchema],
  entries: [habitEntrySchema],
  archived: { type: Boolean, default: false, index: true },
}, { timestamps: true });

habitSchema.index({ userId: 1, archived: 1, updatedAt: -1 });

module.exports = mongoose.model('Habit', habitSchema);

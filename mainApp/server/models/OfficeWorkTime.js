const mongoose = require('mongoose');

const officeWorkTimeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // User's local calendar day (YYYY-MM-DD)
  totalMs: { type: Number, default: 0, min: 0 },
  activeSince: { type: Number, default: null },
}, { timestamps: true });

officeWorkTimeSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('OfficeWorkTime', officeWorkTimeSchema);

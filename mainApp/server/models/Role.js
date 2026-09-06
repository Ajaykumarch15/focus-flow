const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, unique: true, trim: true },
    level: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true }
);

roleSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);

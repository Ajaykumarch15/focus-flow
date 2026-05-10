const mongoose = require('mongoose');

const completedItemSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  done:      { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const linkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url:   { type: String, required: true },
}, { _id: true });

const workLogSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    // Human-readable title for this specific work item
    title: { type: String, default: 'Untitled Work Item' },

    // The problem / ticket being solved
    problem: { type: String, default: '' },

    // Git branch currently checked out
    gitBranch: { type: String, default: '' },

    // What exactly am I doing right now
    currentWork: { type: String, default: '' },

    // Free-form planning section
    plan: { type: String, default: '' },

    // Design / architecture notes
    designNotes: { type: String, default: '' },

    // Blockers or questions
    blockers: { type: String, default: '' },

    // Checklist of things completed
    completedItems: [completedItemSchema],

    // Relevant links
    links: [linkSchema],

    // Status — 'done' means this log is closed/completed
    status: {
      type:    String,
      enum:    ['planning', 'in-progress', 'reviewing', 'blocked', 'done'],
      default: 'in-progress',
    },

    // ── CONTINUE SUPPORT ─────────────────────────────────────────────────────
    // When status !== 'done' the log is "active" and shows at the top.
    // User can work on it across multiple days.
    // When they click "Mark Done" → status = 'done', closedAt = now.
    // If they click "Continue" on a done log → status = 'in-progress', closedAt = null, reopenedAt = now.
    isActive:   { type: Boolean, default: true, index: true },
    closedAt:   { type: Date },
    reopenedAt: { type: Date },

    // Mood / energy rating 1-5
    mood: { type: Number, min: 1, max: 5, default: 3 },

    // Free tags
    tags: [{ type: String }],
  },
  { timestamps: true }
);

// Index for fast "get my active logs" query
workLogSchema.index({ userId: 1, isActive: 1, updatedAt: -1 });

// NOTE: NO unique constraint on userId+date — many logs per day is intentional

module.exports = mongoose.model('WorkLog', workLogSchema);

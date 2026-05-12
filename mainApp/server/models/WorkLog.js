const mongoose = require('mongoose');

// One entry = one day's work on this log
// stores what was done + time range for that day
const workEntrySchema = new mongoose.Schema(
  {
    date:        { type: Date,   required: true },          // midnight of that day
    what:        { type: String, default: '' },             // what I did this day
    startedAt:   { type: Number },                          // epoch ms — when work began
    endedAt:     { type: Number },                          // epoch ms — when work ended
    activeMs:    { type: Number, default: 0 },              // focused ms for that day (from sessions)
    sessionIds:  [{ type: mongoose.Schema.Types.ObjectId }],// Session _id refs
  },
  { _id: true, timestamps: false }
);

const completedItemSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  done:      { type: Boolean, default: true },
  createdAt: { type: Date,   default: Date.now },
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

    // Optional link to a Task document
    // When linked, session data is pulled from the Task's sessions
    taskRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Task',
    },

    title:       { type: String, default: 'Untitled Work Item' },
    problem:     { type: String, default: '' },
    gitBranch:   { type: String, default: '' },
    currentWork: { type: String, default: '' },
    plan:        { type: String, default: '' },
    designNotes: { type: String, default: '' },
    blockers:    { type: String, default: '' },

    // Per-day work entries — one entry per calendar day worked
    workEntries:    [workEntrySchema],

    completedItems: [completedItemSchema],
    links:          [linkSchema],

    status: {
      type:    String,
      enum:    ['planning', 'in-progress', 'reviewing', 'blocked', 'done'],
      default: 'in-progress',
    },

    isActive:   { type: Boolean, default: true, index: true },
    closedAt:   { type: Date },
    reopenedAt: { type: Date },
    mood:       { type: Number, min: 1, max: 5, default: 3 },
    tags:       [{ type: String }],

    // Computed total — sum of all workEntries.activeMs
    totalActiveMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workLogSchema.index({ userId: 1, isActive: 1, updatedAt: -1 });

module.exports = mongoose.model('WorkLog', workLogSchema);

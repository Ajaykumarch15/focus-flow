const mongoose = require('mongoose');
const { pruneWorkLogArrays } = require('../utils/worklogLimits');

// IES-P1-11: `$push` routes enable `runValidators: true`, so these subdoc
// schemas carry the same minlength/maxlength caps the zod layer enforces —
// invalid subdocuments are rejected at the model, not just at the route.
const TITLE = { type: String, required: true, trim: true, minlength: 1, maxlength: 300 };
const URL = { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 };

// Timeline event entry (auto-captured from timer or manually logged)
const timelineEntrySchema = new mongoose.Schema({
  timestamp:   { type: Number, default: Date.now },
  type:        { type: String, enum: ['timer_start', 'timer_pause', 'timer_resume', 'timer_stop', 'note', 'snapshot', 'completed_item', 'decision', 'blocker'], default: 'note' },
  title:       TITLE,
  description: { type: String, default: '', maxlength: 2000 },
  category:    { type: String, default: 'General', maxlength: 100 },
  metadata:    { type: mongoose.Schema.Types.Mixed },
}, { _id: true });

// Technical Decision item
const decisionSchema = new mongoose.Schema({
  title:        TITLE,
  context:      { type: String, default: '', maxlength: 5000 },
  decision:     { type: String, default: '', maxlength: 5000 },
  alternatives: { type: String, default: '', maxlength: 5000 },
  rationale:    { type: String, default: '', maxlength: 5000 },
  timestamp:    { type: Number, default: Date.now },
}, { _id: true });

// Structured Blocker item
const blockerItemSchema = new mongoose.Schema({
  title:      TITLE,
  severity:   { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status:     { type: String, enum: ['open', 'investigating', 'blocked', 'resolved'], default: 'open' },
  notes:      { type: String, default: '', maxlength: 2000 },
  resolvedAt: { type: Number },
  createdAt:  { type: Number, default: Date.now },
}, { _id: true });

// Progress Snapshot item
const progressSnapshotSchema = new mongoose.Schema({
  period:    { type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Custom'], default: 'Morning' },
  text:      { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
  timestamp: { type: Number, default: Date.now },
}, { _id: true });

// Categorized Completed Item
const completedItemSchema = new mongoose.Schema({
  text:        { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
  category:    { type: String, enum: ['feature', 'bug', 'refactor', 'research', 'documentation', 'general'], default: 'feature' },
  done:        { type: Boolean, default: true },
  completedAt: { type: Number, default: Date.now },
  createdAt:   { type: Number, default: Date.now },
}, { _id: true });

// Categorized Link
const linkSchema = new mongoose.Schema({
  label:    TITLE,
  url:      URL,
  category: { type: String, enum: ['Figma', 'GitHub', 'Jira', 'Linear', 'Documentation', 'API', 'Database', 'PR', 'Meeting Notes', 'General'], default: 'General' },
}, { _id: true });

// Attachment Schema
const attachmentSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  type:        { type: String, default: 'file', maxlength: 50 },
  url:         URL,
  sizeBytes:   { type: Number, default: 0, min: 0 },
  uploadDate:  { type: Number, default: Date.now },
  description: { type: String, default: '', maxlength: 2000 },
}, { _id: true });

// Work Entry per calendar day
const workEntrySchema = new mongoose.Schema({
  date:        { type: Date,   required: true },
  what:        { type: String, default: '', maxlength: 10000 },
  startedAt:   { type: Number },
  endedAt:     { type: Number },
  activeMs:    { type: Number, default: 0 },
  // IES-P1-09: typed ref so the delete cascade can detect/drop orphaned ids.
  sessionIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }],
}, { _id: true, timestamps: false });

const workLogSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    taskRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Task',
    },

    projectRef: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   'Project',
      index: true,
    },

    googleDocId:  { type: String, default: '' },
    googleDocUrl: { type: String, default: '' },

    title:       { type: String, default: 'Untitled Work Item' },

    // Structured Problem Flow
    problemFlow: {
      problem:        { type: String, default: '' },
      investigation:  { type: String, default: '' },
      rootCause:      { type: String, default: '' },
      solution:       { type: String, default: '' },
      lessonsLearned: { type: String, default: '' },
    },

    // IES-P1-27: `problem` is a virtual (see below) backed by
    // `problemFlow.problem` — the top-level field is no longer a stored path.
    gitBranch:   { type: String, default: '' },
    currentWork: { type: String, default: '' },
    plan:        { type: String, default: '' },
    designNotes: { type: String, default: '' },
    blockers:    { type: String, default: '' },

    // Git Integration Metadata
    gitRef: {
      repository:  { type: String, default: '' },
      branch:      { type: String, default: '' },
      commitIds:   [{ type: String }],
      prNumber:    { type: String, default: '' },
      issueNumber: { type: String, default: '' },
    },

    // Sub-document Collections
    timelineEntries:   [timelineEntrySchema],
    decisions:         [decisionSchema],
    blockerList:       [blockerItemSchema],
    progressSnapshots: [progressSnapshotSchema],
    completedItems:    [completedItemSchema],
    links:             [linkSchema],
    attachments:       [attachmentSchema],
    workEntries:       [workEntrySchema],

    // Plan for Tomorrow
    tomorrowPlan: {
      topPriority:       { type: String, default: '' },
      unfinishedItems:   [{ type: String }],
      attentionRequired: { type: String, default: '' },
    },

    // Daily Reflection & Multi-Dimensional Mood Metrics
    reflection: {
      wentWell:    { type: String, default: '' },
      slowedDown:  { type: String, default: '' },
      learned:     { type: String, default: '' },
      improvement: { type: String, default: '' },
      rating:      { type: Number, min: 1, max: 5, default: 4 },
    },

    moodMetrics: {
      energy:      { type: Number, min: 1, max: 5, default: 3 },
      focus:       { type: Number, min: 1, max: 5, default: 4 },
      stress:      { type: Number, min: 1, max: 5, default: 2 },
      confidence:  { type: Number, min: 1, max: 5, default: 4 },
      motivation:  { type: Number, min: 1, max: 5, default: 4 },
    },

    status: {
      type:    String,
      enum:    ['planning', 'in-progress', 'reviewing', 'blocked', 'done'],
      default: 'in-progress',
    },

    isActive:   { type: Boolean, default: true, index: true },
    // IES-P1-27: epoch-ms (Number), matching every other timestamp on the doc.
    closedAt:   { type: Number },
    reopenedAt: { type: Number },
    mood:       { type: Number, min: 1, max: 5, default: 3 },
    tags:       [{ type: String }],

    totalActiveMs: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    // IES-P1-27: `problem` is exposed as a virtual so legacy clients can keep
    // reading `log.problem` while the DB stores exactly one source of truth
    // (`problemFlow.problem`).
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

workLogSchema.index({ userId: 1, isActive: 1, updatedAt: -1 });

// IES-P1-04: session-stop lookups and per-day workEntries.date range reports.
workLogSchema.index({ userId: 1, taskRef: 1 });
workLogSchema.index({ userId: 1, 'workEntries.date': 1 });

// IES-P1-08: totalActiveMs is derived from workEntries — one source of truth.
// Every save keeps the cached total in lock-step with the entries it aggregates.
// IES-P1-10: before deriving, every unbounded array is pruned to its cap so a
// document can never creep toward the 16 MB ceiling via the `save()` paths.
workLogSchema.pre('save', function (next) {
  pruneWorkLogArrays(this);
  this.totalActiveMs = (this.workEntries || []).reduce((sum, e) => sum + (e.activeMs || 0), 0);
  next();
});

// IES-P1-27: fold the legacy top-level `problem` into `problemFlow.problem`.
// Reads and writes through `doc.problem` hit the single canonical field; the
// virtual is also serialized (toJSON/toObject virtuals: true) so old clients
// that still read `log.problem` keep working after the field is unset.
workLogSchema.virtual('problem').get(function () {
  return this.problemFlow?.problem ?? '';
});

workLogSchema.virtual('problem').set(function (value) {
  if (value == null) return;
  if (!this.problemFlow) this.problemFlow = {};
  this.problemFlow.problem = String(value);
});

module.exports = mongoose.model('WorkLog', workLogSchema);

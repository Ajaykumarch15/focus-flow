const mongoose = require('mongoose');

// Timeline event entry (auto-captured from timer or manually logged)
const timelineEntrySchema = new mongoose.Schema({
  timestamp:   { type: Number, default: Date.now },
  type:        { type: String, enum: ['timer_start', 'timer_pause', 'timer_resume', 'timer_stop', 'note', 'snapshot', 'completed_item', 'decision', 'blocker'], default: 'note' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  category:    { type: String, default: 'General' },
  metadata:    { type: mongoose.Schema.Types.Mixed },
}, { _id: true });

// Technical Decision item
const decisionSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  context:      { type: String, default: '' },
  decision:     { type: String, default: '' },
  alternatives: { type: String, default: '' },
  rationale:    { type: String, default: '' },
  timestamp:    { type: Number, default: Date.now },
}, { _id: true });

// Structured Blocker item
const blockerItemSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  severity:   { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status:     { type: String, enum: ['open', 'investigating', 'blocked', 'resolved'], default: 'open' },
  notes:      { type: String, default: '' },
  resolvedAt: { type: Number },
  createdAt:  { type: Number, default: Date.now },
}, { _id: true });

// Progress Snapshot item
const progressSnapshotSchema = new mongoose.Schema({
  period:    { type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Custom'], default: 'Morning' },
  text:      { type: String, required: true },
  timestamp: { type: Number, default: Date.now },
}, { _id: true });

// Categorized Completed Item
const completedItemSchema = new mongoose.Schema({
  text:        { type: String, required: true },
  category:    { type: String, enum: ['feature', 'bug', 'refactor', 'research', 'documentation', 'general'], default: 'feature' },
  done:        { type: Boolean, default: true },
  completedAt: { type: Number, default: Date.now },
  createdAt:   { type: Number, default: Date.now },
}, { _id: true });

// Categorized Link
const linkSchema = new mongoose.Schema({
  label:    { type: String, required: true },
  url:      { type: String, required: true },
  category: { type: String, enum: ['Figma', 'GitHub', 'Jira', 'Linear', 'Documentation', 'API', 'Database', 'PR', 'Meeting Notes', 'General'], default: 'General' },
}, { _id: true });

// Attachment Schema
const attachmentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  type:        { type: String, default: 'file' },
  url:         { type: String, required: true },
  sizeBytes:   { type: Number, default: 0 },
  uploadDate:  { type: Number, default: Date.now },
  description: { type: String, default: '' },
}, { _id: true });

// Work Entry per calendar day
const workEntrySchema = new mongoose.Schema({
  date:        { type: Date,   required: true },
  what:        { type: String, default: '' },
  startedAt:   { type: Number },
  endedAt:     { type: Number },
  activeMs:    { type: Number, default: 0 },
  sessionIds:  [{ type: mongoose.Schema.Types.ObjectId }],
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

    // Legacy string fields for backwards compatibility
    problem:     { type: String, default: '' },
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
    closedAt:   { type: Date },
    reopenedAt: { type: Date },
    mood:       { type: Number, min: 1, max: 5, default: 3 },
    tags:       [{ type: String }],

    totalActiveMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workLogSchema.index({ userId: 1, isActive: 1, updatedAt: -1 });

module.exports = mongoose.model('WorkLog', workLogSchema);

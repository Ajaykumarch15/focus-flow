const mongoose = require('mongoose');

// A Session is one continuous work block for a Task.
// Pauses are tracked with pauseLog entries so we can compute exact active time.
const pauseLogSchema = new mongoose.Schema({
  pauseStart:  { type: Number, required: true }, // epoch ms
  resumeTime:  { type: Number },                 // epoch ms — null if still paused
}, { _id: false });

const sessionSchema = new mongoose.Schema(
  {
    userId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    taskId:               { type: mongoose.Schema.Types.ObjectId, ref: 'Task',  required: true, index: true },
    startTime:            { type: Number, required: true },  // epoch ms
    endTime:              { type: Number },                  // epoch ms — null while running
    pauseLog:             [pauseLogSchema],
    // IES-P1-07: durations/counts are never negative; focusScore is bounded 0-100.
    totalPauseDuration:   { type: Number, default: 0, min: 0 },   // ms
    pauseCount:           { type: Number, default: 0, min: 0 },
    activeTime:           { type: Number, default: 0, min: 0 },   // ms (endTime - startTime - pauses)
    focusScore:           { type: Number, default: 0, min: 0, max: 100 },
    isActive:             { type: Boolean, default: true },   // false once stopped
    // IES-P1-26: last client heartbeat (epoch ms). Defaults to creation time so
    // a brand-new session is never instantly stale; the reaper closes sessions
    // whose heartbeat stopped STALE_MS ago. Docs created before this field was
    // added have no value — the reaper only reaps those if startTime is also old.
    lastHeartbeat:        { type: Number, default: Date.now },
    clientOpId:           { type: String },                   // IES-P1-05 offline replay idempotency key (start)
    appliedOpIds:         { type: [String], default: [] },    // IES-P1-05 opIds already applied to this session
  },
  { timestamps: true }
);

// IES-P1-04: compound indexes for report range scans and active/orphan lookups.
sessionSchema.index({ userId: 1, startTime: 1, isActive: 1 });
sessionSchema.index({ userId: 1, isActive: 1, startTime: 1 });
// IES-P1-26: reaper scans active sessions by last heartbeat.
sessionSchema.index({ userId: 1, isActive: 1, lastHeartbeat: 1 });

// IES-P1-05: unique per-user client opId so a replayed START can never create a
// second session, even under concurrent replays. Mirrors migration 0004.
sessionSchema.index(
  { userId: 1, clientOpId: 1 },
  { unique: true, partialFilterExpression: { clientOpId: { $exists: true } } }
);

module.exports = mongoose.model('Session', sessionSchema);

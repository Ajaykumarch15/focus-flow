const mongoose = require('mongoose');

// A PersonalSession is one continuous work block for a PersonalTask.
// Pauses are tracked with pauseLog entries so we can compute exact active time.
const pauseLogSchema = new mongoose.Schema({
  pauseStart:  { type: Number, required: true }, // epoch ms
  resumeTime:  { type: Number },                 // epoch ms — null if still paused
}, { _id: false });

const personalSessionSchema = new mongoose.Schema(
  {
    userId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User',         required: true, index: true },
    personalTaskId:       { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalTask', required: true, index: true },
    startTime:            { type: Number, required: true },  // epoch ms
    endTime:              { type: Number },                  // epoch ms — null while running
    pauseLog:             [pauseLogSchema],
    totalPauseDuration:   { type: Number, default: 0, min: 0 },   // ms
    pauseCount:           { type: Number, default: 0, min: 0 },
    activeTime:           { type: Number, default: 0, min: 0 },   // ms (endTime - startTime - pauses)
    focusScore:           { type: Number, default: 0, min: 0, max: 100 },
    isActive:             { type: Boolean, default: true },   // false once stopped
    lastHeartbeat:        { type: Number, default: Date.now },
    clientOpId:           { type: String },
    appliedOpIds:         { type: [String], default: [] },
  },
  { timestamps: true }
);

personalSessionSchema.index({ userId: 1, startTime: 1, isActive: 1 });
personalSessionSchema.index({ userId: 1, isActive: 1, startTime: 1 });
personalSessionSchema.index({ userId: 1, isActive: 1, lastHeartbeat: 1 });

personalSessionSchema.index(
  { userId: 1, clientOpId: 1 },
  { unique: true, partialFilterExpression: { clientOpId: { $exists: true } } }
);

module.exports = mongoose.model('PersonalSession', personalSessionSchema);

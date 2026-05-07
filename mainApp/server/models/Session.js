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
    totalPauseDuration:   { type: Number, default: 0 },      // ms
    activeTime:           { type: Number, default: 0 },      // ms (endTime - startTime - pauses)
    isActive:             { type: Boolean, default: true },   // false once stopped
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);

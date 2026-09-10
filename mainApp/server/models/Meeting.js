const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    date: { type: String, required: true, index: true }, // Format: "YYYY-MM-DD"
    startTime: { type: String, required: true }, // Format: "HH:mm" (24-hr)
    endTime: { type: String, required: true },   // Format: "HH:mm" (24-hr)
    allDay: { type: Boolean, default: false },
    platform: {
      type: String,
      enum: ['google_meet', 'zoom', 'teams', 'other'],
      default: 'google_meet',
    },
    meetingLink: { type: String, default: '' },
    location: { type: String, default: '' },
    category: {
      type: String,
      enum: ['essentials', 'standup', 'review', 'brainstorm', 'other'],
      default: 'essentials',
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    notes: { type: String, default: '' },
    tags: [{ type: String }],
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  },
  { timestamps: true }
);

meetingSchema.index({ organizerId: 1, date: 1 });
meetingSchema.index({ workspaceId: 1, date: 1 });
meetingSchema.index({ participantIds: 1, date: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);

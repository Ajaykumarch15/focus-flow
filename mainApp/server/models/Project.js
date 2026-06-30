const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    googleFolderId: {
      type:    String,
      default: '',
    },
    workLogsFolderId: {
      type:    String,
      default: '',
    },
    designDocsFolderId: {
      type:    String,
      default: '',
    },
    meetingNotesFolderId: {
      type:    String,
      default: '',
    },
    reportsFolderId: {
      type:    String,
      default: '',
    },
  },
  { timestamps: true }
);

// Unique project name per user
projectSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Project', projectSchema);

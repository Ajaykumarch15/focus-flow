const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    name: { type: String, trim: true, maxlength: 100, default: '' },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: {
      content: { type: String, default: '' },
      senderName: { type: String, default: '' },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      createdAt: { type: Date, default: null },
    },
    unreadCounts: { type: Map, of: Number, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

conversationSchema.index({ workspaceRef: 1, participants: 1 });
conversationSchema.index({ workspaceRef: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);

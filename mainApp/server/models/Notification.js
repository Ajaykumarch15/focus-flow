const mongoose = require('mongoose');

// IES-P2-05: per-user notifications (workspace invites, role changes, removals,
// and future mention/assignment events). Created alongside the workspace events
// in workspaces.js; read via the protected /api/notifications surface.
//
// TTL mirror of Activity: unread push notifications are only useful for a
// bounded window, so stale rows age out and the collection cannot grow forever.
const NOTIFICATION_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const NOTIFICATION_TYPES = [
  'assigned',
  'mentioned',
  'completed',
  'review_requested',
  'blocker_added',
  'sprint_started',
  'report_shared',
  'invited',
  'role_changed',
  'removed',
];

const notificationSchema = new mongoose.Schema(
  {
    // Recipient of the notification.
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Workspace the event happened in (null for non-workspace events).
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    // Who triggered the event.
    actor: {
      id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name:   { type: String, required: true, trim: true, maxlength: 100 },
      email:  { type: String, default: '' },
      avatar: { type: String, default: '' },
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body:  { type: String, default: '', maxlength: 2000 },
    targetUrl: { type: String, default: '' },
    read:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS });
// IES-P2-05: the notification feed reads newest-first for one user.
notificationSchema.index({ userId: 1, createdAt: -1 });
// Unread-badge count query: { userId, read: false }.
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.NOTIFICATION_TTL_SECONDS = NOTIFICATION_TTL_SECONDS;

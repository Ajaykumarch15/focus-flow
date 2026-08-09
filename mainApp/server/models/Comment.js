const mongoose = require('mongoose');

// EEP2-P5.3.1 (DDS §4.14 / SAD §10.x): async comment threads on collaborative
// targets, persisted as a top-level collection (previously client-mock in
// useCollaborationStore.discussions). `targetRef` is polymorphic — the id of a
// Task / WorkLog / Project / doc target, resolved + membership-gated by
// utils/targetValidation.js before any write. Replies are first-class docs whose
// `parentId` points at the root comment; GET collapses them into the root's
// `replies` array to mirror the client DiscussionComment shape.
const COMMENT_TARGET_TYPES = ['task', 'worklog', 'project', 'doc'];

const commentSchema = new mongoose.Schema(
  {
    // null for personal targets (worklog); set for workspace-scoped targets so
    // membership can be re-verified on later reads without re-resolving.
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    targetType: { type: String, enum: COMMENT_TARGET_TYPES, required: true },
    targetRef: { type: mongoose.Schema.Types.ObjectId, required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true, trim: true, maxlength: 200 },
    authorAvatar: { type: String, default: '' },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    // e.g. { '👍': ['<userId>', ...] } — string user ids so the client compares
    // without ObjectId churn; empty maps are deleted from the store on toggle-off.
    reactions: { type: Map, of: [String], default: {} },
    isResolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// EEP_V2 P5.3.1: { targetRef } thread index + newest-first board reads. The
// `parentId: null` filter only touches the root-comment lookup in GET, so the
// compound index serves both the per-thread page query and its sort.
commentSchema.index({ targetType: 1, targetRef: 1, parentId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
module.exports.COMMENT_TARGET_TYPES = COMMENT_TARGET_TYPES;

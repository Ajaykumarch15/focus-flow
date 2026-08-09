const mongoose = require('mongoose');

// EEP2-P5.3.2 (DDS §4.14 / SAD §10.x): file attachments on collaborative
// targets, persisted as a top-level collection. `targetRef` is polymorphic —
// the id of a Task / WorkLog / Project / doc target, resolved + membership-gated
// by utils/targetValidation.js before any write (same gate as Comment).
// `url` is the file link the client supplies (there is no binary store), so the
// write is validated + capped like a worklog attachment entry.
const ATTACHMENT_TARGET_TYPES = ['task', 'worklog', 'project', 'doc'];

// EEP2-P5.3.2 acceptance: size caps. A single attachment cannot claim more than
// MAX_ATTACHMENT_SIZE_BYTES, and a target cannot outgrow MAX_ATTACHMENTS_PER_TARGET
// (mirrors ARRAY_CAPS.attachments for embedded worklog attachments).
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_ATTACHMENTS_PER_TARGET = 200;

const attachmentSchema = new mongoose.Schema(
  {
    // null for personal targets (worklog); set for workspace-scoped targets so
    // membership can be re-verified on later reads without re-resolving.
    workspaceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    targetType: { type: String, enum: ATTACHMENT_TARGET_TYPES, required: true },
    targetRef: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, trim: true, maxlength: 100, default: 'file' },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    sizeBytes: { type: Number, default: 0, min: 0, max: MAX_ATTACHMENT_SIZE_BYTES },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploaderName: { type: String, required: true, trim: true, maxlength: 200 },
    uploaderAvatar: { type: String, default: '' },
  },
  { timestamps: true }
);

// EEP_V2 P5.3.2 / Phase 5 DB work: the `{ targetRef }` index — newest-first
// reads per target plus the per-target count cap in POST.
attachmentSchema.index({ targetType: 1, targetRef: 1, createdAt: -1 });
attachmentSchema.index({ targetRef: 1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
module.exports.ATTACHMENT_TARGET_TYPES = ATTACHMENT_TARGET_TYPES;
module.exports.MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_BYTES;
module.exports.MAX_ATTACHMENTS_PER_TARGET = MAX_ATTACHMENTS_PER_TARGET;

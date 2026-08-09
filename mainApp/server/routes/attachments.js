const express = require('express');
const Attachment = require('../models/Attachment');
const Activity = require('../models/Activity');
const Workspace = require('../models/Workspace');
const protect = require('../middleware/auth');
const { findMember } = require('../middleware/workspace');
const { z, objectId, requiredString, validate } = require('../utils/validation');
const text = (max, label) => z.string().trim().max(max, `${label} too long (max ${max})`);
const { parsePageSize, decodeCursor, paginateCursor } = require('../utils/pagination');
const { validateTarget } = require('../utils/targetValidation');

const router = express.Router();
router.use(protect);

const { ATTACHMENT_TARGET_TYPES, MAX_ATTACHMENT_SIZE_BYTES, MAX_ATTACHMENTS_PER_TARGET } = Attachment;

const attachmentQuerySchema = z.object({
  targetType: z.enum(ATTACHMENT_TARGET_TYPES),
  targetRef: objectId,
  limit: z.string().optional(),
  cursor: z.string().max(200).optional(),
});

// EEP2-P5.3.2 acceptance: size caps are enforced in the create schema —
// sizeBytes is capped at MAX_ATTACHMENT_SIZE_BYTES before anything is written.
const attachmentCreateSchema = z.object({
  targetType: z.enum(ATTACHMENT_TARGET_TYPES),
  targetRef: objectId,
  name: requiredString(200, 'name'),
  type: text(100, 'type').optional(),
  url: requiredString(2000, 'url'),
  sizeBytes: z.coerce
    .number()
    .finite('sizeBytes must be a number')
    .min(0, 'sizeBytes must be at least 0')
    .max(MAX_ATTACHMENT_SIZE_BYTES, `sizeBytes must not exceed ${MAX_ATTACHMENT_SIZE_BYTES}`)
    .optional(),
  description: text(2000, 'description').optional(),
});

const attachmentParamsSchema = z.object({ id: objectId });

// Server JSON mirrors the client TaskAttachment shape — the store maps the
// polymorphic `targetRef` field back onto its `targetId`.
function toAttachmentJson(attachment) {
  return {
    id: String(attachment._id),
    workspaceId: attachment.workspaceRef ? String(attachment.workspaceRef) : '',
    targetType: attachment.targetType,
    targetRef: String(attachment.targetRef),
    name: attachment.name,
    type: attachment.type,
    url: attachment.url,
    sizeBytes: Number(attachment.sizeBytes || 0),
    description: attachment.description,
    uploadedBy: {
      id: String(attachment.uploadedBy),
      name: attachment.uploaderName,
      ...(attachment.uploaderAvatar ? { avatar: attachment.uploaderAvatar } : {}),
    },
    createdAt: attachment.createdAt,
  };
}

// Resolve the polymorphic target and gate the caller; on failure it sends the
// response and returns null so the route can bail. On success returns the
// validation result (workspaceRef for the new doc).
async function gateTarget(req, res, targetType, targetRef) {
  const target = await validateTarget(req.user, { targetType, targetRef });
  if (!target.ok) {
    res.status(target.status).json({ message: target.message });
    return null;
  }
  return target;
}

// GET /api/attachments?targetType=&targetRef=&limit=&cursor=
// Newest-first keyset page of the target's attachments.
router.get('/', validate(null, { query: attachmentQuerySchema }), async (req, res, next) => {
  try {
    const { targetType, targetRef } = req.query;
    const cursor = decodeCursor(req.query.cursor);
    if (cursor && cursor.error) return res.status(400).json({ message: 'Invalid cursor' });

    const target = await gateTarget(req, res, targetType, targetRef);
    if (!target) return;

    const limit = parsePageSize(req.query.limit);
    const page = await paginateCursor({
      model: Attachment,
      filter: { targetType, targetRef },
      tField: 'createdAt',
      limit,
      cursor,
    });

    res.json({
      items: page.items.map((a) => toAttachmentJson(a)),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/attachments — attach a file (by URL) to a validated target.
router.post('/', validate(attachmentCreateSchema), async (req, res, next) => {
  try {
    const { targetType, targetRef, name, type, url, sizeBytes, description } = req.body;
    const target = await gateTarget(req, res, targetType, targetRef);
    if (!target) return;

    // EEP2-P5.3.2 acceptance: per-target count cap (mirrors ARRAY_CAPS.attachments).
    const count = await Attachment.countDocuments({ targetType, targetRef });
    if (count >= MAX_ATTACHMENTS_PER_TARGET) {
      return res.status(400).json({ message: `Attachment limit reached (${MAX_ATTACHMENTS_PER_TARGET})` });
    }

    const attachment = await Attachment.create({
      workspaceRef: target.workspaceRef,
      targetType,
      targetRef,
      name,
      type: type || 'file',
      url,
      sizeBytes: sizeBytes || 0,
      description: description || '',
      uploadedBy: req.user._id,
      uploaderName: req.user.name,
      uploaderAvatar: req.user.avatar || '',
    });

    Activity.create({
      userId: req.user._id,
      action: 'attachment.created',
      workspaceRef: target.workspaceRef,
      details: { targetType, targetRef: String(targetRef) },
    }).catch(() => {});

    res.status(201).json(toAttachmentJson(attachment));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/attachments/:id — uploader, or any non-Viewer workspace member
// for workspace targets (mirrors the comment delete gate).
router.delete('/:id', validate(null, { params: attachmentParamsSchema }), async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
    const target = await gateTarget(req, res, attachment.targetType, attachment.targetRef);
    if (!target) return;

    const isUploader = String(attachment.uploadedBy) === String(req.user._id);
    if (!isUploader) {
      if (attachment.workspaceRef) {
        const ws = await Workspace.findById(attachment.workspaceRef).select('members');
        const m = ws && findMember(ws, req.user._id);
        if (!m || m.role === 'Viewer') {
          return res.status(403).json({ message: 'Only the uploader or a workspace editor can delete this attachment' });
        }
      } else {
        return res.status(403).json({ message: 'Only the uploader can delete this attachment' });
      }
    }

    await Attachment.deleteOne({ _id: attachment._id });
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

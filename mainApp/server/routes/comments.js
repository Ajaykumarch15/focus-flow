const express = require('express');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const Workspace = require('../models/Workspace');
const protect = require('../middleware/auth');
const { findMember } = require('../middleware/workspace');
const { z, objectId, requiredString, validate } = require('../utils/validation');
const { parsePageSize, decodeCursor, paginateCursor } = require('../utils/pagination');
const { validateTarget } = require('../utils/targetValidation');

const router = express.Router();
router.use(protect);

const TARGET_TYPES = ['task', 'worklog', 'project', 'doc'];

const commentQuerySchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetRef: objectId,
  limit: z.string().optional(),
  cursor: z.string().max(200).optional(),
});

const commentCreateSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetRef: objectId,
  content: requiredString(5000, 'content', 'Comment is required'),
  parentId: objectId.nullable().optional(),
});

const commentParamsSchema = z.object({ id: objectId });
const reactionBodySchema = z.object({
  emoji: z.string().trim().min(1, 'emoji is required').max(8, 'emoji too long'),
});

// reactions is a mongoose Map of emoji → userId[]; collapse to a plain object of
// string ids so the client DiscussionComment.reactions matches exactly.
function reactionsToPlain(comment) {
  const raw = comment.reactions || {};
  const entries = typeof raw.entries === 'function' ? [...raw.entries()] : Object.entries(raw);
  return Object.fromEntries(
    entries.map(([emoji, ids]) => [emoji, (ids || []).map((x) => String(x))])
  );
}

// Server JSON mirrors the client DiscussionComment shape — the store maps the
// polymorphic `targetRef` field back onto its `targetId`.
function toCommentJson(comment, replies = []) {
  return {
    id: String(comment._id),
    workspaceId: comment.workspaceRef ? String(comment.workspaceRef) : '',
    targetType: comment.targetType,
    targetRef: String(comment.targetRef),
    parentId: comment.parentId ? String(comment.parentId) : null,
    author: {
      id: String(comment.authorId),
      name: comment.authorName,
      ...(comment.authorAvatar ? { avatar: comment.authorAvatar } : {}),
    },
    content: comment.content,
    createdAt: comment.createdAt,
    reactions: reactionsToPlain(comment),
    replies: replies.map((r) => toCommentJson(r)),
    isResolved: Boolean(comment.isResolved),
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

// GET /api/comments?targetType=&targetRef=&limit=&cursor=
// Newest-first keyset page of ROOT comments; replies are fetched and nested.
router.get('/', validate(null, { query: commentQuerySchema }), async (req, res, next) => {
  try {
    const { targetType, targetRef } = req.query;
    const cursor = decodeCursor(req.query.cursor);
    if (cursor && cursor.error) return res.status(400).json({ message: 'Invalid cursor' });

    const target = await gateTarget(req, res, targetType, targetRef);
    if (!target) return;

    const limit = parsePageSize(req.query.limit);
    const page = await paginateCursor({
      model: Comment,
      filter: { targetType, targetRef, parentId: null },
      tField: 'createdAt',
      limit,
      cursor,
    });

    const rootIds = page.items.map((c) => c._id);
    const replies = rootIds.length
      ? await Comment.find({ parentId: { $in: rootIds } }).sort({ createdAt: 1 })
      : [];
    const byParent = new Map();
    for (const r of replies) {
      const key = String(r.parentId);
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(r);
    }

    res.json({
      items: page.items.map((c) => toCommentJson(c, byParent.get(String(c._id)) || [])),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/comments — new root comment or a reply to a root comment.
router.post('/', validate(commentCreateSchema), async (req, res, next) => {
  try {
    const { targetType, targetRef, content, parentId } = req.body;
    const target = await gateTarget(req, res, targetType, targetRef);
    if (!target) return;

    if (parentId) {
      const parent = await Comment.findById(parentId);
      if (!parent) return res.status(404).json({ message: 'Parent comment not found' });
      // Replies stay within the same thread — never allow a reply to hop targets.
      if (parent.targetType !== targetType || String(parent.targetRef) !== String(targetRef)) {
        return res.status(400).json({ message: 'Reply must target the same thread' });
      }
    }

    const comment = await Comment.create({
      workspaceRef: target.workspaceRef,
      targetType,
      targetRef,
      parentId: parentId || null,
      authorId: req.user._id,
      authorName: req.user.name,
      authorAvatar: req.user.avatar || '',
      content,
      reactions: {},
    });

    Activity.create({
      userId: req.user._id,
      action: 'comment.created',
      workspaceRef: target.workspaceRef,
      details: { targetType, targetRef: String(targetRef) },
    }).catch(() => {});

    res.status(201).json(toCommentJson(comment));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/comments/:id/reactions — toggle the caller's reaction on a comment.
router.patch('/:id/reactions', validate(reactionBodySchema, { params: commentParamsSchema }), async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    const target = await gateTarget(req, res, comment.targetType, comment.targetRef);
    if (!target) return;

    const emoji = req.body.emoji;
    const raw = comment.reactions || {};
    const map = raw instanceof Map ? new Map(raw) : new Map(Object.entries(raw));
    const me = String(req.user._id);
    const current = map.get(emoji) || [];
    const updated = current.includes(me) ? current.filter((x) => x !== me) : [...current, me];
    if (updated.length) map.set(emoji, updated);
    else map.delete(emoji);
    comment.reactions = map;
    await comment.save();

    res.json(toCommentJson(comment));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/comments/:id/resolve — toggle thread resolution.
router.patch('/:id/resolve', validate(null, { params: commentParamsSchema }), async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    const target = await gateTarget(req, res, comment.targetType, comment.targetRef);
    if (!target) return;
    comment.isResolved = !comment.isResolved;
    await comment.save();
    res.json(toCommentJson(comment));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/comments/:id — author, or any non-Viewer workspace member for
// workspace threads. Cascades to the thread's replies.
router.delete('/:id', validate(null, { params: commentParamsSchema }), async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    const target = await gateTarget(req, res, comment.targetType, comment.targetRef);
    if (!target) return;

    const isAuthor = String(comment.authorId) === String(req.user._id);
    if (!isAuthor) {
      if (comment.workspaceRef) {
        const ws = await Workspace.findById(comment.workspaceRef).select('members');
        const m = ws && findMember(ws, req.user._id);
        if (!m || m.role === 'Viewer') {
          return res.status(403).json({ message: 'Only the author or a workspace editor can delete this comment' });
        }
      } else {
        return res.status(403).json({ message: 'Only the author can delete this comment' });
      }
    }

    await Comment.deleteMany({ $or: [{ _id: comment._id }, { parentId: comment._id }] });
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

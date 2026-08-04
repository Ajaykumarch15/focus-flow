// IES-P2-05 · real, per-user notifications surface.
//
// Replaces the fabricated notification center data in the frontend:
//   GET    /api/notifications               → newest-first, keyset-paginated
//   GET    /api/notifications/unread-count  → cheap badge poll ({ count })
//   PATCH  /api/notifications/read-all      → mark all read
//   PATCH  /api/notifications/:id/read      → mark one read (owner only)
//
// Notifications are created alongside the workspace events in workspaces.js
// (invite / role change / removal); this router only reads + marks them.
const express = require('express');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');
const { z, objectId, validate } = require('../utils/validation');
const { parsePageSize, decodeCursor, paginateCursor } = require('../utils/pagination');

const router = express.Router();
router.use(protect);

const notificationParamsSchema = z.object({ id: objectId });

// IES-P2-05: same bounded-page contract as the activity feed / admin list.
const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1, 'limit must be at least 1').max(100, 'limit must be at most 100').optional(),
    cursor: z.string().max(500, 'cursor too long').optional(),
    unreadOnly: z.enum(['true', 'false']).optional(),
  })
  .passthrough();

// Serializes a Notification doc into the frontend NotificationItem shape
// (src/types/collaboration.ts).
function toNotificationJson(n) {
  return {
    id: String(n._id),
    workspaceId: n.workspaceRef ? String(n.workspaceRef) : '',
    recipientId: String(n.userId),
    actor: {
      id: n.actor && n.actor.id ? String(n.actor.id) : '',
      name: (n.actor && n.actor.name) || 'Unknown',
      avatar: n.actor && n.actor.avatar ? n.actor.avatar : undefined,
    },
    type: n.type,
    title: n.title,
    body: n.body || '',
    targetUrl: n.targetUrl || undefined,
    createdAt: n.createdAt,
    read: Boolean(n.read),
  };
}

// ── GET /api/notifications ─────────────────────────────────────────────────────
router.get('/', validate(null, { query: listQuerySchema }), async (req, res, next) => {
  try {
    const limit = parsePageSize(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    if (cursor && cursor.error) return res.status(400).json({ message: 'Invalid cursor' });

    const filter = { userId: req.user._id };
    if (req.query.unreadOnly === 'true') filter.read = false;

    const page = await paginateCursor({
      model: Notification,
      filter,
      tField: 'createdAt',
      limit,
      cursor,
    });
    res.json({ items: page.items.map(toNotificationJson), hasMore: page.hasMore, nextCursor: page.nextCursor });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/notifications/unread-count — lightweight badge poll ───────────────
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/notifications/read-all ──────────────────────────────────────────
router.patch('/read-all', async (req, res, next) => {
  try {
    const { modifiedCount } = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ updated: modifiedCount });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/notifications/:id/read — owner-only single mark-read ────────────
router.patch('/:id/read', validate(null, { params: notificationParamsSchema }), async (req, res, next) => {
  try {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true } },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Notification not found' });
    res.json(toNotificationJson(note));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const protect = require('../middleware/auth');
const { z, objectId, requiredString, validate } = require('../utils/validation');
const Workspace = require('../models/Workspace');

const router = express.Router();
router.use(protect);

const createConversationSchema = z.object({
  workspaceId: objectId,
  participantIds: z.array(objectId).min(1, 'At least one participant required').max(50, 'Too many participants'),
  name: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
});

const messagesQuerySchema = z.object({
  limit: z.string().optional(),
  before: z.string().optional(),
});

const messageCreateSchema = z.object({
  content: requiredString(5000, 'content', 'Message cannot be empty'),
  replyTo: objectId.nullable().optional(),
});

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(8),
});

const paramsSchema = z.object({ id: objectId });
const msgParamsSchema = z.object({ id: objectId, msgId: objectId });

function toConversationJson(conv) {
  const unreadRaw = conv.unreadCounts || {};
  const unreadMap = unreadRaw instanceof Map
    ? Object.fromEntries([...unreadRaw.entries()].map(([k, v]) => [String(k), v]))
    : Object.fromEntries(Object.entries(unreadRaw).map(([k, v]) => [String(k), v]));

  return {
    id: String(conv._id),
    workspaceId: String(conv.workspaceRef),
    type: conv.type,
    name: conv.name,
    description: conv.description || '',
    participants: conv.participants.map((p) => String(p)),
    lastMessage: conv.lastMessage?.content
      ? {
          content: conv.lastMessage.content,
          senderName: conv.lastMessage.senderName,
          senderId: conv.lastMessage.senderId ? String(conv.lastMessage.senderId) : null,
          createdAt: conv.lastMessage.createdAt,
        }
      : null,
    unreadCounts: unreadMap,
    createdBy: String(conv.createdBy),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

function reactionsToPlain(msg) {
  const raw = msg.reactions || {};
  const entries = typeof raw.entries === 'function' ? [...raw.entries()] : Object.entries(raw);
  return Object.fromEntries(
    entries.map(([emoji, ids]) => [emoji, (ids || []).map((x) => String(x))])
  );
}

function toMessageJson(msg) {
  return {
    id: String(msg._id),
    conversationId: String(msg.conversationId),
    sender: {
      id: String(msg.senderId),
      name: msg.senderName,
      ...(msg.senderAvatar ? { avatar: msg.senderAvatar } : {}),
    },
    content: msg.content,
    replyTo: msg.replyTo ? String(msg.replyTo) : null,
    reactions: reactionsToPlain(msg),
    edited: Boolean(msg.edited),
    editedAt: msg.editedAt || null,
    deleted: Boolean(msg.deleted),
    deletedAt: msg.deletedAt || null,
    readBy: (msg.readBy || []).map((r) => ({ user: String(r.user), readAt: r.readAt })),
    createdAt: msg.createdAt,
  };
}

// GET /api/chat/conversations?workspaceId=
router.get('/conversations', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    const convs = await Conversation.find({
      workspaceRef: workspaceId,
      participants: req.user._id,
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    res.json(convs.map(toConversationJson));
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/conversations
router.post('/conversations', validate(createConversationSchema), async (req, res, next) => {
  try {
    const { workspaceId, participantIds, name, description } = req.body;

    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    const allParticipantIds = [...new Set([String(req.user._id), ...participantIds])];

    if (allParticipantIds.length === 2) {
      const existing = await Conversation.findOne({
        workspaceRef: workspaceId,
        type: 'direct',
        participants: { $all: allParticipantIds, $size: allParticipantIds.length },
      }).lean();

      if (existing) {
        return res.json(toConversationJson(existing));
      }
    }

    const conv = await Conversation.create({
      workspaceRef: workspaceId,
      type: allParticipantIds.length === 2 ? 'direct' : 'group',
      name: name || '',
      description: description || '',
      participants: allParticipantIds,
      createdBy: req.user._id,
    });

    res.status(201).json(toConversationJson(conv));
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/conversations/:id
router.get('/conversations/:id', validate(null, { params: paramsSchema }), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Not a participant' });
    }
    res.json(toConversationJson(conv));
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/conversations/:id/participants
router.get('/conversations/:id/participants', validate(null, { params: paramsSchema }), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Not a participant' });
    }

    const users = await User.find({ _id: { $in: conv.participants } })
      .select('name email avatar roleId')
      .populate({ path: 'roleId', select: 'name level' })
      .lean();

    res.json(users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      avatar: u.avatar || '',
      role: u.roleId?.name || 'Member',
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/conversations/:id/unread-count
router.get('/conversations/:id/unread-count', validate(null, { params: paramsSchema }), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Not a participant' });
    }

    const count = await Message.countDocuments({
      conversationId: req.params.id,
      senderId: { $ne: req.user._id },
      'readBy.user': { $ne: req.user._id },
    });

    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/conversations/:id/messages?limit=&before=
router.get('/conversations/:id/messages', validate(null, { params: paramsSchema, query: messagesQuerySchema }), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Not a participant' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const filter = { conversationId: req.params.id };
    if (req.query.before) {
      filter.createdAt = { $lt: new Date(req.query.before) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(messages.reverse().map(toMessageJson));
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/conversations/:id/messages
router.post('/conversations/:id/messages', validate(null, { params: paramsSchema }), validate(messageCreateSchema), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Not a participant' });
    }

    if (req.body.replyTo) {
      const replyMsg = await Message.findById(req.body.replyTo).lean();
      if (!replyMsg || String(replyMsg.conversationId) !== req.params.id) {
        return res.status(400).json({ message: 'Invalid reply target' });
      }
    }

    const msg = await Message.create({
      conversationId: req.params.id,
      senderId: req.user._id,
      senderName: req.user.name,
      senderAvatar: req.user.avatar || '',
      content: req.body.content,
      replyTo: req.body.replyTo || null,
      readBy: [{ user: req.user._id, readAt: new Date() }],
    });

    await Conversation.findByIdAndUpdate(req.params.id, {
      lastMessage: {
        content: req.body.content,
        senderName: req.user.name,
        senderId: req.user._id,
        createdAt: new Date(),
      },
      updatedAt: new Date(),
    });

    res.status(201).json(toMessageJson(msg));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/chat/conversations/:id/messages/:msgId
router.patch('/conversations/:id/messages/:msgId', validate(null, { params: msgParamsSchema }), async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.conversationId) !== req.params.id) {
      return res.status(400).json({ message: 'Message does not belong to this conversation' });
    }
    if (String(msg.senderId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Can only edit your own messages' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Content required' });

    msg.content = content.trim();
    msg.edited = true;
    msg.editedAt = new Date();
    await msg.save();

    res.json(toMessageJson(msg));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chat/conversations/:id/messages/:msgId
router.delete('/conversations/:id/messages/:msgId', validate(null, { params: msgParamsSchema }), async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.conversationId) !== req.params.id) {
      return res.status(400).json({ message: 'Message does not belong to this conversation' });
    }
    if (String(msg.senderId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Can only delete your own messages' });
    }

    msg.deleted = true;
    msg.deletedAt = new Date();
    msg.content = 'This message has been deleted';
    await msg.save();

    res.json(toMessageJson(msg));
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/conversations/:id/messages/:msgId/reactions
router.post('/conversations/:id/messages/:msgId/reactions', validate(null, { params: msgParamsSchema }), validate(reactionSchema), async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.conversationId) !== req.params.id) {
      return res.status(400).json({ message: 'Message does not belong to this conversation' });
    }

    const emoji = req.body.emoji;
    const raw = msg.reactions || {};
    const map = raw instanceof Map ? new Map(raw) : new Map(Object.entries(raw));
    const me = String(req.user._id);
    const current = map.get(emoji) || [];
    const updated = current.includes(me) ? current.filter((x) => x !== me) : [...current, me];
    if (updated.length) map.set(emoji, updated);
    else map.delete(emoji);
    msg.reactions = map;
    await msg.save();

    res.json(toMessageJson(msg));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/chat/conversations/:id/read
router.patch('/conversations/:id/read', validate(null, { params: paramsSchema }), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Not a participant' });
    }

    await Message.updateMany(
      {
        conversationId: req.params.id,
        senderId: { $ne: req.user._id },
        'readBy.user': { $ne: req.user._id },
      },
      { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
    );

    const userId = String(req.user._id);
    const unreadRaw = conv.unreadCounts || {};
    const unreadMap = unreadRaw instanceof Map ? unreadRaw : new Map(Object.entries(unreadRaw));
    unreadMap.set(userId, 0);
    await Conversation.findByIdAndUpdate(req.params.id, { unreadCounts: Object.fromEntries(unreadMap) });

    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { SESSION_COOKIE } = require('../middleware/auth');

const onlineUsers = new Map();
const socketMeta = new Map();
const typingTimers = new Map();

function extractToken(socket) {
  const headerToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (headerToken) return headerToken;
  const queryToken = socket.handshake.query?.token;
  if (queryToken) return queryToken;
  const cookieHeader = socket.handshake.headers?.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').find(c => c.trim().startsWith(`${SESSION_COOKIE}=`));
  return match ? match.trim().split('=')[1] : null;
}

function broadcastPresence(userId, isOnline) {
  if (!global.io) return;
  global.io.emit('presence_update', { userId, isOnline });
}

function initSocket(io) {
  global.io = io;

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id || decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;

    try {
      const user = await User.findById(userId);
      if (!user) {
        socket.disconnect();
        return;
      }

      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      socketMeta.set(socket.id, { userId, workspaces: new Set(), conversations: new Set() });

      if (onlineUsers.get(userId).size === 1) {
        broadcastPresence(userId, true);
      }

      socket.on('join_workspace', ({ workspaceId }) => {
        if (!workspaceId) return;
        socket.join(`ws:${workspaceId}`);
        const meta = socketMeta.get(socket.id);
        if (meta) meta.workspaces.add(workspaceId);
      });

      socket.on('leave_workspace', ({ workspaceId }) => {
        if (!workspaceId) return;
        socket.leave(`ws:${workspaceId}`);
        const meta = socketMeta.get(socket.id);
        if (meta) meta.workspaces.delete(workspaceId);
      });

      socket.on('join_conversation', ({ conversationId }) => {
        if (!conversationId) return;
        socket.join(`conv:${conversationId}`);
        const meta = socketMeta.get(socket.id);
        if (meta) meta.conversations.add(conversationId);
      });

      socket.on('leave_conversation', ({ conversationId }) => {
        if (!conversationId) return;
        socket.leave(`conv:${conversationId}`);
        const meta = socketMeta.get(socket.id);
        if (meta) meta.conversations.delete(conversationId);
      });

      socket.on('send_message', async (data, ack) => {
        try {
          const { conversationId, content, replyTo } = data;
          if (!conversationId || !content) {
            return ack?.({ error: 'conversationId and content are required' });
          }

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            return ack?.({ error: 'Conversation not found' });
          }

          const msg = await Message.create({
            conversation: conversationId,
            sender: userId,
            content,
            replyTo: replyTo || undefined,
            readBy: [userId]
          });

          await Conversation.findByIdAndUpdate(conversationId, { lastMessage: msg._id });

          for (const memberId of conversation.members) {
            if (memberId.toString() !== userId) {
              await Conversation.findByIdAndUpdate(conversationId, {
                $inc: { [`unreadCounts.${memberId}`]: 1 }
              });
            }
          }

          const populated = await Message.findById(msg._id).populate('sender', 'name avatar email');
          const msgJson = populated.toObject();

          io.to(`conv:${conversationId}`).emit('new_message', msgJson);

          ack?.({ ok: true, message: msgJson });
        } catch (err) {
          console.error('send_message error:', err);
          ack?.({ error: err.message });
        }
      });

      socket.on('add_reaction', async ({ messageId, conversationId, emoji }) => {
        try {
          if (!messageId || !conversationId || !emoji) return;

          const message = await Message.findById(messageId);
          if (!message) return;

          const reactions = message.reactions || [];
          const existing = reactions.find(r => r.emoji === emoji);

          if (existing) {
            const userIndex = existing.users.findIndex(u => u.toString() === userId);
            if (userIndex > -1) {
              existing.users.splice(userIndex, 1);
              if (existing.users.length === 0) {
                message.reactions = reactions.filter(r => r.emoji !== emoji);
              }
            } else {
              existing.users.push(userId);
            }
          } else {
            reactions.push({ emoji, users: [userId] });
            message.reactions = reactions;
          }

          await message.save();

          const updated = await Message.findById(messageId).populate('sender', 'name avatar email');

          io.to(`conv:${conversationId}`).emit('reaction_update', {
            messageId,
            reactions: updated.reactions
          });
        } catch (err) {
          console.error('add_reaction error:', err);
        }
      });

      socket.on('typing_start', ({ conversationId }) => {
        if (!conversationId) return;
        const key = `${socket.id}:${conversationId}`;

        if (typingTimers.has(key)) {
          clearTimeout(typingTimers.get(key));
        }

        typingTimers.set(key, setTimeout(() => {
          socket.to(`conv:${conversationId}`).emit('user_typing', {
            conversationId,
            userId,
            isTyping: false
          });
          typingTimers.delete(key);
        }, 5000));

        socket.to(`conv:${conversationId}`).emit('user_typing', {
          conversationId,
          userId,
          isTyping: true
        });
      });

      socket.on('typing_stop', ({ conversationId }) => {
        if (!conversationId) return;
        const key = `${socket.id}:${conversationId}`;

        if (typingTimers.has(key)) {
          clearTimeout(typingTimers.get(key));
          typingTimers.delete(key);
        }

        socket.to(`conv:${conversationId}`).emit('user_typing', {
          conversationId,
          userId,
          isTyping: false
        });
      });

      socket.on('mark_read', async ({ conversationId }) => {
        try {
          if (!conversationId) return;

          await Conversation.findByIdAndUpdate(conversationId, {
            [`unreadCounts.${userId}`]: 0
          });

          await Message.updateMany(
            { conversation: conversationId, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
          );

          io.to(`conv:${conversationId}`).emit('messages_read', {
            conversationId,
            userId,
            readAt: new Date()
          });
        } catch (err) {
          console.error('mark_read error:', err);
        }
      });

      socket.on('disconnect', async () => {
        const userSockets = onlineUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUsers.delete(userId);
            broadcastPresence(userId, false);
          }
        }

        const meta = socketMeta.get(socket.id);
        if (meta) {
          for (const convId of meta.conversations) {
            const key = `${socket.id}:${convId}`;
            if (typingTimers.has(key)) {
              clearTimeout(typingTimers.get(key));
              typingTimers.delete(key);
            }
            socket.to(`conv:${convId}`).emit('user_typing', {
              conversationId: convId,
              userId,
              isTyping: false
            });
          }
          socketMeta.delete(socket.id);
        }
      });
    } catch (err) {
      console.error('Socket connection error:', err);
      socket.disconnect();
    }
  });
}

module.exports = { initSocket, onlineUsers };

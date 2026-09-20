import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { api } from '@shared/utils/api';
import { useAuthStore } from '@shared/services/useAuthStore';

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: { id: string; name: string; avatar?: string };
  content: string;
  replyTo: string | null;
  reactions: Record<string, string[]>;
  edited: boolean;
  editedAt: string | null;
  deleted: boolean;
  deletedAt: string | null;
  readBy: { user: string; readAt: string }[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  type: 'direct' | 'group';
  name: string;
  description: string;
  participants: string[];
  lastMessage: {
    content: string;
    senderName: string;
    senderId: string | null;
    createdAt: string;
  } | null;
  unreadCounts: Record<string, number>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
}

interface ChatState {
  socket: Socket | null;
  connected: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  typingUsers: Record<string, Set<string>>;
  onlineUsers: Record<string, boolean>;
  chatOpen: boolean;
  searchQuery: string;
  participants: Record<string, Participant[]>;
  loadingMessages: boolean;
  _participantNames: Record<string, string>;

  connect: () => void;
  disconnect: () => void;
  loadConversations: (workspaceId: string) => Promise<void>;
  createConversation: (workspaceId: string, participantIds: string[], name?: string) => Promise<Conversation>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadMoreMessages: (conversationId: string) => Promise<boolean>;
  sendMessage: (conversationId: string, content: string, replyTo?: string) => void;
  editMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  toggleReaction: (conversationId: string, messageId: string, emoji: string) => void;
  setActiveConversation: (id: string | null) => void;
  setChatOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  markAsRead: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  loadParticipants: (conversationId: string) => Promise<void>;
  openConversationWith: (userId: string, workspaceId: string) => Promise<Conversation>;
  getUnreadCount: (conversationId: string) => number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  socket: null,
  connected: false,
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  onlineUsers: {},
  chatOpen: false,
  searchQuery: '',
  participants: {},
  loadingMessages: false,
  _participantNames: {},

  connect: () => {
    const existing = get().socket;
    if (existing?.connected) return;

    const BASE = import.meta.env.VITE_API_URL;
    const socketUrl = BASE.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const socket = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));

    socket.on('online_users', ({ userIds }: { userIds: string[] }) => {
      const map: Record<string, boolean> = {};
      for (const id of userIds) map[id] = true;
      set({ onlineUsers: map });
    });

    socket.on('presence_update', ({ userId, status }: { userId: string; status: string }) => {
      set((state) => ({
        onlineUsers: { ...state.onlineUsers, [userId]: status === 'online' },
      }));
    });

    socket.on('new_message', (msg: ChatMessage) => {
      set((state) => {
        const convId = msg.conversationId;
        const existing = state.messages[convId] || [];
        const deduped = existing.some((m) => m.id === msg.id) ? existing : [...existing, msg];
        const conversations = state.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: {
                  content: msg.content,
                  senderName: msg.sender.name,
                  senderId: msg.sender.id,
                  createdAt: msg.createdAt,
                },
                updatedAt: msg.createdAt,
              }
            : c
        );
        conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return { messages: { ...state.messages, [convId]: deduped }, conversations };
      });
    });

    socket.on('reaction_update', ({ conversationId, messageId, reactions }: { conversationId: string; messageId: string; reactions: Record<string, string[]> }) => {
      set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
          messages: {
            ...state.messages,
            [conversationId]: msgs.map((m) =>
              m.id === messageId ? { ...m, reactions } : m
            ),
          },
        };
      });
    });

    socket.on('user_typing', ({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
      set((state) => {
        const current = new Set(state.typingUsers[conversationId] || []);
        if (isTyping) current.add(userId);
        else current.delete(userId);
        return { typingUsers: { ...state.typingUsers, [conversationId]: current } };
      });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  loadConversations: async (workspaceId: string) => {
    try {
      const convs = await api.chat.listConversations(workspaceId);
      const nameMap: Record<string, string> = {};
      set({ conversations: convs, _participantNames: nameMap });
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  },

  createConversation: async (workspaceId: string, participantIds: string[], name?: string) => {
    const conv = await api.chat.createConversation({ workspaceId, participantIds, name });
    set((state) => {
      const exists = state.conversations.some((c) => c.id === conv.id);
      return {
        conversations: exists ? state.conversations : [conv, ...state.conversations],
      };
    });
    return conv;
  },

  loadMessages: async (conversationId: string) => {
    set({ loadingMessages: true });
    try {
      const msgs = await api.chat.getMessages(conversationId, { limit: 50 });
      set((state) => ({ messages: { ...state.messages, [conversationId]: msgs }, loadingMessages: false }));
      const { socket } = get();
      socket?.emit('join_conversation', { conversationId });
    } catch (err) {
      console.error('Failed to load messages', err);
      set({ loadingMessages: false });
    }
  },

  loadMoreMessages: async (conversationId: string) => {
    const msgs = get().messages[conversationId] || [];
    if (msgs.length === 0) return false;
    const oldest = msgs[0];
    try {
      const older = await api.chat.getMessages(conversationId, { limit: 50, before: oldest.createdAt });
      if (older.length === 0) return false;
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: [...older, ...(state.messages[conversationId] || [])],
        },
      }));
      return true;
    } catch {
      return false;
    }
  },

  sendMessage: (conversationId: string, content: string, replyTo?: string) => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('send_message', { conversationId, content, replyTo });
  },

  editMessage: async (conversationId: string, messageId: string, content: string) => {
    try {
      const updated = await api.chat.editMessage(conversationId, messageId, content);
      set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
          messages: {
            ...state.messages,
            [conversationId]: msgs.map((m) => (m.id === messageId ? { ...m, ...updated } : m)),
          },
        };
      });
    } catch (err) {
      console.error('Failed to edit message', err);
    }
  },

  deleteMessage: async (conversationId: string, messageId: string) => {
    try {
      const updated = await api.chat.deleteMessage(conversationId, messageId);
      set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
          messages: {
            ...state.messages,
            [conversationId]: msgs.map((m) => (m.id === messageId ? { ...m, ...updated } : m)),
          },
        };
      });
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  },

  toggleReaction: (conversationId: string, messageId: string, emoji: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('add_reaction', { conversationId, messageId, emoji });
    }
  },

  setActiveConversation: (id: string | null) => {
    const prev = get().activeConversationId;
    const { socket } = get();
    if (prev && prev !== id) {
      socket?.emit('leave_conversation', { conversationId: prev });
    }
    set({ activeConversationId: id });
    if (id) {
      socket?.emit('join_conversation', { conversationId: id });
    }
  },

  setChatOpen: (open: boolean) => set({ chatOpen: open }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  markAsRead: (conversationId: string) => {
    const { socket } = get();
    socket?.emit('mark_read', { conversationId });
    api.chat.markRead(conversationId).catch(() => {});
    const userId = useAuthStore.getState().user?._id || '';
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, unreadCounts: { ...c.unreadCounts, [userId]: 0 } }
          : c
      ),
    }));
  },

  setTyping: (conversationId: string, isTyping: boolean) => {
    const { socket } = get();
    if (isTyping) socket?.emit('typing_start', { conversationId });
    else socket?.emit('typing_stop', { conversationId });
  },

  loadParticipants: async (conversationId: string) => {
    try {
      const parts = await api.chat.getParticipants(conversationId);
      const nameMap: Record<string, string> = {};
      for (const p of parts) nameMap[p.id] = p.name;
      set((state) => ({
        participants: { ...state.participants, [conversationId]: parts },
        _participantNames: { ...state._participantNames, ...nameMap },
      }));
    } catch (err) {
      console.error('Failed to load participants', err);
    }
  },

  openConversationWith: async (userId: string, workspaceId: string) => {
    const conv = await get().createConversation(workspaceId, [userId]);
    get().setActiveConversation(conv.id);
    await get().loadMessages(conv.id);
    set({ chatOpen: true });
    return conv;
  },

  getUnreadCount: (conversationId: string) => {
    const state = get();
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (!conv) return 0;
    const userId = useAuthStore.getState().user?._id || '';
    return conv.unreadCounts[userId] || 0;
  },
}));

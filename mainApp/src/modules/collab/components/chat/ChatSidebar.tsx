import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useChatStore } from '@collab/stores/useChatStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useAuthStore } from '@shared/services/useAuthStore';
import { ConversationItem } from './ConversationItem';
import { ChatPanel } from './ChatPanel';
import { CreateConversationModal } from './CreateConversationModal';

export function ChatSidebar() {
  const chatOpen = useChatStore((s) => s.chatOpen);
  const setChatOpen = useChatStore((s) => s.setChatOpen);
  const connect = useChatStore((s) => s.connect);
  const disconnect = useChatStore((s) => s.disconnect);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const connected = useChatStore((s) => s.connected);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const workspaceId = useWorkspaceId();
  const user = useAuthStore((s) => s.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [userStatus, setUserStatus] = useState<'available' | 'away' | 'dnd'>('available');

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (workspaceId && connected) {
      loadConversations(workspaceId);
    }
  }, [workspaceId, connected, loadConversations]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (conv.name?.toLowerCase().includes(q)) return true;
    if (conv.lastMessage?.content?.toLowerCase().includes(q)) return true;
    return false;
  });

  const handleClose = () => {
    setActiveConversation(null);
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || '?';
  const userName = user?.name || 'Unknown';
  const statusLabel =
    userStatus === 'available' ? 'Available' : userStatus === 'away' ? 'Away' : 'Do Not Disturb';
  const statusColor =
    userStatus === 'available'
      ? 'bg-success-400'
      : userStatus === 'away'
      ? 'bg-amber-400'
      : 'bg-red-400';

  return (
    <>
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              onClick={() => setChatOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full lg:w-[380px] bg-surface-900 border-l border-surface-800 shadow-2xl flex flex-col"
            >
              {activeConversationId ? (
                <ChatPanel onClose={handleClose} />
              ) : (
                <div className="flex flex-col h-full">
                  {/* Profile Section */}
                  <div className="p-4 border-b border-surface-800/60">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-cyan-400 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {userInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-100 truncate">{userName}</p>
                        <div className="relative">
                          <button
                            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                            className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                          >
                            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                            <span>{statusLabel}</span>
                            {statusDropdownOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                          <AnimatePresence>
                            {statusDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="absolute top-full left-0 mt-1 w-40 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 py-1"
                              >
                                {(['available', 'away', 'dnd'] as const).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => {
                                      setUserStatus(s);
                                      setStatusDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                                      userStatus === s
                                        ? 'bg-brand-500/10 text-surface-100'
                                        : 'text-surface-300 hover:bg-surface-700'
                                    }`}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        s === 'available'
                                          ? 'bg-success-400'
                                          : s === 'away'
                                          ? 'bg-amber-400'
                                          : 'bg-red-400'
                                      }`}
                                    />
                                    {s === 'available' ? 'Available' : s === 'away' ? 'Away' : 'Do Not Disturb'}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search conversations..."
                        className="w-full pl-9 pr-3 py-2 bg-surface-800/60 border border-surface-800 rounded-xl text-sm text-surface-100 placeholder-surface-500 outline-none focus:border-brand-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Header with connection indicator */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-800/40">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-brand-400" />
                      <h2 className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Messages</h2>
                      {connected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success-400" title="Connected" />
                      )}
                    </div>
                  </div>

                  {/* Conversation List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
                    {filteredConversations.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-surface-500">
                        <MessageSquare size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">{conversations.length === 0 ? 'No conversations yet' : 'No results found'}</p>
                        <p className="text-xs mt-1">
                          {conversations.length === 0 ? 'Start a new conversation' : 'Try a different search'}
                        </p>
                      </div>
                    )}
                    {filteredConversations.map((conv) => {
                      const isGroup = conv.type === 'group';
                      const displayName = isGroup ? conv.name || 'Group Chat' : 'Direct Message';
                      const otherUserId = isGroup ? '' : conv.participants.find((p) => p !== user?._id) || '';
                      const hasTypingUsers =
                        typingUsers[conv.id] && typingUsers[conv.id].size > 0;
                      return (
                        <ConversationItem
                          key={conv.id}
                          conv={conv}
                          isActive={conv.id === activeConversationId}
                          onClick={() => setActiveConversation(conv.id)}
                          otherUserName={displayName}
                          otherUserId={otherUserId}
                          hasTypingUsers={hasTypingUsers}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB for new conversation */}
      {chatOpen && !activeConversationId && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 flex items-center justify-center hover:bg-brand-600 transition-colors lg:bottom-6 lg:right-6"
          aria-label="New conversation"
        >
          <Plus size={20} />
        </motion.button>
      )}

      <CreateConversationModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

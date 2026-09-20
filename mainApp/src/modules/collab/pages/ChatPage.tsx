import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MessageSquare, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useChatStore } from '@collab/stores/useChatStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useAuthStore } from '@shared/services/useAuthStore';
import { ConversationItem } from '@collab/components/chat/ConversationItem';
import { ChatPanel } from '@collab/components/chat/ChatPanel';
import { CreateConversationModal } from '@collab/components/chat/CreateConversationModal';

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConversationId = searchParams.get('c') || null;
  const connect = useChatStore((s) => s.connect);
  const disconnect = useChatStore((s) => s.disconnect);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const conversations = useChatStore((s) => s.conversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const connected = useChatStore((s) => s.connected);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const workspaceId = useWorkspaceId();
  const user = useAuthStore((s) => s.user);
  const members = useCollaborationStore((s) => s.members);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [userStatus, setUserStatus] = useState<'available' | 'away' | 'dnd'>('available');
  const [mobileShowChat, setMobileShowChat] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (workspaceId && connected) {
      loadConversations(workspaceId);
    }
  }, [workspaceId, connected, loadConversations]);

  useEffect(() => {
    if (workspaceId) {
      useCollaborationStore.getState().loadMembers(workspaceId);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (activeConversationId) {
      setActiveConversation(activeConversationId);
      setMobileShowChat(true);
    } else {
      setActiveConversation(null);
      setMobileShowChat(false);
    }
  }, [activeConversationId, setActiveConversation]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      if (conv.name?.toLowerCase().includes(q)) return true;
      if (conv.lastMessage?.content?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [conversations, searchQuery]);

  const handleSelectConversation = (id: string) => {
    setSearchParams({ c: id });
  };

  const handleBack = () => {
    setSearchParams({});
    setMobileShowChat(false);
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
    <div className="flex h-[calc(100vh-3.5rem)] bg-surface-950 overflow-hidden">
      {/* Left Panel: Conversation List */}
      <div
        className={`w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 border-r border-surface-800/60 flex flex-col bg-surface-950 ${
          mobileShowChat ? 'hidden lg:flex' : 'flex'
        }`}
      >
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

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-800/40">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-brand-400" />
            <h2 className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Messages</h2>
            {connected && (
              <span className="w-1.5 h-1.5 rounded-full bg-success-400" title="Connected" />
            )}
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
            aria-label="New conversation"
          >
            <Plus size={16} />
          </button>
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
            const otherUserId = isGroup ? '' : conv.participants.find((p) => p !== user?._id) || '';
            const otherMember = members.find((m) => m.id === otherUserId);
            const displayName = isGroup ? conv.name || 'Group Chat' : otherMember?.name || 'Direct Message';
            const hasTypingUsers = typingUsers[conv.id] && typingUsers[conv.id].size > 0;
            return (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConversationId}
                onClick={() => handleSelectConversation(conv.id)}
                otherUserName={displayName}
                otherUserId={otherUserId}
                hasTypingUsers={hasTypingUsers}
              />
            );
          })}
        </div>
      </div>

      {/* Right Panel: Active Chat */}
      <div
        className={`flex-1 flex flex-col min-w-0 bg-surface-950 ${
          mobileShowChat ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {activeConversationId ? (
          <>
            {/* Mobile back button */}
            <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-surface-800/60">
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="text-sm text-surface-300 font-medium">Back</span>
            </div>
            <ChatPanel conversationId={activeConversationId} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-500">
            <div className="w-16 h-16 rounded-2xl bg-surface-800/60 flex items-center justify-center mb-4">
              <MessageSquare size={28} className="opacity-30" />
            </div>
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1 text-surface-600">Choose from the list or start a new one</p>
          </div>
        )}
      </div>

      <CreateConversationModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

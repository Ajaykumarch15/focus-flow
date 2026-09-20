import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@collab/stores/useChatStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { OnlineStatusBadge } from './OnlineStatusBadge';

export function CreateConversationModal({
  isOpen,
  onClose,
  preselectedUserId,
}: {
  isOpen: boolean;
  onClose: () => void;
  preselectedUserId?: string;
}) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupChat, setGroupChat] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const members = useCollaborationStore((s) => s.members);
  const user = useAuthStore((s) => s.user);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const createConversation = useChatStore((s) => s.createConversation);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const loadMessages = useChatStore((s) => s.loadMessages);

  useEffect(() => {
    if (isOpen && preselectedUserId) {
      setSelectedIds(new Set([preselectedUserId]));
    }
  }, [isOpen, preselectedUserId]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIds(new Set());
      setGroupChat(false);
      setGroupName('');
    }
  }, [isOpen]);

  const filtered = members.filter((m) => {
    if (m.id === user?._id) return false;
    if (!search) return true;
    return m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0 || !workspaceId) return;
    setCreating(true);
    try {
      const ids = [...selectedIds];
      const conv = await createConversation(workspaceId, ids, groupChat ? groupName : undefined);
      setActiveConversation(conv.id);
      await loadMessages(conv.id);
      navigate(`/collab/${workspaceId}/chat?c=${conv.id}`);
      onClose();
    } catch (err) {
      console.error('Failed to create conversation', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
                <h2 className="text-sm font-semibold text-surface-100">New Conversation</h2>
                <button onClick={onClose} className="p-1 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupChat}
                      onChange={(e) => setGroupChat(e.target.checked)}
                      className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-xs text-surface-300">Group chat</span>
                  </label>
                </div>

                {groupChat && (
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name (optional)"
                    className="w-full px-3 py-2 bg-surface-800/60 border border-surface-800 rounded-xl text-sm text-surface-100 placeholder-surface-500 outline-none focus:border-brand-500/50"
                  />
                )}

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members..."
                    className="w-full pl-9 pr-3 py-2 bg-surface-800/60 border border-surface-800 rounded-xl text-sm text-surface-100 placeholder-surface-500 outline-none focus:border-brand-500/50"
                  />
                </div>

                {selectedIds.size > 0 && (
                  <p className="text-[11px] text-surface-400">{selectedIds.size} member(s) selected</p>
                )}

                <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin">
                  {filtered.map((m) => {
                    const selected = selectedIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleSelect(m.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                          selected ? 'bg-brand-500/10 text-surface-50' : 'text-surface-300 hover:bg-surface-800/60'
                        }`}
                      >
                        <div className="relative">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400/80 to-cyan-400/80 flex items-center justify-center text-[10px] font-bold text-white">
                            {m.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <OnlineStatusBadge userId={m.id} size="sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-[11px] text-surface-400 truncate">{m.email}</p>
                        </div>
                        {selected && (
                          <div className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <p className="text-sm text-surface-500 text-center py-4">No members found</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-800">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-surface-300 hover:text-surface-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={selectedIds.size === 0 || creating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <MessageSquare size={12} />
                  {creating ? 'Creating...' : 'Start Chat'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

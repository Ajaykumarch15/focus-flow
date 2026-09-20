import { useState } from 'react';
import { X } from 'lucide-react';
import { useChatStore } from '@collab/stores/useChatStore';
import { OnlineStatusBadge } from './OnlineStatusBadge';
import { ParticipantsPanel } from './ParticipantsPanel';

export function ChatHeader({
  conversationId,
  otherUserName,
  otherUserId,
  onClose,
}: {
  conversationId: string;
  otherUserName: string;
  otherUserId: string;
  onClose: () => void;
}) {
  const conv = useChatStore((s) => s.conversations.find((c) => c.id === conversationId));
  const isGroup = conv?.type === 'group';
  const displayName = isGroup ? conv?.name || 'Group Chat' : otherUserName;
  const [activeTab, setActiveTab] = useState<'messages' | 'participants'>('messages');
  const [showParticipants, setShowParticipants] = useState(false);

  const initial = displayName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="flex border-b border-surface-800/60">
      <div className="flex-1 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400/80 to-cyan-400/80 flex items-center justify-center text-xs font-bold text-white">
              {initial}
            </div>
            {!isGroup && <OnlineStatusBadge userId={otherUserId} size="sm" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-100">{displayName}</h3>
            <p className="text-[11px] text-surface-400">
              {isGroup ? `${conv?.participants?.length || 0} members` : 'Direct message'}
            </p>
          </div>
        </div>

        {isGroup && (
          <div className="flex items-center gap-1 bg-surface-800/60 rounded-lg p-0.5">
            <button
              onClick={() => {
                setActiveTab('messages');
                setShowParticipants(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'messages'
                  ? 'bg-surface-700 text-surface-100'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => {
                setActiveTab('participants');
                setShowParticipants(true);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'participants'
                  ? 'bg-surface-700 text-surface-100'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              Participants
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="p-1.5 m-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors self-start"
        aria-label="Close chat"
      >
        <X size={16} />
      </button>

      {isGroup && showParticipants && (
        <ParticipantsPanel conversationId={conversationId} />
      )}
    </div>
  );
}

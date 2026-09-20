import { formatDistanceToNow } from 'date-fns';
import { Users } from 'lucide-react';
import { useAuthStore } from '@shared/services/useAuthStore';
import { OnlineStatusBadge } from './OnlineStatusBadge';
import type { Conversation } from '@collab/stores/useChatStore';

export function ConversationItem({
  conv,
  isActive,
  onClick,
  otherUserName,
  otherUserId,
  hasTypingUsers,
}: {
  conv: Conversation;
  isActive: boolean;
  onClick: () => void;
  otherUserName: string;
  otherUserId: string;
  hasTypingUsers?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const isGroup = conv.type === 'group';
  const displayName = isGroup ? conv.name || 'Group Chat' : otherUserName;
  const initial = displayName?.charAt(0)?.toUpperCase() || '?';
  const unreadCount = conv.unreadCounts[user?._id || ''] || 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
        isActive
          ? 'bg-brand-500/10 border-l-2 border-brand-500 text-surface-50'
          : 'border-l-2 border-transparent text-surface-300 hover:bg-surface-800/60 hover:text-surface-100'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {isGroup ? (
          <div className="w-10 h-10 rounded-xl bg-surface-700 flex items-center justify-center">
            <Users size={18} className="text-surface-400" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400/80 to-cyan-400/80 flex items-center justify-center text-sm font-bold text-white">
            {initial}
          </div>
        )}
        {!isGroup && <OnlineStatusBadge userId={otherUserId} size="sm" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {conv.lastMessage?.createdAt && (
            <span className="text-[10px] text-surface-500 flex-shrink-0 ml-2">
              {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
            </span>
          )}
        </div>
        <p className="text-xs text-surface-400 truncate mt-0.5">
          {hasTypingUsers ? (
            <span className="text-brand-400 italic">typing...</span>
          ) : conv.lastMessage ? (
            <>
              {conv.lastMessage.senderId === user?._id ? (
                <span className="text-surface-500">You: </span>
              ) : null}
              {conv.lastMessage.content}
            </>
          ) : (
            <span className="text-surface-600">No messages yet</span>
          )}
        </p>
      </div>

      {/* Unread Badge */}
      {unreadCount > 0 && (
        <div className="flex-shrink-0 ml-1">
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </div>
      )}
    </button>
  );
}

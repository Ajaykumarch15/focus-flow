import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SmilePlus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useChatStore } from '@collab/stores/useChatStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { EmojiPicker } from './EmojiPicker';
import { MessageStatus } from './MessageStatus';
import type { ChatMessage } from '@collab/stores/useChatStore';

export function MessageBubble({
  msg,
  showSender,
  conversationId,
}: {
  msg: ChatMessage;
  showSender: boolean;
  conversationId: string;
}) {
  const user = useAuthStore((s) => s.user);
  const isMine = msg.sender.id === user?._id;
  const initial = msg.sender.name?.charAt(0)?.toUpperCase() || '?';
  const toggleReaction = useChatStore((s) => s.toggleReaction);
  const messages = useChatStore((s) => s.messages[conversationId] || []);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const replyToMessage = msg.replyTo ? messages.find((m) => m.id === msg.replyTo) : null;

  if (msg.deleted) {
    return (
      <div className={`flex gap-2.5 px-4 py-1 ${isMine ? 'flex-row-reverse' : ''}`}>
        {showSender && <div className="w-7 h-7 flex-shrink-0" />}
        <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
          <div className="px-3 py-2 rounded-2xl bg-surface-800/40 text-sm italic text-surface-500 rounded-tl-md">
            This message was deleted
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 px-4 py-1 group ${isMine ? 'flex-row-reverse' : ''}`}>
      {showSender && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400/80 to-cyan-400/80 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-1">
          {initial}
        </div>
      )}
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {showSender && (
          <span className={`text-[11px] font-medium mb-0.5 ${isMine ? 'text-brand-400' : 'text-surface-400'}`}>
            {isMine ? 'You' : msg.sender.name}
          </span>
        )}

        {/* Reply Preview */}
        {replyToMessage && (
          <div className="w-full mb-1 px-3 py-1.5 rounded-lg bg-surface-800/50 border-l-2 border-brand-500/40">
            <p className="text-[10px] font-medium text-brand-400 mb-0.5">
              {replyToMessage.sender.name}
            </p>
            <p className="text-[11px] text-surface-400 truncate">
              {replyToMessage.deleted ? 'Deleted message' : replyToMessage.content}
            </p>
          </div>
        )}

        <div
          className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isMine
              ? 'bg-brand-500/20 text-surface-100 rounded-tr-md'
              : 'bg-surface-800 text-surface-200 rounded-tl-md'
          }`}
        >
          {msg.content}
        </div>

        {/* Edited label */}
        {msg.edited && (
          <span className="text-[10px] text-surface-500 mt-0.5 px-1 italic">(edited)</span>
        )}

        {/* Reactions */}
        {Object.keys(msg.reactions).length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1">
            {Object.entries(msg.reactions)
              .filter(([, users]) => users.length > 0)
              .map(([emoji, users]) => {
                const isActive = users.includes(user?._id || '');
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggleReaction(conversationId, msg.id, emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                        : 'bg-surface-800 text-surface-300 border border-surface-700 hover:bg-surface-700'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{users.length}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Add reaction button */}
        <div className="flex items-center gap-2 mt-0.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-surface-500 hover:text-surface-300 hover:bg-surface-800"
              aria-label="Add reaction"
            >
              <SmilePlus size={14} />
            </button>
            <AnimatePresence>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(emoji) => toggleReaction(conversationId, msg.id, emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>
          <span className="text-[10px] text-surface-500">
            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Message status for own messages */}
        {isMine && (
          <div className="flex justify-end mt-0.5">
            <MessageStatus readBy={msg.readBy} senderId={msg.sender.id} />
          </div>
        )}
      </div>
    </div>
  );
}

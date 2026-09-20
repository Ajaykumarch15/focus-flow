import { useEffect } from 'react';
import { useChatStore } from '@collab/stores/useChatStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const markAsRead = useChatStore((s) => s.markAsRead);
  const user = useAuthStore((s) => s.user);

  const conv = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    if (activeConversationId && !messages[activeConversationId]) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, messages, loadMessages]);

  useEffect(() => {
    if (activeConversationId) {
      markAsRead(activeConversationId);
    }
  }, [activeConversationId, markAsRead, messages]);

  if (!activeConversationId || !conv) {
    return (
      <div className="flex items-center justify-center h-full text-surface-500">
        <p className="text-sm">Select a conversation to start chatting</p>
      </div>
    );
  }

  const otherParticipant = conv.participants.find((p) => p !== user?._id) || '';
  const otherUserName = conv.type === 'direct' ? 'Member' : conv.name || 'Group';
  const otherUserId = otherParticipant;

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversationId={activeConversationId}
        otherUserName={otherUserName}
        otherUserId={otherUserId}
        onClose={onClose}
      />
      <MessageList conversationId={activeConversationId} />
      <ChatInput conversationId={activeConversationId} />
    </div>
  );
}

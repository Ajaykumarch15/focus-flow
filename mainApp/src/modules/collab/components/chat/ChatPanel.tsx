import { useEffect } from 'react';
import { useChatStore } from '@collab/stores/useChatStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatPanel({ conversationId }: { conversationId: string }) {
  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const markAsRead = useChatStore((s) => s.markAsRead);
  const members = useCollaborationStore((s) => s.members);
  const user = useAuthStore((s) => s.user);

  const conv = conversations.find((c) => c.id === conversationId);

  useEffect(() => {
    if (conversationId && !messages[conversationId]) {
      loadMessages(conversationId);
    }
  }, [conversationId, messages, loadMessages]);

  useEffect(() => {
    if (conversationId) {
      markAsRead(conversationId);
    }
  }, [conversationId, markAsRead, messages]);

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-surface-500">
        <p className="text-sm">Conversation not found</p>
      </div>
    );
  }

  const otherParticipant = conv.participants.find((p) => p !== user?._id) || '';
  const otherMember = members.find((m) => m.id === otherParticipant);
  const otherUserName = conv.type === 'direct' ? (otherMember?.name || 'Direct Message') : conv.name || 'Group';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatHeader
        conversationId={conversationId}
        otherUserName={otherUserName}
        otherUserId={otherParticipant}
      />
      <MessageList conversationId={conversationId} />
      <ChatInput conversationId={conversationId} />
    </div>
  );
}

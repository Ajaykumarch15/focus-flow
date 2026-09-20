import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useChatStore } from '@collab/stores/useChatStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { DateSeparator } from './DateSeparator';
import { JumpToBottom } from './JumpToBottom';

export function MessageList({ conversationId }: { conversationId: string }) {
  const messages = useChatStore((s) => s.messages[conversationId] || []);
  const typingUsers = useChatStore((s) => s.typingUsers[conversationId] || new Set());
  const loadingMessages = useChatStore((s) => s.loadingMessages);
  const user = useAuthStore((s) => s.user);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const lastMessageCountRef = useRef(messages.length);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      scrollToBottom();
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowJumpToBottom(distanceFromBottom > 200);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom('instant');
  }, [conversationId, scrollToBottom]);

  const typingNames = [...typingUsers]
    .filter((id) => id !== user?._id)
    .map(() => 'Someone');

  // Group messages by date
  const messagesWithDates: Array<{ type: 'date'; date: string } | { type: 'message'; msg: typeof messages[0]; index: number }> = [];
  let lastDate = '';

  messages.forEach((msg, i) => {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastDate) {
      messagesWithDates.push({ type: 'date', date: msg.createdAt });
      lastDate = msgDate;
    }
    messagesWithDates.push({ type: 'message', msg, index: i });
  });

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto py-3 space-y-1 scrollbar-thin relative">
      {/* Loading spinner */}
      {loadingMessages && (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={20} className="text-brand-400 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loadingMessages && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-surface-500">
          <p className="text-sm">No messages yet.</p>
          <p className="text-xs mt-1">Send the first message!</p>
        </div>
      )}

      {/* Messages */}
      {messagesWithDates.map((item) => {
        if (item.type === 'date') {
          return <DateSeparator key={`date-${item.date}`} date={item.date} />;
        }
        const { msg, index } = item;
        const prev = messages[index - 1];
        const showSender = !prev || prev.sender.id !== msg.sender.id;
        return (
          <MessageBubble
            key={msg.id}
            msg={msg}
            showSender={showSender}
            conversationId={conversationId}
          />
        );
      })}

      {typingNames.length > 0 && <TypingIndicator names={typingNames} />}

      <div ref={bottomRef} />

      <JumpToBottom onClick={() => scrollToBottom()} show={showJumpToBottom} />
    </div>
  );
}

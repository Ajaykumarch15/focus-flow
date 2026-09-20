import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, SmilePlus, Paperclip } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useChatStore } from '@collab/stores/useChatStore';
import { EmojiPicker } from './EmojiPicker';

export function ChatInput({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emitTyping = useCallback(
    (typing: boolean) => {
      if (typing === isTypingRef.current) return;
      isTypingRef.current = typing;
      setTyping(conversationId, typing);
    },
    [conversationId, setTyping]
  );

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      emitTyping(false);
    };
  }, [emitTyping]);

  const handleInput = (val: string) => {
    setText(val);
    emitTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(conversationId, trimmed);
    setText('');
    emitTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    textareaRef.current?.focus();
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleInputAutoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    handleInput(el.value);
  };

  return (
    <div className="border-t border-surface-800/60 bg-surface-950/80 p-3">
      <div className="flex items-end gap-2 bg-surface-800/60 rounded-2xl border border-surface-800 px-3 py-2">
        {/* Emoji picker */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
            aria-label="Open emoji picker"
          >
            <SmilePlus size={18} />
          </button>
          <AnimatePresence>
            {showEmojiPicker && (
              <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
            )}
          </AnimatePresence>
        </div>

        {/* Attachment button (placeholder) */}
        <button
          type="button"
          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors flex-shrink-0"
          aria-label="Attach file"
          onClick={() => {}}
        >
          <Paperclip size={18} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputAutoResize}
          onKeyDown={handleKeyDown}
          placeholder="Write your message..."
          rows={1}
          className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-500 resize-none outline-none max-h-[120px] min-h-[24px] leading-6"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

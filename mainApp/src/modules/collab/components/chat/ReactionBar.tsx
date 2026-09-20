import { Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface ReactionBarProps {
  reactions: Record<string, string[]>;
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

export function ReactionBar({ reactions, currentUserId, onToggle }: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1 relative">
      {entries.map(([emoji, users]) => {
        const isActive = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
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

      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setShowPicker((p) => !p)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-800 border border-surface-700 text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
        >
          <Plus size={12} />
        </button>

        {showPicker && (
          <div className="absolute z-50 bottom-full mb-1 right-0 bg-surface-800 border border-surface-700 rounded-lg shadow-xl p-1.5 flex gap-0.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(emoji);
                  setShowPicker(false);
                }}
                className="w-7 h-7 flex items-center justify-center text-base rounded-md hover:bg-surface-700 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

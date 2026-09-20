import { motion } from 'framer-motion';

const EMOJIS = ['😊', '❤️', '👍', '🔥', '👏', '😂', '😢', '😮', '🎉', '🚀', '👀', '💪'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 bottom-full mb-2 bg-surface-800 border border-surface-700 rounded-xl shadow-xl p-2 grid grid-cols-6 gap-1"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-surface-700 transition-colors"
        >
          {emoji}
        </button>
      ))}
    </motion.div>
  );
}

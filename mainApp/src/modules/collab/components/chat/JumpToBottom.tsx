import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

interface JumpToBottomProps {
  onClick: () => void;
  show: boolean;
}

export function JumpToBottom({ onClick, show }: JumpToBottomProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          onClick={onClick}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-9 h-9 rounded-full bg-surface-800 border border-surface-700 shadow-lg flex items-center justify-center text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-colors"
        >
          <ArrowDown size={16} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

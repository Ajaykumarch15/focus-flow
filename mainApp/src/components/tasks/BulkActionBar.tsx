import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Trash2, X, ListChecks } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Button } from '../ui/Button';

interface BulkActionBarProps {
  visible: boolean;
  selectedIds: string[];
  onSelectAll: () => void;
  totalCount: number;
  onComplete: () => void;
  onDelete: () => void;
}

export function BulkActionBar({ visible, selectedIds, onSelectAll, totalCount, onComplete, onDelete }: BulkActionBarProps) {
  const { clearTaskSelection } = useStore();
  const count = selectedIds.length;
  const allSelected = count === totalCount && totalCount > 0;

  return (
    <AnimatePresence>
      {visible && count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl backdrop-blur-xl">
            <span className="text-sm font-medium text-surface-200 mr-1">
              {count} selected
            </span>

            <div className="w-px h-5 bg-surface-700" />

            <Button
              size="sm"
              variant="ghost"
              onClick={onSelectAll}
              className="text-xs gap-1.5"
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              <ListChecks size={14} />
              {allSelected ? 'Deselect all' : `Select all (${totalCount})`}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onComplete}
              className="text-xs gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              <CheckCircle size={14} />
              Complete
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-xs gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 size={14} />
              Delete
            </Button>

            <div className="w-px h-5 bg-surface-700" />

            <Button
              size="sm"
              variant="ghost"
              onClick={clearTaskSelection}
              className="p-1.5 text-surface-400 hover:text-surface-200"
              title="Clear selection"
            >
              <X size={14} />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

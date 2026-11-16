import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ListChecks, Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';

interface WorkLogBulkBarProps {
  visible: boolean;
  count: number;
  totalCount: number;
  /** Selected logs that can still be completed (i.e. not already closed). */
  completableCount: number;
  busy?: boolean;
  onSelectAll: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Floating action bar for bulk operations on the work log list.
 * Mirrors the task list's BulkActionBar so selection behaves consistently
 * across the two list surfaces.
 */
export function WorkLogBulkBar({
  visible,
  count,
  totalCount,
  completableCount,
  busy = false,
  onSelectAll,
  onComplete,
  onDelete,
  onClear,
}: WorkLogBulkBarProps) {
  const allSelected = count === totalCount && totalCount > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            role="toolbar"
            aria-label="Bulk actions for selected work logs"
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl backdrop-blur-xl"
          >
            <span className="text-sm font-medium text-surface-200 mr-1 whitespace-nowrap">
              {count > 0 ? `${count} selected` : 'Select logs'}
            </span>

            <div className="w-px h-5 bg-surface-700" />

            <Button
              size="sm"
              variant="ghost"
              onClick={onSelectAll}
              disabled={busy || totalCount === 0}
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
              disabled={busy || completableCount === 0}
              className="text-xs gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
              title={
                completableCount === 0
                  ? 'Select at least one active log to complete'
                  : `Complete ${completableCount} log${completableCount > 1 ? 's' : ''}`
              }
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Complete
              {completableCount > 0 && count !== completableCount && (
                <span className="text-[10px] font-bold bg-emerald-500/15 rounded-md px-1.5 py-0.5">
                  {completableCount}
                </span>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              disabled={busy || count === 0}
              className="text-xs gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              title={count === 0 ? 'Select at least one log to delete' : `Delete ${count} log${count > 1 ? 's' : ''}`}
            >
              <Trash2 size={14} />
              Delete
            </Button>

            <div className="w-px h-5 bg-surface-700" />

            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              disabled={busy}
              className="p-1.5 text-surface-400 hover:text-surface-200"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X size={14} />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

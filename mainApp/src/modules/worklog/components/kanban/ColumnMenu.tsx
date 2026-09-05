import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Plus, ArrowUpDown, Calendar, Trash2 } from 'lucide-react';
import { useKanbanStore } from './kanbanStore';
import type { KanbanStatus } from './types';

interface ColumnMenuProps {
  columnId: KanbanStatus;
  columnTitle: string;
}

export function ColumnMenu({ columnId, columnTitle }: ColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { openAddModal, setSortBy } = useKanbanStore();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAddTask = () => {
    openAddModal(columnId);
    setOpen(false);
  };

  const handleSortPriority = () => {
    setSortBy('priority');
    setOpen(false);
  };

  const handleSortDueDate = () => {
    setSortBy('dueDate');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
        aria-label={`${columnTitle} menu`}
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 w-48 bg-surface-900 border border-surface-800 rounded-xl shadow-xl z-50 p-1.5"
            >
              <button
                onClick={handleAddTask}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-surface-300 hover:text-surface-50 hover:bg-surface-800 transition-colors text-left"
              >
                <Plus size={14} /> Add task
              </button>
              <div className="my-1 border-t border-surface-800" />
              <button
                onClick={handleSortPriority}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-surface-300 hover:text-surface-50 hover:bg-surface-800 transition-colors text-left"
              >
                <ArrowUpDown size={14} /> Sort by priority
              </button>
              <button
                onClick={handleSortDueDate}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-surface-300 hover:text-surface-50 hover:bg-surface-800 transition-colors text-left"
              >
                <Calendar size={14} /> Sort by due date
              </button>
              <div className="my-1 border-t border-surface-800" />
              <button
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left"
              >
                <Trash2 size={14} /> Delete column
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

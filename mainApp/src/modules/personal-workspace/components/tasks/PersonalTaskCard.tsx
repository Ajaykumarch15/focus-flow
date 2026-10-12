import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Link2, Timer, CheckCircle, Trash2, Calendar, MoreVertical, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { Button } from '@shared/components/ui/Button';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { getDeadlineStatus } from '@shared/utils/time';
import type { Task } from '@shared/types';

interface PersonalTaskCardProps {
  task: Task;
}

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  todo: { dot: 'bg-surface-400', label: 'To Do' },
  active: { dot: 'bg-blue-500', label: 'In Progress' },
  paused: { dot: 'bg-yellow-500', label: 'Paused' },
  completed: { dot: 'bg-emerald-500', label: 'Completed' },
};

const PRIORITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Urgent' },
  high: { bg: 'bg-pink-500/15', text: 'text-pink-400', label: 'High' },
  medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Medium' },
  low: { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'Low' },
};

export function PersonalTaskCard({ task }: PersonalTaskCardProps) {
  const navigate = useNavigate();
  const { completeTask, deleteTask } = usePersonalTaskStore();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const priority = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium;
  const subtasksDone = task.subtasks.filter(s => s.completed).length;
  const subtasksTotal = task.subtasks.length;
  const commentCount = (task as any).comments?.length || 0;

  const [parallelState, setParallelState] = useState(() =>
    parallelTimerEngine.getState(task.id)
  );
  const [display, setDisplay] = useState(() =>
    parallelTimerEngine.getFormattedDisplay(task.id)
  );

  useEffect(() => {
    const unsubscribe = parallelTimerEngine.subscribe((changedTaskId) => {
      if (changedTaskId === task.id || changedTaskId === '') {
        setParallelState(parallelTimerEngine.getState(task.id));
        setDisplay(parallelTimerEngine.getFormattedDisplay(task.id));
      }
    });
    return unsubscribe;
  }, [task.id]);

  const isRunning = parallelState === 'running';
  const isPaused = parallelState === 'paused';
  const hasTimer = isRunning || isPaused;

  const deadlineInfo = task.status !== 'completed' ? getDeadlineStatus(task.deadline) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-kebab-root]')) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status !== 'completed') await completeTask(task.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    await deleteTask(task.id);
    setShowConfirmDelete(false);
  };

  return (
    <>
      <motion.button
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        onClick={() => navigate(`/personal/tasks/${task.id}`)}
        className={`relative text-left w-full rounded-2xl border transition-all hover:border-brand-500/30 hover:bg-surface-850/80 cursor-pointer flex items-stretch ${menuOpen ? 'overflow-visible' : 'overflow-hidden'} ${
          isRunning
            ? 'border-blue-500/40 bg-blue-500/5 shadow-lg shadow-blue-500/10'
            : isPaused
            ? 'border-yellow-500/30 bg-yellow-500/5'
            : task.status === 'completed'
            ? 'opacity-60 border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900'
            : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900'
        }`}
      >
        {/* Color accent strip */}
        <div
          className="w-[3px] flex-shrink-0 rounded-l-2xl"
          style={{ backgroundColor: task.color || '#6366f1' }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 pl-3">
          {/* Top row: Status + Priority + Timer */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              {isRunning ? (
                <motion.span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-blue-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              ) : isPaused ? (
                <motion.span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-yellow-500"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              ) : (
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}`} />
              )}
              <span className="text-xs font-medium text-surface-400">
                {isRunning ? 'Running' : isPaused ? 'Paused' : status.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {hasTimer && (
                <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md">
                  <Timer size={9} />
                  {display}
                </span>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${priority.bg} ${priority.text}`}>
                {priority.label}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className={`text-sm font-semibold leading-snug line-clamp-2 lg:line-clamp-1 ${task.status === 'completed' ? 'line-through text-surface-500' : 'text-surface-50'}`}>
            {task.title}
          </h3>

          {/* Description preview */}
          {task.description && (
            <p className="hidden lg:block text-xs text-surface-500 mt-1 truncate">{task.description}</p>
          )}

          {/* Bottom: Counts + Deadline */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {commentCount > 0 && (
              <span className="hidden lg:flex items-center gap-1 text-[11px] text-surface-500">
                <MessageSquare size={11} />
                {commentCount}
              </span>
            )}
            {subtasksTotal > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-surface-500">
                <Link2 size={11} />
                {subtasksDone}/{subtasksTotal}
              </span>
            )}
            {deadlineInfo && (
              <span className={`flex items-center gap-1 text-[11px] ${
                deadlineInfo.status === 'overdue' ? 'text-red-400' : 'text-surface-500'
              }`}>
                <Calendar size={11} />
                {deadlineInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div data-kebab-root className="relative flex flex-col items-center justify-start gap-1 flex-shrink-0 pr-3 pt-3.5 lg:justify-center lg:pt-0">
          {task.status !== 'completed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleComplete}
              className="p-1.5 text-surface-400 hover:text-emerald-400"
              title="Complete task"
            >
              <CheckCircle size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="hidden lg:inline-flex p-1.5 text-surface-400 hover:text-red-400"
            title="Delete task"
          >
            <Trash2 size={14} />
          </Button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Task actions"
            className="lg:hidden p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <MoreVertical size={15} />
          </button>

          {/* Kebab menu (mobile) */}
          {menuOpen && (
            <div role="menu" data-no-nav
              className="absolute right-0 top-20 z-40 w-36 rounded-xl border border-surface-800 bg-surface-900 shadow-2xl p-1">
              <button
                role="menuitem"
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); navigate(`/personal/tasks/${task.id}`); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-surface-300 hover:text-surface-50 hover:bg-surface-850 transition-colors"
              >
                <ExternalLink size={13} /> Open task
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowConfirmDelete(true); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </motion.button>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Task?"
        message={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </>
  );
}

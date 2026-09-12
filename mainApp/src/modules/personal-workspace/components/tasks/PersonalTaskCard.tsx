import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Link2, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';
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

function getInitial(title: string): string {
  return title.charAt(0).toUpperCase() || '?';
}

export function PersonalTaskCard({ task }: PersonalTaskCardProps) {
  const navigate = useNavigate();
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

  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onClick={() => navigate(`/personal/tasks/${task.id}`)}
      className={`relative text-left w-full rounded-2xl border p-4 transition-all hover:border-brand-500/30 hover:bg-surface-850/80 cursor-pointer flex items-center gap-4 ${
        isRunning
          ? 'border-blue-500/40 bg-blue-500/5 shadow-lg shadow-blue-500/10'
          : isPaused
          ? 'border-yellow-500/30 bg-yellow-500/5'
          : task.status === 'completed'
          ? 'opacity-60 border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900'
          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900'
      }`}
    >
      {/* Left: Status dot + Title + Meta */}
      <div className="flex-1 min-w-0">
        {/* Top row: Status + Priority */}
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
        <h3 className={`text-sm font-semibold leading-snug truncate ${task.status === 'completed' ? 'line-through text-surface-500' : 'text-surface-50'}`}>
          {task.title}
        </h3>

        {/* Bottom: Counts */}
        {(commentCount > 0 || subtasksTotal > 0) && (
          <div className="flex items-center gap-3 mt-2">
            {commentCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-surface-500">
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
          </div>
        )}
      </div>

      {/* Right: Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ backgroundColor: task.color || '#6366f1' }}
        title={task.title}
      >
        {getInitial(task.title)}
      </div>
    </motion.button>
  );
}

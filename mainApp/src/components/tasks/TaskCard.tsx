import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Trash2, CheckCircle, ChevronRight, Clock, Calendar, GripVertical } from 'lucide-react';
import { Task } from '../../types';
import { useStore } from '../../store/useStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { formatHours, getDeadlineStatus } from '../../utils/time';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface TaskCardProps {
  task: Task;
  compact?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  dragHandleProps?: Record<string, any>;
}

export function TaskCard({ task, compact: _compact, selected = false, onToggleSelect, dragHandleProps }: TaskCardProps) {
  const { startTimer, pauseTimer, resumeTimer, stopTimer, completeTask, deleteTask } = useStore();
  const { activeTaskId, activeTimerState, display: activeDisplay } = useActiveTimer();
  const navigate = useNavigate();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isActive = activeTaskId === task.id;
  const isPaused = isActive && activeTimerState === 'paused';
  const isRunning = isActive && activeTimerState === 'running';

  const displayTime = isActive ? activeDisplay : formatHours(task.totalTime);

  const subtasksDone = task.subtasks.filter(s => s.completed).length;
  const subtasksTotal = task.subtasks.length;
  const progress = subtasksTotal > 0 ? (subtasksDone / subtasksTotal) * 100 : 0;

  const deadlineInfo = task.status !== 'completed' ? getDeadlineStatus(task.deadline) : null;
  const isOverdue = deadlineInfo?.status === 'overdue';

  const PRIORITY_DOT: Record<string, string> = {
    urgent: 'bg-red-400',
    high: 'bg-orange-400',
    medium: 'bg-yellow-400',
    low: 'bg-emerald-400',
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [data-no-nav]')) return;
    navigate(`/tasks/${task.id}`);
  };

  const handleTimerAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) await pauseTimer(task.id);
    else if (isPaused) await resumeTimer(task.id);
    else {
      const baseMs = task.totalTime || 0;
      await startTimer(task.id, baseMs);
    }
  };

  const handleStopTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await stopTimer(task.id);
  };

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

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(task.id);
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4 }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('button, input, [data-no-nav]')) {
            e.preventDefault();
            navigate(`/tasks/${task.id}`);
          }
        }}
        className={`card p-6 rounded-[22px] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group relative overflow-hidden
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50
          ${isRunning ? 'border-amber-400/50 bg-[#FFFDF5] dark:bg-amber-500/10' : isOverdue ? 'border-red-500/30 bg-red-500/5' : ''}
          ${task.status === 'completed' ? 'opacity-70 bg-surface-900/60' : ''}
          ${selected ? 'ring-2 ring-brand-400/50 border-brand-400/30 bg-brand-500/5' : ''}
        `}
        onClick={handleCardClick}
        tabIndex={0}
        role="button"
        aria-label={`Open task: ${task.title}`}
      >
        {/* Color accent — cyan->blue gradient for running, red for overdue, task color otherwise */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
            isRunning ? 'bg-gradient-to-b from-cyan-400 to-blue-600' : ''
          }`}
          style={{ backgroundColor: isRunning ? undefined : isOverdue ? '#ef4444' : task.color }}
        />

        {/* Running glow */}
        {isRunning && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 pointer-events-none"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        <div className="relative flex items-start gap-3">
          {/* Drag Handle */}
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              className="mt-0.5 p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-800 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 transition-opacity"
              data-no-nav
            >
              <GripVertical size={16} />
            </button>
          )}

          {/* Selection Checkbox */}
          {onToggleSelect && (
            <button
              onClick={handleCheckboxClick}
              className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                selected
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'border-surface-600 hover:border-surface-400'
              }`}
              data-no-nav
              aria-label={`Select task: ${task.title}`}
            >
              {selected && <CheckCircle size={12} />}
            </button>
          )}

          {/* Task Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-surface-500'}`}
                title={`${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)} priority`}
              />
              <span className="sr-only">{`${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}`} priority</span>
              <h3 className={`text-sm font-semibold truncate ${task.status === 'completed' ? 'line-through text-surface-500' : 'text-surface-50'}`}>
                {task.title}
              </h3>
              {task.status === 'completed' && (
                <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
              )}
            </div>

            {task.description && (
              <p className="text-xs text-surface-400 line-clamp-1 mb-2 ml-4">{task.description}</p>
            )}

            {/* Progress bar */}
            {subtasksTotal > 0 && (
              <div className="flex items-center gap-2 mb-2 ml-4">
                <div className="flex-1 h-1 bg-surface-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] text-surface-500">{subtasksDone}/{subtasksTotal}</span>
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 ml-4">
              {task.category && <Badge>{task.category}</Badge>}
              {task.deadline && deadlineInfo && (
                <Badge tone={deadlineInfo.status === 'overdue' ? 'danger' : deadlineInfo.status === 'due-today' ? 'warning' : 'neutral'}>
                  <Calendar size={10} />
                  {deadlineInfo.label}
                </Badge>
              )}
              <span className="text-[10px] text-surface-500 flex items-center gap-1">
                <Clock size={10} />
                {displayTime}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0" data-no-nav>
            <div className="flex items-center gap-1">
              {task.status !== 'completed' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTimerAction}
                    className={`p-1.5 ${isRunning ? 'text-amber-400' : isPaused ? 'text-orange-400' : 'text-surface-400 hover:text-surface-200'}`}
                    title={isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start focus session'}
                  >
                    {isRunning ? <Pause size={14} /> : isPaused ? <Square size={14} /> : <Play size={14} />}
                  </Button>
                  {isRunning && (
                    <Button variant="ghost" size="sm" onClick={handleStopTimer} className="p-1.5 text-surface-400 hover:text-red-400" title="Stop timer">
                      <Square size={14} />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleComplete} className="p-1.5 text-surface-400 hover:text-emerald-400" title="Complete task">
                    <CheckCircle size={14} />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={handleDelete} className="p-1.5 text-surface-400 hover:text-red-400" title="Delete task">
                <Trash2 size={14} />
              </Button>
            </div>
            <ChevronRight size={14} className="text-surface-600 group-hover:text-surface-300 transition-colors" />
          </div>
        </div>
      </motion.div>

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

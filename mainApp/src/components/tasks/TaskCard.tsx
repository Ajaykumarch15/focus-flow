import { motion } from 'framer-motion';
import { Play, Pause, Square, Trash2, CheckCircle, Circle, ChevronRight, Tag } from 'lucide-react';
import { Task } from '../../types';
import { useStore } from '../../store/useStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../utils/colors';
import { formatHours, formatDuration } from '../../utils/time';
import { useNavigate } from 'react-router-dom';

interface TaskCardProps {
  task: Task;
  compact?: boolean;
}

export function TaskCard({ task, compact = false }: TaskCardProps) {
  const { startTimer, pauseTimer, resumeTimer, stopTimer, completeTask, deleteTask, activeTaskId, activeTimerState } = useStore();
  const navigate = useNavigate();

  const isActive = activeTaskId === task.id;
  const isPaused = isActive && activeTimerState === 'paused';
  const isRunning = isActive && activeTimerState === 'running';
  const priority = PRIORITY_CONFIG[task.priority];
  const status = STATUS_CONFIG[task.status];

  const lastSession = task.sessions[task.sessions.length - 1];
  const displayTime = isActive && lastSession
    ? formatDuration(lastSession.activeTime)
    : formatHours(task.totalTime);

  const subtasksDone = task.subtasks.filter(s => s.completed).length;
  const subtasksTotal = task.subtasks.length;
  const progress = subtasksTotal > 0 ? (subtasksDone / subtasksTotal) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={`card card-hover p-4 cursor-pointer group relative overflow-hidden
        ${isRunning ? 'border-brand-500/40 bg-brand-500/5' : ''}
        ${task.status === 'completed' ? 'opacity-60' : ''}
      `}
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      {/* Color accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: task.color }}
      />

      {/* Running glow */}
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-20"
          style={{ background: `radial-gradient(circle at 50% 50%, ${task.color}40, transparent)` }}
          animate={{ opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="pl-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`badge ${priority.bg} ${priority.color} border ${priority.border}`}>
                {priority.label}
              </span>
              {task.category && (
                <span className="badge bg-surface-700/50 text-surface-300">
                  {task.category}
                </span>
              )}
            </div>
            <h3 className={`font-medium text-white truncate ${task.status === 'completed' ? 'line-through text-surface-400' : ''}`}>
              {task.title}
            </h3>
            {task.description && !compact && (
              <p className="text-sm text-surface-300 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>

          {/* Timer display */}
          <div className="text-right flex-shrink-0">
            <div className={`timer-display font-bold ${isRunning ? 'text-brand-400 text-base' : 'text-surface-300 text-sm'}`}>
              {displayTime}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {subtasksTotal > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-surface-300 mb-1">
              <span>{subtasksDone}/{subtasksTotal} subtasks</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: task.color }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {task.status !== 'completed' && (
              <>
                {!isActive && (
                  <button
                    onClick={() => startTimer(task.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 rounded-lg text-xs font-medium transition-all"
                  >
                    <Play size={12} />
                    Start
                  </button>
                )}
                {isRunning && (
                  <button
                    onClick={() => pauseTimer(task.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-400 rounded-lg text-xs font-medium transition-all"
                  >
                    <Pause size={12} />
                    Pause
                  </button>
                )}
                {isPaused && (
                  <button
                    onClick={() => resumeTimer(task.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 rounded-lg text-xs font-medium transition-all"
                  >
                    <Play size={12} />
                    Resume
                  </button>
                )}
                {isActive && (
                  <button
                    onClick={() => stopTimer(task.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400/15 hover:bg-red-400/25 text-red-400 rounded-lg text-xs font-medium transition-all"
                  >
                    <Square size={12} />
                    Stop
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {task.status !== 'completed' && (
              <button
                onClick={() => completeTask(task.id)}
                className="p-1.5 rounded-lg text-surface-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
                title="Mark complete"
              >
                <CheckCircle size={15} />
              </button>
            )}
            <button
              onClick={() => deleteTask(task.id)}
              className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
            <ChevronRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Clock, CheckCircle, Trash2 } from 'lucide-react';
import { parallelTimerEngine, type TimerStateSnapshot } from '@worklog/services/parallelTimerEngine';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import { formatTimeOfDay } from '@shared/utils/time';

interface ActiveTimerCardProps {
  taskId: string;
  snapshot: TimerStateSnapshot;
}

export function ActiveTimerCard({ taskId, snapshot }: ActiveTimerCardProps) {
  const [elapsed, setElapsed] = useState(() =>
    parallelTimerEngine.getFormattedDisplay(taskId)
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'complete' | 'delete'>('stop');

  const workTasks = useStore((s) => s.tasks);
  const personalTasks = usePersonalTaskStore((s) => s.tasks);
  const pauseParallelTimer = useStore((s) => s.pauseParallelTimer);
  const resumeParallelTimer = useStore((s) => s.resumeParallelTimer);
  const stopParallelTimer = useStore((s) => s.stopParallelTimer);
  const workCompleteTask = useStore((s) => s.completeTask);
  const workDeleteTask = useStore((s) => s.deleteTask);
  const personalCompleteTask = usePersonalTaskStore((s) => s.completeTask);
  const personalDeleteTask = usePersonalTaskStore((s) => s.deleteTask);

  const isPersonal = snapshot.sessionKind === 'personal';
  const tasks = isPersonal ? personalTasks : workTasks;
  const task = tasks.find((t) => t.id === taskId);
  const title = task?.title ?? 'Unknown Task';

  const isRunning = snapshot.timerState === 'running';
  const isPaused = snapshot.timerState === 'paused';

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsed(parallelTimerEngine.getFormattedDisplay(taskId));
    }, 1000);
    return () => clearInterval(interval);
  }, [taskId, isRunning]);

  const handlePause = useCallback(() => {
    pauseParallelTimer(taskId);
  }, [taskId, pauseParallelTimer]);

  const handleResume = useCallback(() => {
    resumeParallelTimer(taskId);
  }, [taskId, resumeParallelTimer]);

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'stop') {
      stopParallelTimer(taskId);
    } else if (confirmAction === 'complete') {
      (isPersonal ? personalCompleteTask : workCompleteTask)(taskId);
    } else if (confirmAction === 'delete') {
      (isPersonal ? personalDeleteTask : workDeleteTask)(taskId);
    }
    setConfirmOpen(false);
  }, [taskId, confirmAction, isPersonal, stopParallelTimer, workCompleteTask, personalCompleteTask, workDeleteTask, personalDeleteTask]);

  const openConfirm = useCallback((action: 'stop' | 'complete' | 'delete') => {
    setConfirmAction(action);
    setConfirmOpen(true);
  }, []);

  const confirmLabels = {
    stop: { title: 'Stop Timer', message: `Stop the timer for "${title}"? The session will be finalized and saved.`, confirm: 'Stop Timer' },
    complete: { title: 'Complete Task', message: `Mark "${title}" as complete? This will stop the timer and mark the task done.`, confirm: 'Complete Task' },
    delete: { title: 'Delete Task', message: `Delete "${title}"? This will stop the timer and permanently remove the task.`, confirm: 'Delete Task' },
  };

  const startTime = snapshot.sessionStartTime
    ? formatTimeOfDay(snapshot.sessionStartTime)
    : null;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl border border-surface-800 bg-surface-900 p-5 hover:border-surface-700 transition-all"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isRunning
                  ? 'bg-green-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-surface-50 truncate">
                {title}
              </h3>
              {startTime && (
                <p className="text-xs text-surface-500 mt-0.5 flex items-center gap-1">
                  <Clock size={10} />
                  Started at {startTime}
                </p>
              )}
            </div>
          </div>
          <Badge tone={isPersonal ? 'info' : 'brand'}>
            {isPersonal ? 'Personal' : 'Work'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-2xl font-bold text-surface-50 tabular-nums tracking-tight">
            {elapsed}
          </span>

          <div className="flex items-center gap-1">
            {isRunning && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePause}
                aria-label={`Pause ${title}`}
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
              >
                <Pause size={16} />
              </Button>
            )}

            {isPaused && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResume}
                aria-label={`Resume ${title}`}
                className="text-brand-400 hover:text-brand-300 hover:bg-brand-500/10"
              >
                <Play size={16} />
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => openConfirm('stop')}
              aria-label={`Stop ${title}`}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Square size={16} />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => openConfirm('complete')}
              aria-label={`Complete ${title}`}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
            >
              <CheckCircle size={16} />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => openConfirm('delete')}
              aria-label={`Delete ${title}`}
              className="text-surface-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmLabels[confirmAction].title}
        message={confirmLabels[confirmAction].message}
        confirmLabel={confirmLabels[confirmAction].confirm}
        cancelLabel="Cancel"
        variant={confirmAction === 'delete' ? 'danger' : 'warning'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

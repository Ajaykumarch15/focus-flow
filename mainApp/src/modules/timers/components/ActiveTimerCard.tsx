import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Clock } from 'lucide-react';
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

  const workTasks = useStore((s) => s.tasks);
  const personalTasks = usePersonalTaskStore((s) => s.tasks);
  const pauseParallelTimer = useStore((s) => s.pauseParallelTimer);
  const resumeParallelTimer = useStore((s) => s.resumeParallelTimer);
  const stopParallelTimer = useStore((s) => s.stopParallelTimer);

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

  const handleStop = useCallback(() => {
    stopParallelTimer(taskId);
    setConfirmOpen(false);
  }, [taskId, stopParallelTimer]);

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

          <div className="flex items-center gap-2">
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
              onClick={() => setConfirmOpen(true)}
              aria-label={`Stop ${title}`}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Square size={16} />
            </Button>
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Stop Timer"
        message={`Are you sure you want to stop the timer for "${title}"? The session will be finalized and saved.`}
        confirmLabel="Stop Timer"
        cancelLabel="Keep Running"
        variant="danger"
        onConfirm={handleStop}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

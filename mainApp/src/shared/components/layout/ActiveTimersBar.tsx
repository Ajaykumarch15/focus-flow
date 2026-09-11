/**
 * ActiveTimersBar — Compact display of all running parallel timers.
 *
 * Shows in the sidebar or header when multiple timers are active.
 * Allows quick pause/stop for any running timer.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Layers } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { parallelTimerEngine, TimerStateSnapshot } from '@worklog/services/parallelTimerEngine';
import { Button } from '@shared/components/ui/Button';

interface ActiveTimerItemProps {
  taskId: string;
  snapshot: TimerStateSnapshot;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onStop: (taskId: string) => void;
}

function ActiveTimerItem({ taskId, snapshot, onPause, onResume, onStop }: ActiveTimerItemProps) {
  const [elapsed, setElapsed] = useState(() =>
    parallelTimerEngine.getFormattedDisplay(taskId)
  );
  const { tasks } = useStore();

  const task = tasks.find((t) => t.id === taskId);
  const title = task?.title ?? 'Unknown Task';

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(parallelTimerEngine.getFormattedDisplay(taskId));
    }, 1000);
    return () => clearInterval(interval);
  }, [taskId]);

  const isRunning = snapshot.timerState === 'running';
  const isPaused = snapshot.timerState === 'paused';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center justify-between gap-2 py-2 px-3 bg-surface-800/50 rounded-lg border border-surface-700"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isRunning ? 'bg-green-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span className="text-xs text-surface-200 truncate">{title}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] font-bold text-surface-400 tabular-nums">
          {elapsed}
        </span>

        {isRunning && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onPause(taskId)}
            aria-label={`Pause ${title}`}
            className="p-1 text-amber-400 hover:text-amber-300"
          >
            <Pause size={10} />
          </Button>
        )}

        {isPaused && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onResume(taskId)}
            aria-label={`Resume ${title}`}
            className="p-1 text-brand-400 hover:text-brand-300"
          >
            <Play size={10} />
          </Button>
        )}

        <Button
          size="xs"
          variant="ghost"
          onClick={() => onStop(taskId)}
          aria-label={`Stop ${title}`}
          className="p-1 text-red-400 hover:text-red-300"
        >
          <Square size={10} />
        </Button>
      </div>
    </motion.div>
  );
}

export function ActiveTimersBar() {
  const [allTimers, setAllTimers] = useState<Map<string, TimerStateSnapshot>>(
    () => parallelTimerEngine.getAllSnapshots()
  );

  // Subscribe to timer updates
  useEffect(() => {
    const unsubscribe = parallelTimerEngine.subscribe((_, __, allSnapshots) => {
      setAllTimers(new Map(allSnapshots));
    });
    return unsubscribe;
  }, []);

  // Filter to only running/paused timers
  const activeTimers = Array.from(allTimers.entries()).filter(
    ([_, snapshot]) => snapshot.timerState !== 'idle'
  );

  const handlePause = useCallback((taskId: string) => {
    const { pauseParallelTimer } = useStore.getState();
    pauseParallelTimer(taskId);
  }, []);

  const handleResume = useCallback((taskId: string) => {
    const { resumeParallelTimer } = useStore.getState();
    resumeParallelTimer(taskId);
  }, []);

  const handleStop = useCallback((taskId: string) => {
    const { stopParallelTimer } = useStore.getState();
    stopParallelTimer(taskId);
  }, []);

  if (activeTimers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Layers size={12} className="text-surface-400" />
        <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">
          Active Timers ({activeTimers.length})
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {activeTimers.map(([taskId, snapshot]) => (
          <ActiveTimerItem
            key={taskId}
            taskId={taskId}
            snapshot={snapshot}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

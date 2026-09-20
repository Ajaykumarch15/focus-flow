/**
 * ActiveTimersBar — Compact display of all running parallel timers.
 *
 * Shows in the sidebar or header when multiple timers are active.
 * Allows quick pause/stop for any running timer.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Layers } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { parallelTimerEngine, TimerStateSnapshot } from '@worklog/services/parallelTimerEngine';
import { timerEngine } from '@worklog/services/timerEngine';
import { Button } from '@shared/components/ui/Button';
import { formatDuration } from '@shared/utils/time';

interface ActiveTimerItemProps {
  taskId: string;
  snapshot: TimerStateSnapshot;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onStop: (taskId: string) => void;
}

function ActiveTimerItem({ taskId, snapshot, onPause, onResume, onStop }: ActiveTimerItemProps) {
  const [tick, setTick] = useState(0);
  const { tasks } = useStore();

  const task = tasks.find((t) => t.id === taskId);
  const title = task?.title ?? 'Unknown Task';

  useEffect(() => {
    if (snapshot.timerState !== 'running') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [snapshot.timerState]);

  const elapsed = useMemo(() => {
    const now = Date.now();
    const live = snapshot.timerState === 'running'
      ? now - snapshot.sessionStartTime - snapshot.totalPauseDuration
      : snapshot.timerState === 'paused' && snapshot.pauseStart
        ? snapshot.pauseStart - snapshot.sessionStartTime - snapshot.totalPauseDuration
        : 0;
    return formatDuration(snapshot.baseElapsedMs + live);
  }, [snapshot, tick]);

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
  const [legacySnapshot, setLegacySnapshot] = useState(() => timerEngine.getSnapshot());

  // Subscribe to timer updates
  useEffect(() => {
    const unsubParallel = parallelTimerEngine.subscribe((_, __, allSnapshots) => {
      setAllTimers(new Map(allSnapshots));
    });
    const unsubLegacy = timerEngine.subscribe((snapshot) => {
      setLegacySnapshot(snapshot);
    });
    return () => {
      unsubParallel();
      unsubLegacy();
    };
  }, []);

  // Merge parallel + legacy into one list (avoid duplicates)
  const activeTimers = useMemo(() => {
    const parallel = Array.from(allTimers.entries()).filter(
      ([_, snapshot]) => snapshot.timerState !== 'idle'
    );
    if (legacySnapshot.taskId && legacySnapshot.timerState !== 'idle' && !allTimers.has(legacySnapshot.taskId)) {
      parallel.push([legacySnapshot.taskId, {
        taskId: legacySnapshot.taskId,
        sessionId: legacySnapshot.sessionId,
        timerState: legacySnapshot.timerState,
        sessionStartTime: legacySnapshot.sessionStartTime,
        totalPauseDuration: legacySnapshot.totalPauseDuration,
        pauseStart: legacySnapshot.pauseStart,
        baseElapsedMs: legacySnapshot.baseElapsedMs,
        sessionKind: legacySnapshot.sessionKind,
        lastUpdated: legacySnapshot.lastUpdated,
      }]);
    }
    return parallel;
  }, [allTimers, legacySnapshot]);

  const handlePause = useCallback((taskId: string) => {
    // Route to legacy or parallel engine based on which one owns this task
    if (timerEngine.getActiveTaskId() === taskId && timerEngine.getState() !== 'idle') {
      useStore.getState().pauseTimer(taskId);
    } else {
      useStore.getState().pauseParallelTimer(taskId);
    }
  }, []);

  const handleResume = useCallback((taskId: string) => {
    if (timerEngine.getActiveTaskId() === taskId && timerEngine.getState() !== 'idle') {
      useStore.getState().resumeTimer(taskId);
    } else {
      useStore.getState().resumeParallelTimer(taskId);
    }
  }, []);

  const handleStop = useCallback((taskId: string) => {
    if (timerEngine.getActiveTaskId() === taskId && timerEngine.getState() !== 'idle') {
      useStore.getState().stopTimer(taskId);
    } else {
      useStore.getState().stopParallelTimer(taskId);
    }
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

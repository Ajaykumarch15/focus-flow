/**
 * useActiveTimer.ts — High-Performance Live Timer Hook
 *
 * Subscribes to both the legacy single-timer engine and the new parallel timer engine.
 * Returns the first active timer found (legacy or parallel).
 * Only re-renders the subscribing component (e.g. Sidebar / TaskCard),
 * without causing entire app/Zustand store re-renders every second.
 */

import { useState, useEffect, useMemo } from 'react';
import { timerEngine, TimerFSMState } from '@worklog/services/timerEngine';
import { parallelTimerEngine, TimerStateSnapshot as ParallelSnapshot } from '@worklog/services/parallelTimerEngine';
import { formatDuration } from '@shared/utils/time';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import type { Task } from '@shared/types';

export function useActiveTimer(externalTasks?: Task[]) {
  // Legacy single-timer state
  const [legacySnapshot, setLegacySnapshot] = useState(() => timerEngine.getSnapshot());
  const [legacyElapsedMs, setLegacyElapsedMs] = useState(() => timerEngine.getElapsedMs());

  // Parallel multi-timer state
  const [parallelSnapshots, setParallelSnapshots] = useState<Map<string, ParallelSnapshot>>(
    () => parallelTimerEngine.getAllSnapshots()
  );

  useEffect(() => {
    const unsubLegacy = timerEngine.subscribe((newSnapshot, newElapsed) => {
      setLegacySnapshot(newSnapshot);
      setLegacyElapsedMs(newElapsed);
    });

    const unsubParallel = parallelTimerEngine.subscribe((_, __, allSnapshots) => {
      setParallelSnapshots(new Map(allSnapshots));
    });

    return () => {
      unsubLegacy();
      unsubParallel();
    };
  }, []);

  const storeTasks = useStore(s => s.tasks);
  const personalTasks = usePersonalTaskStore(s => s.tasks);

  // Find first active parallel timer (running or paused), excluding completed tasks
  const firstParallel = useMemo(() => {
    const allTasks = [...storeTasks, ...personalTasks];
    for (const [taskId, snapshot] of parallelSnapshots) {
      if (snapshot.timerState !== 'idle') {
        const task = allTasks.find(t => t.id === taskId);
        if (task && task.status !== 'completed') {
          return { taskId, snapshot };
        }
      }
    }
    return null;
  }, [parallelSnapshots, storeTasks, personalTasks]);

  // Determine which timer to use: parallel takes priority if no legacy is active
  const useParallel = !legacySnapshot.taskId && firstParallel;
  const activeTaskId = useParallel ? firstParallel!.taskId : legacySnapshot.taskId;
  const activeTimerState = useParallel
    ? firstParallel!.snapshot.timerState as TimerFSMState
    : legacySnapshot.timerState as TimerFSMState;
  const elapsedMs = useParallel
    ? parallelTimerEngine.getElapsedMs(firstParallel!.taskId)
    : legacyElapsedMs;
  const sessionStartTime = useParallel
    ? firstParallel!.snapshot.sessionStartTime
    : legacySnapshot.sessionStartTime;
  const totalPauseDuration = useParallel
    ? firstParallel!.snapshot.totalPauseDuration
    : legacySnapshot.totalPauseDuration;
  const sessionKind = useParallel
    ? firstParallel!.snapshot.sessionKind
    : legacySnapshot.sessionKind;
  const baseElapsedMs = useParallel
    ? firstParallel!.snapshot.baseElapsedMs
    : legacySnapshot.baseElapsedMs;

  const tasks = externalTasks ?? (sessionKind === 'personal' ? personalTasks : storeTasks);
  const activeTask = tasks.find(t => t.id === activeTaskId);

  const display = useMemo(
    () => formatDuration(elapsedMs + (baseElapsedMs || 0)),
    [elapsedMs, baseElapsedMs]
  );

  return {
    activeTaskId,
    activeSessionId: useParallel ? firstParallel!.snapshot.sessionId : legacySnapshot.sessionId,
    activeTimerState,
    activeTask,
    display,
    elapsedMs,
    baseElapsedMs,
    sessionStartTime,
    totalPauseDuration,
    sessionKind,
  };
}
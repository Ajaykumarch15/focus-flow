import { useEffect, useState } from 'react';
import { parallelTimerEngine, type TimerStateSnapshot } from '@worklog/services/parallelTimerEngine';
import { formatDuration } from '@shared/utils/time';

/** Subscribe to one task's timer, regardless of other active parallel timers. */
export function useTaskParallelTimer(taskId: string) {
  const [snapshot, setSnapshot] = useState<TimerStateSnapshot | null>(
    () => parallelTimerEngine.getSnapshot(taskId),
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    setSnapshot(parallelTimerEngine.getSnapshot(taskId));
    const unsubscribe = parallelTimerEngine.subscribe((changedTaskId, nextSnapshot) => {
      if (changedTaskId === taskId) setSnapshot(nextSnapshot);
    });
    return unsubscribe;
  }, [taskId]);

  useEffect(() => {
    if (snapshot?.timerState !== 'running') return;
    const interval = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, [snapshot?.timerState, taskId]);

  const taskSnapshot = snapshot?.taskId === taskId ? snapshot : null;
  const state = taskSnapshot?.timerState ?? 'idle';
  const display = state === 'idle'
    ? formatDuration(0)
    : formatDuration(parallelTimerEngine.getTotalElapsedMs(taskId));

  return { snapshot: taskSnapshot, state, display };
}

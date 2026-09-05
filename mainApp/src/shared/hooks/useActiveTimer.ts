/**
 * useActiveTimer.ts — High-Performance Live Timer Hook
 *
 * Subscribes directly to the authoritative TimerEngine.
 * Only re-renders the subscribing component (e.g. Sidebar / TaskCard),
 * without causing entire app/Zustand store re-renders every second.
 */

import { useState, useEffect, useMemo } from 'react';
import { timerEngine, TimerFSMState } from '@worklog/services/timerEngine';
import { formatDuration } from '@shared/utils/time';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import type { Task } from '@shared/types';

export function useActiveTimer(externalTasks?: Task[]) {
  const [snapshot, setSnapshot] = useState(() => timerEngine.getSnapshot());
  const [elapsedMs, setElapsedMs] = useState(() => timerEngine.getElapsedMs());

  useEffect(() => {
    // Subscribe to timerEngine updates
    const unsubscribe = timerEngine.subscribe((newSnapshot, newElapsed) => {
      setSnapshot(newSnapshot);
      setElapsedMs(newElapsed);
    });

    return unsubscribe;
  }, []);

  const storeTasks = useStore(s => s.tasks);
  const personalTasks = usePersonalTaskStore(s => s.tasks);
  const tasks = externalTasks ?? (snapshot.sessionKind === 'personal' ? personalTasks : storeTasks);
  const activeTask = tasks.find(t => t.id === snapshot.taskId);
  // `elapsedMs` stays the pure live session elapsed (Focus Mode, daily totals);
  // the display adds the pre-existing base so resuming a task keeps its clock.
  const display = useMemo(
    () => formatDuration(elapsedMs + (snapshot.baseElapsedMs || 0)),
    [elapsedMs, snapshot.baseElapsedMs]
  );

  return {
    activeTaskId: snapshot.taskId,
    activeSessionId: snapshot.sessionId,
    activeTimerState: snapshot.timerState as TimerFSMState,
    activeTask,
    display,
    elapsedMs,
    baseElapsedMs: snapshot.baseElapsedMs,
    sessionStartTime: snapshot.sessionStartTime,
    totalPauseDuration: snapshot.totalPauseDuration,
    sessionKind: snapshot.sessionKind,
  };
}
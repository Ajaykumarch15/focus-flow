/**
 * useActiveTimer.ts — High-Performance Live Timer Hook
 *
 * Subscribes directly to the authoritative TimerEngine.
 * Only re-renders the subscribing component (e.g. Sidebar / TaskCard),
 * without causing entire app/Zustand store re-renders every second.
 */

import { useState, useEffect } from 'react';
import { timerEngine, TimerFSMState } from '../utils/timerEngine';
import { useStore } from '../store/useStore';

export function useActiveTimer() {
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

  const tasks = useStore(s => s.tasks);
  const activeTask = tasks.find(t => t.id === snapshot.taskId);
  const display = timerEngine.getFormattedDisplay();

  return {
    activeTaskId: snapshot.taskId,
    activeSessionId: snapshot.sessionId,
    activeTimerState: snapshot.timerState as TimerFSMState,
    activeTask,
    display,
    elapsedMs,
    sessionStartTime: snapshot.sessionStartTime,
    totalPauseDuration: snapshot.totalPauseDuration,
  };
}
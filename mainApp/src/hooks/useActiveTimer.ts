import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/time';
import { loadTimer, calcElapsed } from '../utils/timerPersist';

export function useActiveTimer() {
  const { activeTaskId, activeTimerState, tasks } = useStore();

  // Read correct initial value from store or localStorage immediately
  // so sidebar shows the right time on first render after refresh
  const getInitial = () => {
    const state = useStore.getState();
    const task = state.tasks.find(t => t.id === state.activeTaskId);
    const session = task?.sessions[task.sessions.length - 1];
    if (session?.activeTime) return formatDuration(session.activeTime);

    // Tasks not loaded yet — use localStorage
    const p = loadTimer();
    if (p && p.taskId === state.activeTaskId) return formatDuration(calcElapsed(p));
    return '00:00';
  };

  const [display, setDisplay] = useState(getInitial);

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const lastSession = activeTask?.sessions[activeTask.sessions.length - 1];

  useEffect(() => {
    const update = () => {
      const state = useStore.getState();
      const task = state.tasks.find(t => t.id === state.activeTaskId);
      const session = task?.sessions[task.sessions.length - 1];

      if (session?.activeTime) {
        setDisplay(formatDuration(session.activeTime));
      } else {
        // Fallback while tasks are loading
        const p = loadTimer();
        if (p && p.taskId === state.activeTaskId) {
          setDisplay(formatDuration(calcElapsed(p)));
        }
      }
    };

    update();
    if (activeTimerState !== 'running') return;
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeTimerState, activeTaskId, lastSession?.activeTime]);

  return { activeTask, activeTimerState, display, activeTaskId };
}
import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/time';

export function useActiveTimer() {
  const { activeTaskId, activeTimerState, tasks } = useStore();
  const [display, setDisplay] = useState('00:00');

  const activeTask = tasks.find(t => t.id === activeTaskId);

  useEffect(() => {
    if (activeTimerState !== 'running' || !activeTask) return;

    const update = () => {
      const lastSession = activeTask.sessions[activeTask.sessions.length - 1];
      if (lastSession) {
        setDisplay(formatDuration(lastSession.activeTime));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeTimerState, activeTask]);

  return { activeTask, activeTimerState, display, activeTaskId };
}

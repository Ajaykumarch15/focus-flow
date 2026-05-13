import { useState, useEffect } from 'react';
import { useStore }              from '../store/useStore';
import { formatDuration }        from '../utils/time';

/**
 * useActiveTimer — used by the Sidebar widget and WorkLog timer panel.
 *
 * Returns a display string that ticks every second while running.
 * On refresh restore the initial value comes from the injected session
 * (which already has the correct elapsed time from timerPersist).
 */
export function useActiveTimer() {
  const { activeTaskId, activeTimerState, tasks } = useStore();
  const [display, setDisplay] = useState('00:00');

  const activeTask    = tasks.find(t => t.id === activeTaskId);
  const lastSession   = activeTask?.sessions[activeTask.sessions.length - 1];

  useEffect(() => {
    // Set immediately (handles restore case where session already has elapsed time)
    if (lastSession) {
      setDisplay(formatDuration(lastSession.activeTime));
    } else {
      setDisplay('00:00');
    }

    if (activeTimerState !== 'running' || !lastSession) return;

    const interval = setInterval(() => {
      if (lastSession) {
        setDisplay(formatDuration(lastSession.activeTime));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimerState, activeTaskId, lastSession?.activeTime]);

  return { activeTask, activeTimerState, display, activeTaskId };
}

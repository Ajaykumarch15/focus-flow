import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function useTimer() {
  const { tick, activeTaskId, activeTimerState } = useStore();

  useEffect(() => {
    if (activeTimerState !== 'running') return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimerState, tick]);

  return { activeTaskId, activeTimerState };
}

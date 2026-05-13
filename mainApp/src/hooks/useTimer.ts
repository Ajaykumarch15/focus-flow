import { useEffect } from 'react';
import { useStore }   from '../store/useStore';

/**
 * useTimer — mounts in AppLayout once.
 *
 * Handles two cases:
 * 1. Normal operation — starts/stops the 1s interval when activeTimerState changes.
 * 2. Refresh restore — if the store already has activeTimerState === 'running'
 *    when this hook first mounts (because loadAll restored it from localStorage),
 *    the interval starts immediately on mount.
 */
export function useTimer() {
  const { tick, activeTimerState } = useStore();

  useEffect(() => {
    if (activeTimerState !== 'running') return;

    // Start ticking immediately (handles both new starts and refresh restores)
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimerState, tick]);
}

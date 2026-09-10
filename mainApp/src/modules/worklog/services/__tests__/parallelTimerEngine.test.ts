import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parallelTimerEngine } from '../parallelTimerEngine';

describe('ParallelTimerEngine', () => {
  beforeEach(async () => {
    // Stop all timers and clear state
    await parallelTimerEngine.stopAll();
    parallelTimerEngine.hydrate(null);
    localStorage.clear();
  });

  describe('State Management', () => {
    it('should start in idle state for all tasks', () => {
      expect(parallelTimerEngine.getState('task-1')).toBe('idle');
      expect(parallelTimerEngine.getState('task-2')).toBe('idle');
      expect(parallelTimerEngine.isAnyRunning()).toBe(false);
    });

    it('should start a timer for a task', async () => {
      const result = await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      expect(result.success).toBe(true);
      expect(parallelTimerEngine.getState('task-1')).toBe('running');
      expect(parallelTimerEngine.getActiveTaskIds()).toContain('task-1');
    });

    it('should start multiple timers concurrently', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      await parallelTimerEngine.start('task-2', 'sess-2', 1000000, 0, 'personal');

      expect(parallelTimerEngine.getState('task-1')).toBe('running');
      expect(parallelTimerEngine.getState('task-2')).toBe('running');
      expect(parallelTimerEngine.getActiveTaskIds()).toHaveLength(2);
      expect(parallelTimerEngine.isAnyRunning()).toBe(true);
    });

    it('should pause a specific timer without affecting others', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      await parallelTimerEngine.start('task-2', 'sess-2', 1000000, 0, 'work');

      const pauseResult = parallelTimerEngine.pause('task-1', 1005000);
      expect(pauseResult.success).toBe(true);
      expect(parallelTimerEngine.getState('task-1')).toBe('paused');
      expect(parallelTimerEngine.getState('task-2')).toBe('running');
    });

    it('should resume a paused timer', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      parallelTimerEngine.pause('task-1', 1005000);
      expect(parallelTimerEngine.getState('task-1')).toBe('paused');

      const resumeResult = parallelTimerEngine.resume('task-1', 1010000);
      expect(resumeResult.success).toBe(true);
      expect(parallelTimerEngine.getState('task-1')).toBe('running');
    });

    it('should stop a specific timer without affecting others', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      await parallelTimerEngine.start('task-2', 'sess-2', 1000000, 0, 'work');

      const stopResult = await parallelTimerEngine.stop('task-1', 1020000);
      expect(stopResult.success).toBe(true);
      expect(parallelTimerEngine.getState('task-1')).toBe('idle');
      expect(parallelTimerEngine.getState('task-2')).toBe('running');
      expect(parallelTimerEngine.getActiveTaskIds()).not.toContain('task-1');
    });
  });

  describe('Elapsed Time Calculation', () => {
    it('should calculate elapsed time correctly for a single timer', async () => {
      const startTime = 1000000;
      await parallelTimerEngine.start('task-1', 'sess-1', startTime, 0, 'work');

      expect(parallelTimerEngine.getElapsedMs('task-1', startTime + 10000)).toBe(10000);
      expect(parallelTimerEngine.getElapsedMs('task-1', startTime + 25000)).toBe(25000);
    });

    it('should calculate elapsed time correctly with pause/resume', async () => {
      const startTime = 1000000;
      await parallelTimerEngine.start('task-1', 'sess-1', startTime, 0, 'work');

      // Run for 10 seconds
      let now = startTime + 10000;
      expect(parallelTimerEngine.getElapsedMs('task-1', now)).toBe(10000);

      // Pause for 20 seconds
      parallelTimerEngine.pause('task-1', now);
      now += 20000;
      expect(parallelTimerEngine.getElapsedMs('task-1', now)).toBe(10000); // Still 10s

      // Resume and run for 15 more seconds
      parallelTimerEngine.resume('task-1', now);
      now += 15000;
      expect(parallelTimerEngine.getElapsedMs('task-1', now)).toBe(25000); // 10s + 15s
    });

    it('should calculate elapsed time independently for multiple timers', async () => {
      const startTime = 1000000;
      await parallelTimerEngine.start('task-1', 'sess-1', startTime, 0, 'work');
      await parallelTimerEngine.start('task-2', 'sess-2', startTime + 5000, 0, 'work');

      const now = startTime + 20000;
      expect(parallelTimerEngine.getElapsedMs('task-1', now)).toBe(20000);
      expect(parallelTimerEngine.getElapsedMs('task-2', now)).toBe(15000);
    });
  });

  describe('FSM Transition Guards', () => {
    it('should reject invalid transitions', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');

      // Invalid: pause on non-existent task
      const pauseWrong = parallelTimerEngine.pause('task-2');
      expect(pauseWrong.success).toBe(false);

      // Invalid: resume on running timer
      const resumeRunning = parallelTimerEngine.resume('task-1');
      expect(resumeRunning.success).toBe(false);
    });

    it('should allow valid transitions', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');

      // Valid: running -> pause
      const canPause = parallelTimerEngine.canTransitionTo('task-1', 'pause');
      expect(canPause.allowed).toBe(true);

      // Valid: running -> stop
      const canStop = parallelTimerEngine.canTransitionTo('task-1', 'stop');
      expect(canStop.allowed).toBe(true);
    });
  });

  describe('Listener Notifications', () => {
    it('should notify listeners on state changes', async () => {
      const listener = vi.fn();
      parallelTimerEngine.subscribe(listener);

      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      // Listener may be called multiple times (once for legacy stop, once for parallel start)
      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ taskId: 'task-1', timerState: 'running' }),
        expect.any(Map)
      );

      listener.mockClear();
      parallelTimerEngine.pause('task-1', 1005000);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      parallelTimerEngine.subscribe(listener1);
      parallelTimerEngine.subscribe(listener2);

      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Persistence', () => {
    it('should save timers to localStorage', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      await parallelTimerEngine.start('task-2', 'sess-2', 1000000, 0, 'work');

      const saved = localStorage.getItem('ff_active_timers');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed).toHaveLength(2);
    });

    it('should restore timers from localStorage', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      
      // Get the persisted data
      const saved = localStorage.getItem('ff_active_timers');
      expect(saved).toBeTruthy();
      
      // Create new engine and hydrate
      const savedTimers = JSON.parse(saved!);
      parallelTimerEngine.hydrate(savedTimers);
      
      expect(parallelTimerEngine.getState('task-1')).toBe('running');
    });
  });

  describe('Edge Cases', () => {
    it('should handle starting the same task twice (no-op)', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      const secondStart = await parallelTimerEngine.start('task-1', 'sess-2', 1000000, 0, 'work');
      
      // Should be a guarded no-op
      expect(secondStart.success).toBe(true);
      expect(parallelTimerEngine.getActiveTaskIds()).toHaveLength(1);
    });

    it('should return 0 elapsed for idle timers', () => {
      expect(parallelTimerEngine.getElapsedMs('nonexistent-task')).toBe(0);
    });

    it('should stop all timers', async () => {
      await parallelTimerEngine.start('task-1', 'sess-1', 1000000, 0, 'work');
      await parallelTimerEngine.start('task-2', 'sess-2', 1000000, 0, 'work');
      
      await parallelTimerEngine.stopAll();
      expect(parallelTimerEngine.getActiveTaskIds()).toHaveLength(0);
      expect(parallelTimerEngine.isAnyRunning()).toBe(false);
    });
  });
});

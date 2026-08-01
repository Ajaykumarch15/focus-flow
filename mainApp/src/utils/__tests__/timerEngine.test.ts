import { describe, it, expect, beforeEach, vi } from 'vitest';
import { timerEngine } from '../timerEngine';
import { offlineQueue } from '../offlineQueue';

describe('TimerEngine & Session FSM', () => {
  beforeEach(() => {
    // Reset timerEngine to clean idle state
    timerEngine.hydrate(null);
    localStorage.clear();
    offlineQueue.clear();
  });

  it('1 & 2. Should enforce strict FSM transitions and reject invalid transitions', async () => {
    expect(timerEngine.getState()).toBe('idle');

    // Invalid transition: idle -> pause
    const pauseFail = timerEngine.pause('task-1');
    expect(pauseFail.success).toBe(false);

    // Invalid transition: idle -> resume
    const resumeFail = timerEngine.resume('task-1');
    expect(resumeFail.success).toBe(false);

    // Valid transition: idle -> start
    const startRes = await timerEngine.start('task-1', 'sess-1', 1000000);
    expect(startRes.success).toBe(true);
    expect(timerEngine.getState()).toBe('running');
    expect(timerEngine.getActiveTaskId()).toBe('task-1');

    // Invalid transition: running -> start (same task re-entrant should be safe)
    const reStartRes = await timerEngine.start('task-1', 'sess-1', 1000000);
    expect(reStartRes.success).toBe(true); // guarded no-op

    // Valid transition: running -> pause
    const pauseRes = timerEngine.pause('task-1', 1005000);
    expect(pauseRes.success).toBe(true);
    expect(timerEngine.getState()).toBe('paused');

    // Valid transition: paused -> start (different task - starts new task)
    const canStartOther = timerEngine.canTransitionTo('start', 'task-2');
    expect(canStartOther.allowed).toBe(true);

    // Valid transition: paused -> resume
    const resumeRes = timerEngine.resume('task-1', 1010000);
    expect(resumeRes.success).toBe(true);
    expect(timerEngine.getState()).toBe('running');

    // Valid transition: running -> stop
    const stopRes = await timerEngine.stop('task-1', 1020000);
    expect(stopRes.success).toBe(true);
    expect(timerEngine.getState()).toBe('idle');
    expect(timerEngine.getActiveTaskId()).toBeNull();
  });

  it('4 & 5. Should compute active time accurately across multiple pause/resume cycles', async () => {
    const startTime = 1000000;
    await timerEngine.start('task-1', 'sess-1', startTime);

    // Run for 10 seconds (10000ms)
    let now = startTime + 10000;
    expect(timerEngine.getElapsedMs(now)).toBe(10000);

    // Pause 1 at startTime + 10s
    timerEngine.pause('task-1', now);
    expect(timerEngine.getElapsedMs(now)).toBe(10000);

    // Stay paused for 20 seconds (20000ms pause)
    now += 20000;
    expect(timerEngine.getElapsedMs(now)).toBe(10000); // Time does NOT count while paused!

    // Resume 1 at startTime + 30s
    timerEngine.resume('task-1', now);
    expect(timerEngine.getElapsedMs(now)).toBe(10000);

    // Run for another 15 seconds
    now += 15000;
    expect(timerEngine.getElapsedMs(now)).toBe(25000); // 10s + 15s = 25s

    // Pause 2
    timerEngine.pause('task-1', now);
    // Stay paused for 5 seconds
    now += 5000;
    timerEngine.resume('task-1', now);

    // Run for another 5 seconds
    now += 5000;

    // Stop timer
    const stopRes = await timerEngine.stop('task-1', now);
    expect(stopRes.success).toBe(true);
    expect(stopRes.activeTime).toBe(30000); // 10s + 15s + 5s = 30s exact active time!
  });

  it('3. Should restore session state and elapsed time after simulated browser refresh', async () => {
    const startTime = 5000000;
    await timerEngine.start('task-refresh', 'sess-refresh', startTime);
    timerEngine.setSessionId('sess-refresh-real');

    // Simulate page reload: rehydrate from saved localStorage snapshot
    const persistedRaw = localStorage.getItem('ff_active_timer');
    expect(persistedRaw).not.toBeNull();
    const persisted = JSON.parse(persistedRaw!);

    // Clear memory state
    timerEngine.hydrate(null);
    expect(timerEngine.getState()).toBe('idle');

    // Rehydrate
    timerEngine.hydrate(persisted);
    expect(timerEngine.getState()).toBe('running');
    expect(timerEngine.getActiveTaskId()).toBe('task-refresh');
    expect(timerEngine.getActiveSessionId()).toBe('sess-refresh-real');
    expect(timerEngine.getElapsedMs(startTime + 60000)).toBe(60000);
  });

  it('9 & 10. Should enqueue failed operations in OfflineQueue and allow clearing', () => {
    expect(offlineQueue.getPendingCount()).toBe(0);

    offlineQueue.enqueue('START_SESSION', 'task-off', undefined, { startTime: 100 });
    expect(offlineQueue.getPendingCount()).toBe(1);

    offlineQueue.enqueue('PAUSE_SESSION', 'task-off', 'sess-off', { pauseTime: 200 });
    expect(offlineQueue.getPendingCount()).toBe(2);

    offlineQueue.clear();
    expect(offlineQueue.getPendingCount()).toBe(0);
  });
});

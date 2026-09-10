/**
 * parallelTimerEngine.ts — Multi-Timer Engine for Parallel Task Tracking
 *
 * Core Features:
 * 1. Track multiple concurrent timers (one per task).
 * 2. Each timer has its own state: idle | running | paused.
 * 3. Shared tick interval updates all running timers.
 * 4. Cross-tab synchronization via BroadcastChannel.
 * 5. Persistence of all active timers to localStorage.
 */

import { formatDuration } from '@shared/utils/time';
import {
  saveTimers,
  loadTimers,
  clearTimers,
  addCompletedSession,
  PersistedTimer,
} from './timerPersist';
import { timerEngine } from './timerEngine';

export type TimerFSMState = 'idle' | 'running' | 'paused';
export type TimerAction = 'start' | 'pause' | 'resume' | 'stop';
export type TimerSessionKind = 'work' | 'personal';

export interface TimerStateSnapshot {
  taskId: string;
  sessionId: string | null;
  timerState: TimerFSMState;
  sessionStartTime: number;
  totalPauseDuration: number;
  pauseStart?: number;
  baseElapsedMs: number;
  sessionKind: TimerSessionKind | null;
  lastUpdated: number;
}

export type TimerChangeListener = (
  taskId: string,
  snapshot: TimerStateSnapshot | null,
  allTimers: Map<string, TimerStateSnapshot>
) => void;

class ParallelTimerEngine {
  private timers: Map<string, TimerStateSnapshot> = new Map();
  private isOperating: Set<string> = new Set(); // per-task lock
  private tickInterval: number | null = null;
  private lastTickMs: number = 0;
  private listeners: Set<TimerChangeListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.initBroadcastChannel();
    this.initVisibilityListeners();
    this.restoreFromStorage();
  }

  // ── 1. State Inspection ──────────────────────────────────────────────────

  public getSnapshot(taskId: string): TimerStateSnapshot | null {
    return this.timers.get(taskId) ?? null;
  }

  public getAllSnapshots(): Map<string, TimerStateSnapshot> {
    return new Map(this.timers);
  }

  public getState(taskId: string): TimerFSMState {
    return this.timers.get(taskId)?.timerState ?? 'idle';
  }

  public getActiveTaskIds(): string[] {
    return Array.from(this.timers.keys()).filter(
      (id) => this.timers.get(id)?.timerState !== 'idle'
    );
  }

  public isBusy(taskId: string): boolean {
    return this.isOperating.has(taskId);
  }

  public isAnyRunning(): boolean {
    return this.getActiveTaskIds().length > 0;
  }

  public getRunningTimers(): TimerStateSnapshot[] {
    return Array.from(this.timers.values()).filter(
      (t) => t.timerState === 'running'
    );
  }

  // ── 2. Elapsed Time Calculation ──────────────────────────────────────────

  public getElapsedMs(taskId: string, now: number = Date.now()): number {
    const timer = this.timers.get(taskId);
    if (!timer || timer.timerState === 'idle' || !timer.sessionStartTime) {
      return 0;
    }
    if (timer.timerState === 'paused' && timer.pauseStart) {
      return Math.max(
        0,
        timer.pauseStart - timer.sessionStartTime - timer.totalPauseDuration
      );
    }
    return Math.max(0, now - timer.sessionStartTime - timer.totalPauseDuration);
  }

  public getTotalElapsedMs(taskId: string, now: number = Date.now()): number {
    const timer = this.timers.get(taskId);
    if (!timer) return 0;
    return timer.baseElapsedMs + this.getElapsedMs(taskId, now);
  }

  public getFormattedDisplay(taskId: string, now: number = Date.now()): string {
    return formatDuration(this.getTotalElapsedMs(taskId, now));
  }

  // ── 3. FSM Transitions ──────────────────────────────────────────────────

  public canTransitionTo(
    taskId: string,
    action: TimerAction
  ): { allowed: boolean; reason?: string } {
    if (this.isOperating.has(taskId)) {
      return { allowed: false, reason: 'Operation in progress for this task' };
    }

    const timer = this.timers.get(taskId);
    const state = timer?.timerState ?? 'idle';

    switch (action) {
      case 'start':
        if (state === 'running') {
          return { allowed: false, reason: 'Timer already running for this task' };
        }
        return { allowed: true };

      case 'resume':
        if (state !== 'paused') {
          return { allowed: false, reason: `Cannot resume from state: ${state}` };
        }
        return { allowed: true };

      case 'pause':
        if (state !== 'running') {
          return { allowed: false, reason: `Cannot pause from state: ${state}` };
        }
        return { allowed: true };

      case 'stop':
        if (state === 'idle') {
          return { allowed: false, reason: 'Timer is already idle' };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Unknown action' };
    }
  }

  /**
   * Start Timer for a specific task.
   * Does NOT stop other timers (parallel mode).
   * Stops the legacy single-timer if it's running to prevent conflicting state.
   */
  public async start(
    taskId: string,
    existingSessionId?: string,
    startTime?: number,
    baseElapsedMs?: number,
    kind?: TimerSessionKind
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    // Re-entrant start guard: if already running for this task, return success
    const existingTimer = this.timers.get(taskId);
    if (existingTimer && existingTimer.timerState === 'running') {
      return { success: true, sessionId: existingTimer.sessionId ?? undefined };
    }

    const check = this.canTransitionTo(taskId, 'start');
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    // Stop legacy timer if running to prevent conflicting state
    if (timerEngine.getState() !== 'idle') {
      const legacyTaskId = timerEngine.getActiveTaskId();
      if (legacyTaskId) {
        await timerEngine.stop(legacyTaskId);
      }
    }

    this.isOperating.add(taskId);
    const now = startTime || Date.now();

    try {
      const existing = this.timers.get(taskId);
      const snapshot: TimerStateSnapshot = {
        taskId,
        sessionId: existingSessionId ?? existing?.sessionId ?? null,
        timerState: 'running',
        sessionStartTime: now,
        totalPauseDuration: 0,
        pauseStart: undefined,
        baseElapsedMs: Math.max(0, baseElapsedMs ?? existing?.baseElapsedMs ?? 0),
        sessionKind: kind ?? existing?.sessionKind ?? null,
        lastUpdated: now,
      };

      this.timers.set(taskId, snapshot);
      this.persist();
      this.startTickerIfneeded();
      this.broadcast('START', { ...snapshot });
      this.notifyListeners(taskId, snapshot);

      return { success: true, sessionId: snapshot.sessionId ?? undefined };
    } finally {
      this.isOperating.delete(taskId);
    }
  }

  /**
   * Set Session ID after backend creation.
   */
  public setSessionId(taskId: string, sessionId: string): void {
    const timer = this.timers.get(taskId);
    if (timer && timer.timerState !== 'idle') {
      timer.sessionId = sessionId;
      timer.lastUpdated = Date.now();
      this.persist();
      this.notifyListeners(taskId, timer);
    }
  }

  /**
   * Pause Timer for a specific task.
   */
  public pause(
    taskId: string,
    pauseTime?: number
  ): { success: boolean; error?: string } {
    const check = this.canTransitionTo(taskId, 'pause');
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    this.isOperating.add(taskId);
    const now = pauseTime || Date.now();

    try {
      const timer = this.timers.get(taskId)!;
      timer.timerState = 'paused';
      timer.pauseStart = now;
      timer.lastUpdated = now;

      this.persist();
      this.broadcast('PAUSE', { taskId, pauseStart: now });
      this.notifyListeners(taskId, timer);

      return { success: true };
    } finally {
      this.isOperating.delete(taskId);
    }
  }

  /**
   * Resume Timer for a specific task.
   */
  public resume(
    taskId: string,
    resumeTime?: number
  ): { success: boolean; error?: string } {
    const check = this.canTransitionTo(taskId, 'resume');
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    this.isOperating.add(taskId);
    const now = resumeTime || Date.now();

    try {
      const timer = this.timers.get(taskId)!;
      if (timer.pauseStart) {
        const pauseDelta = Math.max(0, now - timer.pauseStart);
        timer.totalPauseDuration += pauseDelta;
      }
      timer.timerState = 'running';
      timer.pauseStart = undefined;
      timer.lastUpdated = now;

      this.persist();
      this.startTickerIfneeded();
      this.broadcast('RESUME', {
        taskId,
        resumeTime: now,
        totalPauseDuration: timer.totalPauseDuration,
        baseElapsedMs: timer.baseElapsedMs,
      });
      this.notifyListeners(taskId, timer);

      return { success: true };
    } finally {
      this.isOperating.delete(taskId);
    }
  }

  /**
   * Stop Timer for a specific task.
   */
  public async stop(
    taskId: string,
    stopTime?: number
  ): Promise<{
    success: boolean;
    activeTime: number;
    sessionId: string | null;
    error?: string;
  }> {
    const timer = this.timers.get(taskId);
    if (!timer || timer.timerState === 'idle') {
      return {
        success: false,
        activeTime: 0,
        sessionId: null,
        error: 'Timer is already idle',
      };
    }

    const check = this.canTransitionTo(taskId, 'stop');
    if (!check.allowed) {
      return { success: false, activeTime: 0, sessionId: null, error: check.reason };
    }

    this.isOperating.add(taskId);
    const now = stopTime || Date.now();

    try {
      // Calculate active time BEFORE updating totalPauseDuration to avoid
      // double-subtraction when the timer is paused.
      const activeTime = this.getElapsedMs(taskId, now);

      if (timer.timerState === 'paused' && timer.pauseStart) {
        timer.totalPauseDuration += Math.max(0, now - timer.pauseStart);
      }

      const stoppedSessionId = timer.sessionId;

      addCompletedSession(activeTime);

      // Remove from map
      this.timers.delete(taskId);

      this.persist();
      this.broadcast('STOP', { taskId, activeTime, stopTime: now, sessionId: stoppedSessionId });
      this.notifyListeners(taskId, null);

      return { success: true, activeTime, sessionId: stoppedSessionId };
    } finally {
      this.isOperating.delete(taskId);
    }
  }

  /**
   * Stop all timers (e.g., on logout).
   */
  public async stopAll(): Promise<void> {
    const taskIds = this.getActiveTaskIds();
    for (const taskId of taskIds) {
      await this.stop(taskId);
    }
  }

  /**
   * Hydrate a specific timer from persisted data.
   */
  public hydrateTimer(persisted: PersistedTimer): void {
    const snapshot: TimerStateSnapshot = {
      taskId: persisted.taskId,
      sessionId: persisted.sessionId,
      timerState: persisted.timerState as TimerFSMState,
      sessionStartTime: persisted.sessionStartTime,
      totalPauseDuration: persisted.totalPauseDuration || 0,
      pauseStart: persisted.pauseStart,
      baseElapsedMs: persisted.baseElapsedMs || 0,
      sessionKind: persisted.sessionKind ?? null,
      lastUpdated: Date.now(),
    };

    this.timers.set(persisted.taskId, snapshot);

    if (snapshot.timerState === 'running') {
      this.startTickerIfneeded();
    }
    this.notifyListeners(persisted.taskId, snapshot);
  }

  /**
   * Force Synchronize engine state with external data.
   */
  public hydrate(persisted: PersistedTimer[] | null): void {
    if (!persisted || persisted.length === 0) {
      if (this.timers.size > 0) {
        this.timers.clear();
        this.stopTicker();
        this.notifyListeners('', null);
      }
      return;
    }

    // Clear existing and reload
    this.timers.clear();
    for (const p of persisted) {
      this.hydrateTimer(p);
    }
  }

  // ── 4. Subscriptions & Clock Ticker ──────────────────────────────────────

  public subscribe(listener: TimerChangeListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    const all = this.getAllSnapshots();
    listener('', null, all);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(changedTaskId: string, snapshot: TimerStateSnapshot | null): void {
    const all = this.getAllSnapshots();
    this.listeners.forEach((fn) => {
      try {
        fn(changedTaskId, snapshot, all);
      } catch (e) {
        console.error('ParallelTimer listener error:', e);
      }
    });
  }

  private startTickerIfneeded(): void {
    if (this.tickInterval !== null) return; // Already running
    if (this.getActiveTaskIds().length === 0) return;

    this.lastTickMs = Date.now();
    this.tickInterval = window.setInterval(() => {
      const now = Date.now();
      if (now - this.lastTickMs > 3000) {
        console.warn('ParallelTimer tick drift detected. Resyncing clock.');
      }
      this.lastTickMs = now;
      this.notifyListeners('', null);
    }, 1000);
  }

  private stopTicker(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private initVisibilityListeners(): void {
    if (typeof window === 'undefined') return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && this.getActiveTaskIds().length > 0) {
        this.lastTickMs = Date.now();
        this.notifyListeners('', null);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
  }

  // ── 5. Cross-Tab Sync ──────────────────────────────────────────────────

  private initBroadcastChannel(): void {
    if (typeof window === 'undefined') return;

    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('ff_parallel_timer_channel');
        this.broadcastChannel.onmessage = (event) =>
          this.handleRemoteMessage(event.data);
      }
    } catch {
      window.addEventListener('storage', (e) => {
        if (e.key === 'ff_parallel_timer_sync_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.handleRemoteMessage(data);
          } catch {
            /* ignore */
          }
        }
      });
    }
  }

  private broadcast(type: string, payload: any): void {
    const msg = {
      type,
      payload,
      senderId: Math.random().toString(36).substring(2),
    };
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.setItem(
          'ff_parallel_timer_sync_event',
          JSON.stringify({ ...msg, _t: Date.now() })
        );
      } catch {
        /* ignore */
      }
    }
  }

  private handleRemoteMessage(data: any): void {
    if (!data || !data.type) return;

    const { type, payload } = data;
    const taskId = payload?.taskId;
    if (!taskId) return;

    switch (type) {
      case 'START': {
        const snapshot: TimerStateSnapshot = {
          taskId,
          sessionId: payload.sessionId || null,
          timerState: 'running',
          sessionStartTime: payload.sessionStartTime || Date.now(),
          totalPauseDuration: 0,
          pauseStart: undefined,
          baseElapsedMs: payload.baseElapsedMs || 0,
          sessionKind: payload.sessionKind ?? null,
          lastUpdated: Date.now(),
        };
        this.timers.set(taskId, snapshot);
        this.persist();
        this.startTickerIfneeded();
        this.notifyListeners(taskId, snapshot);
        break;
      }

      case 'PAUSE': {
        const timer = this.timers.get(taskId);
        if (timer && timer.timerState === 'running') {
          timer.timerState = 'paused';
          timer.pauseStart = payload.pauseStart || Date.now();
          timer.lastUpdated = Date.now();
          this.persist();
          this.notifyListeners(taskId, timer);
        }
        break;
      }

      case 'RESUME': {
        const timer = this.timers.get(taskId);
        if (timer && timer.timerState === 'paused') {
          timer.timerState = 'running';
          timer.totalPauseDuration =
            payload.totalPauseDuration ?? timer.totalPauseDuration;
          timer.baseElapsedMs = payload.baseElapsedMs ?? timer.baseElapsedMs;
          timer.pauseStart = undefined;
          timer.lastUpdated = Date.now();
          this.persist();
          this.startTickerIfneeded();
          this.notifyListeners(taskId, timer);
        }
        break;
      }

      case 'STOP': {
        this.timers.delete(taskId);
        this.persist();
        this.notifyListeners(taskId, null);
        if (this.getActiveTaskIds().length === 0) {
          this.stopTicker();
        }
        break;
      }
    }
  }

  // ── 6. Persistence ──────────────────────────────────────────────────────

  private persist(): void {
    const activeTimers: PersistedTimer[] = [];
    this.timers.forEach((timer) => {
      if (timer.timerState !== 'idle') {
        activeTimers.push({
          taskId: timer.taskId,
          sessionId: timer.sessionId,
          timerState: timer.timerState as 'running' | 'paused',
          sessionStartTime: timer.sessionStartTime,
          totalPauseDuration: timer.totalPauseDuration,
          pauseStart: timer.pauseStart,
          baseElapsedMs: timer.baseElapsedMs,
          sessionKind: timer.sessionKind ?? undefined,
        });
      }
    });

    if (activeTimers.length === 0) {
      clearTimers();
    } else {
      saveTimers(activeTimers);
    }
  }

  private restoreFromStorage(): void {
    const loaded = loadTimers();
    if (loaded && loaded.length > 0) {
      for (const p of loaded) {
        this.hydrateTimer(p);
      }
    }
  }
}

// Singleton export
export const parallelTimerEngine = new ParallelTimerEngine();

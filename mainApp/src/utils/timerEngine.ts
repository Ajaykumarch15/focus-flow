/**
 * timerEngine.ts — Production-Grade Authoritative Timer Engine & Finite State Machine
 *
 * Core Principles:
 * 1. Single Source of Truth for active timer state & elapsed calculation.
 * 2. Strict Finite State Machine: Idle -> Running -> Paused -> Running -> Idle.
 * 3. Timestamp-based math: elapsed = Date.now() - sessionStartTime - totalPauseDuration.
 * 4. Sleep/Wake & Tab visibility recovery built-in.
 * 5. Cross-tab synchronization via BroadcastChannel.
 * 6. Concurrency lock to prevent duplicate clicks.
 */

import { formatDuration } from './time';
import { clearTimer, loadTimer, saveTimer, PersistedTimer, addCompletedSession } from './timerPersist';

export type TimerFSMState = 'idle' | 'running' | 'paused';
export type TimerAction = 'start' | 'pause' | 'resume' | 'stop';

export interface TimerStateSnapshot {
  taskId: string | null;
  sessionId: string | null;
  timerState: TimerFSMState;
  sessionStartTime: number;
  totalPauseDuration: number;
  pauseStart?: number;
  lastUpdated: number;
}

export type TimerChangeListener = (snapshot: TimerStateSnapshot, elapsedMs: number) => void;

class TimerEngine {
  private taskId: string | null = null;
  private sessionId: string | null = null;
  private timerState: TimerFSMState = 'idle';
  private sessionStartTime: number = 0;
  private totalPauseDuration: number = 0;
  private pauseStart?: number;

  private isOperating: boolean = false;
  private tickInterval: number | null = null;
  private lastTickMs: number = 0;
  private listeners: Set<TimerChangeListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.initBroadcastChannel();
    this.initVisibilityListeners();
    this.restoreFromStorage();
  }

  // ── 1. Single Source of Truth & State Inspection ──────────────────────────

  public getSnapshot(): TimerStateSnapshot {
    return {
      taskId: this.taskId,
      sessionId: this.sessionId,
      timerState: this.timerState,
      sessionStartTime: this.sessionStartTime,
      totalPauseDuration: this.totalPauseDuration,
      pauseStart: this.pauseStart,
      lastUpdated: Date.now(),
    };
  }

  public getState(): TimerFSMState {
    return this.timerState;
  }

  public getActiveTaskId(): string | null {
    return this.taskId;
  }

  public getActiveSessionId(): string | null {
    return this.sessionId;
  }

  public isBusy(): boolean {
    return this.isOperating;
  }

  /**
   * Pure Timestamp Math for Elapsed Time Calculation
   * Never relies on incrementing elapsed += 1 per second.
   */
  public getElapsedMs(now: number = Date.now()): number {
    if (this.timerState === 'idle' || !this.sessionStartTime) {
      return 0;
    }
    if (this.timerState === 'paused' && this.pauseStart) {
      return Math.max(0, this.pauseStart - this.sessionStartTime - this.totalPauseDuration);
    }
    return Math.max(0, now - this.sessionStartTime - this.totalPauseDuration);
  }

  public getFormattedDisplay(now: number = Date.now()): string {
    return formatDuration(this.getElapsedMs(now));
  }

  // ── 2. Finite State Machine Transitions ───────────────────────────────────

  /**
   * FSM Transition Guard
   */
  public canTransitionTo(action: TimerAction, targetTaskId?: string): { allowed: boolean; reason?: string } {
    if (this.isOperating) {
      return { allowed: false, reason: 'Operation in progress' };
    }

    switch (action) {
      case 'start':
        if (this.timerState === 'idle') return { allowed: true };
        if (this.timerState === 'running' && targetTaskId && this.taskId === targetTaskId) {
          return { allowed: false, reason: 'Timer is already running for this task' };
        }
        return { allowed: true };

      case 'resume':
        if (this.timerState !== 'paused') {
          return { allowed: false, reason: `Cannot resume timer from state: ${this.timerState}` };
        }
        if (targetTaskId && this.taskId !== targetTaskId) {
          return { allowed: false, reason: 'Cannot resume timer for a different task' };
        }
        return { allowed: true };

      case 'pause':
        if (this.timerState !== 'running') {
          return { allowed: false, reason: `Cannot pause timer from state: ${this.timerState}` };
        }
        if (targetTaskId && this.taskId !== targetTaskId) {
          return { allowed: false, reason: 'Cannot pause a task that is not currently running' };
        }
        return { allowed: true };

      case 'stop':
        if (this.timerState === 'idle') {
          return { allowed: false, reason: 'Timer is already idle' };
        }
        if (targetTaskId && this.taskId !== targetTaskId) {
          return { allowed: false, reason: 'Cannot stop timer for a non-active task' };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Unknown action' };
    }
  }

  /**
   * Start Timer (Transition: Idle | Running(other) -> Running)
   */
  public async start(taskId: string, existingSessionId?: string, startTime?: number): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const check = this.canTransitionTo('start', taskId);
    if (!check.allowed && this.timerState === 'running' && this.taskId === taskId) {
      // Re-entrant start call for the exact same running task -> no-op success
      return { success: true, sessionId: this.sessionId ?? undefined };
    }

    if (this.timerState !== 'idle' && this.taskId !== taskId) {
      // Stop current running/paused session before starting new task
      await this.stop(this.taskId!);
    }

    this.isOperating = true;
    const now = startTime || Date.now();

    try {
      this.taskId = taskId;
      this.sessionId = existingSessionId || null;
      this.timerState = 'running';
      this.sessionStartTime = now;
      this.totalPauseDuration = 0;
      this.pauseStart = undefined;

      this.persist();
      this.startTicker();
      this.broadcast('START', { taskId, sessionId: this.sessionId, startTime: now });
      this.notifyListeners();

      return { success: true, sessionId: this.sessionId ?? undefined };
    } finally {
      this.isOperating = false;
    }
  }

  /**
   * Set Session ID after backend creation
   */
  public setSessionId(sessionId: string): void {
    if (this.taskId && this.timerState !== 'idle') {
      this.sessionId = sessionId;
      this.persist();
      this.notifyListeners();
    }
  }

  /**
   * Pause Timer (Transition: Running -> Paused)
   */
  public pause(taskId?: string, pauseTime?: number): { success: boolean; error?: string } {
    const target = taskId || this.taskId;
    if (!target) return { success: false, error: 'No active task to pause' };

    const check = this.canTransitionTo('pause', target);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    this.isOperating = true;
    const now = pauseTime || Date.now();

    try {
      this.timerState = 'paused';
      this.pauseStart = now;

      this.stopTicker();
      this.persist();
      this.broadcast('PAUSE', { taskId: this.taskId, sessionId: this.sessionId, pauseStart: now });
      this.notifyListeners();

      return { success: true };
    } finally {
      this.isOperating = false;
    }
  }

  /**
   * Resume Timer (Transition: Paused -> Running)
   */
  public resume(taskId?: string, resumeTime?: number): { success: boolean; error?: string } {
    const target = taskId || this.taskId;
    if (!target) return { success: false, error: 'No task to resume' };

    const check = this.canTransitionTo('resume', target);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    this.isOperating = true;
    const now = resumeTime || Date.now();

    try {
      if (this.pauseStart) {
        const pauseDelta = Math.max(0, now - this.pauseStart);
        this.totalPauseDuration += pauseDelta;
      }
      this.timerState = 'running';
      this.pauseStart = undefined;

      this.persist();
      this.startTicker();
      this.broadcast('RESUME', { taskId: this.taskId, sessionId: this.sessionId, resumeTime: now, totalPauseDuration: this.totalPauseDuration });
      this.notifyListeners();

      return { success: true };
    } finally {
      this.isOperating = false;
    }
  }

  /**
   * Stop Timer (Transition: Running | Paused -> Idle)
   */
  public async stop(taskId?: string, stopTime?: number): Promise<{ success: boolean; activeTime: number; sessionId: string | null; taskId: string | null; error?: string }> {
    const target = taskId || this.taskId;
    if (!target || this.timerState === 'idle') {
      return { success: false, activeTime: 0, sessionId: null, taskId: null, error: 'Timer is already idle' };
    }

    const check = this.canTransitionTo('stop', target);
    if (!check.allowed) {
      return { success: false, activeTime: 0, sessionId: null, taskId: null, error: check.reason };
    }

    this.isOperating = true;
    const now = stopTime || Date.now();

    try {
      // If currently paused, finalize current pause duration
      if (this.timerState === 'paused' && this.pauseStart) {
        this.totalPauseDuration += Math.max(0, now - this.pauseStart);
      }

      const activeTime = this.getElapsedMs(now);
      const stoppedTaskId = this.taskId;
      const stoppedSessionId = this.sessionId;

      addCompletedSession(activeTime);

      // Reset state
      this.timerState = 'idle';
      this.taskId = null;
      this.sessionId = null;
      this.sessionStartTime = 0;
      this.totalPauseDuration = 0;
      this.pauseStart = undefined;

      this.stopTicker();
      clearTimer();
      this.broadcast('STOP', { taskId: stoppedTaskId, sessionId: stoppedSessionId, activeTime, stopTime: now });
      this.notifyListeners();

      return { success: true, activeTime, sessionId: stoppedSessionId, taskId: stoppedTaskId };
    } finally {
      this.isOperating = false;
    }
  }

  /**
   * Force Synchronize engine state with external data (e.g. from backend or localStorage load)
   */
  public hydrate(persisted: PersistedTimer | null): void {
    if (!persisted) {
      if (this.timerState !== 'idle') {
        this.timerState = 'idle';
        this.taskId = null;
        this.sessionId = null;
        this.sessionStartTime = 0;
        this.totalPauseDuration = 0;
        this.pauseStart = undefined;
        this.stopTicker();
        this.notifyListeners();
      }
      return;
    }

    this.taskId = persisted.taskId;
    this.sessionId = persisted.sessionId;
    this.timerState = persisted.timerState as TimerFSMState;
    this.sessionStartTime = persisted.sessionStartTime;
    this.totalPauseDuration = persisted.totalPauseDuration || 0;
    this.pauseStart = persisted.pauseStart;

    if (this.timerState === 'running') {
      this.startTicker();
    } else {
      this.stopTicker();
    }
    this.notifyListeners();
  }

  // ── 3. Subscriptions & Clock Ticker ───────────────────────────────────────

  public subscribe(listener: TimerChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot(), this.getElapsedMs());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    const elapsed = this.getElapsedMs();
    this.listeners.forEach(fn => {
      try { fn(snapshot, elapsed); } catch (e) { console.error('Timer listener error:', e); }
    });
  }

  private startTicker(): void {
    this.stopTicker();
    this.lastTickMs = Date.now();
    this.tickInterval = window.setInterval(() => {
      const now = Date.now();
      if (now - this.lastTickMs > 3000) {
        console.warn('Timer tick drift detected (laptop sleep/throttle). Resyncing clock.');
      }
      this.lastTickMs = now;
      this.notifyListeners();
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
      if (document.visibilityState === 'visible' && this.timerState === 'running') {
        this.lastTickMs = Date.now();
        this.notifyListeners();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
  }

  // ── 4. Cross-Tab Sync (BroadcastChannel + Storage Event) ─────────────────

  private initBroadcastChannel(): void {
    if (typeof window === 'undefined') return;

    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('ff_timer_engine_channel');
        this.broadcastChannel.onmessage = (event) => this.handleRemoteMessage(event.data);
      }
    } catch {
      window.addEventListener('storage', (e) => {
        if (e.key === 'ff_active_timer_sync_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.handleRemoteMessage(data);
          } catch { /* ignore */ }
        }
      });
    }
  }

  private broadcast(type: string, payload: any): void {
    const msg = { type, payload, senderId: Math.random().toString(36).substring(2) };
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(msg); } catch { /* ignore */ }
    } else {
      try {
        localStorage.setItem('ff_active_timer_sync_event', JSON.stringify({ ...msg, _t: Date.now() }));
      } catch { /* ignore */ }
    }
  }

  private handleRemoteMessage(data: any): void {
    if (!data || !data.type) return;

    const { type, payload } = data;
    switch (type) {
      case 'START':
        if (payload.taskId) {
          this.taskId = payload.taskId;
          this.sessionId = payload.sessionId || null;
          this.timerState = 'running';
          this.sessionStartTime = payload.startTime || Date.now();
          this.totalPauseDuration = 0;
          this.pauseStart = undefined;
          this.startTicker();
          this.notifyListeners();
        }
        break;

      case 'PAUSE':
        if (this.timerState === 'running') {
          this.timerState = 'paused';
          this.pauseStart = payload.pauseStart || Date.now();
          this.stopTicker();
          this.notifyListeners();
        }
        break;

      case 'RESUME':
        if (this.timerState === 'paused') {
          this.timerState = 'running';
          this.totalPauseDuration = payload.totalPauseDuration ?? this.totalPauseDuration;
          this.pauseStart = undefined;
          this.startTicker();
          this.notifyListeners();
        }
        break;

      case 'STOP':
        if (this.timerState !== 'idle') {
          this.timerState = 'idle';
          this.taskId = null;
          this.sessionId = null;
          this.sessionStartTime = 0;
          this.totalPauseDuration = 0;
          this.pauseStart = undefined;
          this.stopTicker();
          this.notifyListeners();
        }
        break;
    }
  }

  // ── 5. Persistence Helper ────────────────────────────────────────────────

  private persist(): void {
    if (this.timerState === 'idle' || !this.taskId) {
      clearTimer();
      return;
    }

    saveTimer({
      taskId: this.taskId,
      sessionId: this.sessionId,
      timerState: this.timerState,
      sessionStartTime: this.sessionStartTime,
      totalPauseDuration: this.totalPauseDuration,
      pauseStart: this.pauseStart,
    });
  }

  private restoreFromStorage(): void {
    const loaded = loadTimer();
    if (loaded) {
      this.hydrate(loaded);
    }
  }
}

export const timerEngine = new TimerEngine();

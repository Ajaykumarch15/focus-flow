/**
 * offlineQueue.ts — Network Failure Recovery & Offline Synchronization Queue
 *
 * Ensures timer operations (start, pause, resume, stop) are queued locally
 * whenever the network is offline or backend API requests fail/timeout.
 * Replays operations in sequence once connectivity is restored.
 *
 * IES-P1-05 reliability rules:
 *  - Ops are NEVER dropped. A failed op stays persisted and is retried with
 *    exponential backoff until it succeeds or the queue is cleared.
 *  - Every op carries a client-generated `opId` so the server can deduplicate
 *    replays (a START that was applied but whose response was lost won't create
 *    a second session, and repeated pause/resume/stop side effects are skipped).
 *  - Replays do NOT resend client timestamps; the server uses its own clock, so
 *    a stale/fabricated offline time can never be applied.
 */

import { api } from './api';

export type OfflineOpType = 'START_SESSION' | 'PAUSE_SESSION' | 'RESUME_SESSION' | 'STOP_SESSION';

export interface OfflineOperation {
  opId: string;
  type: OfflineOpType;
  taskId: string;
  sessionId?: string;
  timestamp: number;
  payload?: Record<string, any>;
  attempts: number;
}

const QUEUE_KEY = 'ff_offline_timer_queue';
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

export function createOpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

export class OfflineQueue {
  private queue: OfflineOperation[] = [];
  private isProcessing: boolean = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      this.queue = raw ? JSON.parse(raw) : [];
    } catch {
      this.queue = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch { /* storage full */ }
  }

  private scheduleRetry(attempts: number): void {
    if (this.retryTimer) return;
    const delay = Math.min(1000 * 2 ** (attempts - 1), MAX_RETRY_DELAY_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.processQueue();
    }, delay);
  }

  public enqueue(
    type: OfflineOpType,
    taskId: string,
    sessionId?: string,
    payload?: Record<string, any>,
    opId?: string,
  ): OfflineOperation {
    const op: OfflineOperation = {
      opId: opId || createOpId(),
      type,
      taskId,
      sessionId,
      timestamp: Date.now(),
      payload,
      attempts: 0,
    };

    this.queue.push(op);
    this.save();

    // Try processing if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue();
    }

    return op;
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const op = this.queue[0];
        const replayed = op.attempts > 0;
        op.attempts += 1;

        try {
          let success = false;
          // Replays must not resend client timestamps: the server validates and
          // uses its own clock, so a fabricated offline time is never applied.
          // The FIRST attempt may carry the enqueue wall-clock as the action time.
          switch (op.type) {
            case 'START_SESSION':
              await api.sessions.start(op.taskId, replayed ? undefined : (op.payload?.startTime ?? op.timestamp), op.opId);
              success = true;
              break;

            case 'PAUSE_SESSION':
              if (op.sessionId) {
                await api.sessions.pause(op.sessionId, replayed ? undefined : (op.payload?.pauseTime ?? op.timestamp), op.opId);
                success = true;
              }
              break;

            case 'RESUME_SESSION':
              if (op.sessionId) {
                await api.sessions.resume(op.sessionId, replayed ? undefined : (op.payload?.resumeTime ?? op.timestamp), op.opId);
                success = true;
              }
              break;

            case 'STOP_SESSION':
              if (op.sessionId) {
                await api.sessions.stop(op.sessionId, replayed ? undefined : (op.payload?.endTime ?? op.timestamp), op.opId);
                success = true;
              }
              break;
          }

          if (success) {
            // Dequeue only on success — a failed op is never dropped.
            this.queue.shift();
            this.save();
          }
        } catch (err: any) {
          console.warn(`[OfflineQueue] Operation ${op.type} failed (attempt ${op.attempts}):`, err?.message);
          // Persist the incremented attempts so a reload knows this op was
          // already sent and will not resend a client timestamp.
          this.save();
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            break;
          }
          // Keep the op queued and retry with exponential backoff.
          this.scheduleRetry(op.attempts);
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
    this.save();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}

export const offlineQueue = new OfflineQueue();

/**
 * offlineQueue.ts — Network Failure Recovery & Offline Synchronization Queue
 *
 * Ensures timer operations (start, pause, resume, stop) are queued locally
 * whenever the network is offline or backend API requests fail/timeout.
 * Replays operations in sequence once connectivity is restored.
 */

import { api } from './api';

export type OfflineOpType = 'START_SESSION' | 'PAUSE_SESSION' | 'RESUME_SESSION' | 'STOP_SESSION';

export interface OfflineOperation {
  id: string;
  type: OfflineOpType;
  taskId: string;
  sessionId?: string;
  timestamp: number;
  payload?: Record<string, any>;
  attempts: number;
}

const QUEUE_KEY = 'ff_offline_timer_queue';

class OfflineQueue {
  private queue: OfflineOperation[] = [];
  private isProcessing: boolean = false;

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

  public enqueue(type: OfflineOpType, taskId: string, sessionId?: string, payload?: Record<string, any>): OfflineOperation {
    const op: OfflineOperation = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
        op.attempts += 1;

        try {
          let success = false;
          switch (op.type) {
            case 'START_SESSION':
              await api.sessions.start(op.taskId, op.payload?.startTime || op.timestamp);
              success = true;
              break;

            case 'PAUSE_SESSION':
              if (op.sessionId) {
                await api.sessions.pause(op.sessionId, op.payload?.pauseTime || op.timestamp);
                success = true;
              }
              break;

            case 'RESUME_SESSION':
              if (op.sessionId) {
                await api.sessions.resume(op.sessionId, op.payload?.resumeTime || op.timestamp);
                success = true;
              }
              break;

            case 'STOP_SESSION':
              if (op.sessionId) {
                await api.sessions.stop(op.sessionId, op.payload?.endTime || op.timestamp);
                success = true;
              }
              break;
          }

          if (success || op.attempts > 5) {
            // Dequeue item on success or if retried too many times to prevent infinite blocking
            this.queue.shift();
            this.save();
          }
        } catch (err: any) {
          console.warn(`[OfflineQueue] Operation ${op.type} failed (attempt ${op.attempts}):`, err?.message);
          if (!navigator.onLine) {
            // Stop processing if network lost mid-loop
            break;
          }
          if (op.attempts >= 3) {
            // Shift failed item after max attempts
            this.queue.shift();
            this.save();
          } else {
            break;
          }
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
  }
}

export const offlineQueue = new OfflineQueue();

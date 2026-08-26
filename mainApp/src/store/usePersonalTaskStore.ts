/**
 * usePersonalTaskStore — Independent task store for the Personal workspace.
 *
 * Mirrors the task-related slice of useStore but operates on its own tasks array.
 * All tasks created through this store are tagged with workspaceContext: 'personal'.
 * Uses the shared timerEngine singleton for focus timer state.
 */

import { create } from 'zustand';
import { api } from '../utils/api';
import { timerEngine } from '../utils/timerEngine';
import { offlineQueue, createOpId } from '../utils/offlineQueue';
import type { Task, Priority, Subtask } from '../types';
import { toast } from './useToastStore';

// ── Mappers ───────────────────────────────────────────────────────────────────
function mapTask(doc: any): Task {
  return {
    id: doc._id,
    title: doc.title ?? '',
    description: doc.description ?? '',
    priority: (doc.priority ?? 'medium') as Priority,
    status: doc.status ?? 'todo',
    category: doc.category ?? 'Work',
    deadline: doc.deadline ? new Date(doc.deadline).getTime() : undefined,
    scheduledDate: doc.scheduledDate ? new Date(doc.scheduledDate).getTime() : undefined,
    reminderMinutesBefore: doc.reminderMinutesBefore ?? undefined,
    color: doc.color ?? '#0ea5e9',
    tags: doc.tags ?? [],
    subtasks: (doc.subtasks ?? []).map((s: any): Subtask => ({
      id: s._id,
      title: s.title,
      completed: s.completed,
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
    })),
    sessions: [],
    totalTime: doc.totalTime ?? 0,
    order: doc.order ?? 0,
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
    completedAt: doc.completedAt ? new Date(doc.completedAt).getTime() : null,
    roadmapRef: (doc.roadmapRef || doc.personalRoadmapRef) ? String(doc.roadmapRef || doc.personalRoadmapRef) : undefined,
    phaseRef: (doc.phaseRef || doc.personalPhaseRef) ? String(doc.phaseRef || doc.personalPhaseRef) : undefined,
    milestoneRef: (doc.milestoneRef || doc.personalMilestoneRef) ? String(doc.milestoneRef || doc.personalMilestoneRef) : undefined,
    workspaceContext: doc.workspaceContext || 'personal',
  };
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 30_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(sessionId: string, onStale?: () => void): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    api.personalSessions.heartbeat(sessionId).catch((err: any) => {
      if (err?.message?.includes('404') || err?.message?.includes('not found')) {
        stopHeartbeat();
        onStale?.();
      }
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ── Store Shape ───────────────────────────────────────────────────────────────
interface PersonalTaskState {
  tasks: Task[];
  selectedTaskIds: Set<string>;
  loading: boolean;
  error: string | null;

  fetchTasks: () => Promise<void>;
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'sessions' | 'totalTime' | 'deadline' | 'scheduledDate' | 'order'> & { deadline?: string | number; scheduledDate?: string | number }) => Promise<string>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reorderTasks: (tasks: Task[]) => void;
  persistTaskOrder: (orderedIds: string[]) => Promise<void>;

  toggleTaskSelection: (id: string) => void;
  selectAllTasks: (ids: string[]) => void;
  clearTaskSelection: () => void;
  bulkCompleteTasks: (ids: string[]) => Promise<void>;
  bulkDeleteTasks: (ids: string[]) => Promise<void>;

  startTimer: (taskId: string, baseMs?: number) => Promise<void>;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => Promise<void>;

  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;

  getTask: (id: string) => Task | undefined;
}

export const usePersonalTaskStore = create<PersonalTaskState>((set, get) => ({
  tasks: [],
  selectedTaskIds: new Set<string>(),
  loading: false,
  error: null,

  fetchTasks: async () => {
    try {
      set({ loading: true, error: null });
      const docs = await api.personalTasks.list();
      const personal = docs.map(mapTask);
      set({ tasks: personal, loading: false });
    } catch (err: any) {
      console.error('❌ usePersonalTaskStore.fetchTasks failed:', err);
      set({ error: err.message, loading: false });
    }
  },

  addTask: async (data) => {
    const tempId = `temp_${Date.now()}`;
    const { deadline, scheduledDate, ...rest } = data;
    const tempTask: Task = {
      ...rest,
      id: tempId, sessions: [], totalTime: 0, order: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
      workspaceContext: 'personal',
      deadline: typeof deadline === 'number' ? deadline
        : deadline ? new Date(deadline).getTime() : undefined,
      scheduledDate: typeof scheduledDate === 'number' ? scheduledDate
        : scheduledDate ? new Date(scheduledDate).getTime() : undefined,
    };
    set((s) => ({ tasks: [tempTask, ...s.tasks] }));
    try {
      const doc = await api.personalTasks.create({
        ...data,
        deadline: data.deadline || undefined,
        scheduledDate: data.scheduledDate || undefined,
      });
      const real = mapTask(doc);
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === tempId ? real : t)) }));
      return real.id;
    } catch (err: any) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== tempId) }));
      throw err;
    }
  },

  updateTask: async (id, updates) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)),
    }));
    await api.personalTasks.update(id, updates);
  },

  deleteTask: async (id) => {
    if (timerEngine.getActiveTaskId() === id) {
      await get().stopTimer(id);
    }
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
    }));
    await api.personalTasks.delete(id);
  },

  completeTask: async (id) => {
    if (timerEngine.getActiveTaskId() === id) {
      await get().stopTimer(id);
    }
    await get().updateTask(id, { status: 'completed', completedAt: Date.now() });
  },

  reorderTasks: (tasks) => set({ tasks }),

  persistTaskOrder: async (orderedIds) => {
    try {
      set((s) => ({
        tasks: s.tasks.map((t) => {
          const idx = orderedIds.indexOf(t.id);
          return idx >= 0 ? { ...t, order: idx } : t;
        }),
      }));
      await api.personalTasks.reorder(orderedIds);
    } catch {
      get().fetchTasks();
    }
  },

  // ── Selection & Bulk ──────────────────────────────────────────────────────
  toggleTaskSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedTaskIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { selectedTaskIds: next };
    }),

  selectAllTasks: (ids) => set({ selectedTaskIds: new Set(ids) }),

  clearTaskSelection: () => set({ selectedTaskIds: new Set() }),

  bulkCompleteTasks: async (ids) => {
    if (!ids.length) return;
    const now = Date.now();
    try {
      for (const id of ids) {
        if (timerEngine.getActiveTaskId() === id) {
          await get().stopTimer(id);
        }
      }
      set((s) => ({
        tasks: s.tasks.map((t) =>
          ids.includes(t.id) ? { ...t, status: 'completed' as const, completedAt: now } : t
        ),
        selectedTaskIds: new Set(),
      }));
      await Promise.all(ids.map((id) => api.personalTasks.update(id, { status: 'completed', completedAt: now })));
      toast.success('Tasks completed', `${ids.length} task${ids.length > 1 ? 's' : ''} marked as complete.`);
    } catch {
      toast.error('Failed to complete tasks');
      get().fetchTasks();
    }
  },

  bulkDeleteTasks: async (ids) => {
    if (!ids.length) return;
    try {
      set((s) => ({
        tasks: s.tasks.filter((t) => !ids.includes(t.id)),
        selectedTaskIds: new Set(),
      }));
      await Promise.all(ids.map((id) => api.personalTasks.delete(id)));
      toast.success('Tasks deleted', `${ids.length} task${ids.length > 1 ? 's' : ''} removed.`);
    } catch {
      toast.error('Failed to delete tasks');
      get().fetchTasks();
    }
  },

  // ── Timer ─────────────────────────────────────────────────────────────────
  startTimer: async (taskId, baseMs) => {
    const now = Date.now();
    const opId = createOpId();

    const currentTaskId = timerEngine.getSnapshot().taskId;
    if (currentTaskId && currentTaskId !== taskId) {
      await get().stopTimer(currentTaskId);
    }

    const resumeFromMs = baseMs ?? (get().tasks.find((t) => t.id === taskId)?.totalTime ?? 0);
    const res = await timerEngine.start(taskId, undefined, now, resumeFromMs);
    if (!res.success) {
      if (res.error) toast.error('Timer Error', res.error);
      return;
    }

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'active' } : t)),
    }));

    try {
      const sessionDoc = await api.personalSessions.start(taskId, now, opId);
      timerEngine.setSessionId(sessionDoc._id);
      startHeartbeat(sessionDoc._id, () => {
        timerEngine.hydrate(null);
      });
    } catch {
      console.warn('Network issue on session start. Enqueuing offline op.');
      offlineQueue.enqueue('START_SESSION', taskId, undefined, { startTime: now }, opId);
    }
  },

  pauseTimer: (taskId) => {
    const sessionId = timerEngine.getActiveSessionId();
    const now = Date.now();
    const opId = createOpId();

    const res = timerEngine.pause(taskId, now);
    if (!res.success) {
      if (res.error) toast.error('Timer Error', res.error);
      return;
    }

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'paused' } : t)),
    }));

    if (sessionId) {
      api.personalSessions.pause(sessionId, now, opId).catch(() => {
        offlineQueue.enqueue('PAUSE_SESSION', taskId, sessionId, { pauseTime: now }, opId);
      });
    }
  },

  resumeTimer: (taskId) => {
    const sessionId = timerEngine.getActiveSessionId();
    const now = Date.now();
    const opId = createOpId();

    const res = timerEngine.resume(taskId, now);
    if (!res.success) {
      if (res.error) toast.error('Timer Error', res.error);
      return;
    }

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'active' } : t)),
    }));

    if (sessionId) {
      api.personalSessions.resume(sessionId, now, opId).catch(() => {
        offlineQueue.enqueue('RESUME_SESSION', taskId, sessionId, { resumeTime: now }, opId);
      });
    }
  },

  stopTimer: async (taskId) => {
    const sessionId = timerEngine.getActiveSessionId();
    const now = Date.now();
    const opId = createOpId();

    const res = await timerEngine.stop(taskId, now);
    if (!res.success && res.error !== 'Timer is already idle') {
      if (res.error) toast.error('Timer Error', res.error);
      return;
    }

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t } : t)),
    }));

    if (sessionId) {
      try {
        await api.personalSessions.stop(sessionId, now, opId);
        stopHeartbeat();
        await get().fetchTasks();
      } catch {
        console.warn('Network issue on session stop. Enqueuing offline op.');
        offlineQueue.enqueue('STOP_SESSION', taskId, sessionId, { endTime: now }, opId);
      }
    }
  },

  // ── Subtasks ──────────────────────────────────────────────────────────────
  addSubtask: async (taskId, title) => {
    const doc = await api.personalTasks.addSubtask(taskId, title);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? mapTask(doc) : t)) }));
  },

  toggleSubtask: async (taskId, subtaskId, completed) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map((st) => (st.id === subtaskId ? { ...st, completed } : st)) }
          : t
      ),
    }));
    const doc = await api.personalTasks.toggleSubtask(taskId, subtaskId, completed);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? mapTask(doc) : t)) }));
  },

  deleteSubtask: async (taskId, subtaskId) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter((st) => st.id !== subtaskId) } : t
      ),
    }));
    const doc = await api.personalTasks.deleteSubtask(taskId, subtaskId);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? mapTask(doc) : t)) }));
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  getTask: (id) => get().tasks.find((t) => t.id === id),
}));

/**
 * usePersonalTaskStore — Independent task store for the Personal workspace.
 *
 * Mirrors the task-related slice of useStore but operates on its own tasks array.
 * All tasks created through this store are tagged with workspaceContext: 'personal'.
 * Uses the shared timerEngine singleton for focus timer state.
 */

import { create } from 'zustand';
import { api } from '@shared/utils/api';
import { timerEngine } from '@worklog/services/timerEngine';
import { offlineQueue, createOpId } from '@shared/utils/offlineQueue';
import { startTimerHeartbeat, stopTimerHeartbeat } from '@worklog/services/timerHeartbeat';
import type { Task, Priority, Subtask, JournalEntry } from '@shared/types';
import { useStore } from '@worklog/services/useStore';
import { useRoadmapStore } from './useRoadmapStore';
import { toast } from '@shared/services/useToastStore';

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
// Heartbeat start/stop lives in utils/timerHeartbeat (kind-aware): the shared
// `startTimerHeartbeat` pings api.personalSessions for personal sessions and
// api.sessions for work sessions, using a single interval.

// ── Store Shape ───────────────────────────────────────────────────────────────
interface PersonalTaskState {
  tasks: Task[];
  journals: JournalEntry[];
  selectedTaskIds: Set<string>;
  loading: boolean;
  error: string | null;

  fetchTasks: () => Promise<void>;
  fetchJournals: () => Promise<void>;
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

  addJournal: (data: { taskId: string; content: string; mood: number; focusRating: number }) => Promise<void>;

  getTask: (id: string) => Task | undefined;
  getJournalsForTask: (taskId: string) => JournalEntry[];

  // Rehydrate a running/paused personal session from the backend on app boot so a
  // personal timer survives a refresh (the engine restores from localStorage, but
  // it needs its heartbeat restarted or the server reaper closes it as a zombie).
  rehydratePersonalTimer: () => Promise<void>;
}

export const usePersonalTaskStore = create<PersonalTaskState>((set, get) => ({
  tasks: [],
  journals: [],
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

  fetchJournals: async () => {
    try {
      const docs = await api.journals.list();
      const mapped = docs.map((j: any) => ({
        id: j._id,
        taskId: j.taskId,
        content: j.content ?? '',
        mood: j.mood ?? 3,
        focusRating: j.focusRating ?? 3,
        createdAt: j.createdAt ? new Date(j.createdAt).getTime() : Date.now(),
        updatedAt: j.updatedAt ? new Date(j.updatedAt).getTime() : Date.now(),
      }));
      set({ journals: mapped });
    } catch (err) {
      console.error('❌ usePersonalTaskStore.fetchJournals failed:', err);
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
    // Refresh roadmap progress if a linked task's status changed
    if (updates.status) {
      const task = get().tasks.find((t) => t.id === id);
      if (task?.milestoneRef) {
        useRoadmapStore.getState().refreshIfLinked(task.roadmapRef);
      }
    }
  },

  deleteTask: async (id) => {
    if (timerEngine.getActiveTaskId() === id) {
      await get().stopTimer(id);
    }
    // Capture roadmapRef before removing from local state
    const taskToDelete = get().tasks.find((t) => t.id === id);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
    }));
    await api.personalTasks.delete(id);
    // Refresh roadmap progress if the deleted task was linked to a milestone
    if (taskToDelete?.milestoneRef && taskToDelete?.roadmapRef) {
      useRoadmapStore.getState().refreshIfLinked(taskToDelete.roadmapRef);
    }
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
      // Refresh roadmap progress for any linked tasks
      const completedTasks = get().tasks.filter((t) => ids.includes(t.id) && t.milestoneRef);
      const roadmapIds = new Set(completedTasks.map((t) => t.roadmapRef).filter(Boolean));
      for (const roadmapId of roadmapIds) {
        useRoadmapStore.getState().refreshIfLinked(roadmapId);
      }
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

    const currentSnapshot = timerEngine.getSnapshot();
    const currentTaskId = currentSnapshot.taskId;
    const currentKind = currentSnapshot.sessionKind;
    if (currentTaskId && currentTaskId !== taskId && currentKind && currentKind !== 'personal') {
      // Switching from a work session to personal — show handoff toast
      const workTaskTitle = useStore.getState().tasks.find((t) => t.id === currentTaskId)?.title;
      if (workTaskTitle) {
        toast.warning('Switched timer', `Stopped work session "${workTaskTitle}" to start this personal task.`);
      }
      const { stopActiveTimerForSwitch } = await import('@worklog/services/activeTimerRouter');
      await stopActiveTimerForSwitch();
    }

    const resumeFromMs = baseMs ?? (get().tasks.find((t) => t.id === taskId)?.totalTime ?? 0);
    const res = await timerEngine.start(taskId, undefined, now, resumeFromMs, 'personal');
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
      startTimerHeartbeat(() => {
        timerEngine.hydrate(null);
      });
    } catch {
      console.warn('Network issue on session start. Enqueuing offline op.');
        offlineQueue.enqueue('START_SESSION', taskId, undefined, { startTime: now }, opId, 'personal');
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
          offlineQueue.enqueue('PAUSE_SESSION', taskId, sessionId, { pauseTime: now }, opId, 'personal');
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
          offlineQueue.enqueue('RESUME_SESSION', taskId, sessionId, { resumeTime: now }, opId, 'personal');
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
        stopTimerHeartbeat();
        await get().fetchTasks();
      } catch {
        console.warn('Network issue on session stop. Enqueuing offline op.');
          offlineQueue.enqueue('STOP_SESSION', taskId, sessionId, { endTime: now }, opId, 'personal');
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

  addJournal: async (data: { taskId: string; content: string; mood: number; focusRating: number }) => {
    try {
      const doc = await api.journals.create(data);
      const journal = {
        id: doc._id,
        taskId: doc.taskId,
        content: doc.content,
        mood: doc.mood,
        focusRating: doc.focusRating,
        createdAt: new Date(doc.createdAt).getTime(),
        updatedAt: new Date(doc.updatedAt).getTime(),
      };
      set((s) => ({ journals: [journal, ...s.journals] }));
    } catch (err) {
      console.error('Failed to add journal:', err);
      throw err;
    }
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  getTask: (id) => get().tasks.find((t) => t.id === id),
  getJournalsForTask: (taskId) => get().journals.filter((j) => j.taskId === taskId),

  rehydratePersonalTimer: async () => {
    // If the engine already holds a session (restored from localStorage, or a work
    // session rehydrated by useStore.loadAll), don't clobber it. Just make sure a
    // restored personal session has its heartbeat running.
    if (timerEngine.getState() !== 'idle') {
      if (timerEngine.getSessionKind() === 'personal' && timerEngine.getActiveSessionId()) {
        startTimerHeartbeat(() => timerEngine.hydrate(null));
      }
      return;
    }
    try {
      const sessions = await api.personalSessions.list({ active: true });
      const active = (sessions || []).find((s: any) => s.isActive);
      if (!active) return;
      const openPause = [...(active.pauseLog || [])].reverse()
        .find((p: any) => p?.pauseStart && !p?.resumeTime);
      timerEngine.hydrate({
        taskId: String(active.personalTaskId ?? active.taskId),
        sessionId: String(active._id),
        timerState: openPause ? 'paused' : 'running',
        sessionStartTime: active.startTime,
        totalPauseDuration: active.totalPauseDuration || 0,
        pauseStart: openPause?.pauseStart,
        baseElapsedMs: 0,
        sessionKind: 'personal',
      });
      startTimerHeartbeat(() => timerEngine.hydrate(null));
    } catch {
      // Offline: engine keeps whatever localStorage restored on construction.
    }
  },
}));

/**
 * useStore — same as before, with toast notifications added.
 *
 * ONLY the changed/added lines are marked with ← TOAST
 * Every other line is identical to your existing useStore.ts
 */

import { create } from 'zustand';
import { api }    from '../utils/api';
import { toast }  from './useToastStore';                  // ← TOAST import
import type {
  Task, JournalEntry, TimerState, Priority,
  Subtask, ThemeSettings, UserProfile,
} from '../types';

const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark', accentColor: '#0ea5e9', fontSize: 'md',
  glassmorphism: true, animatedBackground: true, reducedMotion: false,
};
const DEFAULT_PROFILE: UserProfile = {
  name: 'Focus Master', dailyGoal: 8, pomodoroWork: 25,
  pomodoroBreak: 5, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

interface StoreState {
  tasks:             Task[];
  journals:          JournalEntry[];
  profile:           UserProfile;
  theme:             ThemeSettings;
  activeTaskId:      string | null;
  activeSessionId:   string | null;
  activeTimerState:  TimerState;
  currentSessionStart?: number;
  currentPauseStart?:   number;
  dataLoading: boolean;
  dataError:   string | null;

  loadAll:      () => Promise<void>;
  fetchTasks:   () => Promise<void>;
  addTask:      (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'sessions' | 'totalTime'>) => Promise<string>;
  updateTask:   (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask:   (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reorderTasks: (tasks: Task[]) => void;

  startTimer:  (taskId: string) => Promise<void>;
  pauseTimer:  (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer:   (taskId: string) => void;
  tick:        () => void;

  addSubtask:    (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;

  fetchJournals:  () => Promise<void>;
  addJournal:     (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateJournal:  (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteJournal:  (id: string) => Promise<void>;

  updateProfile: (updates: Partial<UserProfile>) => void;
  updateTheme:   (updates: Partial<ThemeSettings>) => void;

  getTask:      (id: string) => Task | undefined;
  getTodayTime: () => number;
  getWeekTime:  () => number;
}

function mapTask(doc: any): Task {
  return {
    id: doc._id, title: doc.title ?? '', description: doc.description ?? '',
    priority: (doc.priority ?? 'medium') as Priority, status: doc.status ?? 'todo',
    category: doc.category ?? 'Work',
    deadline: doc.deadline ? new Date(doc.deadline).getTime() : undefined,
    color: doc.color ?? '#0ea5e9', tags: doc.tags ?? [],
    subtasks: (doc.subtasks ?? []).map((s: any): Subtask => ({
      id: s._id, title: s.title, completed: s.completed,
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
    })),
    sessions: [], totalTime: doc.totalTime ?? 0,
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
  };
}

function mapJournal(doc: any): JournalEntry {
  return {
    id: doc._id, taskId: doc.taskId ?? '', content: doc.content,
    mood: doc.mood, focusRating: doc.focusRating,
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
  };
}

function mapSettings(userDoc: any) {
  const s = userDoc?.settings ?? {};
  return {
    profile: {
      name: userDoc?.name ?? DEFAULT_PROFILE.name,
      dailyGoal: s.dailyGoal ?? 8, pomodoroWork: s.pomodoroWork ?? 25,
      pomodoroBreak: s.pomodoroBreak ?? 5, timezone: DEFAULT_PROFILE.timezone,
    } as UserProfile,
    theme: {
      mode: 'dark' as const,
      accentColor: s.accentColor ?? '#0ea5e9',
      fontSize: (s.fontSize ?? 'md') as 'sm' | 'md' | 'lg',
      glassmorphism: s.glassmorphism ?? true,
      animatedBackground: s.animatedBg ?? true,
      reducedMotion: s.reducedMotion ?? false,
    } as ThemeSettings,
  };
}

export const useStore = create<StoreState>((set, get) => ({
  tasks: [], journals: [], profile: DEFAULT_PROFILE, theme: DEFAULT_THEME,
  activeTaskId: null, activeSessionId: null,
  activeTimerState: 'idle' as TimerState,
  dataLoading: false, dataError: null,

  // ── Boot ────────────────────────────────────────────────────────────────────
  loadAll: async () => {
    set({ dataLoading: true, dataError: null });
    try {
      const [taskDocs, journalDocs, userDoc] = await Promise.all([
        api.tasks.list(), api.journals.list(), api.profile.get(),
      ]);
      const { profile, theme } = mapSettings(userDoc);

      let activeTaskId: string | null = null, activeSessionId: string | null = null;
      let currentSessionStart: number | undefined;
      try {
        const activeSessions = await api.sessions.list({ active: true });
        if (activeSessions.length > 0) {
          activeTaskId = activeSessions[0].taskId;
          activeSessionId = activeSessions[0]._id;
          currentSessionStart = activeSessions[0].startTime;
        }
      } catch { /* non-fatal */ }

      set({
        tasks: taskDocs.map(mapTask), journals: journalDocs.map(mapJournal),
        profile, theme, activeTaskId, activeSessionId,
        activeTimerState: activeTaskId ? 'running' : 'idle',
        currentSessionStart, dataLoading: false,
      });
    } catch (err: any) {
      set({ dataError: err.message, dataLoading: false });
      toast.error('Failed to load data', err.message);               // ← TOAST
    }
  },

  fetchTasks: async () => {
    try {
      const docs = await api.tasks.list();
      set({ tasks: docs.map(mapTask) });
    } catch (err: any) {
      toast.error('Could not refresh tasks', err.message);            // ← TOAST
    }
  },

  fetchJournals: async () => {
    try {
      const docs = await api.journals.list();
      set({ journals: docs.map(mapJournal) });
    } catch (err: any) {
      toast.error('Could not refresh journals', err.message);         // ← TOAST
    }
  },

  // ── Tasks ────────────────────────────────────────────────────────────────────
  addTask: async (data) => {
    const tempId = `temp_${Date.now()}`;
    const tempTask: Task = {
      ...data, id: tempId, sessions: [], totalTime: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    set(s => ({ tasks: [tempTask, ...s.tasks] }));

    try {
      const doc  = await api.tasks.create({ ...data, deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined });
      const real = mapTask(doc);
      set(s => ({ tasks: s.tasks.map(t => t.id === tempId ? real : t) }));
      toast.success('Task created', `"${data.title}" has been saved`); // ← TOAST
      return real.id;
    } catch (err: any) {
      set(s => ({ tasks: s.tasks.filter(t => t.id !== tempId) }));
      toast.error('Failed to create task', err.message);               // ← TOAST
      throw err;
    }
  },

  updateTask: async (id, updates) => {
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t),
    }));
    try {
      await api.tasks.update(id, updates);
      // No toast — silent saves feel better for inline edits
    } catch (err: any) {
      toast.error('Failed to update task', err.message);               // ← TOAST
      throw err;
    }
  },

  deleteTask: async (id) => {
    const { activeTaskId, stopTimer, tasks } = get();
    const task = tasks.find(t => t.id === id);
    if (activeTaskId === id) stopTimer(id);
    set(s => ({
      tasks:    s.tasks.filter(t => t.id !== id),
      journals: s.journals.filter(j => j.taskId !== id),
    }));
    try {
      await api.tasks.delete(id);
      toast.info('Task deleted', task?.title ? `"${task.title}" removed` : undefined); // ← TOAST
    } catch (err: any) {
      toast.error('Failed to delete task', err.message);               // ← TOAST
    }
  },

  completeTask: async (id) => {
    const { activeTaskId, stopTimer, tasks } = get();
    const task = tasks.find(t => t.id === id);
    if (activeTaskId === id) stopTimer(id);
    await get().updateTask(id, { status: 'completed' });
    toast.success('Task completed! 🎉', task?.title);                   // ← TOAST
  },

  reorderTasks: (tasks) => set({ tasks }),

  // ── Timer ────────────────────────────────────────────────────────────────────
  startTimer: async (taskId) => {
    const now = Date.now();
    const task = get().tasks.find(t => t.id === taskId);
    set(s => ({
      activeTaskId: taskId, activeSessionId: null,
      activeTimerState: 'running', currentSessionStart: now, currentPauseStart: undefined,
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, status: 'active', sessions: [...t.sessions, { id: 'pending', startTime: now, totalPauseDuration: 0, activeTime: 0 }] }
          : t
      ),
    }));
    toast.info('Timer started', task?.title);                           // ← TOAST
    try {
      const sessionDoc = await api.sessions.start(taskId, now);
      set({ activeSessionId: sessionDoc._id });
    } catch (err: any) {
      toast.error('Session not saved', 'Timer runs locally but may not sync');  // ← TOAST
    }
  },

  pauseTimer: (taskId) => {
    const { activeSessionId } = get();
    const now = Date.now();
    set(s => ({
      activeTimerState: 'paused', currentPauseStart: now,
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'paused' } : t),
    }));
    toast.warning('Timer paused');                                      // ← TOAST
    if (activeSessionId) api.sessions.pause(activeSessionId, now).catch(console.error);
  },

  resumeTimer: (taskId) => {
    const { activeSessionId, currentPauseStart } = get();
    const now = Date.now();
    const pauseDuration = currentPauseStart ? now - currentPauseStart : 0;
    set(s => ({
      activeTimerState: 'running', currentPauseStart: undefined,
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t;
        const sessions = [...t.sessions];
        const last = sessions[sessions.length - 1];
        if (last) sessions[sessions.length - 1] = { ...last, totalPauseDuration: last.totalPauseDuration + pauseDuration };
        return { ...t, sessions, status: 'active' };
      }),
    }));
    toast.info('Timer resumed');                                        // ← TOAST
    if (activeSessionId) api.sessions.resume(activeSessionId, now).catch(console.error);
  },

  stopTimer: (taskId) => {
    const { activeSessionId, currentPauseStart, activeTimerState, tasks } = get();
    const task = tasks.find(t => t.id === taskId);
    const now  = Date.now();

    set(s => ({
      activeTaskId: null, activeSessionId: null,
      activeTimerState: 'idle', currentSessionStart: undefined, currentPauseStart: undefined,
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t;
        const sessions = [...t.sessions];
        const last = sessions[sessions.length - 1];
        if (last && !last.endTime) {
          const extraPause = (activeTimerState === 'paused' && currentPauseStart) ? now - currentPauseStart : 0;
          const totalPause = last.totalPauseDuration + extraPause;
          const activeTime = Math.max(0, now - last.startTime - totalPause);
          sessions[sessions.length - 1] = { ...last, endTime: now, totalPauseDuration: totalPause, activeTime };
        }
        const totalTime = sessions.reduce((a, s) => a + s.activeTime, 0);
        return { ...t, sessions, totalTime, status: 'todo' };
      }),
    }));

    // Calculate time for the session that just ended
    const lastSession = task?.sessions[task.sessions.length - 1];
    if (lastSession) {
      const mins = Math.round(lastSession.activeTime / 60000);
      toast.success('Session saved', `${mins}m focused on "${task?.title}"`); // ← TOAST
    }

    if (activeSessionId) {
      api.sessions.stop(activeSessionId, now)
        .then(() => get().fetchTasks())
        .catch(err => toast.error('Session sync failed', err.message));  // ← TOAST
    }
  },

  tick: () => {
    const { activeTaskId, activeTimerState, currentSessionStart } = get();
    if (!activeTaskId || activeTimerState !== 'running' || !currentSessionStart) return;
    const now = Date.now();
    set(s => ({
      tasks: s.tasks.map(t => {
        if (t.id !== activeTaskId) return t;
        const sessions = [...t.sessions];
        const last = sessions[sessions.length - 1];
        if (last && !last.endTime)
          sessions[sessions.length - 1] = { ...last, activeTime: Math.max(0, now - last.startTime - last.totalPauseDuration) };
        return { ...t, sessions };
      }),
    }));
  },

  // ── Subtasks ─────────────────────────────────────────────────────────────────
  addSubtask: async (taskId, title) => {
    try {
      const doc = await api.tasks.addSubtask(taskId, title);
      set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
      // Silent — subtask add is too fast/frequent for a toast
    } catch (err: any) {
      toast.error('Failed to add subtask', err.message);               // ← TOAST
      throw err;
    }
  },

  toggleSubtask: async (taskId, subtaskId, completed) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, completed } : st) }
          : t
      ),
    }));
    try {
      const doc = await api.tasks.toggleSubtask(taskId, subtaskId, completed);
      set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
      if (completed) toast.success('Subtask done ✓');                  // ← TOAST (only on complete, not un-complete)
    } catch (err: any) {
      toast.error('Failed to update subtask', err.message);            // ← TOAST
    }
  },

  deleteSubtask: async (taskId, subtaskId) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter(st => st.id !== subtaskId) } : t
      ),
    }));
    try {
      const doc = await api.tasks.deleteSubtask(taskId, subtaskId);
      set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
    } catch (err: any) {
      toast.error('Failed to delete subtask', err.message);            // ← TOAST
    }
  },

  // ── Journals ─────────────────────────────────────────────────────────────────
  addJournal: async (entry) => {
    try {
      const doc = await api.journals.create(entry);
      set(s => ({ journals: [mapJournal(doc), ...s.journals] }));
      toast.success('Journal entry saved');                             // ← TOAST
    } catch (err: any) {
      toast.error('Failed to save journal', err.message);              // ← TOAST
      throw err;
    }
  },

  updateJournal: async (id, updates) => {
    set(s => ({
      journals: s.journals.map(j => j.id === id ? { ...j, ...updates, updatedAt: Date.now() } : j),
    }));
    await api.journals.update(id, updates).catch(err =>
      toast.error('Journal sync failed', err.message)                  // ← TOAST
    );
  },

  deleteJournal: async (id) => {
    set(s => ({ journals: s.journals.filter(j => j.id !== id) }));
    try {
      await api.journals.delete(id);
      toast.info('Journal entry deleted');                              // ← TOAST
    } catch (err: any) {
      toast.error('Failed to delete journal', err.message);            // ← TOAST
    }
  },

  // ── Profile + Theme ───────────────────────────────────────────────────────────
  updateProfile: (updates) => {
    set(s => ({ profile: { ...s.profile, ...updates } }));
    const current = get().profile;
    api.profile.update({
      name: updates.name ?? current.name,
      settings: { dailyGoal: updates.dailyGoal ?? current.dailyGoal, pomodoroWork: updates.pomodoroWork ?? current.pomodoroWork, pomodoroBreak: updates.pomodoroBreak ?? current.pomodoroBreak },
    })
      .then(() => toast.success('Settings saved'))                     // ← TOAST
      .catch(err => toast.error('Settings not saved', err.message));   // ← TOAST
  },

  updateTheme: (updates) => {
    set(s => ({ theme: { ...s.theme, ...updates } }));
    const current = get().theme;
    api.profile.update({
      settings: {
        accentColor:   updates.accentColor   ?? current.accentColor,
        fontSize:      updates.fontSize      ?? current.fontSize,
        glassmorphism: updates.glassmorphism ?? current.glassmorphism,
        animatedBg:    updates.animatedBackground ?? current.animatedBackground,
        reducedMotion: updates.reducedMotion ?? current.reducedMotion,
      },
    }).catch(err => toast.error('Theme not saved', err.message));      // ← TOAST
  },

  // ── Helpers ───────────────────────────────────────────────────────────────────
  getTask: (id) => get().tasks.find(t => t.id === id),

  getTodayTime: () => {
    const tasks = get().tasks;
    let total = 0;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const now = Date.now();
    for (const task of tasks) {
      for (const session of task.sessions) {
        if (session.startTime >= startOfDay.getTime()) {
          total += Math.max(0, (session.endTime || now) - session.startTime - session.totalPauseDuration);
        }
      }
    }
    return total;
  },

  getWeekTime: () => {
    const tasks = get().tasks;
    let total = 0;
    for (const task of tasks) total += task.totalTime;
    return total;
  },
}));

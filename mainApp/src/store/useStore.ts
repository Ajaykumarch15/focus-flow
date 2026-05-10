/**
 * useStore — MongoDB-backed version.
 *
 * KEY FIX: re-adds `profile`, `theme`, `updateProfile`, `updateTheme`
 * so Dashboard / Settings / FocusMode don't crash.
 * Profile data is synced from the authenticated user's settings doc in Atlas.
 */

import { create } from 'zustand';
import { api } from '../utils/api';
import type {
  Task, JournalEntry, TimerState, Priority,
  Subtask, ThemeSettings, UserProfile,
} from '../types';

// ── Default fallbacks (used before Atlas data loads) ─────────────────────────
const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark',
  accentColor: '#0ea5e9',
  fontSize: 'md',
  glassmorphism: true,
  animatedBackground: true,
  reducedMotion: false,
};

const DEFAULT_PROFILE: UserProfile = {
  name: 'Focus Master',
  dailyGoal: 8,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

// ── Shape ─────────────────────────────────────────────────────────────────────
interface StoreState {
  tasks: Task[];
  journals: JournalEntry[];
  profile: UserProfile;
  theme: ThemeSettings;
  activeTaskId: string | null;
  activeSessionId: string | null;
  activeTimerState: TimerState;
  currentSessionStart?: number;
  currentPauseStart?: number;
  dataLoading: boolean;
  dataError: string | null;

  // Boot
  loadAll: () => Promise<void>;

  // Tasks
  fetchTasks: () => Promise<void>;
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'sessions' | 'totalTime'>) => Promise<string>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reorderTasks: (tasks: Task[]) => void;

  // Timer
  startTimer: (taskId: string) => Promise<void>;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => void;
  tick: () => void;

  // Subtasks
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;

  // Journals
  fetchJournals: () => Promise<void>;
  addJournal: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateJournal: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteJournal: (id: string) => Promise<void>;

  // Profile + Theme (persisted to Atlas on the User doc)
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateTheme: (updates: Partial<ThemeSettings>) => Promise<void>;

  // Helpers
  getTask: (id: string) => Task | undefined;
  getTodayTime: () => number;
  getWeekTime: () => number;
}

// ── Mappers: MongoDB doc → frontend shape ─────────────────────────────────────
function mapTask(doc: any): Task {
  return {
    id: doc._id,
    title: doc.title ?? '',
    description: doc.description ?? '',
    priority: (doc.priority ?? 'medium') as Priority,
    status: doc.status ?? 'todo',
    category: doc.category ?? 'Work',
    deadline: doc.deadline ? new Date(doc.deadline).getTime() : undefined,
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
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
  };
}

function mapJournal(doc: any): JournalEntry {
  return {
    id: doc._id,
    taskId: doc.taskId ?? '',
    content: doc.content,
    mood: doc.mood,
    focusRating: doc.focusRating,
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
  };
}

// User.settings from Atlas → local profile + theme shapes
function mapSettings(settings: any): { profile: UserProfile; theme: ThemeSettings } {
  return {
    profile: {
      name: settings?.name ?? DEFAULT_PROFILE.name,
      dailyGoal: settings?.dailyGoal ?? DEFAULT_PROFILE.dailyGoal,
      pomodoroWork: settings?.pomodoroWork ?? DEFAULT_PROFILE.pomodoroWork,
      pomodoroBreak: settings?.pomodoroBreak ?? DEFAULT_PROFILE.pomodoroBreak,
      timezone: DEFAULT_PROFILE.timezone,
    },
    theme: {
      mode: 'dark',
      accentColor: settings?.accentColor ?? DEFAULT_THEME.accentColor,
      fontSize: (settings?.fontSize ?? DEFAULT_THEME.fontSize) as 'sm' | 'md' | 'lg',
      glassmorphism: settings?.glassmorphism ?? DEFAULT_THEME.glassmorphism,
      animatedBackground: settings?.animatedBg ?? DEFAULT_THEME.animatedBackground,
      reducedMotion: settings?.reducedMotion ?? DEFAULT_THEME.reducedMotion,
    },
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useStore = create<StoreState>((set, get) => ({
  tasks: [],
  journals: [],
  profile: DEFAULT_PROFILE,
  theme: DEFAULT_THEME,
  activeTaskId: null,
  activeSessionId: null,
  activeTimerState: 'idle' as TimerState,
  dataLoading: false,
  dataError: null,

  // ── Boot ────────────────────────────────────────────────────────────────────
  loadAll: async () => {
    set({ dataLoading: true, dataError: null });
    try {
      const [taskDocs, journalDocs, userDoc] = await Promise.all([
        api.tasks.list(),
        api.journals.list(),
        api.profile.get(),
      ]);

      // Hydrate profile + theme from user settings stored in Atlas
      const { profile, theme } = mapSettings({
        ...userDoc?.settings,
        name: userDoc?.name,
      });

      // Restore any in-progress timer session
      let activeTaskId: string | null = null;
      let activeSessionId: string | null = null;
      let currentSessionStart: number | undefined;

      try {
        const activeSessions = await api.sessions.list({ active: true });
        if (activeSessions.length > 0) {
          const s = activeSessions[0];
          activeTaskId = s.taskId;
          activeSessionId = s._id;
          currentSessionStart = s.startTime;
        }
      } catch {
        // Non-fatal — timer just won't auto-restore
      }

      set({
        tasks: taskDocs.map(mapTask),
        journals: journalDocs.map(mapJournal),
        profile,
        theme,
        activeTaskId,
        activeSessionId,
        activeTimerState: activeTaskId ? 'running' : 'idle',
        currentSessionStart,
        dataLoading: false,
      });
    } catch (err: any) {
      set({ dataError: err.message, dataLoading: false });
    }
  },

  fetchTasks: async () => {
    const docs = await api.tasks.list();
    set({ tasks: docs.map(mapTask) });
  },

  fetchJournals: async () => {
    const docs = await api.journals.list();
    set({ journals: docs.map(mapJournal) });
  },

  // ── Task CRUD ────────────────────────────────────────────────────────────────
  addTask: async (data) => {
    const tempId = `temp_${Date.now()}`;
    const tempTask: Task = {
      ...data, id: tempId,
      sessions: [], totalTime: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    set(s => ({ tasks: [tempTask, ...s.tasks] }));

    const doc = await api.tasks.create({
      ...data,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
    });
    const real = mapTask(doc);
    set(s => ({ tasks: s.tasks.map(t => t.id === tempId ? real : t) }));
    return real.id;
  },

  updateTask: async (id, updates) => {
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t),
    }));
    await api.tasks.update(id, updates);
  },

  deleteTask: async (id) => {
    const { activeTaskId, stopTimer } = get();
    if (activeTaskId === id) stopTimer(id);
    set(s => ({
      tasks: s.tasks.filter(t => t.id !== id),
      journals: s.journals.filter(j => j.taskId !== id),
    }));
    await api.tasks.delete(id);
  },

  completeTask: async (id) => {
    const { activeTaskId, stopTimer } = get();
    if (activeTaskId === id) stopTimer(id);
    await get().updateTask(id, { status: 'completed' });
  },

  reorderTasks: (tasks) => set({ tasks }),

  // ── Timer ────────────────────────────────────────────────────────────────────
  startTimer: async (taskId) => {
    const now = Date.now();
    set(s => ({
      activeTaskId: taskId,
      activeSessionId: null,
      activeTimerState: 'running',
      currentSessionStart: now,
      currentPauseStart: undefined,
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? {
            ...t,
            status: 'active',
            sessions: [
              ...t.sessions,
              { id: 'pending', startTime: now, totalPauseDuration: 0, activeTime: 0 },
            ],
          }
          : t
      ),
    }));
    try {
      const sessionDoc = await api.sessions.start(taskId, now);
      set({ activeSessionId: sessionDoc._id });
    } catch (err) {
      console.error('Failed to persist session start:', err);
    }
  },

  pauseTimer: (taskId) => {
    const { activeSessionId } = get();
    const now = Date.now();
    set(s => ({
      activeTimerState: 'paused',
      currentPauseStart: now,
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'paused' } : t),
    }));
    if (activeSessionId) api.sessions.pause(activeSessionId, now).catch(console.error);
  },

  resumeTimer: (taskId) => {
    const { activeSessionId, currentPauseStart } = get();
    const now = Date.now();
    const pauseDuration = currentPauseStart ? now - currentPauseStart : 0;

    set(s => ({
      activeTimerState: 'running',
      currentPauseStart: undefined,
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t;
        const sessions = [...t.sessions];
        const last = sessions[sessions.length - 1];
        if (last) {
          sessions[sessions.length - 1] = {
            ...last,
            totalPauseDuration: last.totalPauseDuration + pauseDuration,
          };
        }
        return { ...t, sessions, status: 'active' };
      }),
    }));
    if (activeSessionId) api.sessions.resume(activeSessionId, now).catch(console.error);
  },

  stopTimer: (taskId) => {
    const { activeSessionId, currentPauseStart, activeTimerState } = get();
    const now = Date.now();

    set(s => ({
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
      currentSessionStart: undefined,
      currentPauseStart: undefined,
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t;
        const sessions = [...t.sessions];
        const last = sessions[sessions.length - 1];
        if (last && !last.endTime) {
          const extraPause = (activeTimerState === 'paused' && currentPauseStart)
            ? now - currentPauseStart : 0;
          const totalPause = last.totalPauseDuration + extraPause;
          const activeTime = Math.max(0, now - last.startTime - totalPause);
          sessions[sessions.length - 1] = {
            ...last, endTime: now, totalPauseDuration: totalPause, activeTime,
          };
        }
        const totalTime = sessions.reduce((a, s) => a + s.activeTime, 0);
        return { ...t, sessions, totalTime, status: 'todo' };
      }),
    }));

    if (activeSessionId) {
      api.sessions.stop(activeSessionId, now)
        .then(() => get().fetchTasks())
        .catch(console.error);
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
        if (last && !last.endTime) {
          sessions[sessions.length - 1] = {
            ...last,
            activeTime: Math.max(0, now - last.startTime - last.totalPauseDuration),
          };
        }
        return { ...t, sessions };
      }),
    }));
  },

  // ── Subtasks ─────────────────────────────────────────────────────────────────
  addSubtask: async (taskId, title) => {
    const doc = await api.tasks.addSubtask(taskId, title);
    set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
  },

  toggleSubtask: async (taskId, subtaskId, completed) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, completed } : st) }
          : t
      ),
    }));
    const doc = await api.tasks.toggleSubtask(taskId, subtaskId, completed);
    set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
  },

  deleteSubtask: async (taskId, subtaskId) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter(st => st.id !== subtaskId) }
          : t
      ),
    }));
    const doc = await api.tasks.deleteSubtask(taskId, subtaskId);
    set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
  },

  // ── Journals ─────────────────────────────────────────────────────────────────
  addJournal: async (entry) => {
    const doc = await api.journals.create(entry);
    set(s => ({ journals: [mapJournal(doc), ...s.journals] }));
  },

  updateJournal: async (id, updates) => {
    set(s => ({
      journals: s.journals.map(j => j.id === id ? { ...j, ...updates, updatedAt: Date.now() } : j),
    }));
    await api.journals.update(id, updates);
  },

  deleteJournal: async (id) => {
    set(s => ({ journals: s.journals.filter(j => j.id !== id) }));
    await api.journals.delete(id);
  },

  // ── Profile + Theme ───────────────────────────────────────────────────────────
  updateProfile: async (updates) => {
    set(s => ({ profile: { ...s.profile, ...updates } }));
    // Persist settings fields that exist on the User.settings sub-doc
    await api.profile.update({
      name: get().profile.name,
      settings: {
        dailyGoal: get().profile.dailyGoal,
        pomodoroWork: get().profile.pomodoroWork,
        pomodoroBreak: get().profile.pomodoroBreak,
        ...updates,
      },
    });
  },

  updateTheme: async (updates) => {
    set(s => ({ theme: { ...s.theme, ...updates } }));
    await api.profile.update({
      settings: {
        accentColor: get().theme.accentColor,
        fontSize: get().theme.fontSize,
        glassmorphism: get().theme.glassmorphism,
        animatedBg: get().theme.animatedBackground,
        reducedMotion: get().theme.reducedMotion,
        ...updates,
      },
    });
  },

  // ── Helpers ──────────────────────────────────────────────────────────────────
  getTask: (id) => get().tasks.find(t => t.id === id),

  getTodayTime: () => {
    const tasks = get().tasks;
    let total = 0;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const now = Date.now();
    for (const task of tasks) {
      for (const session of task.sessions) {
        if (session.startTime >= startOfDay.getTime()) {
          const end = session.endTime || now;
          total += Math.max(0, end - session.startTime - session.totalPauseDuration);
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
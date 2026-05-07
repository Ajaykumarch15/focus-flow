import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Task, TaskStatus, TimerState, JournalEntry, Subtask, ThemeSettings, UserProfile } from '../types';

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

interface StoreActions {
  // Task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'sessions' | 'totalTime'>) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  reorderTasks: (tasks: Task[]) => void;

  // Timer actions
  startTimer: (taskId: string) => void;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => void;
  tick: () => void;

  // Subtask actions
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;

  // Journal actions
  addJournal: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateJournal: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournal: (id: string) => void;

  // Settings
  updateTheme: (updates: Partial<ThemeSettings>) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;

  // Computed
  getTask: (id: string) => Task | undefined;
  getTodayTime: () => number;
  getWeekTime: () => number;
}

export const useStore = create<AppState & StoreActions>()(
  persist(
    (set, get) => ({
      tasks: [],
      journals: [],
      theme: DEFAULT_THEME,
      profile: DEFAULT_PROFILE,
      activeTaskId: null,
      activeTimerState: 'idle' as TimerState,

      addTask: (taskData) => {
        const id = uuidv4();
        const task: Task = {
          ...taskData,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sessions: [],
          totalTime: 0,
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return id;
      },

      updateTask: (id, updates) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        }));
      },

      deleteTask: (id) => {
        const { activeTaskId, stopTimer } = get();
        if (activeTaskId === id) stopTimer(id);
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          journals: s.journals.filter((j) => j.taskId !== id),
        }));
      },

      completeTask: (id) => {
        const { activeTaskId, stopTimer } = get();
        if (activeTaskId === id) stopTimer(id);
        get().updateTask(id, { status: 'completed' });
      },

      reorderTasks: (tasks) => set({ tasks }),

      startTimer: (taskId) => {
        const now = Date.now();
        const sessionId = uuidv4();
        set((s) => ({
          activeTaskId: taskId,
          activeTimerState: 'running',
          currentSessionStart: now,
          currentPauseStart: undefined,
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'active' as TaskStatus,
                  sessions: [
                    ...t.sessions,
                    { id: sessionId, startTime: now, totalPauseDuration: 0, activeTime: 0 },
                  ],
                }
              : t
          ),
        }));
      },

      pauseTimer: (taskId) => {
        const now = Date.now();
        set({ activeTimerState: 'paused', currentPauseStart: now });
        get().updateTask(taskId, { status: 'paused' });
      },

      resumeTimer: (taskId) => {
        const { currentPauseStart } = get();
        const now = Date.now();
        const pauseDuration = currentPauseStart ? now - currentPauseStart : 0;

        set((s) => ({
          activeTimerState: 'running',
          currentPauseStart: undefined,
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const sessions = [...t.sessions];
            const last = sessions[sessions.length - 1];
            if (last) {
              sessions[sessions.length - 1] = {
                ...last,
                totalPauseDuration: last.totalPauseDuration + pauseDuration,
              };
            }
            return { ...t, sessions, status: 'active' as TaskStatus };
          }),
        }));
      },

      stopTimer: (taskId) => {
        const { currentSessionStart, currentPauseStart, activeTimerState } = get();
        const now = Date.now();

        set((s) => ({
          activeTaskId: null,
          activeTimerState: 'idle',
          currentSessionStart: undefined,
          currentPauseStart: undefined,
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const sessions = [...t.sessions];
            const last = sessions[sessions.length - 1];
            if (last && !last.endTime) {
              const extraPause = (activeTimerState === 'paused' && currentPauseStart)
                ? now - currentPauseStart : 0;
              const totalPause = last.totalPauseDuration + extraPause;
              const activeTime = now - last.startTime - totalPause;
              sessions[sessions.length - 1] = {
                ...last,
                endTime: now,
                totalPauseDuration: totalPause,
                activeTime: Math.max(0, activeTime),
              };
            }
            const totalTime = sessions.reduce((acc, s) => acc + s.activeTime, 0);
            return { ...t, sessions, totalTime, status: 'todo' as TaskStatus };
          }),
        }));
      },

      tick: () => {
        const { activeTaskId, activeTimerState, currentSessionStart, currentPauseStart } = get();
        if (!activeTaskId || activeTimerState !== 'running' || !currentSessionStart) return;
        const now = Date.now();
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== activeTaskId) return t;
            const sessions = [...t.sessions];
            const last = sessions[sessions.length - 1];
            if (last && !last.endTime) {
              const activeTime = now - last.startTime - last.totalPauseDuration;
              sessions[sessions.length - 1] = { ...last, activeTime: Math.max(0, activeTime) };
            }
            return { ...t, sessions };
          }),
        }));
      },

      addSubtask: (taskId, title) => {
        const subtask: Subtask = { id: uuidv4(), title, completed: false, createdAt: Date.now() };
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t
          ),
        }));
      },

      toggleSubtask: (taskId, subtaskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((st) =>
                    st.id === subtaskId ? { ...st, completed: !st.completed } : st
                  ),
                }
              : t
          ),
        }));
      },

      deleteSubtask: (taskId, subtaskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.filter((st) => st.id !== subtaskId) }
              : t
          ),
        }));
      },

      addJournal: (entry) => {
        const journal: JournalEntry = {
          ...entry,
          id: uuidv4(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ journals: [journal, ...s.journals] }));
      },

      updateJournal: (id, updates) => {
        set((s) => ({
          journals: s.journals.map((j) =>
            j.id === id ? { ...j, ...updates, updatedAt: Date.now() } : j
          ),
        }));
      },

      deleteJournal: (id) => {
        set((s) => ({ journals: s.journals.filter((j) => j.id !== id) }));
      },

      updateTheme: (updates) => {
        set((s) => ({ theme: { ...s.theme, ...updates } }));
      },

      updateProfile: (updates) => {
        set((s) => ({ profile: { ...s.profile, ...updates } }));
      },

      getTask: (id) => get().tasks.find((t) => t.id === id),

      getTodayTime: () => {
        const tasks = get().tasks;
        let total = 0;
        const now = Date.now();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        for (const task of tasks) {
          for (const session of task.sessions) {
            if (session.startTime >= startOfDay.getTime()) {
              const end = session.endTime || now;
              const active = end - session.startTime - session.totalPauseDuration;
              total += Math.max(0, active);
            }
          }
        }
        return total;
      },

      getWeekTime: () => {
        const tasks = get().tasks;
        let total = 0;
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        const now = Date.now();

        for (const task of tasks) {
          for (const session of task.sessions) {
            if (session.startTime >= startOfWeek.getTime()) {
              const end = session.endTime || now;
              const active = end - session.startTime - session.totalPauseDuration;
              total += Math.max(0, active);
            }
          }
        }
        return total;
      },
    }),
    {
      name: 'focusflow-storage',
    }
  )
);

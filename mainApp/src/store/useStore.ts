/**
 * useStore — fixed version.
 *
 * KEY FIXES vs previous version:
 *
 * 1. Timer state is saved to localStorage on every start/pause/resume/stop.
 *    On refresh, it's restored INSTANTLY from localStorage while the API loads.
 *
 * 2. When loadAll() confirms an active session exists in Atlas, it injects
 *    a synthetic session object (with correct elapsed time) into the active
 *    task's sessions array — so the timer display shows the right number
 *    immediately, not 0.
 *
 * 3. profile + theme are cached in localStorage so they render immediately
 *    on refresh instead of flashing defaults.
 *
 * 4. dataLoading no longer blocks the entire UI — cached data shows first.
 */

import { create } from 'zustand';
import { api } from '../utils/api';
import {
  saveTimer, loadTimer, clearTimer, calcElapsed, PersistedTimer,
  addCompletedSession,
  loadTodayMs,
} from '../utils/timerPersist';
import type {
  Task, JournalEntry, TimerState, Priority,
  Subtask, ThemeSettings, UserProfile,
} from '../types';
import { useWorkLogStore } from './useWorkLogStore';
import { toast } from './useToastStore';
import { generateBrandShades } from '../utils/colorUtils';

// ── Defaults ──────────────────────────────────────────────────────────────────
const PROFILE_KEY = 'ff_profile_cache';
const THEME_KEY = 'ff_theme_cache';

const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark', accentColor: '#0ea5e9', fontSize: 'md',
  glassmorphism: true, animatedBackground: true, reducedMotion: false,
};
const DEFAULT_PROFILE: UserProfile = {
  name: 'Focus Master', dailyGoal: 8, pomodoroWork: 25,
  pomodoroBreak: 5, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  streak: { current: 0, best: 0, lastDate: '' },
  totalPoints: 0,
  leaderboardOptIn: true,
};

function loadCached<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveCache(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function applyThemeToDOM(theme: ThemeSettings): void {
  try {
    const root = document.documentElement;
    if (!root) return;
    // Dark / light mode
    if (theme.mode === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    // Font size
    if (theme.fontSize === 'sm') root.style.fontSize = '14px';
    else if (theme.fontSize === 'lg') root.style.fontSize = '18px';
    else root.style.fontSize = '16px';

    // Motion & Effects
    if (theme.reducedMotion) root.classList.add('reduce-motion');
    else root.classList.remove('reduce-motion');

    if (theme.glassmorphism === false) root.classList.add('no-glass');
    else root.classList.remove('no-glass');

    if (theme.animatedBackground === false) root.classList.add('no-anim-bg');
    else root.classList.remove('no-anim-bg');

    // Accent colour → brand palette
    if (theme.accentColor) {
      root.style.setProperty('--color-accent', theme.accentColor);

      // Generate both dark and light palettes for the same accent colour
      const darkShades  = generateBrandShades(theme.accentColor, 'dark');
      const lightShades = generateBrandShades(theme.accentColor, 'light');

      // Apply the active palette via inline styles
      const activeShades = theme.mode === 'light' ? lightShades : darkShades;
      for (const [level, color] of Object.entries(activeShades)) {
        root.style.setProperty(`--color-brand-${level}`, color);
      }

      // Inject a <style> tag with BOTH palettes scoped properly
      let tag = document.getElementById('ff-accent-overrides') as HTMLStyleElement | null;
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'ff-accent-overrides';
        document.head.appendChild(tag);
      }
      const toCss = (shades: Record<string, string>) =>
        Object.entries(shades)
          .map(([level, color]) => `--color-brand-${level}:${color};`)
          .join('');
      tag.textContent =
        `:root{${toCss(lightShades)}--color-accent:${theme.accentColor};}` +
        `html.dark{${toCss(darkShades)}--color-accent:${theme.accentColor};}`;
    }
  } catch (e) {
    console.error('applyThemeToDOM failed:', e);
  }
}

function docId(value: any): string {
  return String(value?._id ?? value ?? '');
}

function getOpenPauseStart(sessionDoc: any): number | undefined {
  const pauseLog = Array.isArray(sessionDoc?.pauseLog) ? sessionDoc.pauseLog : [];
  const openPause = [...pauseLog].reverse().find((p: any) => p?.pauseStart && !p?.resumeTime);
  return openPause?.pauseStart;
}

function injectLiveSession(
  tasks: Task[],
  taskId: string,
  session: { id: string; startTime: number; totalPauseDuration: number; activeTime: number },
  timerState: TimerState,
): Task[] {
  return tasks.map(t => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      status: (timerState === 'paused' ? 'paused' : 'active') as Task['status'],
      sessions: [{
        id: session.id,
        startTime: session.startTime,
        endTime: undefined,
        totalPauseDuration: session.totalPauseDuration,
        activeTime: session.activeTime,
      }],
    };
  });
}

// ── Restore timer state instantly from localStorage ───────────────────────────
function buildRestoredTimerState(persisted: PersistedTimer | null, tasks: Task[]): {
  activeTaskId: string | null;
  activeTimerState: TimerState;
  currentSessionStart: number | undefined;
  currentPauseStart: number | undefined;
  tasks: Task[];
} {
  if (!persisted) {
    return { activeTaskId: null, activeTimerState: 'idle', currentSessionStart: undefined, currentPauseStart: undefined, tasks };
  }

  const elapsed = calcElapsed(persisted);

  // Inject a synthetic session into the active task so the display is correct
  const patchedTasks = tasks.map(t => {
    if (t.id !== persisted.taskId) return t;
    return {
      ...t,
      status: (persisted.timerState === 'paused' ? 'paused' : 'active') as Task['status'],
      sessions: [
        ...t.sessions,
        {
          id: persisted.sessionId || 'restored',
          startTime: persisted.sessionStartTime,
          endTime: undefined,
          totalPauseDuration: persisted.totalPauseDuration,
          activeTime: elapsed,
        },
      ],
    };
  });

  return {
    activeTaskId: persisted.taskId,
    activeTimerState: persisted.timerState,
    currentSessionStart: persisted.sessionStartTime,
    currentPauseStart: persisted.timerState === 'paused' ? persisted.pauseStart : undefined,
    tasks: patchedTasks,
  };
}

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
    reminderMinutesBefore: doc.reminderMinutesBefore ?? undefined,
    color: doc.color ?? '#0ea5e9',
    tags: doc.tags ?? [],
    subtasks: (doc.subtasks ?? []).map((s: any): Subtask => ({
      id: s._id,
      title: s.title,
      completed: s.completed,
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
    })),
    sessions: [],         // populated from timer restore / loadAll
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

function mapSettings(userDoc: any) {
  const s = userDoc?.settings ?? {};
  return {
    profile: {
      name: userDoc?.name ?? DEFAULT_PROFILE.name,
      dailyGoal: s.dailyGoal ?? DEFAULT_PROFILE.dailyGoal,
      pomodoroWork: s.pomodoroWork ?? DEFAULT_PROFILE.pomodoroWork,
      pomodoroBreak: s.pomodoroBreak ?? DEFAULT_PROFILE.pomodoroBreak,
      timezone: s.timezone ?? DEFAULT_PROFILE.timezone,
      streak: userDoc.streak ?? DEFAULT_PROFILE.streak,
      totalPoints: userDoc.totalPoints ?? 0,
      leaderboardOptIn: userDoc.leaderboardOptIn ?? true,
    } as UserProfile,
    theme: {
      mode: (s.mode ?? DEFAULT_THEME.mode) as 'dark' | 'light',
      accentColor: s.accentColor ?? DEFAULT_THEME.accentColor,
      fontSize: (s.fontSize ?? DEFAULT_THEME.fontSize) as 'sm' | 'md' | 'lg',
      glassmorphism: s.glassmorphism ?? DEFAULT_THEME.glassmorphism,
      animatedBackground: s.animatedBg ?? DEFAULT_THEME.animatedBackground,
      reducedMotion: s.reducedMotion ?? DEFAULT_THEME.reducedMotion,
    } as ThemeSettings,
  };
}

// ── Store shape ───────────────────────────────────────────────────────────────
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

  loadAll: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'sessions' | 'totalTime'>) => Promise<string>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reorderTasks: (tasks: Task[]) => void;

  startTimer: (taskId: string) => Promise<void>;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => Promise<void>;
  tick: () => void;

  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;

  fetchJournals: () => Promise<void>;
  addJournal: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateJournal: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteJournal: (id: string) => Promise<void>;

  updateProfile: (updates: Partial<UserProfile>) => void;
  updateTheme: (updates: Partial<ThemeSettings>) => void;

  getTask: (id: string) => Task | undefined;
  getTodayTime: () => number;
  getWeekTime: () => number;
}

// ── Build initial state from localStorage caches ─────────────────────────────
// This runs synchronously at store creation, so cached data is available
// BEFORE the first API call returns.
const persisted = loadTimer();

export const useStore = create<StoreState>((set, get) => {
  // Seed profile/theme from cache so they show immediately on refresh
  const cachedProfile = loadCached<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE);
  const cachedTheme = loadCached<ThemeSettings>(THEME_KEY, DEFAULT_THEME);

  // Seed timer from localStorage (no tasks yet, we'll patch after loadAll)
  const timerInit = persisted
    ? {
      activeTaskId: persisted.taskId,
      activeTimerState: persisted.timerState as TimerState,
      activeSessionId: persisted.sessionId,
      currentSessionStart: persisted.sessionStartTime,
      currentPauseStart: persisted.timerState === 'paused' ? persisted.pauseStart : undefined,
    }
    : {
      activeTaskId: null as string | null,
      activeTimerState: 'idle' as TimerState,
      activeSessionId: null as string | null,
      currentSessionStart: undefined as number | undefined,
      currentPauseStart: undefined as number | undefined,
    };

  // Apply cached theme immediately so there's no wrong flash
  applyThemeToDOM(cachedTheme);

  return {
    tasks: [],
    journals: [],
    profile: cachedProfile,
    theme: cachedTheme,
    dataLoading: false,
    dataError: null,
    ...timerInit,

    // ── Boot ────────────────────────────────────────────────────────────────
    loadAll: async () => {
      set({ dataLoading: true, dataError: null });
      try {
        const [taskDocs, journalDocs, userDoc] = await Promise.all([
          api.tasks.list(),
          api.journals.list(),
          api.profile.get(),
        ]);

        const { profile, theme: serverTheme } = mapSettings(userDoc);

        // Merge: keep locally-set accent color / mode if server doesn't have it yet
        const cached = loadCached<ThemeSettings>(THEME_KEY, DEFAULT_THEME);
        const mergedTheme: ThemeSettings = {
          ...serverTheme,
          accentColor: serverTheme.accentColor || cached.accentColor || DEFAULT_THEME.accentColor,
        };

        // Cache profile + theme for instant restore next refresh
        saveCache(PROFILE_KEY, profile);
        saveCache(THEME_KEY, mergedTheme);
        applyThemeToDOM(mergedTheme);

        let baseTasks = taskDocs.map(mapTask);

        // ── Restore active timer ───────────────────────────────────────────
        // First check localStorage (instant); then validate against Atlas
        const localTimer = loadTimer();
        let activeTaskId: string | null = null;
        let activeSessionId: string | null = null;
        let activeTimerState: TimerState = 'idle';
        let currentSessionStart: number | undefined;
        let currentPauseStart: number | undefined;

        try {
          const activeSessions = await api.sessions.list({ active: true });
          const match = localTimer
            ? activeSessions.find(s =>
              docId(s.taskId) === localTimer.taskId || docId(s._id) === localTimer.sessionId
            )
            : activeSessions[0];
          const timerForMatch: PersistedTimer | null = match
            ? (localTimer ?? {
              taskId: docId(match.taskId),
              sessionId: docId(match._id),
              timerState: (baseTasks.find(t => t.id === docId(match.taskId))?.status === 'paused' || getOpenPauseStart(match))
                ? 'paused'
                : 'running',
              sessionStartTime: match.startTime,
              totalPauseDuration: match.totalPauseDuration || 0,
              ...(getOpenPauseStart(match) ? { pauseStart: getOpenPauseStart(match) } : {}),
            })
            : localTimer;

          if (match) {
            // Session still active in Atlas — restore with correct elapsed
            activeTaskId = docId(match.taskId);
            activeSessionId = docId(match._id);
            activeTimerState = timerForMatch!.timerState;
            currentSessionStart = match.startTime;
            currentPauseStart = timerForMatch!.timerState === 'paused' ? timerForMatch!.pauseStart : undefined;

            const elapsed = calcElapsed({
              ...timerForMatch!,
              taskId: docId(match.taskId),
              sessionId: docId(match._id),
              sessionStartTime: match.startTime,
              totalPauseDuration: match.totalPauseDuration || 0,
            });

            // Inject live session into the task so timer shows correct time
            baseTasks = baseTasks.map(t => {
              if (t.id !== docId(match.taskId)) return t;
              return {
                ...t,
                status: (activeTimerState === 'paused' ? 'paused' : 'active') as Task['status'],
                sessions: [{
                  id: docId(match._id),
                  startTime: match.startTime,
                  endTime: undefined,
                  totalPauseDuration: match.totalPauseDuration || 0,
                  activeTime: elapsed,
                }],
              };
            });
            saveTimer({
              ...timerForMatch!,
              taskId: docId(match.taskId),
              sessionId: docId(match._id),
              sessionStartTime: match.startTime,
              totalPauseDuration: match.totalPauseDuration || 0,
            });

          } else {
            // Session no longer active in Atlas — clear stale localStorage
            clearTimer();
            // Cache today's total for instant display on refresh
            try {
              const todayMs = get().getTodayTime();
              localStorage.setItem('ff_today_ms', JSON.stringify({
                date: new Date().toISOString(),
                ms: todayMs,
              }));
            } catch { /* ignore */ }
          }
        } catch {
          // API failed — fall back to localStorage only
          if (localTimer) {
            activeTaskId = localTimer.taskId;
            activeSessionId = localTimer.sessionId;
            activeTimerState = localTimer.timerState;
            currentSessionStart = localTimer.sessionStartTime;
            currentPauseStart = localTimer.timerState === 'paused' ? localTimer.pauseStart : undefined;

            const elapsed = calcElapsed(localTimer);
            baseTasks = baseTasks.map(t => {
              if (t.id !== localTimer.taskId) return t;
              return {
                ...t,
                status: (activeTimerState === 'paused' ? 'paused' : 'active') as Task['status'],
                sessions: [{
                  id: localTimer.sessionId || 'restored',
                  startTime: localTimer.sessionStartTime,
                  endTime: undefined,
                  totalPauseDuration: localTimer.totalPauseDuration,
                  activeTime: elapsed,
                }],
              };
            });
          }
        }

        set({
          tasks: baseTasks,
          journals: journalDocs.map(mapJournal),
          profile,
          theme: mergedTheme,
          activeTaskId,
          activeSessionId,
          activeTimerState,
          currentSessionStart,
          currentPauseStart,
          dataLoading: false,
        });
      } catch (err: any) {
        console.error('❌ loadAll failed:', err);
        set({ dataError: err.message, dataLoading: false });
      }
    },

    fetchTasks: async () => {
      try {
        const docs = await api.tasks.list();
        // Don't overwrite the active task's sessions when refreshing
        const { activeTaskId } = get();
        set(s => ({
          tasks: docs.map(doc => {
            const mapped = mapTask(doc);
            if (doc._id === activeTaskId) {
              // Keep the live session intact
              const liveTask = s.tasks.find(t => t.id === activeTaskId);
              return liveTask ? { ...mapped, sessions: liveTask.sessions } : mapped;
            }
            return mapped;
          }),
        }));
      } catch (err) {
        console.error('❌ fetchTasks failed:', err);
      }
    },

    fetchJournals: async () => {
      try {
        const docs = await api.journals.list();
        set({ journals: docs.map(mapJournal) });
      } catch (err) {
        console.error('❌ fetchJournals failed:', err);
      }
    },

    // ── Tasks ─────────────────────────────────────────────────────────────────
    addTask: async (data) => {
      const tempId = `temp_${Date.now()}`;
      const tempTask: Task = {
        ...data, id: tempId, sessions: [], totalTime: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      set(s => ({ tasks: [tempTask, ...s.tasks] }));
      try {
        const doc = await api.tasks.create({ ...data, deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined });
        const real = mapTask(doc);
        set(s => ({ tasks: s.tasks.map(t => t.id === tempId ? real : t) }));
        return real.id;
      } catch (err: any) {
        set(s => ({ tasks: s.tasks.filter(t => t.id !== tempId) }));
        throw err;
      }
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

    // ── Timer ─────────────────────────────────────────────────────────────────
    startTimer: async (taskId) => {
      const currentActiveTaskId = get().activeTaskId;
      if (currentActiveTaskId && currentActiveTaskId !== taskId) {
        await get().stopTimer(currentActiveTaskId);
      }

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
              ...t, status: 'active',
              sessions: [
                ...t.sessions,
                { id: 'pending', startTime: now, totalPauseDuration: 0, activeTime: 0 },
              ],
            }
            : t
        ),
      }));

      // Save to localStorage immediately so refresh works
      saveTimer({
        taskId, sessionId: null, timerState: 'running',
        sessionStartTime: now, totalPauseDuration: 0,
      });

      try {
        const sessionDoc = await api.sessions.start(taskId, now);
        set(s => ({
          activeSessionId: sessionDoc._id,
          tasks: s.tasks.map(t => {
            if (t.id !== taskId) return t;
            const sessions = [...t.sessions];
            const lastIdx = sessions.findIndex(sess => sess.id === 'pending' && sess.startTime === now);
            if (lastIdx >= 0) {
              sessions[lastIdx] = { ...sessions[lastIdx], id: sessionDoc._id };
            }
            return { ...t, sessions };
          }),
        }));
        // Update localStorage with real session ID
        saveTimer({
          taskId, sessionId: sessionDoc._id, timerState: 'running',
          sessionStartTime: now, totalPauseDuration: 0,
        });
      } catch (err) {
        console.error('❌ Failed to persist session start:', err);
      }
    },

    pauseTimer: (taskId) => {
      const { activeSessionId, currentSessionStart } = get();
      const now = Date.now();

      set(s => ({
        activeTimerState: 'paused',
        currentPauseStart: now,
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'paused' } : t),
      }));

      // Save paused state to localStorage
      const last = get().tasks.find(t => t.id === taskId)?.sessions.slice(-1)[0];
      saveTimer({
        taskId,
        sessionId: activeSessionId,
        timerState: 'paused',
        sessionStartTime: last?.startTime ?? (currentSessionStart || Date.now()),
        totalPauseDuration: last?.totalPauseDuration ?? 0,
        pauseStart: now,
      });

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
          if (last) sessions[sessions.length - 1] = {
            ...last, totalPauseDuration: last.totalPauseDuration + pauseDuration,
          };
          return { ...t, sessions, status: 'active' };
        }),
      }));

      // Update localStorage
      const last = get().tasks.find(t => t.id === taskId)?.sessions.slice(-1)[0];
      if (last) {
        saveTimer({
          taskId,
          sessionId: activeSessionId,
          timerState: 'running',
          sessionStartTime: last.startTime,
          totalPauseDuration: last.totalPauseDuration,
        });
      }

      if (activeSessionId) api.sessions.resume(activeSessionId, now).catch(console.error);
    },

    stopTimer: async (taskId) => {
      const { activeSessionId, currentPauseStart, activeTimerState } = get();
      const now = Date.now();

      // ── Calculate final session time BEFORE wiping state ──────────────────
      const stoppingTask = get().tasks.find(t => t.id === taskId);
      const lastSession = stoppingTask?.sessions[stoppingTask.sessions.length - 1];
      const extraPause = (activeTimerState === 'paused' && currentPauseStart)
        ? now - currentPauseStart : 0;
      const finalPause = (lastSession?.totalPauseDuration || 0) + extraPause;
      const finalActive = lastSession
        ? Math.max(0, now - lastSession.startTime - finalPause)
        : 0;

      // ── Cache today's total BEFORE state wipe so refresh shows correct value
      // ✅ CORRECT — one line, uses the new helper
      try {
        addCompletedSession(finalActive);
      } catch { /* ignore */ }

      // ── Now wipe state ────────────────────────────────────────────────────
      clearTimer();

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
            sessions[sessions.length - 1] = {
              ...last,
              endTime: now,
              totalPauseDuration: finalPause,
              activeTime: finalActive,
            };
          }
          const totalTime = sessions.reduce((a, s) => a + s.activeTime, 0);
          return { ...t, sessions, totalTime, status: 'todo' };
        }),
      }));

      // Persist to Atlas
      const sid = activeSessionId;
      if (sid) {
        try {
          await api.sessions.stop(sid, now);
          await get().fetchTasks();
        } catch (err) {
          console.error('❌ Failed to persist session stop:', err);
        }
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

      // Keep localStorage in sync (updates totalPauseDuration if needed)
      const liveTask = get().tasks.find(t => t.id === activeTaskId);
      const liveSession = liveTask?.sessions.slice(-1)[0];
      if (liveSession && get().activeSessionId) {
        saveTimer({
          taskId: activeTaskId,
          sessionId: get().activeSessionId,
          timerState: 'running',
          sessionStartTime: liveSession.startTime,
          totalPauseDuration: liveSession.totalPauseDuration,
        });
      }
    },

    // ── Subtasks ───────────────────────────────────────────────────────────────
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
      // Only update subtasks, preserve live sessions
      set(s => ({
        tasks: s.tasks.map(t => {
          if (t.id !== taskId) return t;
          const updated = mapTask(doc);
          return { ...updated, sessions: t.sessions }; // keep live sessions
        }),
      }));
    },

    deleteSubtask: async (taskId, subtaskId) => {
      set(s => ({
        tasks: s.tasks.map(t =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.filter(st => st.id !== subtaskId) } : t
        ),
      }));
      const doc = await api.tasks.deleteSubtask(taskId, subtaskId);
      set(s => ({
        tasks: s.tasks.map(t => {
          if (t.id !== taskId) return t;
          const updated = mapTask(doc);
          return { ...updated, sessions: t.sessions };
        }),
      }));
    },

    // ── Journals ───────────────────────────────────────────────────────────────
    addJournal: async (entry) => {
      const doc = await api.journals.create(entry);
      set(s => ({ journals: [mapJournal(doc), ...s.journals] }));
    },

    updateJournal: async (id, updates) => {
      set(s => ({
        journals: s.journals.map(j => j.id === id ? { ...j, ...updates, updatedAt: Date.now() } : j),
      }));
      await api.journals.update(id, updates).catch(console.error);
    },

    deleteJournal: async (id) => {
      set(s => ({ journals: s.journals.filter(j => j.id !== id) }));
      await api.journals.delete(id).catch(console.error);
    },

    // ── Profile + Theme ────────────────────────────────────────────────────────
    updateProfile: (updates) => {
      set(s => ({ profile: { ...s.profile, ...updates } }));
      const current = get().profile;
      saveCache(PROFILE_KEY, current); // update cache immediately
      api.profile.update({
        name: updates.name ?? current.name,
        leaderboardOptIn: updates.leaderboardOptIn ?? current.leaderboardOptIn,
        settings: {
          dailyGoal: updates.dailyGoal ?? current.dailyGoal,
          pomodoroWork: updates.pomodoroWork ?? current.pomodoroWork,
          pomodoroBreak: updates.pomodoroBreak ?? current.pomodoroBreak,
          timezone: updates.timezone ?? current.timezone,
        },
      }).catch((err) => {
        console.error(err);
        toast.error('Could not save settings', err.message || 'Profile changes were kept locally only.');
      });
    },

    updateTheme: (updates) => {
      set(s => ({ theme: { ...s.theme, ...updates } }));
      const current = get().theme;
      saveCache(THEME_KEY, current);
      applyThemeToDOM(current); // apply to DOM immediately
      api.profile.update({
        settings: {
          mode: updates.mode ?? current.mode,
          accentColor: updates.accentColor ?? current.accentColor,
          fontSize: updates.fontSize ?? current.fontSize,
          glassmorphism: updates.glassmorphism ?? current.glassmorphism,
          animatedBg: updates.animatedBackground ?? current.animatedBackground,
          reducedMotion: updates.reducedMotion ?? current.reducedMotion,
        },
      }).catch((err) => {
        console.error(err);
        toast.error('Could not save appearance', err.message || 'Theme changes were kept locally only.');
      });
    },

    // ── Helpers ────────────────────────────────────────────────────────────────
    getTask: (id) => get().tasks.find(t => t.id === id),

    getTodayTime: () => {
      const now = Date.now();

      // Completed sessions today — from localStorage cache (set in stopTimer)
      const completedMs = loadTodayMs();

      // Current live session — from store (ticks every second)
      let liveMs = 0;
      const { activeTaskId, tasks } = get();
      if (activeTaskId) {
        const activeTask = tasks.find(t => t.id === activeTaskId);
        const session = activeTask?.sessions[activeTask.sessions.length - 1];
        if (session && !session.endTime) {
          liveMs = Math.max(0, now - session.startTime - session.totalPauseDuration);
        }
      }

      return completedMs + liveMs;
    },
    getWeekTime: () => {
      const tasks = get().tasks;
      let total = 0;
      for (const task of tasks) total += task.totalTime;
      return total;
    },
  };
});

/**
 * useStore — Production-Grade Application Store
 *
 * Integrated with TimerEngine & OfflineQueue for complete reliability:
 * 1. Single Source of Truth for active timer state via timerEngine.
 * 2. Automatic offline queuing and recovery via offlineQueue.
 * 3. Atomic backend sync and instant local state restoration.
 * 4. Automatic WorkLog and reports synchronization.
 */

import { create } from 'zustand';
import { api } from '../utils/api';
import {
  loadTimer,
  loadTodayMs,
  loadWeekMs,
  rebuildDayCache,
} from '../utils/timerPersist';
import { timerEngine } from '../utils/timerEngine';
import { offlineQueue, createOpId } from '../utils/offlineQueue';
import type {
  Task, JournalEntry, TimerState, Priority,
  Subtask, ThemeSettings, UserProfile,
} from '../types';
import { useWorkLogStore } from './useWorkLogStore';
import { useRoadmapStore } from './useRoadmapStore';
import { useWorkspaceStore } from './useWorkspaceStore';
import { toast } from './useToastStore';
import { generateBrandShades } from '../utils/colorUtils';

// ── Defaults & Caching ────────────────────────────────────────────────────────
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

// IES-P1-26: session liveness. The client beats every 30s while a timer is open
// (running or paused) so the server's reaper (10-min staleness) never closes a
// live session as a zombie. A dropped beat is retried silently next tick.
const HEARTBEAT_INTERVAL_MS = 30_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(sessionId: string | null, onStale?: () => void): void {
  stopHeartbeat();
  if (!sessionId) return;
  heartbeatTimer = setInterval(() => {
    api.sessions.heartbeat(sessionId).catch((err: any) => {
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

function applyThemeToDOM(theme: ThemeSettings): void {
  try {
    const root = document.documentElement;
    if (!root) return;
    if (theme.mode === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    if (theme.fontSize === 'sm') root.style.fontSize = '14px';
    else if (theme.fontSize === 'lg') root.style.fontSize = '18px';
    else root.style.fontSize = '16px';

    if (theme.reducedMotion) root.classList.add('reduce-motion');
    else root.classList.remove('reduce-motion');

    if (theme.glassmorphism === false) root.classList.add('no-glass');
    else root.classList.remove('no-glass');

    if (theme.animatedBackground === false) root.classList.add('no-anim-bg');
    else root.classList.remove('no-anim-bg');

    if (theme.accentColor) {
      root.style.setProperty('--color-accent', theme.accentColor);
      const darkShades  = generateBrandShades(theme.accentColor, 'dark');
      const lightShades = generateBrandShades(theme.accentColor, 'light');
      const activeShades = theme.mode === 'light' ? lightShades : darkShades;
      for (const [level, color] of Object.entries(activeShades)) {
        root.style.setProperty(`--color-brand-${level}`, color);
      }

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
    sessions: [],
    totalTime: doc.totalTime ?? 0,
    order: doc.order ?? 0,
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
    completedAt: doc.completedAt ? new Date(doc.completedAt).getTime() : null,
    roadmapRef: doc.roadmapRef ? String(doc.roadmapRef) : undefined,
    phaseRef: doc.phaseRef ? String(doc.phaseRef) : undefined,
    milestoneRef: doc.milestoneRef ? String(doc.milestoneRef) : undefined,
    workspaceContext: doc.workspaceContext || 'work',
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

// ── Store Shape ───────────────────────────────────────────────────────────────
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
  mobileSidebarOpen: boolean;

  setMobileSidebarOpen: (open: boolean) => void;
  loadAll: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'sessions' | 'totalTime' | 'deadline' | 'order'> & { deadline?: string | number }) => Promise<string>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reorderTasks: (tasks: Task[]) => void;

  // ── Selection & Bulk Ops ────────────────────────────────────────────────────
  selectedTaskIds: Set<string>;
  toggleTaskSelection: (id: string) => void;
  selectAllTasks: (ids: string[]) => void;
  clearTaskSelection: () => void;
  bulkCompleteTasks: (ids: string[]) => Promise<void>;
  bulkDeleteTasks: (ids: string[]) => Promise<void>;
  persistTaskOrder: (orderedIds: string[]) => Promise<void>;

  // EEP2-P5.4.2: `baseMs` lets the sprint board pass a collab task's accumulated
  // totalTime as the resume base (collab tasks live in the collaboration store,
  // not in this personal `tasks` list, so the store cannot look it up itself).
  startTimer: (taskId: string, baseMs?: number) => Promise<void>;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => Promise<void>;

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

export const useStore = create<StoreState>((set, get) => {
  const cachedProfile = loadCached<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE);
  const cachedTheme = loadCached<ThemeSettings>(THEME_KEY, DEFAULT_THEME);
  applyThemeToDOM(cachedTheme);

  const snapshot = timerEngine.getSnapshot();

  // Listen to timerEngine updates and update store state in sync
  timerEngine.subscribe((newSnapshot) => {
    set({
      activeTaskId: newSnapshot.taskId,
      activeSessionId: newSnapshot.sessionId,
      activeTimerState: newSnapshot.timerState as TimerState,
      currentSessionStart: newSnapshot.sessionStartTime || undefined,
      currentPauseStart: newSnapshot.pauseStart,
    });
  });

  return {
    tasks: [],
    journals: [],
    profile: cachedProfile,
    theme: cachedTheme,
    dataLoading: false,
    dataError: null,
    mobileSidebarOpen: false,
    selectedTaskIds: new Set<string>(),
    setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
    activeTaskId: snapshot.taskId,
    activeSessionId: snapshot.sessionId,
    activeTimerState: snapshot.timerState as TimerState,
    currentSessionStart: snapshot.sessionStartTime || undefined,
    currentPauseStart: snapshot.pauseStart,

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
        const cached = loadCached<ThemeSettings>(THEME_KEY, DEFAULT_THEME);
        const mergedTheme: ThemeSettings = {
          ...serverTheme,
          accentColor: serverTheme.accentColor || cached.accentColor || DEFAULT_THEME.accentColor,
        };

        saveCache(PROFILE_KEY, profile);
        saveCache(THEME_KEY, mergedTheme);
        applyThemeToDOM(mergedTheme);

        const baseTasks = taskDocs.map(mapTask);

        // Process any queued offline timer operations
        offlineQueue.processQueue().catch(() => {});

        // Rehydrate TimerEngine with active session from backend
        try {
          const allSessions = await api.sessions.list();
          const match = allSessions.find((s: any) => s.isActive);
          const localTimer = loadTimer();

          // Keep the offline day/week cache authoritative from the backend, so a
          // refresh or re-login never resets today's progress to zero.
          rebuildDayCache(allSessions);

          if (match) {
            const pauseStart = getOpenPauseStart(match);
            const isPaused = baseTasks.find(t => t.id === docId(match.taskId))?.status === 'paused' || Boolean(pauseStart);
            const matchedTask = baseTasks.find(t => t.id === docId(match.taskId));

            timerEngine.hydrate({
              taskId: docId(match.taskId),
              sessionId: docId(match._id),
              timerState: isPaused ? 'paused' : 'running',
              sessionStartTime: match.startTime,
              totalPauseDuration: match.totalPauseDuration || 0,
              pauseStart,
              baseElapsedMs: matchedTask?.totalTime ?? 0,
            });
          } else if (localTimer) {
            // Validate local snapshot if backend didn't return an active session
            timerEngine.hydrate(localTimer);
          } else {
            timerEngine.hydrate(null);
          }
        } catch {
          // Backend offline — rely on localTimer in timerEngine
          const localTimer = loadTimer();
          if (localTimer) timerEngine.hydrate(localTimer);
        }

        const engineSnap = timerEngine.getSnapshot();

        // IES-P1-26: a timer restored from the backend (or local storage) must
        // resume beating, or the reaper will close it as a zombie.
        startHeartbeat(engineSnap.sessionId, () => {
          timerEngine.hydrate(null);
          set({
            activeTaskId: null,
            activeSessionId: null,
            activeTimerState: 'idle',
            currentSessionStart: undefined,
            currentPauseStart: undefined,
          });
        });

        set({
          tasks: baseTasks,
          journals: journalDocs.map(mapJournal),
          profile,
          theme: mergedTheme,
          activeTaskId: engineSnap.taskId,
          activeSessionId: engineSnap.sessionId,
          activeTimerState: engineSnap.timerState as TimerState,
          currentSessionStart: engineSnap.sessionStartTime || undefined,
          currentPauseStart: engineSnap.pauseStart,
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
        set({ tasks: docs.map(mapTask) });
      } catch (err) {
        console.error('❌ fetchTasks failed:', err);
      }
    },

    fetchProfile: async () => {
      try {
        const userDoc = await api.profile.get();
        const { profile } = mapSettings(userDoc);
        saveCache(PROFILE_KEY, profile);
        set({ profile });
      } catch (err) {
        console.error('❌ fetchProfile failed:', err);
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
      const { deadline, ...rest } = data;
      const tempTask: Task = {
        ...rest,
        id: tempId, sessions: [], totalTime: 0, order: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        deadline: typeof deadline === 'number' ? deadline
          : deadline ? new Date(deadline).getTime() : undefined,
      };
      set(s => ({ tasks: [tempTask, ...s.tasks] }));
      try {
        const wsCtx = useWorkspaceStore.getState().activeWorkspace;
        const doc = await api.tasks.create({ ...data, deadline: data.deadline || undefined, workspaceContext: data.workspaceContext || wsCtx });
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
      // Refresh roadmap progress if a linked task's status changed
      if (updates.status) {
        const task = get().tasks.find(t => t.id === id);
        if (task?.roadmapRef) {
          useRoadmapStore.getState().refreshIfLinked(task.roadmapRef);
        }
      }
    },

    deleteTask: async (id) => {
      if (timerEngine.getActiveTaskId() === id) {
        await get().stopTimer(id);
      }
      set(s => ({
        tasks: s.tasks.filter(t => t.id !== id),
        journals: s.journals.filter(j => j.taskId !== id),
      }));
      await api.tasks.delete(id);
    },

    completeTask: async (id) => {
      if (timerEngine.getActiveTaskId() === id) {
        await get().stopTimer(id);
      }
      await get().updateTask(id, { status: 'completed', completedAt: Date.now() });
      // The updateTask handler already refreshes roadmap progress for linked tasks
    },

    reorderTasks: (tasks) => set({ tasks }),

    // ── Selection & Bulk Ops ─────────────────────────────────────────────────
    toggleTaskSelection: (id) => set(s => {
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
        set(s => ({
          tasks: s.tasks.map(t => ids.includes(t.id) ? { ...t, status: 'completed' as const, completedAt: now } : t),
          selectedTaskIds: new Set(),
        }));
        await Promise.all(ids.map(id => api.tasks.update(id, { status: 'completed', completedAt: now })));
        toast.success('Tasks completed', `${ids.length} task${ids.length > 1 ? 's' : ''} marked as complete.`);
      } catch {
        toast.error('Failed to complete tasks');
        get().fetchTasks();
      }
    },

    bulkDeleteTasks: async (ids) => {
      if (!ids.length) return;
      try {
        set(s => ({
          tasks: s.tasks.filter(t => !ids.includes(t.id)),
          selectedTaskIds: new Set(),
        }));
        await Promise.all(ids.map(id => api.tasks.delete(id)));
        toast.success('Tasks deleted', `${ids.length} task${ids.length > 1 ? 's' : ''} removed.`);
      } catch {
        toast.error('Failed to delete tasks');
        get().fetchTasks();
      }
    },

    persistTaskOrder: async (orderedIds) => {
      try {
        set(s => ({
          tasks: s.tasks.map(t => {
            const idx = orderedIds.indexOf(t.id);
            return idx >= 0 ? { ...t, order: idx } : t;
          }),
        }));
        await api.tasks.reorder(orderedIds);
      } catch {
        get().fetchTasks();
      }
    },

    // ── Timer Operations (Delegated to TimerEngine & OfflineQueue) ────────────
    startTimer: async (taskId, baseMs) => {
      const now = Date.now();
      const opId = createOpId();

      // A different running/paused task is closed first (backend + offline queue)
      // so only one session stays open across the whole workspace.
      const currentTaskId = timerEngine.getSnapshot().taskId;
      if (currentTaskId && currentTaskId !== taskId) {
        await get().stopTimer(currentTaskId);
      }

      // Resuming a task continues from its accumulated time (display continuity).
      const resumeFromMs = baseMs ?? (get().tasks.find(t => t.id === taskId)?.totalTime ?? 0);

      const res = await timerEngine.start(taskId, undefined, now, resumeFromMs);
      if (!res.success) {
        if (res.error) toast.error('Timer Error', res.error);
        return;
      }

      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'active' } : t),
      }));

      try {
        const sessionDoc = await api.sessions.start(taskId, now, opId);
        timerEngine.setSessionId(sessionDoc._id);
        startHeartbeat(sessionDoc._id, () => {
          timerEngine.hydrate(null);
          set({
            activeTaskId: null,
            activeSessionId: null,
            activeTimerState: 'idle',
            currentSessionStart: undefined,
            currentPauseStart: undefined,
          });
        });
        get().fetchProfile();
      } catch (err) {
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

      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'paused' } : t),
      }));

      if (sessionId) {
        api.sessions.pause(sessionId, now, opId).catch(() => {
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

      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'active' } : t),
      }));

      if (sessionId) {
        api.sessions.resume(sessionId, now, opId).catch(() => {
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

      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? { ...t } : t),
      }));

      if (sessionId) {
        try {
          await api.sessions.stop(sessionId, now, opId);
          stopHeartbeat();
          await get().fetchTasks();
          get().fetchProfile();
          // Auto-sync WorkLog store
          useWorkLogStore.getState().loadToday().catch(() => {});
        } catch {
          console.warn('Network issue on session stop. Enqueuing offline op.');
          offlineQueue.enqueue('STOP_SESSION', taskId, sessionId, { endTime: now }, opId);
        }
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
      set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
    },

    deleteSubtask: async (taskId, subtaskId) => {
      set(s => ({
        tasks: s.tasks.map(t =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.filter(st => st.id !== subtaskId) } : t
        ),
      }));
      const doc = await api.tasks.deleteSubtask(taskId, subtaskId);
      set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? mapTask(doc) : t) }));
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
      saveCache(PROFILE_KEY, current);
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
      applyThemeToDOM(current);
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
      const completedMs = loadTodayMs();
      const liveMs = timerEngine.getState() !== 'idle' ? timerEngine.getElapsedMs() : 0;
      return completedMs + liveMs;
    },

    getWeekTime: () => {
      const completedMs = loadWeekMs();
      const liveMs = timerEngine.getState() !== 'idle' ? timerEngine.getElapsedMs() : 0;
      return completedMs + liveMs;
    },
  };
});

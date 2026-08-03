import { create } from 'zustand';
import { api } from '../utils/api';
import { runMutation } from '../utils/mutation';
import { getTodayKey, dayKeyInTz, localDateToUtc, getTimezone } from '../utils/time';

export type HabitFeeling = 'rough' | 'okay' | 'good' | 'great' | 'energized';

export interface HabitChecklistItem {
  _id: string;
  text: string;
  order: number;
}

export interface HabitEntry {
  _id: string;
  date: string;
  completedItems: string[];
  minutes: number;
  feeling: HabitFeeling;
  note: string;
}

export interface Habit {
  _id: string;
  title: string;
  description: string;
  color: string;
  targetMinutes: number;
  reminderTime?: string;
  checklist: HabitChecklistItem[];
  entries: HabitEntry[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HabitState {
  habits: Habit[];
  loading: boolean;
  creating: boolean;
  error: string | null;
  activeHabitId: string | null;
  habitTimerState: 'idle' | 'running' | 'paused';
  habitTimerStartedAt?: number;
  habitTimerPausedAt?: number;
  habitTimerPausedMs: number;
  habitTimerBaseMinutes: number;
  loadHabits: () => Promise<void>;
  createHabit: (data: { title: string; description?: string; color?: string; targetMinutes?: number; checklist?: string[] }) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  addChecklistItem: (id: string, text: string) => Promise<void>;
  deleteChecklistItem: (id: string, itemId: string) => Promise<void>;
  updateToday: (id: string, entry: Partial<Pick<HabitEntry, 'completedItems' | 'minutes' | 'feeling' | 'note'>>) => Promise<void>;
  startTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  stopTimer: (id: string) => Promise<void>;
  getLiveMinutes: (id: string) => number;
  getLiveElapsedMs: (id: string) => number;
}

const CACHE_KEY = 'ff_habit_cache';
const TIMER_KEY = 'ff_habit_timer';

interface PersistedHabitTimer {
  habitId: string;
  state: 'running' | 'paused';
  startedAt: number;
  pausedAt?: number;
  pausedMs: number;
  baseMinutes: number;
}

// IES-P1-06: "today" for habit entries is the calendar day in the user's
// timezone. The stored date is the tz-midnight instant (matches the server
// encoding), so `dayKeyInTz(entry.date)` round-trips to the same day.
function todayKey(): string {
  return new Date(localDateToUtc(getTodayKey(), getTimezone())).toISOString();
}

function normalizeHabit(doc: any): Habit {
  return {
    _id: doc._id,
    title: doc.title || 'Untitled Habit',
    description: doc.description || '',
    color: doc.color || '#22c55e',
    targetMinutes: doc.targetMinutes || 20,
    checklist: (doc.checklist || []).map((item: any) => ({
      _id: item._id,
      text: item.text,
      order: item.order || 0,
    })).sort((a: HabitChecklistItem, b: HabitChecklistItem) => a.order - b.order),
    entries: (doc.entries || []).map((entry: any) => ({
      _id: entry._id,
      date: entry.date,
      completedItems: (entry.completedItems || []).map((id: any) => String(id)),
      minutes: entry.minutes || 0,
      feeling: entry.feeling || 'okay',
      note: entry.note || '',
    })),
    archived: doc.archived || false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function readCache(): Habit[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(habits: Habit[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(habits));
  } catch { /* ignore */ }
}

function readTimer(): PersistedHabitTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTimer(timer: PersistedHabitTimer): void {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch { /* ignore */ }
}

function clearTimer(): void {
  try {
    localStorage.removeItem(TIMER_KEY);
  } catch { /* ignore */ }
}

function patchHabit(habits: Habit[], updated: Habit): Habit[] {
  return habits.map(h => h._id === updated._id ? updated : h);
}

export function getTodayHabitEntry(habit: Habit): HabitEntry {
  const today = getTodayKey();
  const existing = habit.entries.find(entry => dayKeyInTz(entry.date) === today);

  return existing || {
    _id: 'today',
    date: todayKey(),
    completedItems: [],
    minutes: 0,
    feeling: 'okay',
    note: '',
  };
}

function elapsedMs(timer: {
  state: 'idle' | 'running' | 'paused';
  startedAt?: number;
  pausedAt?: number;
  pausedMs: number;
}): number {
  if (!timer.startedAt || timer.state === 'idle') return 0;
  const end = timer.state === 'paused' && timer.pausedAt ? timer.pausedAt : Date.now();
  return Math.max(0, end - timer.startedAt - timer.pausedMs);
}

function mergeTodayMinutes(habits: Habit[], id: string, minutes: number): Habit[] {
  return habits.map(habit => {
    if (habit._id !== id) return habit;
    const today = getTodayKey();
    const existing = habit.entries.find(entry => dayKeyInTz(entry.date) === today);

    if (existing) {
      return {
        ...habit,
        entries: habit.entries.map(entry => entry._id === existing._id ? { ...entry, minutes } : entry),
      };
    }

    return {
      ...habit,
      entries: [
        ...habit.entries,
        {
          _id: 'today',
          date: todayKey(),
          completedItems: [],
          minutes,
          feeling: 'okay',
          note: '',
        },
      ],
    };
  });
}

const persistedTimer = readTimer();

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: readCache(),
  loading: false,
  creating: false,
  error: null,
  activeHabitId: persistedTimer?.habitId ?? null,
  habitTimerState: persistedTimer?.state ?? 'idle',
  habitTimerStartedAt: persistedTimer?.startedAt,
  habitTimerPausedAt: persistedTimer?.pausedAt,
  habitTimerPausedMs: persistedTimer?.pausedMs ?? 0,
  habitTimerBaseMinutes: persistedTimer?.baseMinutes ?? 0,

  loadHabits: async () => {
    set({ loading: true, error: null });
    try {
      const docs = await api.habits.list();
      const habits = docs.map(normalizeHabit);
      writeCache(habits);
      set({ habits, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createHabit: async (data) => {
    set({ creating: true, error: null });
    try {
      const doc = await api.habits.create({
        ...data,
        checklist: (data.checklist || []).map(text => ({ text })),
      });
      const habit = normalizeHabit(doc);
      const habits = [habit, ...get().habits];
      writeCache(habits);
      set({ habits, creating: false });
    } catch (err: any) {
      set({ creating: false, error: err.message });
      throw err;
    }
  },

  updateHabit: async (id, updates) => {
    const prev = get().habits;
    await runMutation(
      () => {
        const habits = get().habits.map(h => h._id === id ? { ...h, ...updates } : h);
        writeCache(habits);
        set({ habits });
        return () => {
          writeCache(prev);
          set({ habits: prev });
        };
      },
      async () => {
        const doc = await api.habits.update(id, updates);
        const refreshed = patchHabit(get().habits, normalizeHabit(doc));
        writeCache(refreshed);
        set({ habits: refreshed });
      },
      { errorTitle: 'Failed to update habit' },
    );
  },

  deleteHabit: async (id) => {
    const hadActiveTimer = get().activeHabitId === id;
    const prev = get().habits;
    await runMutation(
      () => {
        if (hadActiveTimer) {
          clearTimer();
          set({
            activeHabitId: null,
            habitTimerState: 'idle',
            habitTimerStartedAt: undefined,
            habitTimerPausedAt: undefined,
            habitTimerPausedMs: 0,
            habitTimerBaseMinutes: 0,
          });
        }
        const habits = get().habits.filter(h => h._id !== id);
        writeCache(habits);
        set({ habits });
        return () => {
          writeCache(prev);
          set({ habits: prev });
        };
      },
      () => api.habits.delete(id),
      { errorTitle: 'Failed to delete habit' },
    );
  },

  addChecklistItem: async (id, text) => {
    const doc = await api.habits.addChecklistItem(id, text);
    const habits = patchHabit(get().habits, normalizeHabit(doc));
    writeCache(habits);
    set({ habits });
  },

  deleteChecklistItem: async (id, itemId) => {
    const doc = await api.habits.deleteChecklistItem(id, itemId);
    const habits = patchHabit(get().habits, normalizeHabit(doc));
    writeCache(habits);
    set({ habits });
  },

  updateToday: async (id, entry) => {
    const doc = await api.habits.updateToday(id, entry);
    const habits = patchHabit(get().habits, normalizeHabit(doc));
    writeCache(habits);
    set({ habits });
  },

  startTimer: (id) => {
    const habit = get().habits.find(h => h._id === id);
    if (!habit) return;
    const baseMinutes = getTodayHabitEntry(habit).minutes;
    const startedAt = Date.now();
    const timer: PersistedHabitTimer = {
      habitId: id,
      state: 'running',
      startedAt,
      pausedMs: 0,
      baseMinutes,
    };
    writeTimer(timer);
    set({
      activeHabitId: id,
      habitTimerState: 'running',
      habitTimerStartedAt: startedAt,
      habitTimerPausedAt: undefined,
      habitTimerPausedMs: 0,
      habitTimerBaseMinutes: baseMinutes,
    });
  },

  pauseTimer: (id) => {
    const state = get();
    if (state.activeHabitId !== id || state.habitTimerState !== 'running' || !state.habitTimerStartedAt) return;
    const pausedAt = Date.now();
    writeTimer({
      habitId: id,
      state: 'paused',
      startedAt: state.habitTimerStartedAt,
      pausedAt,
      pausedMs: state.habitTimerPausedMs,
      baseMinutes: state.habitTimerBaseMinutes,
    });
    set({ habitTimerState: 'paused', habitTimerPausedAt: pausedAt });
  },

  resumeTimer: (id) => {
    const state = get();
    if (state.activeHabitId !== id || state.habitTimerState !== 'paused' || !state.habitTimerStartedAt) return;
    const extraPause = state.habitTimerPausedAt ? Date.now() - state.habitTimerPausedAt : 0;
    const pausedMs = state.habitTimerPausedMs + extraPause;
    writeTimer({
      habitId: id,
      state: 'running',
      startedAt: state.habitTimerStartedAt,
      pausedMs,
      baseMinutes: state.habitTimerBaseMinutes,
    });
    set({ habitTimerState: 'running', habitTimerPausedAt: undefined, habitTimerPausedMs: pausedMs });
  },

  stopTimer: async (id) => {
    const minutes = get().getLiveMinutes(id);
    const prev = {
      habits: get().habits,
      activeHabitId: get().activeHabitId,
      habitTimerState: get().habitTimerState,
      habitTimerStartedAt: get().habitTimerStartedAt,
      habitTimerPausedAt: get().habitTimerPausedAt,
      habitTimerPausedMs: get().habitTimerPausedMs,
      habitTimerBaseMinutes: get().habitTimerBaseMinutes,
    };
    await runMutation(
      () => {
        clearTimer();
        const habits = mergeTodayMinutes(get().habits, id, minutes);
        writeCache(habits);
        set({
          habits,
          activeHabitId: null,
          habitTimerState: 'idle',
          habitTimerStartedAt: undefined,
          habitTimerPausedAt: undefined,
          habitTimerPausedMs: 0,
          habitTimerBaseMinutes: 0,
        });
        return () => {
          if (prev.habitTimerState !== 'idle' && prev.habitTimerStartedAt) {
            writeTimer({
              habitId: prev.activeHabitId || id,
              state: prev.habitTimerState as 'running' | 'paused',
              startedAt: prev.habitTimerStartedAt,
              pausedAt: prev.habitTimerPausedAt,
              pausedMs: prev.habitTimerPausedMs,
              baseMinutes: prev.habitTimerBaseMinutes,
            });
          }
          writeCache(prev.habits);
          set({
            habits: prev.habits,
            activeHabitId: prev.activeHabitId,
            habitTimerState: prev.habitTimerState,
            habitTimerStartedAt: prev.habitTimerStartedAt,
            habitTimerPausedAt: prev.habitTimerPausedAt,
            habitTimerPausedMs: prev.habitTimerPausedMs,
            habitTimerBaseMinutes: prev.habitTimerBaseMinutes,
          });
        };
      },
      () => get().updateToday(id, { minutes }),
      { errorTitle: 'Failed to save habit timer' },
    );
  },

  getLiveElapsedMs: (id) => {
    const state = get();
    if (state.activeHabitId !== id) return 0;
    return elapsedMs({
      state: state.habitTimerState,
      startedAt: state.habitTimerStartedAt,
      pausedAt: state.habitTimerPausedAt,
      pausedMs: state.habitTimerPausedMs,
    });
  },

  getLiveMinutes: (id) => {
    const state = get();
    if (state.activeHabitId !== id) {
      const habit = state.habits.find(h => h._id === id);
      return habit ? getTodayHabitEntry(habit).minutes : 0;
    }
    const addedMinutes = Math.round((state.getLiveElapsedMs(id) / 60000) * 10) / 10;
    return Math.round((state.habitTimerBaseMinutes + addedMinutes) * 10) / 10;
  },
}));

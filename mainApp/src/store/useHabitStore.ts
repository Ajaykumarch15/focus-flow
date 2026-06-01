import { create } from 'zustand';
import { api } from '../utils/api';

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
  loadHabits: () => Promise<void>;
  createHabit: (data: { title: string; description?: string; color?: string; targetMinutes?: number; checklist?: string[] }) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  addChecklistItem: (id: string, text: string) => Promise<void>;
  deleteChecklistItem: (id: string, itemId: string) => Promise<void>;
  updateToday: (id: string, entry: Partial<Pick<HabitEntry, 'completedItems' | 'minutes' | 'feeling' | 'note'>>) => Promise<void>;
}

const CACHE_KEY = 'ff_habit_cache';

function todayKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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

function patchHabit(habits: Habit[], updated: Habit): Habit[] {
  return habits.map(h => h._id === updated._id ? updated : h);
}

export function getTodayHabitEntry(habit: Habit): HabitEntry {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = habit.entries.find(entry => {
    const d = new Date(entry.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  return existing || {
    _id: 'today',
    date: todayKey(),
    completedItems: [],
    minutes: 0,
    feeling: 'okay',
    note: '',
  };
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: readCache(),
  loading: false,
  creating: false,
  error: null,

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
    const habits = get().habits.map(h => h._id === id ? { ...h, ...updates } : h);
    writeCache(habits);
    set({ habits });
    const doc = await api.habits.update(id, updates);
    const refreshed = patchHabit(get().habits, normalizeHabit(doc));
    writeCache(refreshed);
    set({ habits: refreshed });
  },

  deleteHabit: async (id) => {
    const habits = get().habits.filter(h => h._id !== id);
    writeCache(habits);
    set({ habits });
    await api.habits.delete(id);
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
}));

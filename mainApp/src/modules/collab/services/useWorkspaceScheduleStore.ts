import { create } from 'zustand';
import { api } from '@shared/utils/api';
import type { ScheduleItem, ScheduleCreatePayload, ScheduleUpdatePayload } from '@shared/types';

interface WorkspaceScheduleState {
  schedules: ScheduleItem[];
  selectedDate: string;
  viewMode: 'day' | 'week';
  selectedUserIds: string[];
  loading: boolean;
  error: string | null;

  fetchWorkspaceSchedules: (params: {
    workspaceId: string;
    projectId?: string;
    date?: string;
    from?: string;
    to?: string;
    userIds?: string[];
  }) => void;
  fetchTeamSchedules: (workspaceId: string, date?: string, from?: string, to?: string) => void;
  createSchedule: (payload: ScheduleCreatePayload) => Promise<{ schedule: ScheduleItem; warning?: string }>;
  updateSchedule: (id: string, payload: ScheduleUpdatePayload) => Promise<{ schedule: ScheduleItem; warning?: string }>;
  deleteSchedule: (id: string) => Promise<void>;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: 'day' | 'week') => void;
  setSelectedUserIds: (ids: string[]) => void;
  clearSchedules: () => void;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useWorkspaceScheduleStore = create<WorkspaceScheduleState>()((set) => ({
  schedules: [],
  selectedDate: todayDateString(),
  viewMode: 'day',
  selectedUserIds: [],
  loading: false,
  error: null,

  fetchWorkspaceSchedules: async (params) => {
    set({ loading: true, error: null });
    try {
      const schedules = await api.schedules.listWorkspace(params);
      set((state) => {
        const merged = new Map(state.schedules.map((s) => [s._id, s]));
        for (const s of schedules) merged.set(s._id, s);
        return { schedules: Array.from(merged.values()), loading: false };
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch schedules', loading: false });
    }
  },

  fetchTeamSchedules: async (workspaceId, date, from, to) => {
    set({ loading: true, error: null });
    try {
      const schedules = await api.schedules.listTeam({ workspaceId, date, from, to });
      set((state) => {
        const merged = new Map(state.schedules.map((s) => [s._id, s]));
        for (const s of schedules) merged.set(s._id, s);
        return { schedules: Array.from(merged.values()), loading: false };
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch team schedules', loading: false });
    }
  },

  createSchedule: async (payload) => {
    const result = await api.schedules.create(payload);
    set((state) => ({
      schedules: [...state.schedules, result.schedule],
    }));
    return result;
  },

  updateSchedule: async (id, payload) => {
    const result = await api.schedules.update(id, payload);
    set((state) => ({
      schedules: state.schedules.map((s) => (s._id === id ? result.schedule : s)),
    }));
    return result;
  },

  deleteSchedule: async (id) => {
    await api.schedules.delete(id);
    set((state) => ({
      schedules: state.schedules.filter((s) => s._id !== id),
    }));
  },

  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedUserIds: (ids) => set({ selectedUserIds: ids }),
  clearSchedules: () => set({ schedules: [] }),
}));

export function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

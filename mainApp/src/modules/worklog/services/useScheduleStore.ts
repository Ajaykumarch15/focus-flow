import { create } from 'zustand';
import { api } from '@shared/utils/api';
import { toast } from '@shared/services/useToastStore';
import { useScheduleNotificationStore } from './useScheduleNotificationStore';
import { ScheduleItem, ScheduleCreatePayload, ScheduleUpdatePayload } from '@shared/types';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ScheduleState {
  schedules: ScheduleItem[];
  selectedDate: string;
  viewMode: 'day' | 'week';
  loading: boolean;
  error: string | null;
  isModalOpen: boolean;
  preselectedTaskId: string | null;
  editingSchedule: ScheduleItem | null;
  conflictWarning: string | null;

  setSelectedDate: (date: string) => void;
  setViewMode: (mode: 'day' | 'week') => void;
  openModal: (taskId?: string, editing?: ScheduleItem | null) => void;
  closeModal: () => void;
  setConflictWarning: (warning: string | null) => void;

  fetchSchedules: (params?: { date?: string; from?: string; to?: string }) => Promise<void>;
  createSchedule: (payload: ScheduleCreatePayload) => Promise<ScheduleItem | null>;
  updateSchedule: (id: string, payload: ScheduleUpdatePayload) => Promise<ScheduleItem | null>;
  deleteSchedule: (id: string) => Promise<boolean>;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  selectedDate: getTodayDateString(),
  viewMode: 'day',
  loading: false,
  error: null,
  isModalOpen: false,
  preselectedTaskId: null,
  editingSchedule: null,
  conflictWarning: null,

  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  openModal: (taskId, editing = null) =>
    set({
      isModalOpen: true,
      preselectedTaskId: taskId || null,
      editingSchedule: editing,
      conflictWarning: null,
    }),
  closeModal: () =>
    set({
      isModalOpen: false,
      preselectedTaskId: null,
      editingSchedule: null,
      conflictWarning: null,
    }),
  setConflictWarning: (warning) => set({ conflictWarning: warning }),

  fetchSchedules: async (params) => {
    set({ loading: true, error: null });
    try {
      const items = await api.schedules.list(params);
      set((state) => {
        const scheduleMap = new Map(state.schedules.map((s) => [s._id, s]));
        for (const item of items) {
          scheduleMap.set(item._id, item);
        }
        return { schedules: Array.from(scheduleMap.values()), loading: false };
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load schedules', loading: false });
    }
  },

  createSchedule: async (payload) => {
    set({ loading: true });
    try {
      const res = await api.schedules.create(payload);
      const newSchedule = res.schedule;
      set((state) => ({
        schedules: [...state.schedules, newSchedule],
        loading: false,
        conflictWarning: res.warning || null,
      }));

      if (res.warning) {
        toast.warning('Schedule Conflict', res.warning);
      } else {
        toast.success('Task scheduled successfully');
      }

      return newSchedule;
    } catch (err: any) {
      set({ loading: false });
      toast.error('Schedule Failed', err.message || 'Could not schedule task');
      return null;
    }
  },

  updateSchedule: async (id, payload) => {
    set({ loading: true });
    try {
      const res = await api.schedules.update(id, payload);
      const updated = res.schedule;
      
      // Reset notification dedup lock so rescheduled item can re-trigger notifications
      useScheduleNotificationStore.getState().resetForSchedule(id);

      set((state) => ({
        schedules: state.schedules.map((s) => (s._id === id ? updated : s)),
        loading: false,
        conflictWarning: res.warning || null,
      }));

      if (res.warning) {
        toast.warning('Schedule Conflict', res.warning);
      } else {
        toast.success('Schedule updated');
      }

      return updated;
    } catch (err: any) {
      set({ loading: false });
      toast.error('Update Failed', err.message || 'Could not update schedule');
      return null;
    }
  },

  deleteSchedule: async (id) => {
    try {
      await api.schedules.delete(id);
      useScheduleNotificationStore.getState().resetForSchedule(id);
      set((state) => ({
        schedules: state.schedules.filter((s) => s._id !== id),
      }));
      toast.success('Schedule removed');
      return true;
    } catch (err: any) {
      toast.error('Delete Failed', err.message || 'Could not delete schedule entry');
      return false;
    }
  },
}));

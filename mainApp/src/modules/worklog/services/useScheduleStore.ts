import { create } from 'zustand';
import { api } from '@shared/utils/api';
import { toast } from '@shared/services/useToastStore';
import { useScheduleNotificationStore } from './useScheduleNotificationStore';
import {
  ScheduleItem,
  ScheduleCreatePayload,
  ScheduleUpdatePayload,
  RescheduleItemChange,
  RescheduleStrategy,
  ScheduleStatus,
} from '@shared/types';
import { timeToMinutes } from './scheduleAnalytics';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** One rescheduling operation, kept for undo + audit */
export interface RescheduleAuditEntry {
  id: string;
  at: number;
  label: string;
  strategy: RescheduleStrategy;
  /** Pre-change snapshots of every affected item (source of truth for undo) */
  snapshot: ScheduleItem[];
}

const AUDIT_KEY = 'ff_reschedule_audit';
const AUDIT_LIMIT = 20;

function loadAudit(): RescheduleAuditEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, AUDIT_LIMIT) : [];
  } catch {
    return [];
  }
}
function saveAudit(entries: RescheduleAuditEntry[]) {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(0, AUDIT_LIMIT)));
  } catch { /* storage full/unavailable */ }
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

  // --- Execution-aware extensions ---
  /** Schedule id whose "Extend Time / reschedule" dialog should be open */
  extendDialogScheduleId: string | null;
  openExtendDialog: (scheduleId: string) => void;
  closeExtendDialog: () => void;

  /** Mark a task as skipped (user chose not to run it) */
  skipSchedule: (id: string, reason?: string) => Promise<boolean>;

  /** Quiet merge of an API-returned schedule item into local state (no toast) */
  __mergeQuiet: (updated: ScheduleItem) => void;

  /** Rescheduling audit trail, newest first (undoable ops + history) */
  rescheduleHistory: RescheduleAuditEntry[];
  /** Apply a confirmed proposal: updates every changed slot atomically-in-sequence with rollback info */
  applyReschedule: (changes: RescheduleItemChange[], meta: { strategy: RescheduleStrategy; scheduleId: string; label: string }) => Promise<boolean>;
  /** Revert the most recent rescheduling operation from its snapshot */
  undoLastReschedule: () => Promise<boolean>;
  /** Records an execution-prefixed status change (start/complete) quietly */
  setScheduleExecution: (id: string, patch: { actualStartAt?: number; actualEndAt?: number; status?: ScheduleStatus }) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  selectedDate: getTodayDateString(),
  viewMode: 'day',
  loading: false,
  error: null,
  isModalOpen: false,
  preselectedTaskId: null,
  editingSchedule: null,
  conflictWarning: null,
  extendDialogScheduleId: null,
  rescheduleHistory: loadAudit(),

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
        // When a date window is provided, drop cached items inside that window
        // before merging the fresh response, so deleted/superseded entries are
        // removed instead of accumulating forever. Items outside the window are
        // kept so previously-loaded days/weeks still render without refetching.
        const from = params?.from ?? params?.date ?? null;
        const to = params?.to ?? params?.date ?? null;
        const retained = from && to
          ? state.schedules.filter((s) => !(s.date >= from && s.date <= to))
          : state.schedules;
        const scheduleMap = new Map(retained.map((s) => [s._id, s]));
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

  // -------------------------------------------------------------------------
  // Execution-aware extensions
  // -------------------------------------------------------------------------

  openExtendDialog: (scheduleId) => set({ extendDialogScheduleId: scheduleId }),
  closeExtendDialog: () => set({ extendDialogScheduleId: null }),

  /** Quiet merge of an API-returned schedule item into local state (no toast) */
  __mergeQuiet: (updated: ScheduleItem) => {
    set((state) => ({
      schedules: state.schedules.map((s) => (s._id === updated._id ? updated : s)),
    }));
  },

  skipSchedule: async (id, reason) => {
    try {
      const res = await api.schedules.update(id, {
        status: 'skipped',
        revisionMeta: { strategy: 'skip', reason: reason || 'Skipped by user' },
      });
      useScheduleNotificationStore.getState().resetForSchedule(id);
      get().__mergeQuiet(res.schedule);
      return true;
    } catch (err: any) {
      toast.error('Skip Failed', err.message || 'Could not skip this schedule');
      return false;
    }
  },

  setScheduleExecution: async (id, patch) => {
    try {
      const res = await api.schedules.update(id, patch);
      get().__mergeQuiet(res.schedule);
    } catch {
      // Non-fatal: execution state already lives in the timer/session system
    }
  },

  applyReschedule: async (changes, meta) => {
    if (changes.length === 0) return false;
    const auditEntry: RescheduleAuditEntry = {
      id: `ra_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      label: meta.label,
      strategy: meta.strategy,
      snapshot: [],
    };

    const results = await Promise.allSettled(
      changes.map((c) => {
        // Snapshot from current local state for undo
        const current = get().schedules.find((s) => s._id === c.scheduleId);
        if (current) {
          auditEntry.snapshot.push(current);
        }
        const payload: ScheduleUpdatePayload = {
          startTime: c.to.startTime,
          endTime: c.to.endTime,
          revisionMeta: {
            strategy: meta.strategy,
            reason: meta.label,
            items: { from: c.from, to: c.to },
          },
        };
        // Track cumulative extension on the extended target slot only
        if (c.scheduleId === meta.scheduleId && current) {
          const oldDur = timeToMinutes(current.endTime) - timeToMinutes(current.startTime);
          let newDur = timeToMinutes(c.to.endTime) - timeToMinutes(c.to.startTime);
          if (newDur < oldDur) newDur = oldDur;
          payload.extendedMins = (current.extendedMins || 0) + Math.max(0, newDur - oldDur);
        }
        return api.schedules.update(c.scheduleId, payload);
      })
    );
    const failed: string[] = [];
    let ok = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        ok += 1;
        get().__mergeQuiet(r.value.schedule);
        useScheduleNotificationStore.getState().resetForSchedule(changes[i].scheduleId);
      } else {
        failed.push(changes[i].taskTitle);
      }
    });

    if (ok > 0) {
      const history = [auditEntry, ...loadAudit()].slice(0, AUDIT_LIMIT);
      saveAudit(history);
      set({ rescheduleHistory: history });
    }

    if (failed.length > 0) {
      toast.warning(
        'Reschedule partially applied',
        `${ok} of ${changes.length} updated. Failed: ${failed.join(', ')}. You can undo from the schedule page.`,
      );
    } else if (ok > 1) {
      toast.success('Schedule updated', `${meta.label} — ${ok} slots changed.`);
    } else {
      toast.success('Schedule updated', meta.label);
    }
    return ok > 0;
  },

  undoLastReschedule: async () => {
    const history = get().rescheduleHistory;
    if (history.length === 0) {
      toast.info('Nothing to undo', 'No recent reschedule operations.');
      return false;
    }
    const [entry, ...rest] = history;
    const results = await Promise.allSettled(
      entry.snapshot.map((snap) =>
        api.schedules.update(snap._id, {
          startTime: snap.startTime,
          endTime: snap.endTime,
          extendedMins: snap.extendedMins || 0,
          revisionMeta: { strategy: 'manual', reason: `Undo: ${entry.label}` },
        })
      )
    );
    let reverted = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        reverted += 1;
        get().__mergeQuiet(r.value.schedule);
        useScheduleNotificationStore.getState().resetForSchedule(entry.snapshot[i]._id);
      }
    });
    saveAudit(rest);
    set({ rescheduleHistory: rest });
    if (reverted === entry.snapshot.length && reverted > 0) {
      toast.success('Reschedule undone', `Reverted "${entry.label}".`);
      return true;
    }
    toast.warning('Undo partially applied', `Reverted ${reverted} of ${entry.snapshot.length} changes.`);
    return reverted > 0;
  },
}));

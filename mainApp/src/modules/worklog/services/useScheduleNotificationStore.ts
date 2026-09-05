import { create } from 'zustand';
import { ScheduleNotification } from '@shared/types';

// Persisted dismissed notifications key
const DISMISSED_KEY = 'ff_schedule_dismissed';
const NOTIFIED_KEY = 'ff_schedule_notified';

function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); } catch { return new Set(); }
}
function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}
function loadNotified(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch { return {}; }
}
function saveNotified(map: Record<string, string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
}

interface ScheduleNotificationState {
  activeNotifications: ScheduleNotification[];
  dismissedIds: Set<string>;
  notifiedMap: Record<string, string>; // dedupKey -> notification type
  browserPermission: NotificationPermission;

  /** Push a new notification if not already delivered/dismissed */
  pushNotification: (notif: Omit<ScheduleNotification, 'id' | 'deliveredAt' | 'dismissed'>) => void;
  /** Dismiss a specific notification */
  dismissNotification: (notifId: string) => void;
  /** Dismiss all active notifications */
  dismissAll: () => void;
  /** Check if a schedule+type pair was already notified */
  wasNotified: (scheduleId: string, type: ScheduleNotification['type'], startTimeMs?: number) => boolean;
  /** Mark a schedule+type as notified */
  markNotified: (scheduleId: string, type: ScheduleNotification['type'], startTimeMs?: number) => void;
  /** Clear notification records for a specific scheduleId (e.g. on reschedule) */
  resetForSchedule: (scheduleId: string) => void;
  /** Request browser notification permission */
  requestBrowserPermission: () => void;
  /** Clear all state (on logout) */
  reset: () => void;
}

export const useScheduleNotificationStore = create<ScheduleNotificationState>((set, get) => ({
  activeNotifications: [],
  dismissedIds: loadDismissed(),
  notifiedMap: loadNotified(),
  browserPermission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',

  pushNotification: (notif) => {
    const { dismissedIds, notifiedMap } = get();
    const timeKey = notif.scheduledStartTime ? `:${notif.scheduledStartTime}` : '';
    const key = `${notif.scheduleId}${timeKey}:${notif.type}`;

    // Already notified this exact occurrence
    if (notifiedMap[key]) return;

    // Already dismissed this occurrence
    if (dismissedIds.has(key)) return;

    const id = `sn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry: ScheduleNotification = {
      ...notif,
      id,
      deliveredAt: Date.now(),
      dismissed: false,
    };

    set((s) => ({
      activeNotifications: [entry, ...s.activeNotifications].slice(0, 10),
    }));

    get().markNotified(notif.scheduleId, notif.type, notif.scheduledStartTime);

    // Browser notification if permitted
    if (get().browserPermission === 'granted') {
      try {
        const bn = new Notification(notif.type === 'five-minute' ? '🔔 Upcoming Task' : '🚀 Task Starting Now', {
          body: `"${notif.taskTitle}" — ${notif.type === 'five-minute' ? 'Starts in 5 minutes' : 'Your scheduled task is starting now'}`,
          tag: key,
          requireInteraction: notif.type === 'start-now',
        });
        bn.onclick = () => { window.focus(); bn.close(); };
      } catch { /* Notification API unavailable */ }
    }
  },

  dismissNotification: (notifId) => {
    set((s) => {
      const target = s.activeNotifications.find(n => n.id === notifId);
      if (target) {
        const timeKey = target.scheduledStartTime ? `:${target.scheduledStartTime}` : '';
        const key = `${target.scheduleId}${timeKey}:${target.type}`;
        const nextDismissed = new Set(s.dismissedIds);
        nextDismissed.add(key);
        saveDismissed(nextDismissed);
        return {
          activeNotifications: s.activeNotifications.filter(n => n.id !== notifId),
          dismissedIds: nextDismissed,
        };
      }
      return {};
    });
  },

  dismissAll: () => {
    const { activeNotifications, dismissedIds } = get();
    const nextDismissed = new Set(dismissedIds);
    for (const n of activeNotifications) {
      const timeKey = n.scheduledStartTime ? `:${n.scheduledStartTime}` : '';
      nextDismissed.add(`${n.scheduleId}${timeKey}:${n.type}`);
    }
    saveDismissed(nextDismissed);
    set({ activeNotifications: [], dismissedIds: nextDismissed });
  },

  wasNotified: (scheduleId, type, startTimeMs) => {
    const timeKey = startTimeMs ? `:${startTimeMs}` : '';
    const key = `${scheduleId}${timeKey}:${type}`;
    return !!get().notifiedMap[key];
  },

  markNotified: (scheduleId, type, startTimeMs) => {
    const timeKey = startTimeMs ? `:${startTimeMs}` : '';
    const key = `${scheduleId}${timeKey}:${type}`;
    const next = { ...get().notifiedMap, [key]: type };
    saveNotified(next);
    set({ notifiedMap: next });
  },

  resetForSchedule: (scheduleId) => {
    const { notifiedMap, dismissedIds, activeNotifications } = get();
    const nextNotified = { ...notifiedMap };
    for (const k in nextNotified) {
      if (k.startsWith(`${scheduleId}:`)) {
        delete nextNotified[k];
      }
    }

    const nextDismissed = new Set(dismissedIds);
    for (const k of nextDismissed) {
      if (k.startsWith(`${scheduleId}:`)) {
        nextDismissed.delete(k);
      }
    }

    saveNotified(nextNotified);
    saveDismissed(nextDismissed);

    set({
      notifiedMap: nextNotified,
      dismissedIds: nextDismissed,
      activeNotifications: activeNotifications.filter(n => n.scheduleId !== scheduleId),
    });
  },

  requestBrowserPermission: () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then((p) => {
      set({ browserPermission: p });
    });
  },

  reset: () => {
    set({
      activeNotifications: [],
      dismissedIds: new Set(),
      notifiedMap: {},
    });
    localStorage.removeItem(DISMISSED_KEY);
    localStorage.removeItem(NOTIFIED_KEY);
  },
}));

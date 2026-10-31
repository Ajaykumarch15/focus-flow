import { useEffect, useRef } from 'react';
import { useStore } from '@worklog/services/useStore';
import { useHabitStore } from '@worklog/services/useHabitStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { fetchPersonalSessions, sumClosedSessionMs, computeLivePersonalMs } from '@personal/services/personalFocusTime';
import { isOverdue, isDueToday, getTodayKey } from '@shared/utils/time';
import { toast } from '@shared/services/useToastStore';

const NOTIFICATION_PREFS_KEY = 'ff_notification_prefs';

export interface NotificationSettings {
  enabled: boolean;
  deadlineReminders: boolean;
  habitReminders: boolean;
  dailyGoalReminder: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  deadlineReminders: true,
  habitReminders: true,
  dailyGoalReminder: true,
};

function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(settings));
}

export function getNotificationSettings(): NotificationSettings {
  return loadNotificationSettings();
}

function sendBrowserNotification(title: string, body: string, tag?: string): void {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: '/favicon.svg',
      requireInteraction: false,
    });
  } catch {
    // Notification API not available or blocked
  }
}

/**
 * useNotifications — runs inside AppLayout.
 *
 * Checks every 60 seconds for:
 * - Tasks that are overdue (notifies once per day per task)
 * - Tasks due today (notifies once per day per task)
 * - Task reminders based on reminderMinutesBefore
 * - Daily goal reminder (after 6pm if goal not met)
 */
export function useNotifications() {
  const firedRef = useRef<Set<string>>(new Set());
  const dailyGoalFiredRef = useRef<{ day: string } | null>(null);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const prefs = loadNotificationSettings();
      if (!prefs.enabled) return;

      const { tasks, getTodayTime, profile } = useStore.getState();
      const today = getTodayKey();

      if (prefs.deadlineReminders) {
        for (const task of tasks) {
          if (task.status === 'completed' || !task.deadline) continue;

          const key = `${task.id}-${today}`;

          // Overdue
          if (isOverdue(task.deadline) && !firedRef.current.has(`${key}-overdue`)) {
            firedRef.current.add(`${key}-overdue`);
            sendBrowserNotification(
              'Task Overdue',
              `"${task.title}" is past its deadline.`,
              `overdue-${task.id}`
            );
            toast.warning('Task Overdue', `"${task.title}" is past its deadline.`);
          }

          // Due today
          if (isDueToday(task.deadline) && !firedRef.current.has(`${key}-due-today`)) {
            firedRef.current.add(`${key}-due-today`);
            sendBrowserNotification(
              'Task Due Today',
              `"${task.title}" is due today.`,
              `due-today-${task.id}`
            );
            toast.info('Task Due Today', `"${task.title}" is due today.`);
          }

          // Custom reminder (reminderMinutesBefore)
          if (task.reminderMinutesBefore && task.reminderMinutesBefore > 0) {
            const reminderTime = task.deadline - task.reminderMinutesBefore * 60000;
            const now = Date.now();
            const reminderKey = `${key}-reminder-${task.reminderMinutesBefore}`;

            if (now >= reminderTime && now <= task.deadline && !firedRef.current.has(reminderKey)) {
              firedRef.current.add(reminderKey);
              const minsText = task.reminderMinutesBefore >= 1440
                ? `${Math.round(task.reminderMinutesBefore / 1440)} day(s)`
                : task.reminderMinutesBefore >= 60
                ? `${Math.round(task.reminderMinutesBefore / 60)} hour(s)`
                : `${task.reminderMinutesBefore} minutes`;
              sendBrowserNotification(
                'Task Reminder',
                `"${task.title}" is due in ${minsText}.`,
                `reminder-${task.id}-${task.reminderMinutesBefore}`
              );
              toast.info('Task Reminder', `"${task.title}" is due in ${minsText}.`);
            }
          }
        }
      }

      // Habit reminders
      if (prefs.habitReminders) {
        const { habits } = useHabitStore.getState();
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (const habit of habits) {
          if (habit.archived || !habit.reminderTime) continue;

          const [hours, minutes] = habit.reminderTime.split(':').map(Number);
          const habitMinutes = hours * 60 + minutes;
          const reminderKey = `habit-${habit._id}-${today}`;

          // Fire if within 2 minutes of reminder time
          if (Math.abs(currentMinutes - habitMinutes) <= 2 && !firedRef.current.has(reminderKey)) {
            firedRef.current.add(reminderKey);
            sendBrowserNotification(
              'Habit Reminder',
              `Time for: ${habit.title}`,
              `habit-${habit._id}`
            );
            toast.info('Habit Reminder', `Time for: ${habit.title}`);
          }
        }
      }

      // Daily goal reminder — fires once per DAY (ref re-arms when the date
      // changes), after 6pm, and evaluates BOTH goals: the work goal vs work
      // focus time and the personal goal vs personal focus time.
      const goalKey = getTodayKey();
      if (prefs.dailyGoalReminder && dailyGoalFiredRef.current?.day !== goalKey) {
        const hour = new Date().getHours();
        if (hour >= 18) {
          // Work focus time today: the shared day cache (includes the live timers)
          const todayMs = getTodayTime();
          const workGoalHrs = profile.dailyGoal;

          // Evaluate in the background: the personal total needs an API fetch
          // (personal sessions live server-side, not on the task docs).
          void (async () => {
            try {
              const nowMs = Date.now();
              const sodMs = new Date(); sodMs.setHours(0, 0, 0, 0);
              const sessions = await fetchPersonalSessions();
              const personalSessionMs = sumClosedSessionMs(sessions, sodMs.getTime(), nowMs);
              const { tasks: personalTasks } = usePersonalTaskStore.getState();
              const personalMs = personalSessionMs + computeLivePersonalMs(personalTasks.map(t => t.id), nowMs);

              const unmet: { label: string; focusMs: number; goalHrs: number }[] = [];
              if (workGoalHrs > 0 && todayMs < workGoalHrs * 3600000) {
                unmet.push({ label: 'Work', focusMs: todayMs, goalHrs: workGoalHrs });
              }
              const personalGoalHrs = profile.personalDailyGoal;
              if (personalGoalHrs > 0 && personalMs < personalGoalHrs * 3600000) {
                unmet.push({ label: 'Personal', focusMs: personalMs, goalHrs: personalGoalHrs });
              }

              if (unmet.length > 0) {
                dailyGoalFiredRef.current = { day: goalKey };
                for (const g of unmet) {
                  const focusH = Math.round(g.focusMs / 3600000 * 10) / 10;
                  const remaining = Math.ceil((g.goalHrs * 3600000 - g.focusMs) / 3600000 * 10) / 10;
                  sendBrowserNotification(
                    `${g.label} Daily Goal Not Met`,
                    `You've focused ${focusH}h today. ${remaining}h remaining to reach your ${g.label.toLowerCase()} goal.`,
                    `daily-goal-${g.label.toLowerCase()}`
                  );
                  toast.warning(`${g.label} Daily Goal`, `You need ${remaining}h more to reach your ${g.label.toLowerCase()} daily goal.`);
                }
              }
            } catch { /* goal check is best-effort — retry on the next interval */ }
          })();
        }
      }
    };

    // Check immediately on mount
    check();

    // Check every 60 seconds
    const interval = setInterval(check, 60000);

    return () => clearInterval(interval);
  }, []);
}

/** Request browser notification permission explicitly */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

import { useEffect, useRef } from 'react';
import { useStore } from '@worklog/services/useStore';
import { useHabitStore } from '@worklog/services/useHabitStore';
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
  const dailyGoalFiredRef = useRef(false);

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

      // Daily goal reminder
      if (prefs.dailyGoalReminder && !dailyGoalFiredRef.current) {
        const hour = new Date().getHours();
        if (hour >= 18) {
          const todayMs = getTodayTime();
          const goalMs = profile.dailyGoal * 3600000;
          if (todayMs < goalMs) {
            dailyGoalFiredRef.current = true;
            const remaining = Math.ceil((goalMs - todayMs) / 3600000 * 10) / 10;
            sendBrowserNotification(
              'Daily Goal Not Met',
              `You've focused ${Math.round(todayMs / 3600000 * 10) / 10}h today. ${remaining}h remaining to reach your goal.`,
              'daily-goal'
            );
            toast.warning('Daily Goal', `You need ${remaining}h more to reach your daily goal.`);
          }
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

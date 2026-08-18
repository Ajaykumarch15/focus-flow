import { useEffect, useRef } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useScheduleNotificationStore } from '../store/useScheduleNotificationStore';
import { useStore } from '../store/useStore';
import { ScheduleItem, DerivedScheduleState, Task } from '../types';
import { timeToMinutes } from '../utils/scheduleAnalytics';

const POLL_INTERVAL = 30_000; // 30 seconds

/** Resolve the task object from a schedule item (populated or from store) */
function resolveTask(schedule: ScheduleItem, tasks: any[]): Task | undefined {
  if (typeof schedule.taskId === 'object' && schedule.taskId !== null) return schedule.taskId as Task;
  return tasks.find(t => t.id === schedule.taskId);
}

/** Compute the absolute start time (ms) for a schedule item */
function getScheduleStartTimeMs(item: ScheduleItem): number {
  const [y, m, d] = item.date.split('-').map(Number);
  const startMins = timeToMinutes(item.startTime);
  const h = Math.floor(startMins / 60);
  const min = startMins % 60;
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

/** Compute the absolute end time (ms) for a schedule item */
function getScheduleEndTimeMs(item: ScheduleItem): number {
  const [y, m, d] = item.date.split('-').map(Number);
  const endMins = timeToMinutes(item.endTime);
  const h = Math.floor(endMins / 60);
  const min = endMins % 60;
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

/** Derive the current schedule state based on current time + task status */
export function deriveScheduleState(item: ScheduleItem, taskObj: Task | undefined, nowMs: number): DerivedScheduleState {
  // Completed/cancelled statuses override derivation
  if (item.status === 'completed') return 'completed';
  if (item.status === 'cancelled') return 'completed';

  const startMs = getScheduleStartTimeMs(item);
  const endMs = getScheduleEndTimeMs(item);

  // If the task itself is completed, treat as completed
  if (taskObj?.status === 'completed') return 'completed';

  // Starting soon: within 5 minutes before start
  const fiveMinMs = 5 * 60 * 1000;
  if (nowMs >= startMs - fiveMinMs && nowMs < startMs) return 'starting-soon';

  // Ongoing: past start time but not yet past end time (or still active)
  if (nowMs >= startMs && nowMs <= endMs) return 'ongoing';

  // Past end time → missed (completed/cancelled already handled above)
  if (nowMs > endMs) return 'missed';

  // Before the 5-minute window → upcoming
  if (nowMs < startMs - fiveMinMs) return 'upcoming';

  return 'ongoing';
}

/** Calculate remaining minutes until start */
export function getMinutesUntilStart(item: ScheduleItem, nowMs: number): number {
  const startMs = getScheduleStartTimeMs(item);
  return Math.max(0, Math.ceil((startMs - nowMs) / 60000));
}

/** Calculate minutes elapsed since start */
export function getMinutesSinceStart(item: ScheduleItem, nowMs: number): number {
  const startMs = getScheduleStartTimeMs(item);
  return Math.max(0, Math.floor((nowMs - startMs) / 60000));
}

export { getScheduleStartTimeMs, getScheduleEndTimeMs };

/**
 * Hook that runs on an interval to:
 * 1. Derive schedule states for today's schedules
 * 2. Dispatch 5-minute and start-now notifications
 */
export function useScheduleEvaluator() {
  const { schedules, fetchSchedules } = useScheduleStore();
  const tasks = useStore(s => s.tasks);
  const { pushNotification } = useScheduleNotificationStore();
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const evaluate = () => {
    const nowMs = Date.now();
    const todayStr = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    // Evaluate today's schedules
    const todaySchedules = schedules.filter(s => s.date === todayStr && s.status !== 'cancelled');

    for (const schedule of todaySchedules) {
      const taskObj = resolveTask(schedule, tasks);
      const derived = deriveScheduleState(schedule, taskObj, nowMs);

      if (derived === 'starting-soon') {
        pushNotification({
          scheduleId: schedule._id,
          taskId: typeof schedule.taskId === 'string' ? schedule.taskId : (schedule.taskId as Task).id,
          taskTitle: taskObj?.title || 'Untitled Task',
          type: 'five-minute',
          scheduledStartTime: getScheduleStartTimeMs(schedule),
        });
      }

      if (derived === 'ongoing' && getMinutesSinceStart(schedule, nowMs) <= 2) {
        pushNotification({
          scheduleId: schedule._id,
          taskId: typeof schedule.taskId === 'string' ? schedule.taskId : (schedule.taskId as Task).id,
          taskTitle: taskObj?.title || 'Untitled Task',
          type: 'start-now',
          scheduledStartTime: getScheduleStartTimeMs(schedule),
        });
      }
    }
  };

  useEffect(() => {
    // Initial fetch + evaluate
    void fetchSchedules();
    // Slight delay to let schedules load
    const initTimer = setTimeout(evaluate, 500);

    // Periodic evaluation
    tickRef.current = setInterval(evaluate, POLL_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [schedules.length, tasks.length]);
}

/**
 * Returns a map of scheduleId → derived state for easy lookup
 */
export function useDerivedScheduleStates(scheduleItems: ScheduleItem[]): Map<string, DerivedScheduleState> {
  const tasks = useStore(s => s.tasks);
  const now = Date.now();
  const result = new Map<string, DerivedScheduleState>();
  for (const item of scheduleItems) {
    const taskObj = resolveTask(item, tasks);
    result.set(item._id, deriveScheduleState(item, taskObj, now));
  }
  return result;
}

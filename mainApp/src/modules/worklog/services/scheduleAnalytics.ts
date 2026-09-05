import { ScheduleItem } from '@shared/types';

export function timeToMinutes(timeStr?: string): number {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function getSchedulePlannedMinutes(item: ScheduleItem): number {
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);
  if (end > start) return end - start;
  return 0;
}

export interface ScheduleMetrics {
  totalTasks: number;
  completedTasks: number;
  missedTasks: number;
  plannedMinutes: number;
  completedMinutes: number;
  actualMinutes: number;
  progressPercent: number; // 0 - 100
  planningAccuracy: number; // 0 - 100
}

export function calculateScheduleMetrics(schedules: ScheduleItem[]): ScheduleMetrics {
  const activeSchedules = schedules.filter(s => s.status !== 'cancelled');
  const totalTasks = activeSchedules.length;

  let plannedMinutes = 0;
  let completedMinutes = 0;
  let actualMinutes = 0;
  let completedTasks = 0;
  let missedTasks = 0;

  for (const item of activeSchedules) {
    const planned = getSchedulePlannedMinutes(item);
    plannedMinutes += planned;

    const actual = item.actualTimeMs ? Math.round(item.actualTimeMs / 60000) : 0;
    actualMinutes += actual;

    if (item.status === 'completed') {
      completedTasks += 1;
      completedMinutes += planned;
    } else if (item.status === 'missed') {
      missedTasks += 1;
    }
  }

  const progressPercent = plannedMinutes > 0
    ? Math.min(100, Math.round((actualMinutes / plannedMinutes) * 100))
    : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

  const planningAccuracy = plannedMinutes > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (Math.abs(plannedMinutes - actualMinutes) / plannedMinutes) * 100)))
    : 100;

  return {
    totalTasks,
    completedTasks,
    missedTasks,
    plannedMinutes,
    completedMinutes,
    actualMinutes,
    progressPercent,
    planningAccuracy,
  };
}

export function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

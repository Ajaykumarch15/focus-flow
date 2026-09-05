import type { ScheduleItem, Task } from '@shared/types';

export type CalendarEventType = 'task' | 'meeting' | 'event' | 'reminder';
export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  assigneeIds?: string[];
  participantIds?: string[];
  participantNames?: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: string;
  location?: string;
  color?: string;
}

export function scheduleItemToCalendarEvent(item: ScheduleItem, task?: Task): CalendarEvent {
  const taskObj = typeof item.taskId === 'object' && item.taskId !== null ? item.taskId as Task : task;
  return {
    id: item._id,
    type: 'task',
    title: taskObj?.title || 'Untitled Task',
    description: taskObj?.description,
    date: item.date,
    startTime: item.startTime,
    endTime: item.endTime,
    taskId: taskObj?.id,
    priority: taskObj?.priority,
    status: item.status,
    color: taskObj?.color,
  };
}

export const HOUR_HEIGHT = 64;
export const START_HOUR = 8;
export const END_HOUR = 20;
export const TOTAL_HOURS = END_HOUR - START_HOUR;

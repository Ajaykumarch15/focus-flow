import { useEffect } from 'react';
import { useCalendarStore } from '@worklog/services/useCalendarStore';
import { useWorkspaceScheduleStore } from '@collab/services/useWorkspaceScheduleStore';
import type { ScheduleItem } from '@shared/types';

function scheduleToCalendarEvent(schedule: ScheduleItem) {
  const taskTitle =
    typeof schedule.taskId === 'object' && schedule.taskId !== null
      ? (schedule.taskId as any).title
      : 'Scheduled Task';
  const userName =
    typeof schedule.userId === 'object' && schedule.userId !== null
      ? (schedule.userId as any).name
      : '';

  return {
    id: `ws_schedule_${schedule._id}`,
    type: 'task' as const,
    title: userName ? `${userName}: ${taskTitle}` : taskTitle,
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    taskId: typeof schedule.taskId === 'string' ? schedule.taskId : (schedule.taskId as any)?.id,
    status: schedule.status,
    color: schedule.status === 'completed' ? '#10b981' : schedule.status === 'in-progress' ? '#f59e0b' : '#3b82f6',
  };
}

export function useWorkspaceScheduleSync() {
  const { schedules } = useWorkspaceScheduleStore();
  const { events, addEvent, updateEvent, deleteEvent } = useCalendarStore();

  useEffect(() => {
    for (const schedule of schedules) {
      if (!schedule.workspaceId) continue;
      const calendarId = `ws_schedule_${schedule._id}`;
      const existing = events.find((e) => e.id === calendarId);
      const calendarEvent = scheduleToCalendarEvent(schedule);

      if (!existing) {
        addEvent(calendarEvent);
      } else if (
        existing.title !== calendarEvent.title ||
        existing.date !== calendarEvent.date ||
        existing.startTime !== calendarEvent.startTime ||
        existing.endTime !== calendarEvent.endTime ||
        existing.status !== calendarEvent.status
      ) {
        updateEvent(calendarId, calendarEvent);
      }
    }

    const scheduleIds = new Set(
      schedules.filter((s) => s.workspaceId).map((s) => `ws_schedule_${s._id}`),
    );
    for (const event of events) {
      if (event.id.startsWith('ws_schedule_') && !scheduleIds.has(event.id)) {
        deleteEvent(event.id);
      }
    }
  }, [schedules, events, addEvent, updateEvent, deleteEvent]);
}

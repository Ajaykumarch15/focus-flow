import { useEffect } from 'react';
import { useCalendarStore } from '@worklog/services/useCalendarStore';
import { useMeetingStore } from '../services/useMeetingStore';
import type { Meeting } from '../types/meeting';

function meetingToCalendarEvent(meeting: Meeting) {
  return {
    id: `meeting_${meeting._id}`,
    type: 'meeting' as const,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location || meeting.meetingLink,
    participantIds: meeting.participantIds.map((p) => (typeof p === 'string' ? p : p._id)),
    participantNames: meeting.participantIds.map((p) => (typeof p === 'string' ? p : p.name)),
    status: meeting.status,
  };
}

export function useCalendarMeetingSync() {
  const { meetings } = useMeetingStore();
  const { events, addEvent, updateEvent, deleteEvent } = useCalendarStore();

  useEffect(() => {
    for (const meeting of meetings) {
      const calendarId = `meeting_${meeting._id}`;
      const existing = events.find((e) => e.id === calendarId);
      const calendarEvent = meetingToCalendarEvent(meeting);

      if (!existing) {
        addEvent(calendarEvent);
      } else if (
        existing.title !== calendarEvent.title ||
        existing.date !== calendarEvent.date ||
        existing.startTime !== calendarEvent.startTime ||
        existing.endTime !== calendarEvent.endTime ||
        existing.location !== calendarEvent.location
      ) {
        updateEvent(calendarId, calendarEvent);
      }
    }

    const meetingIds = new Set(meetings.map((m) => `meeting_${m._id}`));
    for (const event of events) {
      if (event.type === 'meeting' && event.id.startsWith('meeting_') && !meetingIds.has(event.id)) {
        deleteEvent(event.id);
      }
    }
  }, [meetings, events, addEvent, updateEvent, deleteEvent]);
}

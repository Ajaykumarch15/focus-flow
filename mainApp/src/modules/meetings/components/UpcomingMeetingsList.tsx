import { MeetingCard } from './MeetingCard';
import type { Meeting } from '../types/meeting';

interface UpcomingMeetingsListProps {
  meetings: Meeting[];
  onMeetingClick?: (meeting: Meeting) => void;
  onConfirm?: (meetingId: string) => void;
  onJoin?: (meeting: Meeting) => void;
}

export function UpcomingMeetingsList({
  meetings,
  onMeetingClick,
  onConfirm,
  onJoin,
}: UpcomingMeetingsListProps) {
  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-300 py-12 dark:border-surface-700">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-surface-300 dark:text-surface-600">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <p className="text-sm font-medium text-surface-400">No upcoming meetings</p>
        <p className="text-xs text-surface-400">Create a meeting to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting._id}
          meeting={meeting}
          onClick={() => onMeetingClick?.(meeting)}
          onConfirm={onConfirm ? () => onConfirm(meeting._id) : undefined}
          onJoin={onJoin ? () => onJoin(meeting) : undefined}
        />
      ))}
    </div>
  );
}

import { useMemo } from 'react';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge } from '@shared/components/ui/Badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { Meeting, MeetingParticipant } from '../types/meeting';

interface MemberAvailabilityCheckProps {
  participantIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  meetings: Meeting[];
  excludeMeetingId?: string;
}

interface ParticipantConflict {
  user: MeetingParticipant;
  conflictingMeeting: Meeting;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function hasTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

export function MemberAvailabilityCheck({
  participantIds,
  date,
  startTime,
  endTime,
  meetings,
  excludeMeetingId,
}: MemberAvailabilityCheckProps) {
  const conflicts = useMemo(() => {
    if (participantIds.length === 0 || !date || !startTime || !endTime) return [];

    const result: ParticipantConflict[] = [];

    for (const meeting of meetings) {
      if (meeting._id === excludeMeetingId) continue;
      if (meeting.date !== date) continue;
      if (meeting.status === 'cancelled') continue;

      if (!hasTimeOverlap(startTime, endTime, meeting.startTime, meeting.endTime)) continue;

      for (const participantId of participantIds) {
        const isOrganizer = typeof meeting.organizerId === 'object'
          && (meeting.organizerId as MeetingParticipant)._id === participantId;
        const isParticipant = meeting.participantIds.some((p) =>
          (typeof p === 'string' ? p : p._id) === participantId,
        );

        if (isOrganizer || isParticipant) {
          const existing = result.find((c) => c.user._id === participantId);
          if (!existing) {
            const user = meeting.participantIds.find((p) =>
              (typeof p === 'string' ? p : p._id) === participantId,
            ) as MeetingParticipant | undefined;

            if (user) {
              result.push({ user, conflictingMeeting: meeting });
            }
          }
        }
      }
    }

    return result;
  }, [participantIds, date, startTime, endTime, meetings, excludeMeetingId]);

  if (participantIds.length === 0 || conflicts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-success-500/10 px-3 py-2">
        <CheckCircle size={14} className="text-success-500" />
        <span className="text-xs text-success-600 dark:text-success-400">
          {participantIds.length === 0
            ? 'No participants selected'
            : 'All participants are available'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-warning-500/10 px-3 py-2">
        <AlertTriangle size={14} className="text-warning-500" />
        <span className="text-xs font-medium text-warning-600 dark:text-warning-400">
          {conflicts.length} participant{conflicts.length !== 1 ? 's' : ''} have scheduling conflicts
        </span>
      </div>

      <div className="space-y-1.5">
        {conflicts.map(({ user, conflictingMeeting }) => (
          <div
            key={user._id}
            className="flex items-center gap-2 rounded-lg border border-warning-500/20 bg-warning-500/5 px-3 py-2"
          >
            <Avatar src={(user as any).avatar} name={user.name} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-surface-700 dark:text-surface-300">
                {user.name}
              </p>
              <p className="truncate text-[10px] text-surface-400">
                Conflicts with: {conflictingMeeting.title} ({conflictingMeeting.startTime} - {conflictingMeeting.endTime})
              </p>
            </div>
            <Badge tone="warning" className="text-[9px]">Conflict</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

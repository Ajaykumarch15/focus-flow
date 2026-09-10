import { useMemo } from 'react';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge } from '@shared/components/ui/Badge';
import type { Meeting, MeetingParticipant } from '../types/meeting';
import { Users } from 'lucide-react';

interface MeetingMembersListProps {
  meetings: Meeting[];
  onMemberClick?: (userId: string) => void;
}

interface MemberStats {
  user: MeetingParticipant;
  meetingCount: number;
  upcomingCount: number;
  status: 'active' | 'inactive';
}

export function MeetingMembersList({ meetings, onMemberClick }: MeetingMembersListProps) {
  const memberStats = useMemo(() => {
    const statsMap = new Map<string, MemberStats>();
    const today = new Date().toISOString().split('T')[0];

    for (const meeting of meetings) {
      if (meeting.status === 'cancelled') continue;

      const participants = [
        meeting.organizerId,
        ...meeting.participantIds,
      ].filter(Boolean);

      for (const participant of participants) {
        const id = typeof participant === 'string' ? participant : participant._id;
        const user = typeof participant === 'string'
          ? { _id: id, name: 'Unknown', email: '', avatar: undefined }
          : participant;

        if (!statsMap.has(id)) {
          statsMap.set(id, {
            user,
            meetingCount: 0,
            upcomingCount: 0,
            status: 'inactive',
          });
        }

        const stats = statsMap.get(id)!;
        stats.meetingCount++;

        if (meeting.date >= today && (meeting.status === 'scheduled' || meeting.status === 'confirmed')) {
          stats.upcomingCount++;
          stats.status = 'active';
        }
      }
    }

    return Array.from(statsMap.values())
      .sort((a, b) => b.meetingCount - a.meetingCount)
      .slice(0, 10);
  }, [meetings]);

  if (memberStats.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-3 flex items-center gap-2">
          <Users size={16} className="text-surface-400" />
          <h3 className="text-sm font-bold text-surface-800 dark:text-surface-100">Meeting Members</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Users size={32} className="mb-2 text-surface-300 dark:text-surface-600" />
          <p className="text-xs text-surface-400">No members yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-surface-400" />
          <h3 className="text-sm font-bold text-surface-800 dark:text-surface-100">Meeting Members</h3>
        </div>
        <Badge tone="neutral" className="text-[10px]">{memberStats.length}</Badge>
      </div>

      <div className="space-y-1">
        {memberStats.map(({ user, meetingCount, upcomingCount, status }) => (
          <button
            key={user._id}
            onClick={() => onMemberClick?.(user._id)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800"
          >
            <div className="relative">
              <Avatar src={(user as any).avatar} name={user.name} size="sm" />
              {status === 'active' && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-success-500 dark:border-surface-900" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-surface-700 dark:text-surface-300">
                {user.name}
              </p>
              <p className="truncate text-[10px] text-surface-400">
                {meetingCount} meeting{meetingCount !== 1 ? 's' : ''}
                {upcomingCount > 0 && ` · ${upcomingCount} upcoming`}
              </p>
            </div>
            {status === 'active' && (
              <Badge tone="success" className="text-[9px]">Active</Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

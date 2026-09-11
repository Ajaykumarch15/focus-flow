import { cn } from '@shared/utils/cn';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { AvatarGroup } from '@shared/components/ui/Avatar';
import type { Meeting, MeetingStatus } from '../types/meeting';
import { MEETING_STATUS_LABELS } from '../types/meeting';

const STATUS_TONE: Record<MeetingStatus, BadgeTone> = {
  scheduled: 'info',
  confirmed: 'success',
  in_progress: 'brand',
  completed: 'neutral',
  cancelled: 'danger',
};

function formatDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diffMin = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMin <= 0) return '0 min';
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + ' min' : ''}`.trim() : `${m} min`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
  onConfirm?: () => void;
  onJoin?: () => void;
  className?: string;
}

export function MeetingCard({ meeting, onClick, onConfirm, onJoin, className }: MeetingCardProps) {
  const participants = meeting.participantIds || [];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-surface-200 p-3 transition-all hover:border-brand-500/30 hover:bg-surface-50 dark:border-surface-800 dark:hover:border-brand-500/30 dark:hover:bg-surface-850',
        className,
      )}
    >
      <div className="flex w-20 flex-col items-center justify-center rounded-lg bg-surface-100 py-2 dark:bg-surface-800">
        <span className="text-sm font-bold text-surface-700 dark:text-surface-200">
          {formatTime(meeting.startTime)}
        </span>
        <span className="text-[10px] text-surface-400">
          {formatDuration(meeting.startTime, meeting.endTime)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AvatarGroup
          items={participants.map((p) => ({ src: (p as any).avatar, name: (p as any).name }))}
          max={3}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-surface-800 dark:text-surface-100">
            {meeting.title}
          </p>
          {meeting.location && (
            <p className="truncate text-xs text-surface-400">{meeting.location}</p>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-3 sm:flex">
        <span className="text-xs text-surface-400">{meeting.date}</span>
        <Badge tone={STATUS_TONE[meeting.status]}>
          {MEETING_STATUS_LABELS[meeting.status]}
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        {meeting.status === 'scheduled' && onConfirm && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-success-500/10 hover:text-success-500"
            title="Confirm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
        {meeting.meetingLink && meeting.status !== 'completed' && meeting.status !== 'cancelled' && onJoin && (
          <button
            onClick={(e) => { e.stopPropagation(); onJoin(); }}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-brand-500/10 hover:text-brand-500"
            title="Join meeting"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l5 5-5 5" />
              <path d="M4 4v7a4 4 0 004 4h12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

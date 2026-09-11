import { Avatar } from '@shared/components/ui/Avatar';
import { Badge } from '@shared/components/ui/Badge';
import { useMeetingTimer } from '../hooks/useMeetingTimer';
import type { Meeting } from '../types/meeting';

interface ActiveCallBannerProps {
  meeting: Meeting;
  onStop?: () => void;
  onJoin?: () => void;
}

export function ActiveCallBanner({ meeting, onStop, onJoin }: ActiveCallBannerProps) {
  const { formatted } = useMeetingTimer(meeting.startTime, meeting.date, meeting.status === 'in_progress');
  const organizer = meeting.organizerId;

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-500/10 via-surface-50 to-cyan-500/10 p-4 dark:from-brand-500/20 dark:via-surface-900 dark:to-cyan-500/15">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar
              src={(organizer as any).avatar}
              name={(organizer as any).name}
              size="lg"
            />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-surface-900" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              {(organizer as any).name}
            </p>
            <p className="text-xs text-surface-400">
              {(organizer as any).location || 'Active meeting'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-surface-500">|| Stop</span>
            <span className="font-mono text-sm font-bold text-surface-700 dark:text-surface-200">
              {formatted}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onStop && (
              <button
                onClick={onStop}
                className="rounded-full bg-danger-500 p-2.5 text-white shadow-lg hover:bg-danger-600 transition-colors"
                title="End meeting"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 004.73.89 2 2 0 012 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            )}
            {onJoin && (
              <button
                onClick={onJoin}
                className="rounded-full bg-success-500 p-2.5 text-white shadow-lg hover:bg-success-600 transition-colors"
                title="Join call"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l5 5-5 5" />
                  <path d="M4 4v7a4 4 0 004 4h12" />
                </svg>
              </button>
            )}
            <button
              className="rounded-full bg-surface-200 p-2.5 text-surface-600 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600 transition-colors"
              title="Toggle microphone"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="brand">Active Call</Badge>
        </div>
      </div>
    </div>
  );
}

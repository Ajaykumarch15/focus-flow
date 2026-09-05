import { cn } from '@shared/utils/cn';
import type { CalendarEvent, CalendarEventType } from '@worklog/types/calendar';
import { timeToMinutes } from '@worklog/services/scheduleAnalytics';
import { START_HOUR, HOUR_HEIGHT } from '@worklog/types/calendar';

const TYPE_STYLES: Record<CalendarEventType, { bg: string; border: string; text: string }> = {
  task: {
    bg: 'bg-brand-500/15 dark:bg-brand-500/10',
    border: 'border-l-brand-500',
    text: 'text-brand-700 dark:text-brand-300',
  },
  meeting: {
    bg: 'bg-blue-500/15 dark:bg-blue-500/10',
    border: 'border-l-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
  },
  event: {
    bg: 'bg-purple-500/15 dark:bg-purple-500/10',
    border: 'border-l-purple-500',
    text: 'text-purple-700 dark:text-purple-300',
  },
  reminder: {
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/10',
    border: 'border-l-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
};

function formatTime12(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

interface CalendarEventCardProps {
  event: CalendarEvent;
  style?: React.CSSProperties;
  onClick?: () => void;
  className?: string;
}

export function CalendarEventCard({ event, style, onClick, className }: CalendarEventCardProps) {
  const styles = TYPE_STYLES[event.type];
  const startMins = timeToMinutes(event.startTime);
  const endMins = timeToMinutes(event.endTime);
  const duration = Math.max(endMins - startMins, 15);
  const top = (startMins - START_HOUR * 60) * (HOUR_HEIGHT / 60);
  const height = duration * (HOUR_HEIGHT / 60);

  return (
    <button
      type="button"
      onClick={onClick}
      style={style ?? { top, height: Math.max(height, 24) }}
      className={cn(
        'absolute left-0.5 right-1 rounded-lg border-l-[3px] px-2 py-1 text-left cursor-pointer',
        'transition-all duration-150 hover:brightness-95 hover:shadow-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
        'overflow-hidden flex flex-col justify-start',
        styles.bg,
        styles.border,
        className,
      )}
    >
      <span className={cn('text-[10px] font-semibold leading-tight truncate', styles.text)}>
        {formatTime12(event.startTime)} – {formatTime12(event.endTime)}
      </span>
      <span className="text-xs font-bold text-surface-800 dark:text-surface-100 leading-tight mt-0.5 line-clamp-2">
        {event.title}
      </span>
      {event.projectName && height > 40 && (
        <span className="text-[9px] text-surface-500 dark:text-surface-400 leading-tight mt-0.5 truncate">
          {event.projectName}
        </span>
      )}
    </button>
  );
}

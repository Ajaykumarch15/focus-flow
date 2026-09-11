import { cn } from '@shared/utils/cn';

interface MeetingDatePickerProps {
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  onDateChange: (date: string) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onAllDayChange: (allDay: boolean) => void;
  canEdit?: boolean;
  className?: string;
}

export function MeetingDatePicker({
  date,
  startTime,
  endTime,
  allDay,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onAllDayChange,
  canEdit = true,
  className,
}: MeetingDatePickerProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-surface-400">Date & Time</label>
        <label className="flex items-center gap-2 text-xs text-surface-400">
          <span>All day</span>
          <button
            type="button"
            onClick={() => canEdit && onAllDayChange(!allDay)}
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors',
              allDay ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-600',
              !canEdit && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                allDay ? 'left-[18px]' : 'left-0.5',
              )}
            />
          </button>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={!canEdit}
          className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
        />
      </div>

      {!allDay && (
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            disabled={!canEdit}
            className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
          />
          <span className="text-surface-400">→</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            disabled={!canEdit}
            className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
          />
        </div>
      )}
    </div>
  );
}

import { cn } from '@shared/utils/cn';

interface DayInfo {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

interface DayHeadersProps {
  days: DayInfo[];
  className?: string;
}

export function DayHeaders({ days, className }: DayHeadersProps) {
  return (
    <div className={cn('grid grid-cols-7 border-b border-surface-800/60', className)}>
      {days.map((day) => (
        <div
          key={day.date}
          className={cn(
            'flex flex-col items-center py-2.5 border-r border-surface-800/60 last:border-r-0',
          )}
        >
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider',
            day.isToday ? 'text-brand-400' : 'text-surface-500',
          )}>
            {day.dayName}
          </span>
          <span className={cn(
            'mt-0.5 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold',
            day.isToday
              ? 'bg-brand-500 text-white'
              : 'text-surface-200',
          )}>
            {day.dayNumber}
          </span>
        </div>
      ))}
    </div>
  );
}

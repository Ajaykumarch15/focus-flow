import { useMemo } from 'react';
import { cn } from '@shared/utils/cn';
import type { CalendarEvent, CalendarEventType } from '@worklog/types/calendar';

const TYPE_DOT: Record<CalendarEventType, string> = {
  task: 'bg-brand-500',
  meeting: 'bg-blue-500',
  event: 'bg-purple-500',
  reminder: 'bg-emerald-500',
};

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: string) => void;
}

function getMonthDays(year: number, month: number): Array<{ date: string; day: number; isCurrentMonth: boolean; isToday: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday=0
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: Array<{ date: string; day: number; isCurrentMonth: boolean; isToday: boolean }> = [];

  // Previous month padding
  const prevLast = new Date(year, month, 0);
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast.getDate() - i;
    const m = month; // 1-indexed (month is already 0-indexed input, but prevLast month is correct)
    const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, day: d, isCurrentMonth: false, isToday: dateStr === todayStr });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, day: d, isCurrentMonth: true, isToday: dateStr === todayStr });
  }

  // Next month padding
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month + 2; // next month (1-indexed)
    const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, day: d, isCurrentMonth: false, isToday: dateStr === todayStr });
  }

  return cells;
}

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function MonthView({ year, month, events, onEventClick, onDayClick }: MonthViewProps) {
  const cells = useMemo(() => getMonthDays(year, month), [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  return (
    <div className="border border-surface-800/60 rounded-2xl bg-surface-900 overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-surface-800/60">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-2 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.date) || [];
          const maxShow = 3;

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onDayClick(cell.date)}
              className={cn(
                'min-h-[80px] p-1.5 border-r border-b border-surface-800/40 text-left',
                'hover:bg-surface-850/50 transition-colors cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                !cell.isCurrentMonth && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold',
                  cell.isToday
                    ? 'bg-brand-500 text-white'
                    : 'text-surface-300',
                )}
              >
                {cell.day}
              </span>

              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, maxShow).map((event) => (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onEventClick(event);
                      }
                    }}
                    className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-semibold text-surface-200 hover:bg-surface-800/60 truncate cursor-pointer"
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', TYPE_DOT[event.type])} />
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
                {dayEvents.length > maxShow && (
                  <span className="text-[9px] font-semibold text-surface-500 px-1">
                    +{dayEvents.length - maxShow} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

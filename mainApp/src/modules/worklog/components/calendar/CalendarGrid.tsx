import { useState, useEffect, useMemo, useCallback } from 'react';
import { TimeAxis } from './TimeAxis';
import { DayHeaders } from './DayHeaders';
import { CalendarEventCard } from './CalendarEventCard';
import { START_HOUR, END_HOUR, HOUR_HEIGHT, type CalendarEvent } from '@worklog/types/calendar';
import { timeToMinutes } from '@worklog/services/scheduleAnalytics';

interface DayInfo {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

interface CalendarGridProps {
  days: DayInfo[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: string, startTime: string) => void;
}

function eventsForDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => e.date === date);
}

function layoutOverlapping(events: CalendarEvent[]): Array<{ event: CalendarEvent; left: number; width: number }> {
  if (events.length === 0) return [];
  const sorted = [...events].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );

  const columns: CalendarEvent[][] = [];
  for (const event of sorted) {
    const start = timeToMinutes(event.startTime);
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1];
      if (timeToMinutes(lastInCol.endTime) <= start) {
        columns[col].push(event);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([event]);
    }
  }

  const totalCols = columns.length;
  const result: Array<{ event: CalendarEvent; left: number; width: number }> = [];
  for (let col = 0; col < columns.length; col++) {
    for (const event of columns[col]) {
      result.push({
        event,
        left: (col / totalCols) * 100,
        width: (1 / totalCols) * 100 - 1,
      });
    }
  }
  return result;
}

export function CalendarGrid({ days, events, onEventClick, onSlotClick }: CalendarGridProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  const currentTimeTop = useMemo(() => {
    const d = new Date(now);
    const mins = d.getHours() * 60 + d.getMinutes();
    if (mins < START_HOUR * 60 || mins > END_HOUR * 60) return null;
    return (mins - START_HOUR * 60) * (HOUR_HEIGHT / 60);
  }, [now]);

  const todayDateStr = useMemo(() => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [now]);

  const handleSlotClick = useCallback(
    (date: string, hour: number) => {
      const startTime = `${String(hour).padStart(2, '0')}:00`;
      onSlotClick(date, startTime);
    },
    [onSlotClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, date: string, hour: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSlotClick(date, hour);
      }
    },
    [handleSlotClick],
  );

  return (
    <div className="flex flex-col border border-surface-800/60 rounded-2xl bg-surface-900 overflow-hidden">
      {/* Day headers */}
      <DayHeaders days={days} />

      {/* Grid body */}
      <div className="flex overflow-y-auto" style={{ maxHeight: 640 }}>
        {/* Time axis */}
        <TimeAxis className="border-r border-surface-800/60" />

        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7 relative">
          {/* Hour grid lines */}
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-surface-800/40"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
            />
          ))}

          {/* Day columns with events */}
          {days.map((day) => {
            const dayEvents = eventsForDay(events, day.date);
            const laid = layoutOverlapping(dayEvents);
            const isTodayCol = day.date === todayDateStr;

            return (
              <div
                key={day.date}
                className="relative border-r border-surface-800/40 last:border-r-0"
                style={{ height: totalHeight }}
              >
                {/* Hour click zones */}
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map((hour) => (
                  <div
                    key={hour}
                    role="button"
                    tabIndex={0}
                    aria-label={`Create event at ${hour}:00 on ${day.dayName} ${day.dayNumber}`}
                    className="absolute left-0 right-0 cursor-pointer hover:bg-brand-500/5 transition-colors"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    onClick={() => handleSlotClick(day.date, hour)}
                    onKeyDown={(e) => handleKeyDown(e, day.date, hour)}
                  />
                ))}

                {/* Events */}
                {laid.map(({ event, left, width }) => (
                  <CalendarEventCard
                    key={event.id}
                    event={event}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: (timeToMinutes(event.startTime) - START_HOUR * 60) * (HOUR_HEIGHT / 60),
                      height: Math.max(
                        (timeToMinutes(event.endTime) - timeToMinutes(event.startTime)) * (HOUR_HEIGHT / 60),
                        24,
                      ),
                    }}
                    onClick={() => onEventClick(event)}
                  />
                ))}

                {/* Current time indicator */}
                {isTodayCol && currentTimeTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="w-2 h-2 rounded-full bg-brand-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-[2px] bg-brand-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

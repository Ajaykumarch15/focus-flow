import { START_HOUR, END_HOUR, HOUR_HEIGHT } from '@worklog/types/calendar';

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

interface TimeAxisProps {
  className?: string;
}

export function TimeAxis({ className }: TimeAxisProps) {
  const hours: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hours.push(h);
  }

  return (
    <div className={`relative shrink-0 ${className ?? ''}`} style={{ width: 56 }}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="relative border-t border-surface-800/60"
          style={{ height: HOUR_HEIGHT }}
        >
          <span className="absolute -top-2.5 right-2 text-[10px] font-mono text-surface-500 select-none">
            {formatHour(hour)}
          </span>
        </div>
      ))}
    </div>
  );
}

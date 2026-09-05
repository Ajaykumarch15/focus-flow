import { Calendar } from 'lucide-react';

export type DateRangePreset = 'today' | 'week' | 'month' | 'last7' | 'last30' | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  start: Date;
  end: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r;
}

export function getDateRange(preset: DateRangePreset, customStart?: string, customEnd?: string): DateRangeValue {
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case 'today':
      return { preset, start: today, end: endOfDay(now), label: 'Today' };

    case 'week': {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(today); monday.setDate(today.getDate() - diff);
      return { preset, start: monday, end: endOfDay(now), label: 'This Week' };
    }

    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { preset, start: first, end: endOfDay(now), label: 'This Month' };
    }

    case 'last7': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { preset, start: d, end: endOfDay(now), label: 'Last 7 Days' };
    }

    case 'last30': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { preset, start: d, end: endOfDay(now), label: 'Last 30 Days' };
    }

    case 'custom': {
      const s = customStart ? startOfDay(new Date(customStart)) : today;
      const e = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now);
      return { preset, start: s, end: e, label: 'Custom Range' };
    }

    default:
      return { preset: 'last7', start: today, end: endOfDay(now), label: 'Last 7 Days' };
  }
}

export function getComparisonRange(range: DateRangeValue): DateRangeValue {
  const ms = range.end.getTime() - range.start.getTime();
  const compEnd = new Date(range.start.getTime() - 1);
  const compStart = new Date(compEnd.getTime() - ms);
  return { ...range, start: compStart, end: compEnd, label: `Previous ${range.label.replace('This ', '').replace('Last ', '')}` };
}

interface DateRangeSelectorProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
  customStart?: string;
  customEnd?: string;
  onCustomChange?: (start: string, end: string) => void;
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangeSelector({ value, onChange, customStart, customEnd, onCustomChange }: DateRangeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-surface-400">
        <Calendar size={14} />
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map(p => (
          <button key={p.value} onClick={() => onChange(p.value)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              value === p.value
                ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      {value === 'custom' && onCustomChange && (
        <div className="flex items-center gap-2 ml-1">
          <input type="date" value={customStart || ''} onChange={e => onCustomChange(e.target.value, customEnd || '')}
            className="px-2 py-1 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-xs" />
          <span className="text-surface-500 text-xs">to</span>
          <input type="date" value={customEnd || ''} onChange={e => onCustomChange(customStart || '', e.target.value)}
            className="px-2 py-1 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-xs" />
        </div>
      )}
    </div>
  );
}

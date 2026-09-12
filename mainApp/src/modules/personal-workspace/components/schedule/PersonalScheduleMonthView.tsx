import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { getScheduledState } from '@personal/services/personalTaskSchedule';
import type { Task } from '@shared/types';

const DAYS_IN_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getMonthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface PersonalScheduleMonthViewProps {
  selectedDate: Date;
  onDateSelect?: (date: Date) => void;
}

export function PersonalScheduleMonthView({ selectedDate, onDateSelect }: PersonalScheduleMonthViewProps) {
  const { tasks } = usePersonalTaskStore();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(selectedDate.getMonth());
  const [year, setYear] = useState(selectedDate.getFullYear());

  // Group tasks by date string
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.scheduledDate) {
        const d = new Date(t.scheduledDate);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
      if (t.deadline && t.status !== 'completed') {
        const d = new Date(t.deadline);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        // Avoid duplicates
        const existing = map.get(key)!;
        if (!existing.find(e => e.id === t.id)) existing.push(t);
      }
    }
    return map;
  }, [tasks]);

  const monthDays = getMonthDays(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getMonthDays(year, month - 1);

  const cells: { day: number; currentMonth: boolean; key: string; dateKey: string }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, currentMonth: false, key: `p${d}`, dateKey: `${y}-${m}-${d}` });
  }
  for (let d = 1; d <= monthDays; d++) {
    cells.push({ day: d, currentMonth: true, key: `c${d}`, dateKey: `${year}-${month}-${d}` });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ day: d, currentMonth: false, key: `n${d}`, dateKey: `${y}-${m}-${d}` });
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-emerald-400',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-surface-50">{MONTH_NAMES[month]} {year}</h3>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900/60 p-3">
        <div className="grid grid-cols-7 gap-1">
          {DAYS_IN_WEEK.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-surface-500 pb-2">{d}</div>
          ))}
          {cells.map(cell => {
            const isToday = cell.currentMonth && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayTasks = tasksByDate.get(cell.dateKey) || [];
            const hasOverdue = dayTasks.some(t => t.status !== 'completed' && getScheduledState(t) === 'missed');

            return (
              <button
                key={cell.key}
                onClick={() => {
                  if (cell.currentMonth && onDateSelect) {
                    const [y, m, d] = cell.dateKey.split('-').map(Number);
                    onDateSelect(new Date(y, m, d));
                  }
                }}
                className={`relative min-h-[72px] p-1.5 rounded-xl text-left transition-all ${
                  isToday ? 'bg-brand-500/15 border border-brand-500/40' :
                  cell.currentMonth ? 'hover:bg-surface-800/50 border border-transparent hover:border-surface-700' :
                  'border border-transparent opacity-30'
                }`}
              >
                <span className={`text-[11px] font-bold block mb-1 ${
                  isToday ? 'text-brand-400' : cell.currentMonth ? 'text-surface-400' : 'text-surface-700'
                }`}>
                  {cell.day}
                </span>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map(t => (
                    <div key={t.id} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[t.priority] || 'bg-surface-500'}`} />
                      <span className="text-[9px] text-surface-400 truncate leading-tight">{t.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[8px] text-surface-600">+{dayTasks.length - 3} more</span>
                  )}
                </div>
                {hasOverdue && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CompactCalendarWidgetProps {
  taskDates?: string[];
}

export function CompactCalendarWidget({ taskDates = [] }: CompactCalendarWidgetProps) {
  const [currentDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const todayStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  const taskDateSet = useMemo(() => new Set(taskDates), [taskDates]);

  const days = useMemo(() => {
    const result: Array<{ day: number; dateStr: string; isToday: boolean; hasTask: boolean; isCurrentMonth: boolean }> = [];
    
    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      const prevMonthDays = new Date(year, month, 0).getDate();
      const day = prevMonthDays - firstDayOfMonth + i + 1;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.push({ day, dateStr, isToday: false, hasTask: false, isCurrentMonth: false });
    }

    // Add days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.push({
        day,
        dateStr,
        isToday: dateStr === todayStr,
        hasTask: taskDateSet.has(dateStr),
        isCurrentMonth: true,
      });
    }

    return result;
  }, [daysInMonth, firstDayOfMonth, year, month, todayStr, taskDateSet]);

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-surface-800 bg-surface-900 p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-surface-100">{monthName}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-7 h-7 rounded-lg hover:bg-surface-800 flex items-center justify-center transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} className="text-surface-400" />
          </button>
          <button
            onClick={nextMonth}
            className="w-7 h-7 rounded-lg hover:bg-surface-800 flex items-center justify-center transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={14} className="text-surface-400" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-surface-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((dayInfo, idx) => (
          <div
            key={idx}
            className={`
              relative w-full aspect-square flex items-center justify-center text-xs rounded-lg
              ${!dayInfo.isCurrentMonth ? 'text-surface-600' : 'text-surface-300'}
              ${dayInfo.isToday ? 'bg-brand-500 text-white font-bold' : ''}
              ${dayInfo.hasTask && !dayInfo.isToday ? 'font-semibold text-surface-100' : ''}
            `}
          >
            {dayInfo.day}
            {dayInfo.hasTask && !dayInfo.isToday && (
              <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

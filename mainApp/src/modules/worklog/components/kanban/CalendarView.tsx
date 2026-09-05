import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useKanbanStore } from './kanbanStore';
import { KANBAN_COLUMNS } from './types';
import type { KanbanTask } from './types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_DOT: Record<string, string> = {
  todo: 'bg-surface-400',
  doing: 'bg-orange-400',
  review: 'bg-blue-400',
  done: 'bg-emerald-400',
};

export function CalendarView() {
  const { tasks, openDetailsPanel } = useKanbanStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const tasksByDate = useMemo(() => {
    const map: Record<string, KanbanTask[]> = {};
    for (const task of tasks) {
      if (task.dueDate) {
        const d = task.dueDate.slice(0, 10);
        if (!map[d]) map[d] = [];
        map[d].push(task);
      }
    }
    return map;
  }, [tasks]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dateKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const selectedTasks = selectedDate ? tasksByDate[selectedDate] ?? [] : [];

  return (
    <div className="flex gap-6">
      {/* Calendar grid */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-surface-50">
            {MONTH_NAMES[month]} {year}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-surface-500 uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const key = dateKey(d);
            const dayTasks = tasksByDate[key] ?? [];
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            const isSelected = selectedDate === key;

            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : key)}
                className={`relative flex flex-col items-center p-2 rounded-xl text-xs transition-all min-h-[72px] ${
                  isSelected
                    ? 'bg-brand-500/10 border border-brand-500/30 text-brand-400'
                    : isToday
                    ? 'bg-surface-800 border border-surface-700 text-surface-50'
                    : 'text-surface-400 hover:bg-surface-850 border border-transparent'
                }`}
              >
                <span className={`font-medium ${isToday ? 'text-brand-400' : ''}`}>{d}</span>
                {dayTasks.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                    {dayTasks.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.status]}`}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[8px] text-surface-500">+{dayTasks.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date sidebar */}
      {selectedDate && (
        <div className="w-72 flex-shrink-0">
          <h4 className="text-sm font-bold text-surface-50 mb-3">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h4>
          {selectedTasks.length === 0 ? (
            <p className="text-xs text-surface-500">No tasks due on this date.</p>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map((task) => {
                const colTitle = KANBAN_COLUMNS.find((c) => c.id === task.status)?.title ?? task.status;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openDetailsPanel(task.id)}
                    className="w-full text-left p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-all"
                  >
                    <p className="text-xs font-bold text-surface-50 mb-1">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                      <span className="text-[10px] text-surface-400">{colTitle}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

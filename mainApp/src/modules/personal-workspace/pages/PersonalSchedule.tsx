import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { PersonalScheduleDayView } from '@personal/components/schedule/PersonalScheduleDayView';
import { PersonalScheduleWeekView } from '@personal/components/schedule/PersonalScheduleWeekView';
import { ScheduleTaskModal } from '@personal/components/schedule/ScheduleTaskModal';
import { getWeekDates, todayKey } from '@personal/services/personalTaskSchedule';

type ViewMode = 'day' | 'week';

const fadeUp = { hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0 } };

export function PersonalSchedule() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const navigateDay = (delta: number) => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const navigateWeek = (delta: number) => {
    setWeekOffset(prev => prev + delta);
  };

  const jumpToToday = () => {
    setSelectedDate(new Date());
    setWeekOffset(0);
  };

  const isToday = useMemo(() => todayKey(selectedDate) === todayKey(), [selectedDate]);

  const dateLabel = useMemo(() => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
    }
    const start = weekDates[0];
    const end = weekDates[6];
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }, [viewMode, selectedDate, weekDates]);

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Calendar size={20} />
            </span>
            Schedule
          </h1>
          <p className="text-sm text-surface-400 mt-1">Plan your days and weeks</p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)} leftIcon={<Plus size={14} />}>
          Schedule Task
        </Button>
      </motion.div>

      {/* Toolbar */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        {/* View toggle + Date nav */}
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'day' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'week' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              Week
            </button>
          </div>

          {/* Navigation arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => viewMode === 'day' ? navigateDay(-1) : navigateWeek(-1)}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => viewMode === 'day' ? navigateDay(1) : navigateWeek(1)}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Date label + Today button */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-surface-200">{dateLabel}</span>
          {!isToday && (
            <Button variant="ghost" size="xs" onClick={jumpToToday} className="text-brand-400 hover:text-brand-300">
              Today
            </Button>
          )}
        </div>
      </motion.div>

      {/* View content */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        {viewMode === 'day' ? (
          <PersonalScheduleDayView selectedDate={selectedDate} />
        ) : (
          <PersonalScheduleWeekView weekDates={weekDates} />
        )}
      </motion.div>

      {/* Schedule modal */}
      <ScheduleTaskModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

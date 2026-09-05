import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Search, Plus,
  Calendar as CalendarIcon, Star, Users, Bell,
  ArrowLeft, CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore, getTodayDateString } from '@worklog/services/useScheduleStore';
import { useStore } from '@worklog/services/useStore';
import { useCalendarStore } from '@worklog/services/useCalendarStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { CalendarGrid } from '@worklog/components/calendar/CalendarGrid';
import { MonthView } from '@worklog/components/calendar/MonthView';
import { QuickCreatePopover } from '@worklog/components/calendar/QuickCreatePopover';
import { EventDetailsDrawer } from '@worklog/components/calendar/EventDetailsDrawer';
import { CreateCalendarEventModal } from '@worklog/components/calendar/CreateCalendarEventModal';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Button } from '@shared/components/ui/Button';
import type { CalendarEvent, CalendarView, CalendarEventType } from '@worklog/types/calendar';
import { scheduleItemToCalendarEvent } from '@worklog/types/calendar';

const fadeUp = { hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const CATEGORY_TABS: Array<{ key: CalendarEventType | 'all'; label: string; icon: typeof CalendarIcon }> = [
  { key: 'all', label: 'All Scheduled', icon: CalendarIcon },
  { key: 'event', label: 'Events', icon: Star },
  { key: 'meeting', label: 'Meetings', icon: Users },
  { key: 'reminder', label: 'Task Reminders', icon: Bell },
];

function shiftDate(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offset);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getWeekDates(dateStr: string): string[] {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(y, m - 1, d + mondayOffset);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(
      `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];
  const fmt = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };
  return `${fmt(first)} – ${fmt(last)} ${first.split('-')[0]}`;
}

function formatMonthLabel(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function CalendarPage() {
  const navigate = useNavigate();
  const { schedules } = useScheduleStore();
  const { tasks } = useStore();
  const {
    events: localEvents,
    viewMode,
    selectedDate,
    categoryFilter,
    searchQuery,
    setViewMode,
    setSelectedDate,
    setCategoryFilter,
    setSearchQuery,
    openModal,
    modalDefaults,
    isModalOpen,
    closeModal,
    openDetails,
  } = useCalendarStore();
  const { members } = useCollaborationStore();

  const [quickCreate, setQuickCreate] = useState<{ open: boolean; date: string; startTime: string }>({
    open: false,
    date: '',
    startTime: '',
  });

  // Merge task schedules + local events into unified CalendarEvent[]
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const taskEvents = schedules
      .filter((s) => s.status !== 'cancelled')
      .map((s) => {
        const task = typeof s.taskId === 'object' && s.taskId !== null
          ? s.taskId as typeof tasks[0]
          : tasks.find((t) => t.id === s.taskId);
        return scheduleItemToCalendarEvent(s, task);
      });
    return [...taskEvents, ...localEvents];
  }, [schedules, localEvents, tasks]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = allEvents;

    if (categoryFilter !== 'all') {
      result = result.filter((e) => e.type === categoryFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          (e.projectName || '').toLowerCase().includes(q),
      );
    }

    return result;
  }, [allEvents, categoryFilter, searchQuery]);

  // Week dates
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  // Week days info for grid
  const weekDays = useMemo(() => {
    const todayStr = getTodayDateString();
    return weekDates.map((date) => {
      const [y, m, d] = date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return {
        date,
        dayName: DAY_NAMES[(dt.getDay() + 6) % 7],
        dayNumber: d,
        isToday: date === todayStr,
      };
    });
  }, [weekDates]);

  // Month data
  const monthYear = useMemo(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    return { year: y, month: m - 1 };
  }, [selectedDate]);

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      openDetails(event);
    },
    [openDetails],
  );

  const handleSlotClick = useCallback(
    (date: string, startTime: string) => {
      setQuickCreate({ open: true, date, startTime });
    },
    [],
  );

  const handleMonthDayClick = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setViewMode('day');
    },
    [setSelectedDate, setViewMode],
  );

  const handlePrev = () => {
    if (viewMode === 'week') setSelectedDate(shiftDate(selectedDate, -7));
    else if (viewMode === 'day') setSelectedDate(shiftDate(selectedDate, -1));
    else {
      const [y, m] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      dt.setMonth(dt.getMonth() - 1);
      setSelectedDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`);
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') setSelectedDate(shiftDate(selectedDate, 7));
    else if (viewMode === 'day') setSelectedDate(shiftDate(selectedDate, 1));
    else {
      const [y, m] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      dt.setMonth(dt.getMonth() + 1);
      setSelectedDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`);
    }
  };

  const handleToday = () => setSelectedDate(getTodayDateString());

  const dateLabel =
    viewMode === 'week'
      ? formatDateRange(weekDates)
      : viewMode === 'day'
        ? (() => {
            const [y, m, d] = selectedDate.split('-').map(Number);
            return new Date(y, m - 1, d).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });
          })()
        : formatMonthLabel(selectedDate);

  const memberAvatars = members.slice(0, 3);
  const overflowCount = Math.max(0, members.length - 3);

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky header bar */}
      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800"
            >
              <ArrowLeft size={14} /> Home
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-brand-500/10">
                <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover dark:hidden" />
                <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover hidden dark:block" />
              </div>
              <div>
                <h1 className="font-display font-bold text-sm leading-none text-surface-50">Calendar</h1>
                <p className="text-[10px] text-surface-400 font-medium mt-0.5">Scheduling workspace</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Member avatars */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-xs">
              <div className="flex -space-x-1.5">
                {memberAvatars.map((m) => (
                  <div
                    key={m.id}
                    className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-500/20 to-cyan-500/15 flex items-center justify-center text-[7px] font-bold text-brand-600 dark:text-brand-300 ring-2 ring-surface-900"
                  >
                    {m.name.charAt(0)}
                  </div>
                ))}
              </div>
              {overflowCount > 0 && (
                <span className="text-surface-400 font-medium">+{overflowCount}</span>
              )}
            </div>
            <button
              onClick={() => {}}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-surface-300 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-1.5 rounded-xl border border-surface-800"
            >
              Invite
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 relative z-10">
        {/* Page header */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <h2 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">
              Calendar
            </h2>
            <p className="text-sm text-surface-400 mt-0.5">
              Stay organized and on track with your personalized calendar.
            </p>
          </div>
        </motion.div>

        {/* Category tabs + Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Category tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  categoryFilter === tab.key
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850 border border-transparent'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-surface-50 outline-none transition-colors placeholder:text-surface-500"
              />
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-surface-400 hover:text-surface-200 hover:bg-surface-850 border border-surface-800 transition-colors"
            >
              Filter
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-xl text-surface-400 hover:text-surface-200 hover:bg-surface-850 border border-surface-800 transition-colors"
            >
              •••
            </button>
            <Button onClick={() => openModal()} leftIcon={<Plus size={14} />} size="sm">
              New
            </Button>
          </div>
        </div>

        {/* Date navigation + View switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-850 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-850 transition-colors"
                aria-label="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <h3 className="text-sm font-display font-bold text-surface-100">{dateLabel}</h3>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1 bg-surface-900 border border-surface-800 rounded-xl p-0.5">
            {(['day', 'week', 'month'] as CalendarView[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === mode
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar views */}
        {allEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
          >
            <EmptyState
              icon={<CalendarDays size={40} className="text-surface-500" />}
              title="No scheduled items"
              description="Your calendar is clear. Add a task, meeting, event, or reminder."
              action={
                <Button onClick={() => openModal()} leftIcon={<Plus size={14} />}>
                  New Event
                </Button>
              }
            />
          </motion.div>
        ) : viewMode === 'month' ? (
          <MonthView
            year={monthYear.year}
            month={monthYear.month}
            events={filteredEvents}
            onEventClick={handleEventClick}
            onDayClick={handleMonthDayClick}
          />
        ) : viewMode === 'week' ? (
          <div className="relative">
            <CalendarGrid
              days={weekDays}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
            <QuickCreatePopover
              open={quickCreate.open}
              date={quickCreate.date}
              startTime={quickCreate.startTime}
              onClose={() => setQuickCreate({ open: false, date: '', startTime: '' })}
            />
          </div>
        ) : (
          /* Day view — reuse week grid with single day */
          <div className="relative">
            <CalendarGrid
              days={weekDays.filter((d) => d.date === selectedDate)}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
            <QuickCreatePopover
              open={quickCreate.open}
              date={quickCreate.date}
              startTime={quickCreate.startTime}
              onClose={() => setQuickCreate({ open: false, date: '', startTime: '' })}
            />
          </div>
        )}
      </main>

      {/* Drawers & Modals */}
      <EventDetailsDrawer />
      <CreateCalendarEventModal
        open={isModalOpen}
        onClose={closeModal}
        defaults={modalDefaults}
      />
    </div>
  );
}

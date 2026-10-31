import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Rocket,
  LayoutGrid,
  Bell,
  Sparkles,
  X,
  Settings,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useScheduleStore, getTodayDateString } from '@worklog/services/useScheduleStore';
import { useStore } from '@worklog/services/useStore';
import { useWorkHours } from '@shared/hooks/useWorkHours';
import { ScheduleModal } from '@personal/components/schedule/ScheduleModal';
import { ScheduleCard } from '@personal/components/schedule/ScheduleCard';
import { SortableScheduleCard } from '@worklog/components/schedule/SortableScheduleCard';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NoScheduledTasks, NoScheduledThisWeek } from '@shared/components/illustrations';
import { calculateScheduleMetrics, formatMinutes, timeToMinutes } from '@worklog/services/scheduleAnalytics';
import type { DerivedScheduleState } from '@shared/types';
import { deriveScheduleState as deriveState } from '@shared/hooks/useScheduleEvaluator';
import { useScheduleNotificationStore } from '@worklog/services/useScheduleNotificationStore';
import { getAutoStartPreference, setAutoStartPreference } from '@shared/hooks/useScheduleEvaluator';
import { RecoveryDrawer } from '@worklog/components/schedule/RecoveryDrawer';
import { ExtendRescheduleDialog } from '@worklog/components/schedule/ExtendRescheduleDialog';
import { toast } from '@shared/services/useToastStore';

// Helper to format date label (e.g. "Monday, August 17")
function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Helper to shift date string by offset days
function shiftDate(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offsetDays);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get week dates (Monday to Sunday) for selected date
function getWeekDates(selectedDateStr: string): string[] {
  const [y, m, d] = selectedDateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dayOfWeek = dt.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(y, m - 1, d + mondayOffset);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(
      `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
    );
  }
  return dates;
}

// Section header
function SectionHeader({ icon: Icon, label, color, count }: { icon: any; label: string; color: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4">
      <Icon size={14} className={color} />
      <span className="text-xs font-bold uppercase tracking-wider text-surface-400">{label}</span>
      <span className="text-[10px] bg-surface-800 text-surface-500 px-1.5 py-0.5 rounded-full">{count}</span>
    </div>
  );
}

// Format "HH:mm" to 12-hr label
function minutesToTimeStr(mins: number): string {
  // Clamp to valid intra-day range [0, 1439] to prevent silent midnight wrap-around.
  // Used for values that get written back to the API (must stay within 00:00-23:59).
  const clamped = Math.max(0, Math.min(1439, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function SchedulePage() {
  const tasks = useStore(s => s.tasks);
  const {
    schedules,
    selectedDate,
    viewMode,
    isModalOpen,
    setSelectedDate,
    setViewMode,
    openModal,
    closeModal,
    fetchSchedules,
    updateSchedule,
  } = useScheduleStore();
  const { requestBrowserPermission, browserPermission } = useScheduleNotificationStore();
  const { workHours, setWorkHours, totalWorkingMinutes, endMinutes } = useWorkHours();
  const [now, setNow] = useState(Date.now());
  const [showWorkHoursSettings, setShowWorkHoursSettings] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(getAutoStartPreference);
  const [showRecovery, setShowRecovery] = useState(false);

  // Refs for outside-click dismissal of popovers
  const workHoursRef = useRef<HTMLDivElement>(null);

  // Refresh clock every 10s for live current-time indicator
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // Dismiss popovers when clicking outside them
  useEffect(() => {
    if (!showWorkHoursSettings) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (workHoursRef.current && !workHoursRef.current.contains(target)) {
        setShowWorkHoursSettings(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showWorkHoursSettings]);

  // Determine date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const weekDates = getWeekDates(selectedDate);
      return { from: weekDates[0], to: weekDates[6] };
    }
    return { from: selectedDate, to: selectedDate };
  }, [selectedDate, viewMode]);

  useEffect(() => {
    void fetchSchedules(dateRange);
  }, [dateRange.from, dateRange.to, fetchSchedules]);

  // Filter and sort schedules for the selected date
  const daySchedules = useMemo(() => {
    return schedules
      .filter(s => s.date === selectedDate && s.status !== 'cancelled')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules, selectedDate]);

  // Available Capacity Calculation (merges overlapping intervals so double-booked
  // time isn't counted twice, which previously caused false over-capacity warnings)
  const capacityMetrics = useMemo(() => {
    const intervals = daySchedules
      .map(s => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }))
      .filter(iv => iv.end > iv.start)
      .sort((a, b) => a.start - b.start);

    let scheduledMins = 0;
    let mergedStart = -1;
    let mergedEnd = -1;
    for (const iv of intervals) {
      if (mergedEnd === -1 || iv.start > mergedEnd) {
        if (mergedEnd !== -1) scheduledMins += mergedEnd - mergedStart;
        mergedStart = iv.start;
        mergedEnd = iv.end;
      } else {
        mergedEnd = Math.max(mergedEnd, iv.end);
      }
    }
    if (mergedEnd !== -1) scheduledMins += mergedEnd - mergedStart;

    const freeMins = Math.max(0, totalWorkingMinutes - scheduledMins);
    // Guard against division-by-zero when work hours are misconfigured (start === end).
    const capacityPercent = totalWorkingMinutes > 0 ? Math.min(100, Math.round((scheduledMins / totalWorkingMinutes) * 100)) : 0;
    const isOverCapacity = totalWorkingMinutes > 0 && scheduledMins > totalWorkingMinutes;

    return { totalWorkingMinutes, scheduledMins, freeMins, capacityPercent, isOverCapacity };
  }, [daySchedules, totalWorkingMinutes]);

  // Next up schedule item
  const nextUpSchedule = useMemo(() => {
    const todayStr = getTodayDateString();
    if (selectedDate !== todayStr) return null;
    const nowMins = new Date(now).getHours() * 60 + new Date(now).getMinutes();
    return daySchedules.find(s => timeToMinutes(s.startTime) > nowMins && s.status !== 'completed');
  }, [daySchedules, selectedDate, now]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Derive states for all schedules
  const derivedMap = useMemo(() => {
    const map = new Map<string, DerivedScheduleState>();
    for (const item of daySchedules) {
      const taskObj = typeof item.taskId === 'object' ? item.taskId as any : tasks.find(t => t.id === item.taskId);
      map.set(item._id, deriveState(item, taskObj, now));
    }
    return map;
  }, [daySchedules, tasks, now]);

  // Categorize schedules
  const categorized = useMemo(() => {
    const groups: Record<DerivedScheduleState, typeof daySchedules> = {
      'starting-soon': [],
      'upcoming': [],
      'ongoing': [],
      'completed': [],
      'missed': [],
    };
    for (const item of daySchedules) {
      const state = derivedMap.get(item._id) || 'upcoming';
      groups[state].push(item);
    }
    return groups;
  }, [daySchedules, derivedMap]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const upcomingItems = categorized.upcoming;
    const oldIndex = upcomingItems.findIndex((s) => s._id === active.id);
    const newIndex = upcomingItems.findIndex((s) => s._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(upcomingItems, oldIndex, newIndex);

    // Anchor the sequence to the earliest start time in the original list.
    // This prevents the first item from inheriting its own (potentially wrong) start time
    // after the reorder changes which item is first.
    const anchorMins = Math.min(...upcomingItems.map(s => timeToMinutes(s.startTime)));
    let runningEnd = anchorMins;

    for (let i = 0; i < reordered.length; i++) {
      const item = reordered[i];
      const duration = Math.max(0, timeToMinutes(item.endTime) - timeToMinutes(item.startTime));
      const newStart = runningEnd;
      const newEnd = newStart + duration;
      // Don't push tasks past the end of working hours.
      if (newEnd > endMinutes) break;
      if (newStart !== timeToMinutes(item.startTime)) {
        const updated = await updateSchedule(item._id, {
          startTime: minutesToTimeStr(newStart),
          endTime: minutesToTimeStr(newEnd),
        });
        // Stop shifting if the update failed, so we don't compute later times
        // from a stale anchor (which left the list half-rescheduled).
        if (!updated) {
          toast.error('Reorder failed', `Could not reschedule "${item.taskId && typeof item.taskId === 'object' ? (item.taskId as any).title : 'task'}".`);
          break;
        }
      }
      runningEnd = newEnd;
    }
  }, [categorized.upcoming, updateSchedule, endMinutes]);

  // Week schedules for week view
  const weekSchedules = useMemo(() => {
    if (viewMode !== 'week') return [];
    return schedules
      .filter(s => s.date >= dateRange.from && s.date <= dateRange.to && s.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [schedules, viewMode, dateRange]);

  const metrics = calculateScheduleMetrics(daySchedules);

  // Date navigation
  const handlePrev = () => setSelectedDate(shiftDate(selectedDate, -1));
  const handleNext = () => setSelectedDate(shiftDate(selectedDate, 1));
  const handleToday = () => setSelectedDate(getTodayDateString());

  const isToday = selectedDate === getTodayDateString();

  // Current time label for live line
  const currentTimeLabel = useMemo(() => {
    const dt = new Date(now);
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [now]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-6 max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">Schedule Workspace</h1>
          <p className="text-sm text-surface-400 mt-0.5">Plan, execute, adapt and recover your day</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {browserPermission !== 'granted' && (
            <Button variant="ghost" size="sm" onClick={requestBrowserPermission} className="gap-1.5 text-xs">
              <Bell size={14} /> Enable Notifications
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newVal = !autoStartEnabled;
              setAutoStartEnabled(newVal);
              setAutoStartPreference(newVal);
            }}
            className={`gap-1.5 text-xs ${autoStartEnabled ? 'text-emerald-400' : 'text-surface-400'}`}
            title={autoStartEnabled ? 'Auto-start timer enabled' : 'Auto-start timer disabled'}
          >
            <Timer size={14} /> Auto-Start {autoStartEnabled ? 'On' : 'Off'}
          </Button>
          <Button onClick={() => openModal()} className="gap-2">
            <Plus size={16} /> Schedule
          </Button>
        </div>
      </div>

      {/* Capacity Indicator Bar */}
      <div className="p-3 bg-surface-900 border border-surface-800 rounded-2xl flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-surface-500 block">Available</span>
            <span className="font-semibold text-surface-200">{formatMinutes(capacityMetrics.totalWorkingMinutes)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-surface-500 block">Scheduled</span>
            <span className="font-semibold text-brand-400">{formatMinutes(capacityMetrics.scheduledMins)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-surface-500 block">Free</span>
            <span className="font-semibold text-emerald-400">{formatMinutes(capacityMetrics.freeMins)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={workHoursRef}>
            <button
              onClick={() => setShowWorkHoursSettings(!showWorkHoursSettings)}
              className="text-surface-500 hover:text-surface-300 transition-colors"
              title="Work hours settings"
            >
              <Settings size={14} />
            </button>
            {showWorkHoursSettings && (
              <div className="absolute right-0 top-full mt-2 z-40 w-80 p-3 bg-surface-900 border border-surface-800 rounded-xl text-xs space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-surface-200">Work Hours</span>
                  <button onClick={() => setShowWorkHoursSettings(false)} className="text-surface-500 hover:text-surface-300">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-surface-400">From</span>
                    <select
                      value={workHours.startHour}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= workHours.endHour) {
                          toast.warning('Invalid hours', 'Start hour must be before the end hour.');
                          return;
                        }
                        setWorkHours(val, workHours.endHour);
                      }}
                      className="bg-surface-950 border border-surface-700 rounded-lg px-2 py-1 text-surface-200 outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-surface-500">to</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={workHours.endHour}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val <= workHours.startHour) {
                          toast.warning('Invalid hours', 'End hour must be after the start hour.');
                          return;
                        }
                        setWorkHours(workHours.startHour, val);
                      }}
                      className="bg-surface-950 border border-surface-700 rounded-lg px-2 py-1 text-surface-200 outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-surface-500 ml-2">({formatMinutes(Math.max(0, workHours.endHour - workHours.startHour) * 60)})</span>
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-surface-400 block">Capacity</span>
            <span className={`font-bold ${capacityMetrics.isOverCapacity ? 'text-red-400' : 'text-surface-100'}`}>
              {capacityMetrics.capacityPercent}%
            </span>
          </div>
          <div className="w-24 h-2 bg-surface-950 rounded-full overflow-hidden border border-surface-800">
            <div
              className={`h-full transition-all ${capacityMetrics.isOverCapacity ? 'bg-red-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.min(100, capacityMetrics.capacityPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Over Capacity Warning Alert */}
      {capacityMetrics.isOverCapacity && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <span>⚠️ OVER CAPACITY: You are scheduling more than {formatMinutes(capacityMetrics.totalWorkingMinutes)} of work for today.</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowRecovery(true)} className="text-xs text-red-200 hover:text-white">
            Recovery Mode
          </Button>
        </div>
      )}

      {/* Date Nav + View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrev} aria-label="Previous day">
            <ChevronLeft size={16} />
          </Button>
          <div className="text-center min-w-[200px]">
            <p className="text-sm font-semibold text-surface-200">{formatDateLabel(selectedDate)}</p>
            {!isToday && (
              <button onClick={handleToday} className="text-[10px] text-brand-400 hover:text-brand-300 mt-0.5">
                Jump to today
              </button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleNext} aria-label="Next day">
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg p-0.5">
          <Button
            variant={viewMode === 'day' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            className="gap-1.5 text-xs"
          >
            <CalendarIcon size={14} /> Day
          </Button>
          <Button
            variant={viewMode === 'week' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            className="gap-1.5 text-xs"
          >
            <LayoutGrid size={14} /> Week
          </Button>
        </div>
      </div>

      {/* Live Current Time Indicator */}
      {isToday && (
        <div className="relative flex items-center my-3 text-xs text-brand-400 font-semibold" aria-label={`Current time: ${currentTimeLabel}`}>
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-ping mr-2 flex-shrink-0" />
          <span className="bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/30">
            NOW {currentTimeLabel}
          </span>
          <div className="flex-1 h-px bg-brand-500/30 ml-2" />
        </div>
      )}

      {/* Next Up Banner */}
      {nextUpSchedule && (
        <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-surface-100">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-400 flex-shrink-0" />
            <div>
              <span className="font-bold text-brand-300 uppercase tracking-wider text-[10px] block">NEXT UP AT {nextUpSchedule.startTime}</span>
              <span className="font-semibold text-surface-100 truncate">
                {typeof nextUpSchedule.taskId === 'object' ? (nextUpSchedule.taskId as any).title : 'Scheduled Task'}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const t = nextUpSchedule.taskId;
              const tid = typeof t === 'string' ? t : ((t as any).id ?? (t as any)._id);
              openModal(tid);
            }}
            className="text-xs py-1 h-auto"
          >
            View / Edit
          </Button>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <>
          {daySchedules.length === 0 ? (
            <EmptyState
              illustration={<NoScheduledTasks />}
              title="No scheduled tasks"
              description="Schedule your tasks to plan focused work sessions for this day."
              action={
                <Button onClick={() => openModal()} className="gap-2">
                  <Plus size={14} /> Schedule Task
                </Button>
              }
            />
          ) : (
            <div className="space-y-1">
              <AnimatePresence>
                {/* Starting Soon */}
                {categorized['starting-soon'].length > 0 && (
                  <motion.div key="group-starting-soon" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <SectionHeader icon={Timer} label="Starting Soon" color="text-amber-400" count={categorized['starting-soon'].length} />
                    {categorized['starting-soon'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="starting-soon" />
                    ))}
                  </motion.div>
                )}

                {/* Ongoing */}
                {categorized['ongoing'].length > 0 && (
                  <motion.div key="group-ongoing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <SectionHeader icon={Rocket} label="Ongoing" color="text-brand-400" count={categorized['ongoing'].length} />
                    {categorized['ongoing'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="ongoing" />
                    ))}
                  </motion.div>
                )}

                {/* Upcoming */}
                {categorized.upcoming.length > 0 && (
                  <motion.div key="group-upcoming" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <SectionHeader icon={Clock} label="Upcoming" color="text-sky-400" count={categorized.upcoming.length} />
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={categorized.upcoming.map((s) => s._id)} strategy={verticalListSortingStrategy}>
                        {categorized.upcoming.map((s) => (
                          <div key={s._id} className="relative">
                            <SortableScheduleCard schedule={s} derivedState="upcoming" />
                          </div>
                        ))}
                      </SortableContext>
                    </DndContext>
                  </motion.div>
                )}

                {/* Completed */}
                {categorized['completed'].length > 0 && (
                  <motion.div key="group-completed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <SectionHeader icon={CheckCircle2} label="Completed" color="text-emerald-400" count={categorized['completed'].length} />
                    {categorized['completed'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="completed" />
                    ))}
                  </motion.div>
                )}

                {/* Missed */}
                {categorized['missed'].length > 0 && (
                  <motion.div key="group-missed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <SectionHeader icon={AlertTriangle} label="Missed" color="text-red-400" count={categorized['missed'].length} />
                    {categorized['missed'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="missed" />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Detailed Summary Card */}
          {daySchedules.length > 0 && (
            <Card className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
                <div>
                  <p className="text-base font-bold text-surface-50">{metrics.totalTasks}</p>
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">Scheduled</p>
                </div>
                <div>
                  <p className="text-base font-bold text-emerald-400">{metrics.completedTasks}</p>
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">Completed</p>
                </div>
                <div>
                  <p className="text-base font-bold text-surface-50">{formatMinutes(metrics.plannedMinutes)}</p>
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">Planned</p>
                </div>
                <div>
                  <p className="text-base font-bold text-amber-400">{formatMinutes(metrics.actualMinutes)}</p>
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">Worked</p>
                </div>
                <div>
                  <p className="text-base font-bold text-sky-400">{formatMinutes(Math.max(0, metrics.plannedMinutes - metrics.actualMinutes))}</p>
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">Remaining</p>
                </div>
                <div>
                  <p className="text-base font-bold text-brand-400">{metrics.progressPercent}%</p>
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">Progress</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          {/* Week Overview Bar */}
          {weekSchedules.length > 0 && (() => {
            const weekDates = getWeekDates(selectedDate);
            let weekTotalScheduled = 0;
            let weekTotalCapacity = totalWorkingMinutes * 7;
            for (const date of weekDates) {
              const dayItems = weekSchedules.filter(s => s.date === date);
              for (const s of dayItems) {
                const mins = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
                if (mins > 0) weekTotalScheduled += mins;
              }
            }
            const weekPercent = Math.min(100, Math.round((weekTotalScheduled / weekTotalCapacity) * 100));
            return (
              <div className="p-3 bg-surface-900 border border-surface-800 rounded-xl flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-surface-500 block">Week Planned</span>
                    <span className="font-semibold text-surface-200">{formatMinutes(weekTotalScheduled)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-surface-500 block">Week Capacity</span>
                    <span className="font-semibold text-surface-400">{formatMinutes(weekTotalCapacity)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${weekPercent > 100 ? 'text-red-400' : 'text-surface-100'}`}>{weekPercent}%</span>
                  <div className="w-24 h-2 bg-surface-950 rounded-full overflow-hidden border border-surface-800">
                    <div
                      className={`h-full transition-all ${weekPercent > 100 ? 'bg-red-500' : 'bg-brand-500'}`}
                      style={{ width: `${Math.min(100, weekPercent)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {weekSchedules.length === 0 ? (
            <EmptyState
              illustration={<NoScheduledThisWeek />}
              title="No scheduled tasks this week"
              description="Schedule tasks across the week to plan ahead."
            />
          ) : (
            (() => {
              const byDate = new Map<string, typeof weekSchedules>();
              for (const s of weekSchedules) {
                const arr = byDate.get(s.date) || [];
                arr.push(s);
                byDate.set(s.date, arr);
              }

              return [...byDate.entries()].map(([date, items]) => {
                const dayScheduledMins = items.reduce((sum, s) => {
                  const mins = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
                  return sum + (mins > 0 ? mins : 0);
                }, 0);
                const dayPercent = Math.min(100, Math.round((dayScheduledMins / totalWorkingMinutes) * 100));
                const isToday = date === getTodayDateString();

                return (
                  <Card key={date} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => { setSelectedDate(date); setViewMode('day'); }}
                        className="text-xs font-bold text-surface-400 uppercase tracking-wider hover:text-surface-200 transition-colors text-left"
                      >
                        {formatDateLabel(date)}
                        {isToday && <span className="ml-2 text-brand-400">(Today)</span>}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-surface-500">{formatMinutes(dayScheduledMins)} scheduled</span>
                        <div className="w-16 h-1.5 bg-surface-950 rounded-full overflow-hidden border border-surface-800">
                          <div
                            className={`h-full transition-all ${dayPercent > 100 ? 'bg-red-500' : 'bg-brand-500'}`}
                            style={{ width: `${Math.min(100, dayPercent)}%` }}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            // Select this card's date first, so the modal opens for the right day.
                            setSelectedDate(date);
                            openModal();
                          }}
                          className="text-[10px] px-2 py-0.5 h-auto text-brand-400 hover:text-brand-300"
                        >
                          + Schedule
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {items.map(s => {
                        const taskObj = typeof s.taskId === 'object' ? s.taskId as any : tasks.find(t => t.id === s.taskId);
                        const derived = deriveState(s, taskObj, now);
                        return <ScheduleCard key={s._id} schedule={s} derivedState={derived} />;
                      })}
                    </div>
                  </Card>
                );
              });
            })()
          )}
        </div>
      )}

      <ScheduleModal isOpen={isModalOpen} onClose={closeModal} />
      <ExtendRescheduleDialog />
      <RecoveryDrawer
        isOpen={showRecovery}
        onClose={() => setShowRecovery(false)}
        scheduledMinutes={capacityMetrics.scheduledMins}
        totalWorkingMinutes={capacityMetrics.totalWorkingMinutes}
      />
    </div>
  );
}

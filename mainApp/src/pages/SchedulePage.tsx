import { useEffect, useMemo, useState } from 'react';
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
  CalendarDays,
  Bell,
  Sparkles,
  Inbox,
  Wand2,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useScheduleStore, getTodayDateString } from '../store/useScheduleStore';
import { useStore } from '../store/useStore';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { ScheduleCard } from '../components/schedule/ScheduleCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { calculateScheduleMetrics, formatMinutes, timeToMinutes } from '../utils/scheduleAnalytics';
import type { DerivedScheduleState, Task, ScheduleItem } from '../types';
import { deriveScheduleState as deriveState } from '../hooks/useScheduleEvaluator';
import { useScheduleNotificationStore } from '../store/useScheduleNotificationStore';
import { mlApi } from '../utils/mlApi';

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
function formatTime12(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function SchedulePage() {
  const { tasks } = useStore();
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
    createSchedule,
    updateSchedule,
  } = useScheduleStore();
  const { requestBrowserPermission, browserPermission } = useScheduleNotificationStore();
  const [now, setNow] = useState(Date.now());

  // Interactive modes
  const [showPlanMyDay, setShowPlanMyDay] = useState(false);
  const [proposedPlan, setProposedPlan] = useState<{ task: Task; start: string; end: string; predMins: number; slotScore?: number; reason?: string }[]>([]);

  // Refresh clock every 10s for live current-time indicator
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

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
  }, [dateRange.from, dateRange.to]);

  // Filter and sort schedules for the selected date
  const daySchedules = useMemo(() => {
    return schedules
      .filter(s => s.date === selectedDate && s.status !== 'cancelled')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules, selectedDate]);

  // Available Capacity Calculation (Default day: 8:00 to 20:00 = 12h = 720 mins)
  const capacityMetrics = useMemo(() => {
    const totalWorkingMins = 12 * 60; // 720 mins
    let scheduledMins = 0;
    for (const s of daySchedules) {
      const startMins = timeToMinutes(s.startTime);
      const endMins = timeToMinutes(s.endTime);
      if (endMins > startMins) scheduledMins += (endMins - startMins);
    }
    const freeMins = Math.max(0, totalWorkingMins - scheduledMins);
    const capacityPercent = Math.min(100, Math.round((scheduledMins / totalWorkingMins) * 100));
    const isOverCapacity = scheduledMins > totalWorkingMins;

    return { totalWorkingMins, scheduledMins, freeMins, capacityPercent, isOverCapacity };
  }, [daySchedules]);

  // Available Slots calculation
  const availableSlots = useMemo(() => {
    const dayIntervals = daySchedules.map(s => ({
      start: timeToMinutes(s.startTime),
      end: timeToMinutes(s.endTime),
    })).sort((a, b) => a.start - b.start);

    const workStart = 8 * 60; // 08:00
    const workEnd = 20 * 60;  // 20:00
    const slots: { start: number; end: number; startStr: string; endStr: string; durationMins: number }[] = [];

    let current = workStart;
    for (const b of dayIntervals) {
      if (b.start > current && (b.start - current) >= 30) {
        slots.push({
          start: current,
          end: b.start,
          startStr: minutesToTimeStr(current),
          endStr: minutesToTimeStr(b.start),
          durationMins: b.start - current,
        });
      }
      current = Math.max(current, b.end);
    }
    if (workEnd > current && (workEnd - current) >= 30) {
      slots.push({
        start: current,
        end: workEnd,
        startStr: minutesToTimeStr(current),
        endStr: minutesToTimeStr(workEnd),
        durationMins: workEnd - current,
      });
    }
    return slots;
  }, [daySchedules]);

  // Unscheduled tasks pool
  const unscheduledTasks = useMemo(() => {
    const scheduledTaskIds = new Set(
      schedules
        .filter(s => s.status !== 'cancelled')
        .map(s => typeof s.taskId === 'object' ? (s.taskId as any).id || (s.taskId as any)._id : s.taskId)
    );
    return tasks.filter(t => t.status !== 'completed' && !scheduledTaskIds.has(t.id));
  }, [tasks, schedules]);

  // Next up schedule item
  const nextUpSchedule = useMemo(() => {
    const todayStr = getTodayDateString();
    if (selectedDate !== todayStr) return null;
    const nowMins = new Date(now).getHours() * 60 + new Date(now).getMinutes();
    return daySchedules.find(s => timeToMinutes(s.startTime) > nowMins && s.status !== 'completed');
  }, [daySchedules, selectedDate, now]);

  // Generate Plan My Day proposal using Python ML API
  const handleGeneratePlanMyDay = async () => {
    try {
      const examples = await mlApi.getExamples();
      const hourlyStats = await mlApi.getHourlyStats(examples);
      const explicitPrefs = await mlApi.getPreferences();

      const eligibleTasks = [...unscheduledTasks].sort((a, b) => {
        const pOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (pOrder[b.priority] || 2) - (pOrder[a.priority] || 2);
      });

      const proposal: { task: Task; start: string; end: string; predMins: number; slotScore: number; reason: string }[] = [];
      let currentMins = availableSlots[0] ? availableSlots[0].start : 9 * 60;

      for (const task of eligibleTasks) {
        if (proposal.length >= 4) break;
        const pred = await mlApi.predictDuration(task, examples);
        const duration = pred.predicted_minutes;
        const startStr = minutesToTimeStr(currentMins);
        const endStr = minutesToTimeStr(currentMins + duration);
        const slotRating = await mlApi.scoreSlot(startStr, endStr, task, examples, hourlyStats, explicitPrefs);
        if (slotRating.score === 0) {
          currentMins += 60;
          continue;
        }
        proposal.push({ task, start: startStr, end: endStr, predMins: duration, slotScore: slotRating.score, reason: slotRating.reason });
        currentMins += duration + 15;
      }

      setProposedPlan(proposal);
      setShowPlanMyDay(true);
    } catch (e: any) {
      console.error('Plan My Day failed:', e);
    }
  };

  const handleApplyProposedPlan = async () => {
    for (const item of proposedPlan) {
      await createSchedule({
        taskId: item.task.id,
        date: selectedDate,
        startTime: item.start,
        endTime: item.end,
      });
    }
    setShowPlanMyDay(false);
    setProposedPlan([]);
  };

  // Schedule Swap Handler
  const handleSwapSchedules = async (s1: ScheduleItem, s2: ScheduleItem) => {
    const s1Start = s1.startTime;
    const s1End = s1.endTime;
    const s2Start = s2.startTime;
    const s2End = s2.endTime;

    await updateSchedule(s1._id, { startTime: s2Start, endTime: s2End });
    await updateSchedule(s2._id, { startTime: s1Start, endTime: s1End });
  };

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto space-y-6">
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
          <Button variant="secondary" size="sm" onClick={handleGeneratePlanMyDay} className="gap-1.5 text-xs">
            <Wand2 size={14} className="text-brand-400" /> Plan My Day
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
            <span className="font-semibold text-surface-200">{formatMinutes(capacityMetrics.totalWorkingMins)}</span>
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
            <span>⚠️ OVER CAPACITY: You are scheduling more than {formatMinutes(capacityMetrics.totalWorkingMins)} of work for today.</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowRecoveryMode(true)} className="text-xs text-red-200 hover:text-white">
            Recovery Mode
          </Button>
        </div>
      )}

      {/* Plan My Day Modal Drawer */}
      {showPlanMyDay && proposedPlan.length > 0 && (
        <div className="p-4 bg-brand-500/10 border border-brand-500/30 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-brand-400" />
              <h3 className="text-xs font-bold text-brand-200 uppercase tracking-wider">Proposed Day Plan</h3>
            </div>
            <button onClick={() => setShowPlanMyDay(false)} className="text-surface-400 hover:text-surface-200">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {proposedPlan.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-surface-950 rounded-xl border border-surface-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-brand-400 font-semibold">{item.start} – {item.end}</span>
                    <span className="font-medium text-surface-100">{item.task.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.slotScore !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        item.slotScore >= 0.75 ? 'bg-emerald-500/20 text-emerald-300' :
                        item.slotScore >= 0.5 ? 'bg-amber-500/20 text-amber-300' :
                        'bg-surface-800 text-surface-400'
                      }`}>
                        {Math.round(item.slotScore * 100)}%
                      </span>
                    )}
                    <span className="text-[10px] bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">{item.task.priority}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-500">{item.predMins}m estimated</span>
                  {item.reason && <span className="text-[10px] text-surface-500 italic truncate max-w-[60%]">{item.reason}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={() => setShowPlanMyDay(false)}>
              Adjust
            </Button>
            <Button size="sm" onClick={handleApplyProposedPlan}>
              Apply Plan
            </Button>
          </div>
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
          <Button size="sm" onClick={() => openModal(typeof nextUpSchedule.taskId === 'string' ? nextUpSchedule.taskId : (nextUpSchedule.taskId as any).id)} className="text-xs py-1 h-auto">
            View / Edit
          </Button>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <>
          {daySchedules.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon size={24} />}
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
              <AnimatePresence mode="popLayout">
                {/* Starting Soon */}
                {categorized['starting-soon'].length > 0 && (
                  <div key="group-starting-soon">
                    <SectionHeader icon={Timer} label="Starting Soon" color="text-amber-400" count={categorized['starting-soon'].length} />
                    {categorized['starting-soon'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="starting-soon" />
                    ))}
                  </div>
                )}

                {/* Ongoing */}
                {categorized['ongoing'].length > 0 && (
                  <div key="group-ongoing">
                    <SectionHeader icon={Rocket} label="Ongoing" color="text-brand-400" count={categorized['ongoing'].length} />
                    {categorized['ongoing'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="ongoing" />
                    ))}
                  </div>
                )}

                {/* Upcoming */}
                {categorized['upcoming'].length > 0 && (
                  <div key="group-upcoming">
                    <SectionHeader icon={Clock} label="Upcoming" color="text-sky-400" count={categorized['upcoming'].length} />
                    {categorized['upcoming'].map((s, idx, arr) => (
                      <div key={s._id} className="relative group">
                        <ScheduleCard schedule={s} derivedState="upcoming" />
                        {idx < arr.length - 1 && (
                          <button
                            onClick={() => handleSwapSchedules(s, arr[idx + 1])}
                            className="absolute right-2 -bottom-2.5 z-20 opacity-0 group-hover:opacity-100 bg-surface-800 hover:bg-surface-700 border border-surface-600 rounded-full p-1 text-[10px] text-surface-200 flex items-center gap-1 transition-all shadow"
                            title="Swap with next task"
                          >
                            <ArrowUpDown size={12} /> Swap
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Available Slots Bar */}
                {availableSlots.length > 0 && (
                  <div key="group-available-slots" className="my-3 p-2.5 bg-surface-900/60 border border-surface-800/80 rounded-xl space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider flex items-center gap-1">
                      <Clock size={12} className="text-brand-400" /> Available Free Time
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {availableSlots.map((slot, idx) => (
                        <button
                          key={`${slot.start}-${slot.end}-${idx}`}
                          onClick={() => openModal()}
                          className="text-[11px] bg-surface-950 hover:bg-surface-800 border border-surface-700/60 px-2.5 py-1 rounded-lg text-surface-300 hover:text-surface-100 transition-colors flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>AVAILABLE {formatTime12(slot.startStr)} – {formatTime12(slot.endStr)} ({formatMinutes(slot.durationMins)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {categorized['completed'].length > 0 && (
                  <div key="group-completed">
                    <SectionHeader icon={CheckCircle2} label="Completed" color="text-emerald-400" count={categorized['completed'].length} />
                    {categorized['completed'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="completed" />
                    ))}
                  </div>
                )}

                {/* Missed */}
                {categorized['missed'].length > 0 && (
                  <div key="group-missed">
                    <SectionHeader icon={AlertTriangle} label="Missed" color="text-red-400" count={categorized['missed'].length} />
                    {categorized['missed'].map(s => (
                      <ScheduleCard key={s._id} schedule={s} derivedState="missed" />
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Unscheduled Pool */}
          {unscheduledTasks.length > 0 && (
            <div className="p-4 bg-surface-900/80 border border-surface-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox size={16} className="text-brand-400" />
                  <h3 className="text-xs font-bold text-surface-200 uppercase tracking-wider">Needs Scheduling</h3>
                  <span className="text-[10px] bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">{unscheduledTasks.length} tasks</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unscheduledTasks.slice(0, 4).map(t => (
                  <div key={t.id} className="p-2.5 bg-surface-950/80 border border-surface-800/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-medium text-surface-200 truncate pr-2">{t.title}</span>
                    <Button size="sm" variant="ghost" onClick={() => openModal(t.id)} className="text-xs px-2 py-1 h-auto text-brand-400 hover:text-brand-300">
                      + Schedule
                    </Button>
                  </div>
                ))}
              </div>
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
          {weekSchedules.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="No scheduled tasks this week"
              description="Schedule tasks across the week to plan ahead."
            />
          ) : (
            (() => {
              // Group by date
              const byDate = new Map<string, typeof weekSchedules>();
              for (const s of weekSchedules) {
                const arr = byDate.get(s.date) || [];
                arr.push(s);
                byDate.set(s.date, arr);
              }

              return [...byDate.entries()].map(([date, items]) => (
                <Card key={date} className="p-4">
                  <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">{formatDateLabel(date)}</h3>
                  <div className="space-y-1">
                    {items.map(s => {
                      const taskObj = typeof s.taskId === 'object' ? s.taskId as any : tasks.find(t => t.id === s.taskId);
                      const derived = deriveState(s, taskObj, now);
                      return <ScheduleCard key={s._id} schedule={s} derivedState={derived} />;
                    })}
                  </div>
                </Card>
              ));
            })()
          )}
        </div>
      )}

      <ScheduleModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}

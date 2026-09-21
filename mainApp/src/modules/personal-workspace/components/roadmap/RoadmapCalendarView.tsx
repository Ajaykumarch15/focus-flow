import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Circle, Clock, X } from 'lucide-react';
import type { RoadmapTaskSummary, RoadmapPhaseDoc, RoadmapMilestoneDoc } from '../../types/roadmap';

interface RoadmapCalendarViewProps {
  tasks: RoadmapTaskSummary[];
  phases: RoadmapPhaseDoc[];
  milestones: RoadmapMilestoneDoc[];
  roadmapStartDate?: string;
  roadmapTargetDate?: string;
  onTaskClick?: (task: RoadmapTaskSummary) => void;
}

const PHASE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  'in-progress': Clock,
  todo: Circle,
};

function getPhaseColor(phaseId: string, phases: RoadmapPhaseDoc[]): string {
  const idx = phases.findIndex(p => p._id === phaseId);
  return PHASE_COLORS[idx % PHASE_COLORS.length];
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function RoadmapCalendarView({
  tasks, phases, milestones, roadmapStartDate, onTaskClick,
}: RoadmapCalendarViewProps) {
  const today = useMemo(() => new Date(), []);

  const initialDate = useMemo(() => {
    if (roadmapStartDate) return new Date(roadmapStartDate);
    return new Date(today);
  }, [roadmapStartDate, today]);

  const [viewDate, setViewDate] = useState(initialDate);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const todayKey = formatDateKey(today);

  // Build a lookup: dateKey -> task[]
  const taskMap = useMemo(() => {
    const map = new Map<string, RoadmapTaskSummary[]>();
    for (const task of tasks) {
      const dateStr = task.scheduledDate || task.deadline;
      if (!dateStr) continue;
      const key = dateStr.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  // Build milestone lookup: dateKey -> milestone[]
  const milestoneMap = useMemo(() => {
    const map = new Map<string, RoadmapMilestoneDoc[]>();
    for (const m of milestones) {
      if (!m.targetDate) continue;
      const key = m.targetDate.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [milestones]);

  // Build phase lookup: milestoneId -> phase
  const milestonePhaseMap = useMemo(() => {
    const map = new Map<string, RoadmapPhaseDoc>();
    for (const phase of phases) {
      for (const m of milestones) {
        if (m.phaseId === phase._id) map.set(m._id, phase);
      }
    }
    return map;
  }, [phases, milestones]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days = useMemo(() => {
    const result: Array<{
      day: number;
      dateStr: string;
      isToday: boolean;
      isCurrentMonth: boolean;
      tasks: RoadmapTaskSummary[];
      milestones: RoadmapMilestoneDoc[];
    }> = [];

    // Previous month padding
    for (let i = 0; i < firstDayOfMonth; i++) {
      const prevMonthDays = new Date(year, month, 0).getDate();
      const day = prevMonthDays - firstDayOfMonth + i + 1;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.push({ day, dateStr, isToday: false, isCurrentMonth: false, tasks: taskMap.get(dateStr) || [], milestones: milestoneMap.get(dateStr) || [] });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({
        day: d,
        dateStr,
        isToday: dateStr === todayKey,
        isCurrentMonth: true,
        tasks: taskMap.get(dateStr) || [],
        milestones: milestoneMap.get(dateStr) || [],
      });
    }

    return result;
  }, [daysInMonth, firstDayOfMonth, year, month, todayKey, taskMap, milestoneMap]);

  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null;
    const dayTasks = taskMap.get(selectedDay) || [];
    const dayMilestones = milestoneMap.get(selectedDay) || [];
    return { date: selectedDay, tasks: dayTasks, milestones: dayMilestones };
  }, [selectedDay, taskMap, milestoneMap]);

  const stats = useMemo(() => {
    const totalScheduled = tasks.filter(t => t.scheduledDate || t.deadline).length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return { totalScheduled, completed, total: tasks.length };
  }, [tasks]);

  const goToPrevMonth = useCallback(() => setViewDate(new Date(year, month - 1, 1)), [year, month]);
  const goToNextMonth = useCallback(() => setViewDate(new Date(year, month + 1, 1)), [year, month]);
  const goToToday = useCallback(() => setViewDate(new Date(today)), [today]);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-900 border border-surface-800 text-xs">
          <Calendar size={13} className="text-surface-400" />
          <span className="text-surface-300 font-medium">{stats.totalScheduled} scheduled</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-900 border border-surface-800 text-xs">
          <CheckCircle2 size={13} className="text-emerald-400" />
          <span className="text-surface-300 font-medium">{stats.completed} completed</span>
        </div>
        {phases.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {phases.map((phase, i) => (
              <span key={phase._id} className="flex items-center gap-1.5 text-[11px] text-surface-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHASE_COLORS[i % PHASE_COLORS.length] }} />
                {phase.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden">
        {/* Calendar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
          <h3 className="text-sm font-bold text-surface-100">{monthName}</h3>
          <div className="flex items-center gap-1">
            <button onClick={goToToday} className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-brand-400 hover:bg-brand-500/10 transition-colors">
              Today
            </button>
            <button onClick={goToPrevMonth} className="w-7 h-7 rounded-lg hover:bg-surface-800 flex items-center justify-center transition-colors" aria-label="Previous month">
              <ChevronLeft size={14} className="text-surface-400" />
            </button>
            <button onClick={goToNextMonth} className="w-7 h-7 rounded-lg hover:bg-surface-800 flex items-center justify-center transition-colors" aria-label="Next month">
              <ChevronRight size={14} className="text-surface-400" />
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-surface-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-semibold uppercase tracking-wider text-surface-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((dayInfo, idx) => {
            const isSelected = selectedDay === dayInfo.dateStr;
            const hasItems = dayInfo.tasks.length > 0 || dayInfo.milestones.length > 0;
            return (
              <div
                key={idx}
                onClick={() => hasItems && setSelectedDay(isSelected ? null : dayInfo.dateStr)}
                className={`
                  relative min-h-[72px] p-1.5 border-b border-r border-surface-800/50 transition-colors
                  ${!dayInfo.isCurrentMonth ? 'bg-surface-950/50' : 'bg-surface-900'}
                  ${hasItems ? 'cursor-pointer hover:bg-surface-800/50' : ''}
                  ${isSelected ? 'bg-surface-800/70 ring-1 ring-brand-500/30' : ''}
                  ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}
                `}
              >
                {/* Day number */}
                <div className="flex items-start justify-between mb-1">
                  <span className={`
                    text-[11px] font-medium leading-none
                    ${dayInfo.isToday ? 'bg-brand-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold' : ''}
                    ${!dayInfo.isCurrentMonth ? 'text-surface-600' : 'text-surface-400'}
                  `}>
                    {dayInfo.day}
                  </span>
                  {dayInfo.milestones.length > 0 && (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 rounded">
                      {dayInfo.milestones.length}
                    </span>
                  )}
                </div>

                {/* Task indicators */}
                <div className="space-y-0.5">
                  {dayInfo.tasks.slice(0, 3).map(task => {
                    const Icon = STATUS_ICONS[task.status] || Circle;
                    const phase = task.phaseRef ? milestonePhaseMap.get(task.phaseRef) || phases.find(p => p._id === task.phaseRef) : null;
                    const color = phase ? getPhaseColor(phase._id, phases) : '#64748b';
                    return (
                      <div key={task.id} className="flex items-center gap-1 group/task">
                        <Icon size={8} style={{ color }} className="flex-shrink-0" />
                        <span className={`text-[9px] leading-tight truncate ${task.status === 'completed' ? 'text-surface-500 line-through' : 'text-surface-300'}`}>
                          {task.title}
                        </span>
                      </div>
                    );
                  })}
                  {dayInfo.tasks.length > 3 && (
                    <span className="text-[9px] text-surface-500">+{dayInfo.tasks.length - 3} more</span>
                  )}
                </div>

                {/* Milestone indicators */}
                {dayInfo.milestones.slice(0, 1).map(m => (
                  <div key={m._id} className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-[9px] text-amber-400 font-medium truncate">{m.title}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      <AnimatePresence>
        {selectedDayData && (selectedDayData.tasks.length > 0 || selectedDayData.milestones.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-brand-400" />
                <h4 className="text-sm font-bold text-surface-100">
                  {new Date(selectedDayData.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h4>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Milestones due */}
              {selectedDayData.milestones.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-2">Milestones Due</p>
                  {selectedDayData.milestones.map(m => (
                    <div key={m._id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-surface-200">{m.title}</span>
                      <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${m.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {selectedDayData.tasks.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-2">Tasks ({selectedDayData.tasks.length})</p>
                  <div className="space-y-1.5">
                    {selectedDayData.tasks.map(task => {
                      const Icon = STATUS_ICONS[task.status] || Circle;
                      const phase = task.phaseRef ? phases.find(p => p._id === task.phaseRef) : null;
                      const color = phase ? getPhaseColor(phase._id, phases) : '#64748b';
                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick?.(task)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-800/50 transition-colors cursor-pointer group"
                        >
                          <Icon size={14} style={{ color }} className="flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'text-surface-500 line-through' : 'text-surface-200 group-hover:text-brand-300 transition-colors'}`}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {phase && (
                                <span className="text-[10px] text-surface-500 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                  {phase.title}
                                </span>
                              )}
                              <span className={`text-[10px] font-medium ${task.priority === 'high' || task.priority === 'urgent' ? 'text-orange-400' : 'text-surface-500'}`}>
                                {task.priority}
                              </span>
                            </div>
                          </div>
                          {task.scheduledDate && task.deadline && task.scheduledDate !== task.deadline && (
                            <span className="text-[10px] text-surface-500 flex-shrink-0">
                              due {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

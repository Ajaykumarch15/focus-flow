import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, Plus,
  AlertTriangle, Clock, ArrowRight, FileText,
  Flame,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { PersonalScheduleDayView } from '@personal/components/schedule/PersonalScheduleDayView';
import { PersonalScheduleWeekView } from '@personal/components/schedule/PersonalScheduleWeekView';
import { PersonalScheduleMonthView } from '@personal/components/schedule/PersonalScheduleMonthView';
import { ScheduleTaskModal } from '@personal/components/schedule/ScheduleTaskModal';
import { ScheduleSidebar } from '@personal/components/schedule/ScheduleSidebar';
import { CollapsibleSection } from '@personal/components/schedule/CollapsibleSection';
import { Pagination } from '@shared/components/ui/Pagination';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { getWeekDates, getScheduledState, formatScheduledDate } from '@personal/services/personalTaskSchedule';
import { cn } from '@shared/utils/cn';
import type { Task } from '@shared/types';

const fadeUp = { hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0 } };

type ViewMode = 'day' | 'week' | 'month';

function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl p-4 relative overflow-hidden transition-all hover:scale-[1.02] cursor-default"
      style={{
        background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`,
        border: `1px solid ${color}30`,
      }}>
      <div className="absolute top-0 right-0 w-20 h-20 opacity-15 pointer-events-none rounded-bl-full"
        style={{ background: `radial-gradient(circle at top right, ${color}40, transparent)` }} />
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-display font-extrabold text-surface-50 leading-none">{value}</p>
      <p className="text-[11px] font-semibold mt-1" style={{ color: `${color}cc` }}>{label}</p>
    </motion.div>
  );
}

function TaskRow({ task, roadmapTitle }: { task: Task; roadmapTitle?: string }) {
  const navigate = useNavigate();
  const state = getScheduledState(task);
  const isMissed = state === 'missed';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
      isMissed ? 'border-red-500/20 bg-red-500/5' : 'border-surface-800 bg-surface-900/40 hover:border-surface-700'
    }`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isMissed ? 'bg-red-400' : 'bg-surface-500'}`} />
      <button onClick={() => navigate(`/personal/tasks/${task.id}`)} className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-medium truncate ${isMissed ? 'text-red-300' : 'text-surface-100'}`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.category && <span className="text-[10px] text-surface-500">{task.category}</span>}
          {task.priority && <span className="text-[10px] text-surface-500 capitalize">{task.priority}</span>}
          {roadmapTitle && (
            <span className="text-[10px] font-medium text-sky-400">{roadmapTitle}</span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.scheduledDate && (
          <span className="text-[10px] text-surface-500 flex items-center gap-1">
            <Calendar size={10} />
            {formatScheduledDate(task.scheduledDate)}
          </span>
        )}
        {isMissed && (
          <span className="text-[10px] font-bold text-red-400 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/20">
            Overdue
          </span>
        )}
      </div>
    </div>
  );
}

export function PersonalSchedule() {
  const { tasks } = usePersonalTaskStore();
  const { roadmaps } = useRoadmapStore();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [upcomingPage, setUpcomingPage] = useState(1);

  const today = useMemo(() => new Date(), []);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Task counts for KPIs
  const counts = useMemo(() => {
    let todayCount = 0, upcoming = 0, overdue = 0, unscheduled = 0;
    for (const t of tasks) {
      if (t.status === 'completed') continue;
      const state = getScheduledState(t);
      if (state === 'today') todayCount++;
      else if (state === 'upcoming') upcoming++;
      else if (state === 'missed') overdue++;
      else unscheduled++;
    }
    return { today: todayCount, upcoming, overdue, unscheduled };
  }, [tasks]);

  // Collapsible section task lists
  const overdueTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completed' && getScheduledState(t) === 'missed'),
  [tasks]);

  const todayTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completed' && getScheduledState(t) === 'today'),
  [tasks]);

  const upcomingTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completed' && getScheduledState(t) === 'upcoming'),
  [tasks]);

  const unscheduledTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completed' && getScheduledState(t) === 'unscheduled').slice(0, 10),
  [tasks]);

  const roadmapMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roadmaps) map.set(r._id, r.title);
    return map;
  }, [roadmaps]);

  // Pagination for upcoming tasks
  const UPCOMING_PAGE_SIZE = 8;
  const upcomingTotalPages = Math.ceil(upcomingTasks.length / UPCOMING_PAGE_SIZE);
  const paginatedUpcomingTasks = useMemo(() => {
    const start = (upcomingPage - 1) * UPCOMING_PAGE_SIZE;
    return upcomingTasks.slice(start, start + UPCOMING_PAGE_SIZE);
  }, [upcomingPage, upcomingTasks]);

  const navigateDate = useCallback((dir: number) => {
    setSelectedDate(d => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + dir);
      return nd;
    });
  }, []);

  const jumpToToday = useCallback(() => {
    setSelectedDate(new Date());
    setWeekOffset(0);
  }, []);

  const dateLabel = useMemo(() => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const start = weekDates[0];
      const end = weekDates[6];
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return '';
  }, [viewMode, selectedDate, weekDates]);

  const isToday = useMemo(() => {
    return selectedDate.toDateString() === today.toDateString();
  }, [selectedDate, today]);

  return (
    <div className="relative px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-6 max-w-[1600px] space-y-6">
      {/* Decorative spots */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-brand-400/[0.12] dark:bg-brand-400/[0.06] blur-3xl" />
        <div className="absolute top-[15%] -right-12 w-40 h-40 rounded-full bg-info-400/[0.10] dark:bg-info-300/[0.05] blur-3xl" />
        <div className="absolute top-[40%] left-[5%] w-36 h-36 rounded-[1.5rem] rotate-12 bg-success-400/[0.08] dark:bg-success-300/[0.04] blur-2xl" />
      </div>

      {/* ═══════════════ HEADER ═══════════════ */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10 relative">
        <div className="flex items-center gap-4">
          <div className="hidden md:block w-[180px] h-[120px] flex-shrink-0 overflow-hidden rounded-2xl">
            <img src="/SVG/calender.png" alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">Schedule</h1>
            <p className="text-sm text-surface-400 mt-0.5">Plan your days and weeks. Turn plans into progress.</p>
          </div>
        </div>
        <Button onClick={() => setModalOpen(true)} leftIcon={<Plus size={16} />}>
          Schedule Task
        </Button>
      </motion.div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 z-10 relative">
        <KpiCard icon={<Calendar size={18} />} label="Events Today" value={counts.today} color="#3b82f6" />
        <KpiCard icon={<ArrowRight size={18} />} label="Upcoming" value={counts.upcoming} color="#8b5cf6" />
        <KpiCard icon={<Flame size={18} />} label="Overdue" value={counts.overdue} color="#ef4444" />
        <KpiCard icon={<FileText size={18} />} label="Unscheduled" value={counts.unscheduled} color="#94a3b8" />
      </motion.div>

      {/* ═══════════════ MAIN 2-COL LAYOUT ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 z-10 relative">

        {/* ── LEFT: Toolbar + View + Collapsible Sections ── */}
        <div className="space-y-4 min-w-0">
          {/* Toolbar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center p-1 rounded-xl bg-surface-900 border border-surface-800">
                {(['day', 'week', 'month'] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                      viewMode === mode
                        ? 'bg-brand-500/15 text-brand-300'
                        : 'text-surface-400 hover:text-surface-200',
                    )}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              {/* Nav arrows */}
              <div className="flex items-center gap-0.5">
                <button onClick={() => navigateDate(viewMode === 'week' ? -7 : -1)}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => navigateDate(viewMode === 'week' ? 7 : 1)}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(viewMode === 'day' || viewMode === 'week') && (
                <span className="text-xs text-surface-400 font-medium">{dateLabel}</span>
              )}
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={jumpToToday}>Today</Button>
              )}
            </div>
          </motion.div>

          {/* View Content */}
          {viewMode === 'day' && <PersonalScheduleDayView selectedDate={selectedDate} />}
          {viewMode === 'week' && <PersonalScheduleWeekView weekDates={weekDates} />}
          {viewMode === 'month' && <PersonalScheduleMonthView selectedDate={selectedDate} onDateSelect={setSelectedDate} />}

          {/* Collapsible Sections - hidden in Day view (DayView has its own sections) */}
          {viewMode !== 'day' && (
          <div className="space-y-3">
            <CollapsibleSection
              title="Overdue"
              count={overdueTasks.length}
              icon={<AlertTriangle size={16} />}
              accentColor="text-red-400"
              countBg="bg-red-500/15"
              countText="text-red-400"
              defaultOpen={overdueTasks.length > 0}
            >
              {overdueTasks.length > 0 ? (
                overdueTasks.map(t => (
                  <TaskRow key={t.id} task={t} roadmapTitle={roadmapMap.get(t.roadmapRef || '')} />
                ))
              ) : (
                <p className="text-xs text-surface-500 text-center py-2">No overdue tasks</p>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Today"
              count={todayTasks.length}
              icon={<Clock size={16} />}
              accentColor="text-cyan-400"
              countBg="bg-cyan-500/15"
              countText="text-cyan-400"
              defaultOpen={true}
            >
              {todayTasks.length > 0 ? (
                todayTasks.map(t => (
                  <TaskRow key={t.id} task={t} roadmapTitle={roadmapMap.get(t.roadmapRef || '')} />
                ))
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <img src="/SVG/calender.png" alt="" className="w-32 h-20 object-contain opacity-40 mb-3" />
                  <p className="text-sm font-medium text-surface-300 mb-1">No tasks scheduled for today</p>
                  <p className="text-xs text-surface-500 mb-3">Take it easy or schedule something productive!</p>
                  <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
                    Schedule a Task
                  </Button>
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Upcoming"
              count={upcomingTasks.length}
              icon={<ArrowRight size={16} />}
              accentColor="text-violet-400"
              countBg="bg-violet-500/15"
              countText="text-violet-400"
              defaultOpen={false}
            >
              {upcomingTasks.length > 0 ? (
                <div className="space-y-2">
                  {paginatedUpcomingTasks.map(t => (
                    <TaskRow key={t.id} task={t} roadmapTitle={roadmapMap.get(t.roadmapRef || '')} />
                  ))}
                  {upcomingTotalPages > 1 && (
                    <Pagination
                      currentPage={upcomingPage}
                      totalPages={upcomingTotalPages}
                      totalItems={upcomingTasks.length}
                      pageSize={UPCOMING_PAGE_SIZE}
                      onPageChange={setUpcomingPage}
                    />
                  )}
                </div>
              ) : (
                <p className="text-xs text-surface-500 text-center py-2">No upcoming tasks</p>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Unscheduled"
              count={unscheduledTasks.length}
              icon={<FileText size={16} />}
              accentColor="text-surface-400"
              countBg="bg-surface-800"
              countText="text-surface-400"
              defaultOpen={false}
            >
              {unscheduledTasks.length > 0 ? (
                unscheduledTasks.map(t => (
                  <TaskRow key={t.id} task={t} roadmapTitle={roadmapMap.get(t.roadmapRef || '')} />
                ))
              ) : (
                <p className="text-xs text-surface-500 text-center py-2">All tasks are scheduled</p>
              )}
            </CollapsibleSection>
          </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <ScheduleSidebar onScheduleTask={() => setModalOpen(true)} />
      </div>

      {modalOpen && <ScheduleTaskModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

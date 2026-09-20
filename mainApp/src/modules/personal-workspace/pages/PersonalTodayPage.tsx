import { useMemo, useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, AlertTriangle, Clock, CheckCircle, Zap,
  Target, ListTodo, ArrowRight, ArrowUpRight,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import {
  getTodayTasks, getMissedTasks,
} from '@personal/services/personalTaskSchedule';
import { formatHours, formatMs } from '@shared/utils/time';
import { CreateTaskModal } from '@worklog/components/tasks/CreateTaskModal';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { EmptyState } from '@shared/components/ui/EmptyState';

import { Skeleton, SkeletonStatCard, SkeletonTaskCard } from '@shared/components/ui/Skeleton';
import { KpiCounter } from '@shared/components/ui/KpiCounter';
import { CompactCalendarWidget } from '@personal/components/CompactCalendarWidget';
import { QuickActionsPanel } from '@personal/components/QuickActionsPanel';
import { RightSidebar } from '@personal/components/RightSidebar';
import type { Task } from '@shared/types';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export function PersonalTodayPage() {
  const { profile, dataLoading, dataError, loadAll } = useStore();
  const { tasks: personalTasks, fetchTasks: fetchPersonalTasks } = usePersonalTaskStore();
  const { activeTimerState, activeTask, display, elapsedMs } = useActiveTimer();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchPersonalTasks(); }, [fetchPersonalTasks]);

  const todayTasks = useMemo(() => getTodayTasks(personalTasks), [personalTasks]);
  const missedTasks = useMemo(() => getMissedTasks(personalTasks), [personalTasks]);

  const todayMs = useMemo(() => {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let total = 0;
    for (const task of personalTasks) {
      for (const s of task.sessions ?? []) {
        if (s.startTime >= sod) total += s.activeTime ?? 0;
      }
    }
    return total + elapsedMs;
  }, [personalTasks, elapsedMs]);

  const completedToday = useMemo(() => {
    const sod = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    return personalTasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).getTime() >= sod).length;
  }, [personalTasks]);

  const dailyGoalMs = profile.personalDailyGoal * 3600000;
  const progressPct = dailyGoalMs > 0 ? Math.min(100, Math.round((todayMs / dailyGoalMs) * 100)) : null;
  const remainingMs = progressPct !== null ? Math.max(0, dailyGoalMs - todayMs) : null;

  const continueTasks = useMemo(() =>
    personalTasks.filter(t => t.status === 'active' || t.status === 'paused'),
    [personalTasks],
  );

  const firstName = profile.name.trim().split(' ')[0] || 'there';

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const todayLabel = useMemo(() =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  []);

  if (dataLoading && personalTasks.length === 0) {
    return (
      <div className="relative p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
        <div className="rounded-3xl border border-surface-800/60 bg-surface-900 p-8 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonStatCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonTaskCard key={i} />)}
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="relative p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="flex items-center gap-3 p-4 rounded-2xl border border-danger-500/20 bg-danger-500/5">
          <div className="w-9 h-9 rounded-xl bg-danger-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-danger-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-danger-500">Failed to load data</p>
            <p className="text-xs text-danger-400/80 mt-0.5">{dataError}</p>
          </div>
          <Button variant="ghost" size="xs" className="text-danger-400 hover:text-danger-300" onClick={() => loadAll()}>Retry</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">

      {/* HERO */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label="Personal dashboard overview"
        className="relative -mx-6 lg:-mx-8 overflow-hidden
                   px-6 sm:px-8 lg:px-10 pt-0 pb-6 sm:pb-8 lg:pb-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          
          <div className="absolute bottom-[12%] left-[15%] w-52 h-36 rounded-full bg-info-400/[0.14] dark:bg-info-300/[0.05] blur-3xl" />
          <div className="absolute top-[35%] -right-10 w-36 h-44 rounded-full bg-brand-300/[0.14] dark:bg-brand-400/[0.05] blur-2xl" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">{todayLabel}</Badge>
              {activeTask && <Badge tone="warning" className="text-[10px] font-bold uppercase tracking-wider animate-pulse">Timer Running</Badge>}
            </div>
            <h1 className="mt-4 text-3xl lg:text-[2.25rem] font-display font-extrabold tracking-tight leading-tight">
              <span className="text-surface-50">{greeting}</span>,{' '}
              <span className="text-brand-500">{firstName}</span>
            </h1>
           
          </div>
          <div className="relative mx-auto shrink-0">
            <div aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 -inset-x-16 h-40 pointer-events-none bg-gradient-to-r from-transparent via-brand-400/[0.04] to-transparent blur-2xl" />
            <motion.img variants={fadeUp} src="/SVG/focus.svg.png" alt="" aria-hidden="true" loading="eager" draggable={false}
              className="relative w-auto max-w-[220px] sm:max-w-[260px] lg:max-w-[470px] xl:max-w-[490px] h-auto object-contain select-none pointer-events-none" />
            <div aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 -inset-x-8 h-24 pointer-events-none bg-gradient-to-r from-brand-400/[0.30] via-brand-400/[0.16] to-brand-400/[0.06] dark:from-brand-400/[0.05] dark:via-brand-400/[0.10] dark:to-brand-400/[0.03] blur-xl" />
          </div>
          <div className="flex-shrink-0 w-full max-w-[260px] mx-auto lg:mr-0">
            <div className="w-full rounded-2xl border border-surface-800 bg-surface-850 dark:border-brand-500/[0.08] shadow-sm dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] p-5 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-surface-400">Daily Goal</p>
              {progressPct === null ? (
                <>
                  <div className="text-4xl font-display font-extrabold text-surface-50 leading-none mt-3">&mdash;</div>
                  <p className="text-xs text-surface-500 mt-2">Set a daily goal in Settings to track progress.</p>
                </>
              ) : (
                <>
                  {/* Circular Progress */}
                  <div className="relative w-24 h-24 mx-auto mt-4">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-surface-200 dark:text-surface-700"
                      />
                      <circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeDasharray={`${(progressPct / 100) * 264} 264`}
                        strokeLinecap="round"
                        className={`${progressPct >= 100 ? 'text-success-400' : 'text-brand-400'}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-display font-extrabold text-surface-50">{progressPct}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-surface-200 mt-3">
                    {formatHours(todayMs)} <span className="text-surface-500 font-normal">of</span> {profile.personalDailyGoal}h
                  </p>
                  {remainingMs != null && remainingMs > 0 && progressPct < 100 && (
                    <p className="text-xs text-surface-400 mt-0.5">{formatMs(remainingMs)} remaining today</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* MISSED BANNER */}
      <AnimatePresence>
        {missedTasks.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-danger-500/20 bg-danger-500/5">
            <div className="w-9 h-9 rounded-xl bg-danger-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-danger-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-danger-500">
                {missedTasks.length} Missed Task{missedTasks.length !== 1 ? 's' : ''} Requiring Attention
              </p>
              <p className="text-xs text-danger-400/80 mt-0.5">Reschedule or complete these to stay on track.</p>
            </div>
            <Button variant="ghost" size="xs" className="text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 font-bold"
              onClick={() => navigate('/personal/tasks')}>View All -&gt;</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KEY METRICS */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Clock size={18} style={{ color: '#f59e0b' }} />} label="Today's Focus Time"
          value={formatHours(todayMs)} sub={`Target: ${profile.personalDailyGoal}h`} color="#f59e0b"
          onExpand={() => navigate('/personal/analytics')} />
        <Stat icon={<CheckCircle size={18} style={{ color: '#3b82f6' }} />} label="Completed Today"
          value={String(completedToday)} sub="Tasks done" color="#3b82f6"
          onExpand={() => navigate('/personal/analytics')} />
        <Stat icon={<ListTodo size={18} style={{ color: '#a855f7' }} />} label="Scheduled Today"
          value={String(todayTasks.length)} sub="Tasks planned" color="#a855f7"
          onExpand={() => navigate('/personal/analytics')} />
      </motion.div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* ACTIVE FOCUS */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-focus" className="space-y-3">
            <h2 id="pt-focus" className="flex items-center justify-between font-display font-bold text-surface-50 text-lg">
              <span className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-amber-400">
                  <Target size={14} />
                </span>
                Active Focus
              </span>
              {!activeTask && (
                <button
                  onClick={() => navigate('/personal/tasks')}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                >
                  Focus Mode <ArrowRight size={12} />
                </button>
              )}
            </h2>
            {activeTask ? (
              <Card className="border-amber-500/20">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Zap size={13} /> Focus Now
                    </p>
                    <StatusBadge status={activeTimerState} />
                  </div>
                  <p className="font-semibold text-surface-50 truncate">{activeTask.title}</p>
                  <div className="flex items-end justify-between mt-3 gap-3">
                    <div>
                      {activeTask.subtasks.length > 0 && (
                        <p className="text-xs text-surface-400">
                          {activeTask.subtasks.filter((s) => s.completed).length}/{activeTask.subtasks.length} subtasks
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="timer-display text-2xl font-display font-extrabold text-brand-400" aria-live="polite">{display}</div>
                      <p className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">Session clock</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" leftIcon={<Zap size={13} />} onClick={() => navigate(`/personal/tasks/${activeTask.id}`)}>Open Task</Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="w-20 h-20 mb-4 flex items-center justify-center">
                    <img src="/SVG/focus.svg.png" alt="" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-sm font-semibold text-surface-200 mb-1">Nothing in focus right now</p>
                  <p className="text-xs text-surface-400 mb-4">Pick a task and start making progress.</p>
                  <Button size="sm" leftIcon={<Play size={12} />} onClick={() => navigate('/personal/tasks')}>
                    Choose a Task
                  </Button>
                </div>
              </Card>
            )}
          </motion.section>

          {/* CONTINUE WORKING */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-continue" className="space-y-3">
            <h2 id="pt-continue" className="flex items-center justify-between font-display font-bold text-surface-50 text-lg">
              <span className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-brand-400">
                  <Play size={14} fill="currentColor" />
                </span>
                Continue Working
                {continueTasks.length > 0 && <Badge tone="neutral">{continueTasks.length}</Badge>}
              </span>
              {continueTasks.length > 0 && (
                <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/personal/tasks')}>
                  View All <ArrowRight size={12} />
                </Button>
              )}
            </h2>
            {continueTasks.length === 0 ? (
              <Card>
                <EmptyState
                  illustration="/SVG/today-goal.png"
                  title="Nothing to resume"
                  description="All your tasks are completed or not yet started."
                />
              </Card>
            ) : (
              <div className="space-y-2.5">
                {continueTasks.map(task => (
                  <ContinueRow key={task.id} task={task} onOpen={() => navigate(`/personal/tasks/${task.id}`)} />
                ))}
              </div>
            )}
          </motion.section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <CompactCalendarWidget />
          <QuickActionsPanel onCreateTask={() => setShowCreate(true)} />
          <RightSidebar />
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onAddTask={(data) => usePersonalTaskStore.getState().addTask(data)} />}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════════

function Stat({ icon, label, value, sub, color, onExpand }: {
  icon: ReactNode; label: string; value: string; sub?: string; color: string; onExpand?: () => void;
}) {
  const numMatch = value.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const numPart = numMatch ? parseFloat(numMatch[1]) : null;
  const suffix = numMatch ? numMatch[2] : '';

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
        border: `1px solid ${color}40`,
      }}
      onClick={onExpand}>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none rounded-bl-full"
        style={{ background: `radial-gradient(circle at top right, ${color}40, transparent)` }} />
      <div className="flex items-center justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}25` }}>
          {icon}
        </div>
        <button
          className="opacity-30 hover:opacity-60 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
          aria-label={`View ${label} details`}>
          <ArrowUpRight size={16} style={{ color }} />
        </button>
      </div>
      <p className="text-[13px] font-semibold mb-1" style={{ color: `${color}cc` }}>{label}</p>
      <p className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 mb-0.5 leading-none">
        {numPart !== null
          ? <KpiCounter value={numPart} suffix={suffix} duration={700} />
          : value}
      </p>
      {sub && <p className="text-xs text-surface-400 mt-2">{sub}</p>}
    </motion.div>
  );
}

function ContinueRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <motion.button variants={fadeUp} onClick={onOpen}
      className="w-full text-left p-4 rounded-2xl border border-surface-800 bg-surface-900 hover:border-surface-700 hover:bg-surface-850 transition-all group flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <StatusBadge status={task.status} />
          <span className="text-[10px] text-surface-500">{task.status === 'active' ? 'In progress' : 'Paused'}</span>
        </div>
        <p className="font-medium text-surface-50 truncate">{task.title}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="timer-display text-sm font-bold text-surface-300">{formatHours(task.totalTime)}</div>
        <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </motion.button>
  );
}



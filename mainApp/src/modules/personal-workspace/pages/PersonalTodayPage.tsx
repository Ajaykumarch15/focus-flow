import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, AlertTriangle, Clock, CheckCircle, Zap,
  Target, ListTodo, ArrowRight,
  Plus, FileText, Calendar, Map, TrendingUp, Sparkles, CalendarDays, AlertOctagon,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import {
  getTodayTasks,
} from '@personal/services/personalTaskSchedule';
import { formatHours, formatMs } from '@shared/utils/time';
import { CreateTaskModal } from '@worklog/components/tasks/CreateTaskModal';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { StatisticsCard } from '@shared/components/ui/StatisticsCard';
import { Badge } from '@shared/components/ui/Badge';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Skeleton, SkeletonStatCard, SkeletonTaskCard } from '@shared/components/ui/Skeleton';
import { CompactCalendarWidget } from '@personal/components/CompactCalendarWidget';
import { QuickActionsPanel } from '@personal/components/QuickActionsPanel';

import type { Task } from '@shared/types';

// Framer Motion animation variants
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

/**
 * PersonalTodayPage - Main dashboard page for personal workspace
 * Displays today's tasks, progress, active timer, and quick actions
 */
export function PersonalTodayPage() {
  // Global store: user profile, loading/error states
  const { profile, dataLoading, dataError, loadAll } = useStore();
  // Personal task store: tasks list and fetch function
  const { tasks: personalTasks, fetchTasks: fetchPersonalTasks } = usePersonalTaskStore();
  // Active timer hook: current timer state, active task, formatted display, elapsed ms
  const { activeTimerState, activeTask, display, elapsedMs } = useActiveTimer();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  // Fetch personal tasks on mount
  useEffect(() => { fetchPersonalTasks(); }, [fetchPersonalTasks]);

  // Derived: tasks scheduled for today
  const todayTasks = useMemo(() => getTodayTasks(personalTasks), [personalTasks]);

  // Total milliseconds worked today (from sessions + active timer)
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

  // Count of tasks completed today (since start of day)
  const completedToday = useMemo(() => {
    const sod = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    return personalTasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).getTime() >= sod).length;
  }, [personalTasks]);

  // Daily goal in milliseconds (from profile settings)
  const dailyGoalMs = profile.personalDailyGoal * 3600000;
  // Progress percentage towards daily goal (capped at 100%)
  const progressPct = dailyGoalMs > 0 ? Math.min(100, Math.round((todayMs / dailyGoalMs) * 100)) : null;
  // Remaining milliseconds to reach goal
  const remainingMs = progressPct !== null ? Math.max(0, dailyGoalMs - todayMs) : null;

  // Active/paused tasks that can be resumed
  const continueTasks = useMemo(() =>
    personalTasks.filter(t => t.status === 'active' || t.status === 'paused'),
    [personalTasks],
  );

  // Count of overdue tasks (past deadline, not completed)
  const overdueCount = useMemo(
    () => personalTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date()).length,
    [personalTasks],
  );

  // First name for personalized greeting
  const firstName = profile.name.trim().split(' ')[0] || 'there';

  // Time-based greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Formatted date label (e.g., "Monday, January 15")
  const todayLabel = useMemo(() =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  []);

  // Loading skeleton while data is fetching
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

  // Error state with retry button
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
    <div className="relative p-4 lg:p-6 max-w-[1320px] mx-auto flex flex-col gap-4 lg:block lg:space-y-4">

      {/* HERO — desktop (lg+) */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label="Personal dashboard overview"
        className="hidden lg:block relative -mx-8 overflow-hidden
                   px-8 pt-0 pb-5">
        {/* Decorative background blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-[12%] left-[15%] w-52 h-36 rounded-full bg-info-400/[0.14] dark:bg-info-300/[0.05] blur-3xl" />
          <div className="absolute top-[35%] -right-10 w-36 h-44 rounded-full bg-brand-300/[0.14] dark:bg-brand-400/[0.05] blur-2xl" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-5">
          {/* Left: Greeting & date */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">{todayLabel}</Badge>
              {activeTask && <Badge tone="warning" className="text-[10px] font-bold uppercase tracking-wider animate-pulse">Timer Running</Badge>}
            </div>
            <h1 className="mt-2 text-xl lg:text-[2.125rem] font-display font-extrabold tracking-tight leading-tight">
              <span className="text-surface-50">{greeting}</span>,{' '}
              <span className="text-brand-500">{firstName}</span>
            </h1>
            
          </div>
          {/* Center: Focus illustration */}
          <div className="relative mx-auto shrink-0">
            <div aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 -inset-x-8 h-20 pointer-events-none bg-gradient-to-r from-transparent via-brand-400/[0.04] to-transparent blur-2xl" />
            <motion.img variants={fadeUp} src="/SVG/focus.svg.png" alt="" aria-hidden="true" loading="eager" draggable={false}
              className="relative w-auto max-w-[110px] sm:max-w-[130px] lg:max-w-[235px] xl:max-w-[245px] h-auto object-contain select-none pointer-events-none" />
            <div aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 -inset-x-4 h-12 pointer-events-none bg-gradient-to-r from-brand-400/[0.30] via-brand-400/[0.16] to-brand-400/[0.06] dark:from-brand-400/[0.05] dark:via-brand-400/[0.10] dark:to-brand-400/[0.03] blur-xl" />
          </div>
          {/* Right: Daily goal progress card */}
          <div className="flex-shrink-0 w-full max-w-[260px] mx-auto lg:mr-0">
            <div className="w-full rounded-2xl border border-surface-800 bg-transparent dark:border-brand-500/[0.08] shadow-sm dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] p-3 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-surface-400">Daily Goal</p>
              {progressPct === null ? (
                // No goal set
                <>
                  <div className="text-3xl font-display font-extrabold text-surface-50 leading-none mt-2">&mdash;</div>
                  <p className="text-xs text-surface-500 mt-2">Set a daily goal in Settings to track progress.</p>
                </>
              ) : (
                // Goal progress with circular indicator
                <>
                  {/* Circular Progress SVG */}
                  <div className="relative w-16 h-16 mx-auto mt-2">
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
                      <span className="text-lg font-display font-extrabold text-surface-50">{progressPct}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-surface-200 mt-2">
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

      {/* HERO — mobile (hidden on lg+) */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label="Personal dashboard overview"
        className="order-1 lg:hidden flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {activeTask && (
            <Badge tone="warning" className="mb-2 text-[10px] font-bold uppercase tracking-wider animate-pulse">Timer Running</Badge>
          )}
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-surface-500">{greeting},</p>
          <h1 className="mt-1 text-[2rem] leading-none font-display font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-success-500 to-info-500 bg-clip-text text-transparent">{firstName}</span>
            <span className="ml-2 text-xl align-middle">👋</span>
          </h1>
          <p className="mt-2 text-xs text-surface-500">Keep going, you're doing great!</p>
        </div>
        <img src="/SVG/focus.svg.png" alt="" aria-hidden="true" loading="eager" draggable={false}
          className="w-28 sm:w-36 shrink-0 h-28 sm:h-36 object-contain select-none pointer-events-none" />
      </motion.section>

      {/* GOAL + STATS — mobile (combined card, hidden on lg+) */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label="Today's goal and progress"
        className="order-2 lg:hidden rounded-3xl border border-surface-800/60 bg-gradient-to-r from-success-500/15 via-surface-900 to-info-500/15 p-4 flex items-center gap-4">
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                className="text-surface-200 dark:text-surface-700" />
              {progressPct !== null && (
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                  strokeDasharray={`${(progressPct / 100) * 264} 264`} strokeLinecap="round"
                  className={progressPct >= 100 ? 'text-success-400' : 'text-brand-400'} />
              )}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-display font-extrabold text-surface-50">{progressPct === null ? '—' : `${progressPct}%`}</span>
            </div>
          </div>
          <p className="mt-1.5 text-xs font-semibold text-surface-200">
            {formatHours(todayMs)} <span className="text-surface-500 font-normal">/ {profile.personalDailyGoal}h</span>
          </p>
          <p className="text-[10px] text-surface-500">Today's Goal</p>
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-3 gap-1">
          {[ 
            { label: 'Completed', value: completedToday, icon: CheckCircle, cls: 'text-success-500' },
            { label: 'Scheduled', value: todayTasks.length, icon: Calendar, cls: 'text-purple-500' },
            { label: 'Overdue', value: overdueCount, icon: AlertTriangle, cls: 'text-danger-500' },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <Icon size={18} className={cls} />
              <span className="text-[10px] text-surface-500">{label}</span>
              <span className="text-lg font-display font-bold text-surface-50">{value}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* KEY METRICS - Stat Cards (desktop only) */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="hidden lg:grid grid-cols-4 gap-3">
        {(([
          { label: "Today's Focus", value: formatHours(todayMs), icon: Clock, accent: 'brand', illustration: TrendingUp, bg: '/SVG/svg/time-management_4ss6.svg' },
          { label: 'Completed Today', value: String(completedToday), icon: CheckCircle, accent: 'success', illustration: Sparkles, bg: '/SVG/svg/thumbs%20up.svg' },
          { label: 'Scheduled Today', value: String(todayTasks.length), icon: ListTodo, accent: 'info', illustration: CalendarDays, bg: '/SVG/svg/PLAN.svg' },
          { label: 'Overdue', value: String(overdueCount), icon: AlertTriangle, accent: 'danger', illustration: AlertOctagon, bg: '/SVG/svg/tight%20deadline.svg' },
        ]) as const).map(({ label, value, icon: Icon, accent, illustration: Illustration, bg }) => (
          <motion.div key={label} variants={fadeUp}>
            <StatisticsCard
              title={label}
              value={value}
              icon={<Icon size={14} />}
              illustration={<Illustration size={16} className="opacity-80" />}
              accent={accent}
              description=""
              transparent
              alwaysShowBorder
              backgroundImage={bg}
            />
          </motion.div>
        ))}
      </motion.div>

      
      

      {/* MAIN GRID — 2/3 left column, 1/3 right column on desktop */}
      <div className="order-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN — Active Focus + Continue Working */}
        <div className="lg:col-span-2 space-y-6">
          {/* ACTIVE FOCUS SECTION */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-focus" className="space-y-3">
            <h2 id="pt-focus" className="flex items-center justify-between font-display font-bold text-surface-50 text-lg">
              <span className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-amber-400">
                  <Target size={14} />
                </span>
                Active Focus
              </span>
              {/* Focus Mode button when no active task */}
              {!activeTask && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/personal/tasks')}
                    className="lg:hidden flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/15 px-2.5 py-1 text-[11px] font-bold text-success-600 dark:text-success-400 transition-colors hover:bg-success-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500/40"
                  >
                    Focus Mode <ArrowRight size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/personal/tasks')}
                    className="hidden lg:flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Focus Mode <ArrowRight size={12} />
                  </button>
                </>
              )}
            </h2>
            {activeTask ? (
              // Active task card with timer
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
              // Empty state: no active task
              <Card className="relative overflow-hidden">
                {/* Decorative focus illustration as card background */}
                <img
                  src="/SVG/svg/deep-work_muov.svg"
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  draggable={false}
                  className="pointer-events-none absolute -right-4 -bottom-3 z-0 h-28 w-auto max-w-[40%] object-contain
                             opacity-20 dark:opacity-[0.14] select-none"
                />
                <div className="relative z-10 p-5 lg:p-6 flex items-center gap-4 lg:gap-6">
                  <div className="w-24 h-24 shrink-0 flex items-center justify-center lg:w-28 lg:h-28">
                    <img src="/SVG/focus.svg.png" alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm lg:text-base font-semibold text-surface-200 mb-1">Nothing in focus right now</p>
                    <p className="text-xs lg:text-sm text-surface-400 lg:mb-4">Pick a task and start making progress.</p>
                    <Button size="sm" leftIcon={<Play size={12} />} className="hidden lg:inline-flex"
                      onClick={() => navigate('/personal/tasks')}>
                      Choose a Task
                    </Button>
                    <button
                      type="button"
                      onClick={() => navigate('/personal/tasks')}
                      className="lg:hidden mt-3 w-full h-9 rounded-xl bg-gradient-to-r from-success-500 to-teal-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all hover:from-success-400 hover:to-teal-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500/40"
                    >
                      <Play size={12} /> Choose a Task
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </motion.section>

          {/* CONTINUE WORKING — Active/paused tasks (desktop only) */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-continue" className="hidden lg:block space-y-3">
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
                  illustration={
                    <img
                      src="/SVG/svg/undraw-co5/ALL%20CHECKED.svg"
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      draggable={false}
                      className="h-32 w-auto object-contain select-none"
                    />
                  }
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

        {/* RIGHT COLUMN — Calendar + Quick Actions (desktop only) */}
        <div className="hidden lg:block space-y-5">
          <CompactCalendarWidget />
          <QuickActionsPanel onCreateTask={() => setShowCreate(true)} />
         {/* <RightSidebar />*/}
        </div>
      </div>

      {/* QUICK ACTIONS — mobile (grid of 4 action buttons) */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="order-5 lg:hidden">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-7 h-7 rounded-full border border-warning-500/25 bg-warning-500/15 flex items-center justify-center text-warning-500">
            <Zap size={13} />
          </span>
          <h2 className="font-display font-bold text-surface-50 text-lg">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {[ 
            { label: 'Add Task', icon: Plus, onClick: () => setShowCreate(true), cls: 'bg-success-500/10 border-success-500/20 text-success-600 dark:text-success-400' },
            { label: 'Add Note', icon: FileText, onClick: () => navigate('/personal/tasks'), cls: 'bg-info-500/10 border-info-500/20 text-info-600 dark:text-info-400' },
            { label: 'Plan My Day', icon: Calendar, onClick: () => navigate('/personal/today'), cls: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' },
            { label: 'Open Roadmap', icon: Map, onClick: () => navigate('/personal/roadmaps'), cls: 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400' },
          ].map(({ label, icon: Icon, onClick, cls }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              aria-label={label}
              className={`${cls} border rounded-2xl aspect-square flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-semibold leading-tight text-center px-1">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onAddTask={(data) => usePersonalTaskStore.getState().addTask(data)} />}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ContinueRow - Individual task row in "Continue Working" section
 * Single-line layout: status badge + task title on one line, time, navigate arrow
 * Border is a slowly rotating gradient whose colors match the task status
 */
function ContinueRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const borderColors = task.status === 'active'
    ? { '--rb-from': 'var(--color-success-500)', '--rb-to': 'var(--color-brand-400)' }
    : task.status === 'paused'
      ? { '--rb-from': 'var(--color-warning-500)', '--rb-to': 'var(--color-warning-400)' }
      : { '--rb-from': 'var(--color-brand-500)', '--rb-to': 'var(--color-info-400)' };
  return (
    <motion.button variants={fadeUp} onClick={onOpen}
      className="rotating-border w-full text-left flex items-center gap-4 group"
      style={borderColors as CSSProperties}>
      <div className="rotating-border-inner flex items-center gap-4 bg-surface-900 hover:bg-surface-850 transition-colors p-4">
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <StatusBadge status={task.status} className="shrink-0" />
          <p className="font-medium text-surface-50 truncate">{task.title}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="timer-display text-sm font-bold text-surface-300">{formatHours(task.totalTime)}</div>
          <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors" />
        </div>
      </div>
    </motion.button>
  );
}

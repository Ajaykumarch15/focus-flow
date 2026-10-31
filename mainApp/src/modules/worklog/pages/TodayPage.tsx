import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Plus, AlertTriangle, Clock, CheckCircle, Zap,
  Target, ListTodo, BellRing, ArrowRight, Map, TrendingUp, Sparkles, CalendarDays, AlertOctagon,
  Calendar,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { fetchMilestonesDueToday, type TodayMilestone } from '@personal/services/milestoneSchedule';
import { selectToday } from '@worklog/services/todaySelectors';
import type {
  TodayView, ContinueItem, DoNowItem, AttentionItem, AttentionKind, AttentionDeadline,
} from '@worklog/services/todaySelectors';
import type { CollaborativeTask } from '@collab/types/collaboration';
import type { Task } from '@shared/types';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import { CreateTaskModal } from '@worklog/components/tasks/CreateTaskModal';
import { TodayPlanWidget } from '@personal/components/schedule/TodayPlanWidget';
import { Card, CardHeader, CardTitle, CardBody } from '@shared/components/ui/Card';
import { StatisticsCard } from '@shared/components/ui/StatisticsCard';

import { Button } from '@shared/components/ui/Button';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NothingNeedsAttention } from '@shared/components/illustrations';
import { Skeleton, SkeletonStatCard, SkeletonTaskCard } from '@shared/components/ui/Skeleton';
import { formatHours, formatMs } from '@shared/utils/time';

import { CompactCalendarWidget } from '@personal/components/CompactCalendarWidget';
import { QuickActionsPanel } from '@personal/components/QuickActionsPanel';
import { RightSidebar } from '@personal/components/RightSidebar';

// ── Motion ────────────────────────────────────────────────────────────────────

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

// ── Attention kind metadata ───────────────────────────────────────────────────

const KIND_META: Record<AttentionKind, { label: string; tone: BadgeTone }> = {
  overdue: { label: 'Overdue', tone: 'danger' },
  'due-today': { label: 'Due today', tone: 'warning' },
  blocker: { label: 'Blocker', tone: 'danger' },
  review: { label: 'Review', tone: 'brand' },
  deadline: { label: 'Deadline', tone: 'info' },
};

function reasonTone(item: DoNowItem): BadgeTone {
  switch (item.deadlineStatus) {
    case 'overdue': return 'danger';
    case 'due-today': return 'warning';
    case 'due-soon': return 'brand';
    case 'upcoming': return 'info';
    default:
      if (item.task.priority === 'urgent') return 'danger';
      if (item.task.priority === 'high') return 'warning';
      return 'neutral';
  }
}

// ── TodayPage ─────────────────────────────────────────────────────────────────

export function TodayPage() {
  const {
    tasks, profile, theme,
    dataLoading, dataError, getTodayTime, getWeekTime, loadAll, startParallelTimer,
  } = useStore();
  const { user } = useAuthStore();
  const { activeLogs } = useWorkLogStore();
  const { blockers, tasks: collabTasks, sprints, projects } = useCollaborationStore();
  const { roadmaps, loadRoadmaps } = useRoadmapStore();
  const { activeTaskId, activeSessionId, activeTimerState, activeTask, display } = useActiveTimer();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [todayMilestones, setTodayMilestones] = useState<TodayMilestone[]>([]);

  useEffect(() => { loadRoadmaps(); }, [loadRoadmaps]);
  useEffect(() => {
    fetchMilestonesDueToday().then(setTodayMilestones);
  }, [roadmaps]);

  const accent = theme?.accentColor || '#0ea5e9';
  const todayMs = getTodayTime();
  const weekMs = getWeekTime();
  const dailyGoalMs = profile.dailyGoal * 3600000;

  const reviews = useMemo<CollaborativeTask[]>(
    () => collabTasks.filter((t) => t.reviewerId && t.reviewerId === (user?._id ?? null) && t.sprintStatus === 'review'),
    [collabTasks, user?._id],
  );

  const deadlines = useMemo<AttentionDeadline[]>(() => {
    const items: AttentionDeadline[] = [];
    const activeSprint = sprints.find((s) => s.status === 'active' && s.endDate);
    if (activeSprint?.endDate) {
      items.push({ id: `sprint-${activeSprint.id}`, title: `Sprint ends: ${activeSprint.name}`, dueDate: activeSprint.endDate });
    }
    for (const p of projects) {
      for (const ms of p.milestones) {
        if (ms.status !== 'completed' && ms.dueDate) {
          items.push({ id: `ms-${p.id}-${ms.id}`, title: `${p.name} · ${ms.title}`, dueDate: ms.dueDate });
        }
      }
    }
    return items;
  }, [sprints, projects]);

  const view: TodayView = useMemo(() => selectToday({
    tasks,
    activeTaskId,
    activeSessionId,
    workLogs: activeLogs,
    blockers,
    reviews,
    deadlines,
    todayMs,
    weekMs,
    dailyGoalMs,
    now: Date.now(),
  }), [tasks, activeTaskId, activeSessionId, activeLogs, blockers, reviews, deadlines, todayMs, weekMs, dailyGoalMs]);

  const firstName = profile.name.trim().split(' ')[0] || 'there';
  const remainingMs = view.stats.progressPct !== null ? Math.max(0, dailyGoalMs - todayMs) : null;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const startTask = (task: Task) => {
    void startParallelTimer(task.id);
    navigate(`/worklog/tasks/${task.id}`);
  };

  if (dataError) {
    return (
      <div className="p-6 lg:p-8 max-w-[1320px] mx-auto">
        <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 p-4 flex items-center gap-3" role="alert">
          <AlertTriangle size={18} className="text-danger-500 flex-shrink-0" />
          <p className="text-sm text-surface-300 flex-1">{dataError}</p>
          <Button variant="danger" size="xs" onClick={() => loadAll()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (dataLoading && tasks.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-8">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-9 w-64 rounded-xl" />
              <Skeleton className="h-4 w-56 rounded mt-2" />
            </div>
            <Skeleton className="h-24 w-40 rounded-2xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonTaskCard key={i} />)}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <SkeletonTaskCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">

      {/* ═══════════════ HEADER ═══════════════ */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label="Dashboard overview"
        className="hidden lg:block relative -mx-8 overflow-hidden
                   px-8 pt-0 pb-5">
        {/* ── Hero card decorative spots ── */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {/* Spot — top left corner */}
          
          {/* Spot — behind buttons area */}
          <div className="absolute bottom-[12%] left-[15%] w-52 h-36 rounded-full
            bg-info-400/[0.14] dark:bg-info-300/[0.05] blur-3xl" />
          {/* Spot — right edge between corner */}
          <div className="absolute top-[35%] -right-10 w-36 h-44 rounded-full
            bg-brand-300/[0.14] dark:bg-brand-400/[0.05] blur-2xl" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                {todayLabel}
              </Badge>
              {activeTask && (
                <Badge tone="warning" className="text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  Timer Running
                </Badge>
              )}
            </div>

            <h1 className="mt-2 text-xl lg:text-[2.125rem] font-display font-extrabold tracking-tight leading-tight">
              <span className="text-surface-50">{greeting}</span>,{' '}
              <span className="text-brand-500">{firstName}</span>
            </h1>
          </div>

          {/* CENTER — decorative productivity illustration */}
          <div className="relative mx-auto shrink-0">
            {/* Localized horizontal glow behind illustration */}
            <div aria-hidden="true"
              className="absolute top-1/2 -translate-y-1/2 -inset-x-8 h-20 pointer-events-none
                         bg-gradient-to-r from-transparent via-brand-400/[0.04] to-transparent
                         dark:via-brand-400/[0.04] blur-2xl" />
            <motion.img
              variants={fadeUp}
              src="/SVG/focus.svg.png"
              alt=""
              aria-hidden="true"
              loading="eager"
              draggable={false}
              className="relative w-auto max-w-[110px] sm:max-w-[130px] lg:max-w-[235px] xl:max-w-[245px] h-auto object-contain select-none pointer-events-none"
            />
            {/* Subtle accent gradient flowing left → right across the image */}
            <div aria-hidden="true"
              className="absolute top-1/2 -translate-y-1/2 -inset-x-4 h-12 pointer-events-none
                         bg-gradient-to-r from-brand-400/[0.30] via-brand-400/[0.16] to-brand-400/[0.06]
                         dark:from-brand-400/[0.05] dark:via-brand-400/[0.10] dark:to-brand-400/[0.03]
                         blur-xl" />
          </div>

          {/* RIGHT — compact Daily Goal card */}
          <div className="flex-shrink-0 w-full max-w-[260px] mx-auto lg:mr-0">
            <div className="w-full rounded-2xl border border-surface-800 bg-transparent dark:border-brand-500/[0.08] shadow-sm dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] p-3 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-surface-400">Daily Goal</p>
              {view.stats.progressPct === null ? (
                <>
                  <div className="text-3xl font-display font-extrabold text-surface-50 leading-none mt-2">—</div>
                  <p className="text-xs text-surface-500 mt-2">Set a daily goal in Settings to track progress.</p>
                </>
              ) : (
                <>
                  {/* Circular Progress */}
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
                        strokeDasharray={`${(view.stats.progressPct / 100) * 264} 264`}
                        strokeLinecap="round"
                        className={`${view.stats.progressPct >= 100 ? 'text-success-400' : 'text-brand-400'}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-display font-extrabold text-surface-50">{view.stats.progressPct}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-surface-200 mt-2">
                    {formatHours(todayMs)} <span className="text-surface-500 font-normal">of</span> {profile.dailyGoal}h
                  </p>
                  {remainingMs != null && remainingMs > 0 && view.stats.progressPct < 100 && (
                    <p className="text-xs text-surface-400 mt-0.5">{formatMs(remainingMs)} remaining today</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* HERO — mobile (hidden on lg+) */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label="Dashboard overview"
        className="lg:hidden flex items-center gap-3">
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
        className="lg:hidden rounded-3xl border border-surface-800/60 bg-gradient-to-r from-success-500/15 via-surface-900 to-info-500/15 p-4 flex items-center gap-4">
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                className="text-surface-200 dark:text-surface-700" />
              {view.stats.progressPct !== null && (
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                  strokeDasharray={`${(view.stats.progressPct / 100) * 264} 264`} strokeLinecap="round"
                  className={view.stats.progressPct >= 100 ? 'text-success-400' : 'text-brand-400'} />
              )}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-display font-extrabold text-surface-50">{view.stats.progressPct === null ? '—' : `${view.stats.progressPct}%`}</span>
            </div>
          </div>
          <p className="mt-1.5 text-xs font-semibold text-surface-200">
            {formatHours(todayMs)} <span className="text-surface-500 font-normal">/ {profile.dailyGoal}h</span>
          </p>
          <p className="text-[10px] text-surface-500">Today's Goal</p>
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-3 gap-1">
          {[
            { label: 'Completed', value: view.stats.completedToday, icon: CheckCircle, cls: 'text-success-500' },
            { label: 'Scheduled', value: view.stats.activeCount, icon: Calendar, cls: 'text-purple-500' },
            { label: 'Overdue', value: view.stats.overdueCount, icon: AlertTriangle, cls: 'text-danger-500' },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <Icon size={18} className={cls} />
              <span className="text-[10px] text-surface-500">{label}</span>
              <span className="text-lg font-display font-bold text-surface-50">{value}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Overdue banner */}
      <AnimatePresence>
        {view.stats.overdueCount > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-danger-500/20 bg-danger-500/5">
            <div className="w-9 h-9 rounded-xl bg-danger-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-danger-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-danger-500">
                {view.stats.overdueCount} Overdue Task{view.stats.overdueCount !== 1 ? 's' : ''} Requiring Attention
              </p>
              <p className="text-xs text-danger-400/80 mt-0.5">Prioritize these to stay on track.</p>
            </div>
            <Button variant="ghost" size="xs" className="text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 font-bold" onClick={() => navigate('/worklog/tasks')}>
              Resolve Now →
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ KEY METRICS - Stat Cards ═══════════════ */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3 z-10 relative">
        {(([
          {label: "Today's Focus", value: formatHours(todayMs), icon: Clock, accent: 'brand', illustration: TrendingUp, bg: '/SVG/svg/time-management_4ss6.svg', bgPos: 'bottom-left'},
        { label: 'Completed Today', value: String(view.stats.completedToday), icon: CheckCircle, accent: 'success', illustration: Sparkles, bg: '/SVG/svg/thumbs%20up.svg', bgPos: 'top-right' },
        { label: 'Scheduled Today', value: String(view.stats.activeCount), icon: ListTodo, accent: 'info', illustration: CalendarDays, bg: '/SVG/svg/PLAN.svg', bgPos: 'bottom-right' },
        { label: 'Overdue', value: String(view.stats.overdueCount), icon: AlertTriangle, accent: 'danger', illustration: AlertOctagon, bg: '/SVG/svg/tight%20deadline.svg', bgPos: 'top' },
        ]) as const).map(({ label, value, icon: Icon, accent, illustration: Illustration, bg, bgPos }) => (
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
              backgroundPosition={bgPos}
            />
          </motion.div>
        ))}
      </motion.div>

      

      {/* ═══════════════ MAIN GRID ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">

          {/* ─── Continue Working ─── */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="today-continue" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="today-continue" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-brand-400">
                  <Play size={14} fill="currentColor" />
                </span>
                Continue Working
                {view.continue.length > 0 && <Badge tone="neutral">{view.continue.length}</Badge>}
              </h2>
              {view.continue.length > 0 && (
                <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/worklog/tasks')}>
                  View All <ArrowRight size={12} />
                </Button>
              )}
            </div>

            {view.continue.length === 0 ? (
              <Card>
                <EmptyState
                  illustration="/SVG/today-goal.png"
                  title="Nothing to resume"
                  description="Resume where you left off, or start something new."
                  action={
                    <Button leftIcon={<Plus size={15} />} className="shadow-lg"
                      style={{ backgroundColor: accent, boxShadow: `0 8px 24px -4px ${accent}40` }}
                      onClick={() => setShowCreate(true)}>
                      Create Task
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="space-y-2.5">
                {view.continue.map((item, i) => (
                  <ContinueRow key={item.taskId} item={item} isPrimary={i === 0 && activeTaskId === item.taskId}
                    onOpen={() => navigate(`/worklog/tasks/${item.taskId}`)} />
                ))}
              </div>
            )}
          </motion.section>

          {/* ─── Today's Focus ─── */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="today-focus" className="space-y-3">
            <h2 id="today-focus" className="flex items-center justify-between font-display font-bold text-surface-50 text-lg">
              <span className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-amber-400">
                  <Target size={14} />
                </span>
                Today's Focus
                {view.doNow.length > 0 && <Badge tone="neutral">{view.doNow.length}</Badge>}
              </span>
              {!activeTask && view.doNow.length === 0 && (
                <button
                  onClick={() => navigate('/worklog/tasks')}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                >
                  Focus Mode <ArrowRight size={12} />
                </button>
              )}
            </h2>

            {activeTask && (
              <Card className="border-amber-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap size={15} className="text-amber-400" /> Focus Now
                  </CardTitle>
                  <StatusBadge status={activeTimerState} />
                </CardHeader>
                <CardBody>
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
                    <Button size="sm" leftIcon={<Zap size={13} />} onClick={() => navigate(`/worklog/tasks/${activeTask.id}`)}>Open Task</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {!activeTask && view.doNow.length === 0 && (
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
                <div className="relative z-10 p-6 flex flex-col items-center text-center">
                  <div className="w-20 h-20 mb-4 flex items-center justify-center">
                    <img src="/SVG/focus.svg.png" alt="" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-sm font-semibold text-surface-200 mb-1">Nothing in focus right now</p>
                  <p className="text-xs text-surface-400 mb-4">Pick a task and start making progress.</p>
                  <Button size="sm" leftIcon={<Play size={12} />} onClick={() => setShowCreate(true)}>
                    Choose a Task
                  </Button>
                </div>
              </Card>
            )}

            {!activeTask && view.doNow.length > 0 && (
              <div className="space-y-2.5">
                {view.doNow.map((item) => (
                  <DoNowRow key={item.task.id} item={item} accent={accent} onStart={startTask} onOpen={() => navigate(`/worklog/tasks/${item.task.id}`)} />
                ))}
              </div>
            )}
          </motion.section>

          {/* ─── Today's Plan + Attention ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── Today's Plan ─── */}
            <motion.section variants={fadeUp} initial="hidden" animate="show">
              <TodayPlanWidget />
            </motion.section>

            {/* ─── Attention ─── */}
            <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="today-attention" className="space-y-3">
            <h2 id="today-attention" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
              <span className="w-8 h-8 rounded-xl bg-transparent border border-surface-800/30 flex items-center justify-center text-danger-400">
                <BellRing size={14} />
              </span>
              Attention
              {view.attention.length > 0 && <Badge tone="danger">{view.attention.length}</Badge>}
            </h2>

            {view.attention.length === 0 ? (
              <Card className="bg-transparent border-surface-800/30">
                <EmptyState
                  illustration={<NothingNeedsAttention />}
                  title="Nothing needs attention"
                  description="No overdue tasks, blockers, or pending reviews right now."
                />
              </Card>
            ) : (
              <div className="space-y-2.5">
                {view.attention.map((item) => (
                  <AttentionRow key={item.id} item={item} onOpen={() => navigate(`/worklog/tasks/${item.taskId}`)} />
                ))}
              </div>
            )}
          </motion.section>
        </div>

        {/* ─── Roadmap Milestones Due Today ─── */}
        {todayMilestones.length > 0 && (
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="today-milestones" className="space-y-3">
            <h2 id="today-milestones" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
              <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-sky-400">
                <Map size={14} />
              </span>
              Roadmap Milestones
              <Badge tone="info">{todayMilestones.length}</Badge>
            </h2>
            <div className="space-y-2.5">
              {todayMilestones.map(ms => (
                <WorklogMilestoneRow key={ms._id} milestone={ms} onOpen={() => navigate(`/personal/roadmaps/${ms.roadmapId}`)} />
              ))}
            </div>
          </motion.section>
        )}

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <CompactCalendarWidget />
          <QuickActionsPanel onCreateTask={() => setShowCreate(true)} />
          <RightSidebar />
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-components (page-local)
// ══════════════════════════════════════════════════════════════════════════════


/** Maps a badge tone to the blinking border's conic-gradient color pair [from, to]. */
const TONE_BORDER: Record<BadgeTone, [string, string]> = {
  brand: ['var(--color-brand-500)', 'var(--color-info-400)'],
  success: ['var(--color-success-500)', 'var(--color-brand-400)'],
  warning: ['var(--color-warning-500)', 'var(--color-warning-400)'],
  danger: ['var(--color-danger-500)', 'var(--color-danger-400)'],
  info: ['var(--color-info-500)', 'var(--color-info-400)'],
  neutral: ['var(--color-brand-500)', 'var(--color-info-400)'],
};

function borderStyle([from, to]: [string, string]): CSSProperties {
  return { '--rb-from': from, '--rb-to': to } as CSSProperties;
}

function ContinueRow({ item, isPrimary, onOpen }: {
  item: ContinueItem; isPrimary?: boolean; onOpen: () => void;
}) {
  const tone: BadgeTone = item.status === 'active' ? 'success' : item.status === 'paused' ? 'warning' : 'brand';
  return (
    <motion.button variants={fadeUp} onClick={onOpen}
      className="rotating-border w-full text-left flex items-center gap-4 group"
      style={borderStyle(TONE_BORDER[tone])}>
      <div className="rotating-border-inner flex items-center gap-4 bg-surface-900 hover:bg-surface-850 transition-colors p-4">
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          {isPrimary && <Badge tone="brand" className="shrink-0">Resume</Badge>}
          <StatusBadge status={item.status} className="shrink-0" />
          <p className="font-medium text-surface-50 truncate">{item.title}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="timer-display text-sm font-bold text-surface-300">{formatHours(item.totalTime)}</div>
          <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors" />
        </div>
      </div>
    </motion.button>
  );
}

function DoNowRow({ item, accent, onStart, onOpen }: {
  item: DoNowItem; accent: string; onStart: (task: Task) => void; onOpen: () => void;
}) {
  const t = item.task;
  return (
    <motion.div variants={fadeUp}
      className="rotating-border rotating-border-cycle flex items-center"
      style={{ ...borderStyle(TONE_BORDER[reasonTone(item)]), '--rb-cycle': '15s' } as CSSProperties}>
      <div className="rotating-border-inner flex items-center gap-4 bg-surface-900 hover:bg-surface-850 transition-colors p-4">
        <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-2.5 text-left group">
          <Badge tone={reasonTone(item)} className="shrink-0">{item.reason}</Badge>
          <p className="font-medium text-surface-50 truncate">{t.title}</p>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" leftIcon={<Play size={12} />} className="shadow-sm"
            style={{ backgroundColor: accent, boxShadow: `0 4px 12px -2px ${accent}40` }}
            onClick={() => onStart(t)}>
            Start
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpen}>Open</Button>
        </div>
      </div>
    </motion.div>
  );
}

function AttentionRow({ item, onOpen }: { item: AttentionItem; onOpen: () => void }) {
  const meta = KIND_META[item.kind];
  const clickable = (item.kind === 'overdue' || item.kind === 'due-today') && Boolean(item.taskId);
  const content = (
    <>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {(item.kind === 'overdue' || item.kind === 'due-today' || item.kind === 'blocker') && (
          <Badge tone="neutral">{item.severity}</Badge>
        )}
      </div>
      <p className="font-medium text-surface-50 truncate">{item.title}</p>
      {item.subtitle && <p className="text-xs text-surface-400 mt-0.5 truncate">{item.subtitle}</p>}
    </>
  );
  return clickable ? (
    <motion.button variants={fadeUp} onClick={onOpen}
      className="w-full text-left p-4 rounded-2xl border border-surface-800/30 bg-transparent hover:border-surface-700/50 hover:bg-surface-800/30 transition-all group flex items-center justify-between gap-3">
      <div className="min-w-0">{content}</div>
      <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
    </motion.button>
  ) : (
    <motion.div variants={fadeUp} className="p-4 rounded-2xl border border-surface-800/30 bg-transparent">
      <div className="min-w-0">{content}</div>
    </motion.div>
  );
}

function WorklogMilestoneRow({ milestone, onOpen }: { milestone: TodayMilestone; onOpen: () => void }) {
  return (
    <motion.button variants={fadeUp} onClick={onOpen}
      className="w-full text-left p-4 rounded-2xl border border-sky-500/20 bg-transparent hover:border-sky-500/40 transition-all group flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge tone="info">Milestone</Badge>
          <Badge tone="warning">Due today</Badge>
        </div>
        <p className="font-medium text-surface-50 truncate">{milestone.title}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-medium" style={{ color: milestone.roadmapColor }}>
            {milestone.roadmapTitle}
          </span>
          <span className="text-[10px] text-surface-500">
            {milestone.completedTasks}/{milestone.totalTasks} tasks
          </span>
          {milestone.progress > 0 && (
            <span className="text-[10px] text-surface-400">{milestone.progress}%</span>
          )}
        </div>
      </div>
      <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
    </motion.button>
  );
}



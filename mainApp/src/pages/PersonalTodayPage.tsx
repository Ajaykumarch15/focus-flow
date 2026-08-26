import { useMemo, useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Plus, AlertTriangle, Clock, CheckCircle, Zap,
  Target, ListTodo, ArrowRight, Map,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePersonalTaskStore } from '../store/usePersonalTaskStore';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { useActiveTimer } from '../hooks/useActiveTimer';
import {
  getTodayTasks, getMissedTasks, getUpcomingTasks,
  formatScheduledDate, scheduledStateColor,
} from '../utils/personalTaskSchedule';
import {
  selectPersonalTimeline,
  type TimelineEvent, type TimelineEventKind,
} from '../lib/timelineSelectors';
import { formatHours, formatMs, formatRelativeTime } from '../utils/time';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { Progress } from '../components/ui/Progress';
import { Skeleton, SkeletonStatCard, SkeletonTaskCard } from '../components/ui/Skeleton';
import { KpiCounter } from '../components/ui/KpiCounter';
import type { Task } from '../types';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

const EVENT_ICONS: Record<TimelineEventKind, typeof Play> = {
  task_created: ListTodo, session_start: Play, journal: Clock,
  timer_start: Play, timer_pause: Clock, timer_resume: Play,
  timer_stop: Clock, note: Clock, snapshot: Zap,
  completed_item: CheckCircle, decision: Zap, blocker: AlertTriangle,
  worklog_blocker: AlertTriangle, worklog_blocker_resolved: CheckCircle,
  blocker_raised: AlertTriangle, blocker_resolved: CheckCircle, feature_created: Target,
};

const EVENT_COLORS: Record<TimelineEventKind, string> = {
  task_created: 'text-sky-400', session_start: 'text-brand-400', journal: 'text-amber-400',
  timer_start: 'text-sky-400', timer_pause: 'text-amber-400', timer_resume: 'text-emerald-400',
  timer_stop: 'text-purple-400', note: 'text-blue-400', snapshot: 'text-indigo-400',
  completed_item: 'text-emerald-400', decision: 'text-amber-400', blocker: 'text-red-400',
  worklog_blocker: 'text-red-400', worklog_blocker_resolved: 'text-emerald-400',
  blocker_raised: 'text-red-400', blocker_resolved: 'text-emerald-400', feature_created: 'text-sky-400',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-emerald-400',
};

export function PersonalTodayPage() {
  const { profile, theme, activeTaskId, activeTimerState, dataLoading, dataError, loadAll } = useStore();
  const { user } = useAuthStore();
  const { tasks: personalTasks, fetchTasks: fetchPersonalTasks, startTimer: personalStartTimer } = usePersonalTaskStore();
  const { roadmaps, loadRoadmaps } = useRoadmapStore();
  const { display } = useActiveTimer();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchPersonalTasks(); }, [fetchPersonalTasks]);
  useEffect(() => { loadRoadmaps(); }, [loadRoadmaps]);

  const todayTasks = useMemo(() => getTodayTasks(personalTasks), [personalTasks]);
  const missedTasks = useMemo(() => getMissedTasks(personalTasks), [personalTasks]);
  const upcomingTasks = useMemo(() => getUpcomingTasks(personalTasks), [personalTasks]);

  const accent = theme?.accentColor || '#0ea5e9';
  const activeTask = activeTaskId ? personalTasks.find((t) => t.id === activeTaskId) : null;

  const todayMs = useMemo(() => {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let total = 0;
    for (const task of personalTasks) {
      for (const s of task.sessions ?? []) {
        if (s.startTime >= sod) total += s.activeTime ?? 0;
      }
    }
    return total;
  }, [personalTasks]);

  const completedToday = useMemo(() => {
    const sod = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    return personalTasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).getTime() >= sod).length;
  }, [personalTasks]);

  const dailyGoalMs = profile.dailyGoal * 3600000;
  const progressPct = dailyGoalMs > 0 ? Math.min(100, Math.round((todayMs / dailyGoalMs) * 100)) : null;
  const remainingMs = progressPct !== null ? Math.max(0, dailyGoalMs - todayMs) : null;

  const continueTasks = useMemo(() =>
    personalTasks.filter(t => t.status === 'active' || t.status === 'paused'),
    [personalTasks],
  );

  const doNowTasks = useMemo(() => [...missedTasks, ...todayTasks], [missedTasks, todayTasks]);

  const activeRoadmaps = useMemo(() =>
    roadmaps.filter(r => r.status === 'active' || r.status === 'planning'),
    [roadmaps],
  );

  const recentEvents = useMemo(() =>
    selectPersonalTimeline({
      tasks: personalTasks, journals: [], workLogs: [], blockers: [], features: [],
      currentUserId: user?._id, now: Date.now(),
    }, { range: 'week', limit: 5 }),
    [personalTasks, user?._id],
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

  const startTask = (task: Task) => {
    personalStartTimer(task.id, task.totalTime || 0);
    navigate('/focus');
  };

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
        className="relative rounded-3xl border border-surface-800/60 overflow-hidden bg-surface-900 dark:bg-[#05070D]
                   shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]
                   dark:border-brand-500/[0.08] p-6 sm:p-8 lg:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-brand-400/[0.18] dark:bg-brand-400/[0.06] blur-2xl" />
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
            <p className="text-surface-300 text-sm mt-2.5 max-w-lg leading-relaxed">
              {activeTask ? `You're focusing on "${activeTask.title}"` : 'What should you do now?'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              {activeTask ? (
                <Button size="lg" leftIcon={<Play size={15} fill="currentColor" />}
                  className="bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold shadow-lg shadow-amber-500/25"
                  onClick={() => navigate('/focus')}>Resume Active Session</Button>
              ) : (
                <Button size="lg" leftIcon={<Plus size={16} />}
                  className="shadow-lg" style={{ backgroundColor: accent, boxShadow: `0 8px 24px -4px ${accent}40` }}
                  onClick={() => setShowCreate(true)}>Start New Task</Button>
              )}
              <Button variant="secondary" size="lg" rightIcon={<ArrowRight size={14} />} onClick={() => navigate('/personal/tasks')}>
                View My Tasks ({continueTasks.length})
              </Button>
            </div>
          </div>
          <div className="relative mx-auto shrink-0">
            <div aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 -inset-x-16 h-40 pointer-events-none bg-gradient-to-r from-transparent via-brand-400/[0.04] to-transparent blur-2xl" />
            <motion.img variants={fadeUp} src="/personal_workspace_hub_light.jpg" alt="" aria-hidden="true" loading="eager" draggable={false}
              className="relative w-auto max-w-[220px] sm:max-w-[260px] lg:max-w-[300px] xl:max-w-[340px] h-auto object-contain select-none pointer-events-none" />
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
                  <div className="text-4xl font-display font-extrabold text-surface-50 leading-none mt-3">{progressPct}%</div>
                  <Progress value={progressPct} tone={progressPct >= 100 ? 'success' : 'brand'} className="mt-3" ariaLabel="Daily goal progress" />
                  <p className="text-sm font-semibold text-surface-200 mt-2 pt-3 border-t border-surface-800/70">
                    {formatHours(todayMs)} <span className="text-surface-500 font-normal">of</span> {profile.dailyGoal}h
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
        <Stat icon={<Clock size={18} style={{ color: accent }} />} label="Today's Focus Time" value={formatHours(todayMs)}
          sub={`Target: ${profile.dailyGoal}h`} color={accent} />
        <Stat icon={<CheckCircle size={18} className="text-emerald-400" />} label="Completed Today"
          value={String(completedToday)} sub="Tasks done" color="#22c55e" />
        <Stat icon={<ListTodo size={18} className="text-violet-400" />} label="Scheduled Today"
          value={String(todayTasks.length)} sub="Tasks planned" color="#8b5cf6" />
      </motion.div>

      {/* MAIN GRID */}
      <div className="space-y-6">

        {/* ACTIVE FOCUS */}
        <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-focus" className="space-y-3">
          <h2 id="pt-focus" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
            <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-amber-400">
              <Target size={14} />
            </span>
            Active Focus
          </h2>
          {activeTask && (
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
                  <Button size="sm" leftIcon={<Zap size={13} />} onClick={() => navigate('/focus')}>Open Focus</Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/personal/tasks/${activeTask.id}`)}>Open Task</Button>
                </div>
              </div>
            </Card>
          )}
        </motion.section>

        {/* DO NOW */}
        <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-donow" className="space-y-3">
          <h2 id="pt-donow" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
            <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-brand-400">
              <Play size={14} fill="currentColor" />
            </span>
            Do Now
            {doNowTasks.length > 0 && <Badge tone="neutral">{doNowTasks.length}</Badge>}
          </h2>
          {doNowTasks.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Target size={26} className="text-brand-400" />}
                title="All clear for today"
                description="No missed or scheduled tasks. Create something new."
                action={
                  <Button leftIcon={<Plus size={15} />} className="shadow-lg"
                    style={{ backgroundColor: accent, boxShadow: `0 8px 24px -4px ${accent}40` }}
                    onClick={() => setShowCreate(true)}>Create Task</Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {doNowTasks.map(task => (
                <TaskRow key={task.id} task={task} accent={accent} onStart={() => startTask(task)}
                  onOpen={() => navigate(`/personal/tasks/${task.id}`)} />
              ))}
            </div>
          )}
        </motion.section>

        {/* CONTINUE WORKING */}
        <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-continue" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="pt-continue" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
              <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-brand-400">
                <Play size={14} fill="currentColor" />
              </span>
              Continue Working
              {continueTasks.length > 0 && <Badge tone="neutral">{continueTasks.length}</Badge>}
            </h2>
            {continueTasks.length > 0 && (
              <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/personal/tasks')}>
                View All
              </Button>
            )}
          </div>
          {continueTasks.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ListTodo size={26} className="text-brand-400" />}
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

        {/* SCHEDULE + UPCOMING */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-schedule" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="pt-schedule" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-cyan-400">
                  <Clock size={14} />
                </span>
                Today's Schedule
                {todayTasks.length > 0 && <Badge tone="info">{todayTasks.length}</Badge>}
              </h2>
            </div>
            {todayTasks.length === 0 ? (
              <Card>
                <EmptyState icon={<Clock size={26} className="text-cyan-400" />} title="No tasks scheduled" description="Set a scheduled date on your tasks to see them here." />
              </Card>
            ) : (
              <div className="space-y-2">
                {todayTasks.map(task => (
                  <ScheduledRow key={task.id} task={task} onOpen={() => navigate(`/personal/tasks/${task.id}`)} />
                ))}
              </div>
            )}
          </motion.section>

          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-upcoming" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="pt-upcoming" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-violet-400">
                  <ArrowRight size={14} />
                </span>
                Upcoming
                {upcomingTasks.length > 0 && <Badge tone="neutral">{upcomingTasks.length}</Badge>}
              </h2>
            </div>
            {upcomingTasks.length === 0 ? (
              <Card>
                <EmptyState icon={<ArrowRight size={26} className="text-violet-400" />} title="Nothing upcoming" description="Schedule tasks for future dates to see them here." />
              </Card>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.slice(0, 5).map(task => (
                  <ScheduledRow key={task.id} task={task} onOpen={() => navigate(`/personal/tasks/${task.id}`)} />
                ))}
              </div>
            )}
          </motion.section>
        </div>

        {/* ROADMAP PROGRESS */}
        {activeRoadmaps.length > 0 && (
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-roadmaps" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="pt-roadmaps" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-sky-400">
                  <Map size={14} />
                </span>
                Roadmap Progress
                <Badge tone="neutral">{activeRoadmaps.length}</Badge>
              </h2>
              <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/roadmaps')}>
                View All
              </Button>
            </div>
            <div className="space-y-2.5">
              {activeRoadmaps.map(rm => (
                <RoadmapRow key={rm._id} roadmap={rm} onOpen={() => navigate(`/roadmaps/${rm._id}`)} />
              ))}
            </div>
          </motion.section>
        )}

        {/* RECENT ACTIVITY */}
        {recentEvents.length > 0 && (
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="pt-activity" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="pt-activity" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
                <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-emerald-400">
                  <CheckCircle size={14} />
                </span>
                Recent Activity
              </h2>
              <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/activity')}>
                View All
              </Button>
            </div>
            <div className="space-y-2">
              {recentEvents.map(event => (
                <ActivityRow key={event.id} event={event} />
              ))}
            </div>
          </motion.section>
        )}

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

function Stat({ icon, label, value, sub, color }: {
  icon: ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  const numMatch = value.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const numPart = numMatch ? parseFloat(numMatch[1]) : null;
  const suffix = numMatch ? numMatch[2] : '';

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-surface-800/60 bg-surface-900 shadow-sm dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] dark:border-surface-700/50 p-5 relative overflow-hidden hover:border-surface-700 transition-colors">
      <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.12] dark:opacity-[0.06] pointer-events-none rounded-bl-full" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}10` }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 mb-0.5">
        {numPart !== null
          ? <KpiCounter value={numPart} suffix={suffix} duration={700} />
          : value}
      </p>
      <p className="text-xs text-surface-400 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-surface-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

function TaskRow({ task, accent, onStart, onOpen }: { task: Task; accent: string; onStart: () => void; onOpen: () => void }) {
  const isMissed = task.scheduledDate && new Date(task.scheduledDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && task.status !== 'completed';
  return (
    <motion.div variants={fadeUp}
      className={`p-4 rounded-2xl border transition-colors ${
        isMissed ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                 : 'border-surface-800 bg-surface-900 hover:border-surface-700'
      }`}>
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-surface-500'}`} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-surface-50 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone={isMissed ? 'danger' : 'info'}>
              {isMissed ? 'Missed' : 'Today'}
            </Badge>
            {task.category && <span className="text-[10px] text-surface-500">{task.category}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" leftIcon={<Play size={12} />} className="shadow-sm"
            style={{ backgroundColor: accent, boxShadow: `0 4px 12px -2px ${accent}40` }}
            onClick={onStart}>Start</Button>
          <Button variant="secondary" size="sm" onClick={onOpen}>Open</Button>
        </div>
      </div>
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

function ScheduledRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const state = task.scheduledDate
    ? (new Date(task.scheduledDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) ? 'missed' : 'today')
    : 'today';
  return (
    <motion.div variants={fadeUp}
      className={`p-4 rounded-2xl border transition-colors ${
        state === 'missed' ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                           : 'border-surface-800 bg-surface-900 hover:border-surface-700'
      }`}>
      <button onClick={onOpen} className="w-full text-left">
        <p className="font-medium text-surface-50 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {task.scheduledDate && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${scheduledStateColor(state)}`}>
              {formatScheduledDate(task.scheduledDate)}
            </span>
          )}
          {task.category && <span className="text-[10px] text-surface-500">{task.category}</span>}
        </div>
      </button>
    </motion.div>
  );
}

function RoadmapRow({ roadmap, onOpen }: { roadmap: { _id: string; title: string; status: string; progress: number; color: string; milestoneCompleted: number; milestoneTotal: number }; onOpen: () => void }) {
  return (
    <motion.button variants={fadeUp} onClick={onOpen}
      className="w-full text-left p-4 rounded-2xl border border-surface-800 bg-surface-900 hover:border-surface-700 hover:bg-surface-850 transition-all group flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${roadmap.color}15` }}>
        <Map size={16} style={{ color: roadmap.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-surface-50 truncate">{roadmap.title}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <Progress value={roadmap.progress} className="flex-1 h-1.5" ariaLabel={`${roadmap.title} progress`} />
          <span className="text-[11px] font-medium text-surface-300">{roadmap.progress}%</span>
        </div>
        <p className="text-[10px] text-surface-500 mt-1">{roadmap.milestoneCompleted}/{roadmap.milestoneTotal} milestones</p>
      </div>
      <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
    </motion.button>
  );
}

const KIND_LABELS: Record<TimelineEventKind, string> = {
  task_created: 'Task created', session_start: 'Session started', journal: 'Journal',
  timer_start: 'Timer started', timer_pause: 'Timer paused', timer_resume: 'Timer resumed',
  timer_stop: 'Timer stopped', note: 'Note', snapshot: 'Snapshot',
  completed_item: 'Completed', decision: 'Decision', blocker: 'Blocker',
  worklog_blocker: 'Blocker', worklog_blocker_resolved: 'Blocker resolved',
  blocker_raised: 'Blocker raised', blocker_resolved: 'Blocker resolved', feature_created: 'Feature created',
};

function ActivityRow({ event }: { event: TimelineEvent }) {
  const Icon = EVENT_ICONS[event.kind] || Clock;
  const color = EVENT_COLORS[event.kind] || 'text-surface-400';
  return (
    <motion.div variants={fadeUp}
      className="flex items-center gap-3 p-3 rounded-2xl border border-surface-800 bg-surface-900 hover:border-surface-700 transition-colors">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface-800 ${color}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-50 truncate">{event.title}</p>
        <p className="text-[10px] text-surface-500">{KIND_LABELS[event.kind]}</p>
      </div>
      <span className="text-[10px] text-surface-500 flex-shrink-0">{formatRelativeTime(event.timestamp)}</span>
    </motion.div>
  );
}

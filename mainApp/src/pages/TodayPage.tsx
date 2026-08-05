import { useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Plus, AlertTriangle, Clock, CheckCircle, Zap,
  Target, ListTodo, BellRing, ArrowRight,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkLogStore } from '../store/useWorkLogStore';
import { useCollaborationStore } from '../store/useCollaborationStore';
import { selectToday } from '../lib/todaySelectors';
import type {
  TodayView, ContinueItem, DoNowItem, AttentionItem, AttentionKind, AttentionDeadline,
} from '../lib/todaySelectors';
import type { CollaborativeTask } from '../types/collaboration';
import type { Task } from '../types';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { Progress } from '../components/ui/Progress';
import { Skeleton, SkeletonStatCard, SkeletonTaskCard } from '../components/ui/Skeleton';
import { formatHours, formatMs } from '../utils/time';

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
    tasks, profile, theme, activeTaskId, activeSessionId, activeTimerState,
    dataLoading, dataError, getTodayTime, getWeekTime, loadAll, startTimer,
  } = useStore();
  const { user } = useAuthStore();
  const { activeLogs } = useWorkLogStore();
  const { blockers, tasks: collabTasks, sprints, projects } = useCollaborationStore();
  const { display } = useActiveTimer();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

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

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;
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
    void startTimer(task.id);
    navigate('/focus');
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
    <div className="p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
      {/* ═══════════════ HEADER ═══════════════ */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="relative rounded-3xl border border-surface-800/60 overflow-hidden bg-surface-900 p-8 lg:p-10">
        <div className="absolute top-0 right-0 w-[500px] h-[300px] opacity-20 dark:opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top right, ${accent}30, transparent 70%)` }} />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                {todayLabel}
              </Badge>
              {activeTask && (
                <Badge tone="warning" className="text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  Timer Running
                </Badge>
              )}
            </div>

            <h1 className="text-3xl lg:text-[2.25rem] font-display font-extrabold text-surface-50 tracking-tight leading-tight">
              {greeting}, {firstName}
            </h1>

            <p className="text-surface-300 text-sm mt-3 max-w-lg leading-relaxed">
              {activeTask
                ? `You're focusing on "${activeTask.title}"`
                : 'What should you do now?'}
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              {activeTask ? (
                <Button size="lg" leftIcon={<Play size={15} fill="currentColor" />}
                  className="bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold shadow-lg shadow-amber-500/25"
                  onClick={() => navigate('/focus')}>
                  Resume Active Session
                </Button>
              ) : (
                <Button size="lg" leftIcon={<Plus size={16} />}
                  className="shadow-lg" style={{ backgroundColor: accent, boxShadow: `0 8px 24px -4px ${accent}40` }}
                  onClick={() => setShowCreate(true)}>
                  Start New Task
                </Button>
              )}
              <Button variant="secondary" size="lg" rightIcon={<ArrowRight size={14} />} onClick={() => navigate('/tasks')}>
                View My Backlog ({view.stats.activeCount})
              </Button>
            </div>
          </div>

          {/* Daily goal */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0 w-full sm:w-auto">
            <div className="w-full sm:w-52 rounded-2xl border border-surface-800/60 bg-surface-950/40 p-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-2">Daily Goal</p>
              {view.stats.progressPct === null ? (
                <>
                  <div className="text-4xl font-display font-extrabold text-surface-50 leading-none">—</div>
                  <p className="text-xs text-surface-500 mt-2">Set a daily goal in Settings to track progress.</p>
                </>
              ) : (
                <>
                  <div className="text-4xl font-display font-extrabold text-surface-50 leading-none">{view.stats.progressPct}%</div>
                  <Progress value={view.stats.progressPct} tone={view.stats.progressPct >= 100 ? 'success' : 'brand'} className="mt-3" ariaLabel="Daily goal progress" />
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
      </motion.div>

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
            <Button variant="ghost" size="xs" className="text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 font-bold" onClick={() => navigate('/tasks')}>
              Resolve Now →
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ KEY METRICS ═══════════════ */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Clock size={18} style={{ color: accent }} />} label="Today's Focus Time" value={formatHours(todayMs)}
          sub={`Target: ${profile.dailyGoal}h`} color={accent} />
        <Stat icon={<CheckCircle size={18} className="text-emerald-400" />} label="Completed Today"
          value={String(view.stats.completedToday)} sub="Tasks done" color="#22c55e" />
        <Stat icon={<ListTodo size={18} className="text-violet-400" />} label="Active Tasks"
          value={String(view.stats.activeCount)} sub="In progress" color="#8b5cf6" />
      </motion.div>

      {/* ═══════════════ MAIN GRID ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─── Continue Working ─── */}
        <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="today-continue" className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="today-continue" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
              <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-brand-400">
                <Play size={14} fill="currentColor" />
              </span>
              Continue Working
              {view.continue.length > 0 && <Badge tone="neutral">{view.continue.length}</Badge>}
            </h2>
            {view.continue.length > 0 && (
              <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/tasks')}>
                View All
              </Button>
            )}
          </div>

          {view.continue.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ListTodo size={26} className="text-brand-400" />}
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
                  onOpen={() => navigate(`/tasks/${item.taskId}`)} />
              ))}
            </div>
          )}
        </motion.section>

        {/* ─── Right rail: Focus + Attention ─── */}
        <div className="space-y-6">
          {/* ─── Today's Focus ─── */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="today-focus" className="space-y-3">
            <h2 id="today-focus" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
              <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-amber-400">
                <Target size={14} />
              </span>
              Today's Focus
              {view.doNow.length > 0 && <Badge tone="neutral">{view.doNow.length}</Badge>}
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
                    <Button size="sm" leftIcon={<Zap size={13} />} onClick={() => navigate('/focus')}>Open Focus</Button>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/tasks/${activeTask.id}`)}>Open Task</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {view.doNow.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Target size={26} className="text-amber-400" />}
                  title="No tasks yet"
                  description="Create your first task to start tracking focus time."
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
                {view.doNow.map((item) => (
                  <DoNowRow key={item.task.id} item={item} accent={accent} onStart={startTask} onOpen={() => navigate(`/tasks/${item.task.id}`)} />
                ))}
              </div>
            )}
          </motion.section>

          {/* ─── Attention ─── */}
          <motion.section variants={fadeUp} initial="hidden" animate="show" aria-labelledby="today-attention" className="space-y-3">
            <h2 id="today-attention" className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
              <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-danger-400">
                <BellRing size={14} />
              </span>
              Attention
              {view.attention.length > 0 && <Badge tone="danger">{view.attention.length}</Badge>}
            </h2>

            {view.attention.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<CheckCircle size={26} className="text-emerald-400" />}
                  title="Nothing needs attention"
                  description="No overdue tasks, blockers, or pending reviews right now."
                />
              </Card>
            ) : (
              <div className="space-y-2.5">
                {view.attention.map((item) => (
                  <AttentionRow key={item.id} item={item} onOpen={() => navigate(`/tasks/${item.taskId}`)} />
                ))}
              </div>
            )}
          </motion.section>
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

function Stat({ icon, label, value, sub, color }: {
  icon: ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-surface-800/60 bg-surface-900 p-5 relative overflow-hidden hover:border-surface-700 transition-colors">
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none rounded-bl-full" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}10` }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
      <p className="text-xs text-surface-400 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-surface-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

const SOURCE_LABEL: Record<ContinueItem['source'], string> = {
  active: 'Active',
  paused: 'Paused',
  worklog: 'In work log',
  history: 'Started',
};

function ContinueRow({ item, isPrimary, onOpen }: {
  item: ContinueItem; isPrimary?: boolean; onOpen: () => void;
}) {
  return (
    <motion.button variants={fadeUp} onClick={onOpen}
      className="w-full text-left p-4 rounded-2xl border border-surface-800 bg-surface-900 hover:border-surface-700 hover:bg-surface-850 transition-all group flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {isPrimary && <Badge tone="brand">Resume</Badge>}
          <StatusBadge status={item.status} />
          <Badge tone="neutral">{SOURCE_LABEL[item.source]}</Badge>
        </div>
        <p className="font-medium text-surface-50 truncate">{item.title}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="timer-display text-sm font-bold text-surface-300">{formatHours(item.totalTime)}</div>
        <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors" />
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
      className="p-4 rounded-2xl border border-surface-800 bg-surface-900 hover:border-surface-700 transition-colors">
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge tone={reasonTone(item)}>{item.reason}</Badge>
          {item.subtaskProgress && (
            <Badge tone="neutral">{item.subtaskProgress.done}/{item.subtaskProgress.total} subtasks</Badge>
          )}
        </div>
        <p className="font-medium text-surface-50 truncate">{t.title}</p>
      </button>
      {item.subtaskProgress && (
        <Progress value={item.subtaskProgress.pct} className="mt-3" ariaLabel={`${t.title} subtask progress`} />
      )}
      <div className="flex gap-2 mt-3">
        <Button size="sm" leftIcon={<Play size={12} />} className="shadow-sm"
          style={{ backgroundColor: accent, boxShadow: `0 4px 12px -2px ${accent}40` }}
          onClick={() => onStart(t)}>
          Start
        </Button>
        <Button variant="secondary" size="sm" onClick={onOpen}>Open</Button>
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
      className="w-full text-left p-4 rounded-2xl border border-surface-800 bg-surface-900 hover:border-surface-700 hover:bg-surface-850 transition-all group flex items-center justify-between gap-3">
      <div className="min-w-0">{content}</div>
      <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
    </motion.button>
  ) : (
    <motion.div variants={fadeUp} className="p-4 rounded-2xl border border-surface-800 bg-surface-900">
      <div className="min-w-0">{content}</div>
    </motion.div>
  );
}

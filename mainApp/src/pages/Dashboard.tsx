import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle, Flame, TrendingUp, Plus, Play, Zap,
  AlertTriangle, BookOpen, BarChart3, Trophy, Calendar,
  Sparkles, ChevronRight, PenLine, Briefcase, Timer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useWorkLogStore } from '../store/useWorkLogStore';
import { timerEngine } from '../utils/timerEngine';
import { api } from '../utils/api';
import { formatHours, formatMs, getWeekDays, isToday, isOverdue, startOfToday, getWeekStart, startOfDayInTz } from '../utils/time';
import { TaskCard } from '../components/tasks/TaskCard';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Skeleton } from '../components/ui/Skeleton';
import { MOOD_LABELS } from '../utils/colors';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { stripHtml } from '../lib/htmlContent';
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';

// ── Motion Variants ──────────────────────────────────────────────────────────

const stagger = { show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };

// ── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedValue({ value, decimals = 0, duration = 800 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState('0');
  const frameRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) { setDisplay(to.toFixed(decimals)); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current.toFixed(decimals));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, decimals, duration]);

  return <>{display}</>;
}

// ── SVG Circular Progress ────────────────────────────────────────────────────

// ── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3.5 py-2.5 bg-surface-900 border border-surface-800 shadow-xl">
      <p className="text-xs text-surface-400 font-medium mb-1">{label}</p>
      <p className="text-sm font-bold text-surface-50">{payload[0].value}h</p>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { tasks, profile, theme, journals, activeTaskId, dataLoading, getTodayTime, activeTimerState, currentSessionStart } = useStore();
  const { activeLogs } = useWorkLogStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api.sessions.list().then(setSessions).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTimerState !== 'idle') {
      const id = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(id);
    }
  }, [activeTimerState]);

  const accent = theme?.accentColor || '#0ea5e9';

  // ── Time calculations ────────────────────────────────────────────────────

  const todayMs = useMemo(() => getTodayTime(), [activeTimerState, tick]);

  const weekMs = useMemo(() => {
    const ws = getWeekStart();
    let wMs = 0;
    for (const s of sessions) {
      if (s.startTime >= ws) wMs += (s.activeTime || 0);
    }
    if (activeTimerState !== 'idle' && (currentSessionStart || 0) >= ws) {
      wMs += timerEngine.getElapsedMs();
    }
    return wMs;
  }, [sessions, activeTimerState, currentSessionStart, tick]);

  // ── Derived stats ────────────────────────────────────────────────────────

  const completedToday = tasks.filter(t => t.status === 'completed' && isToday(t.updatedAt)).length;
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const dailyGoalProgress = Math.min(100, (todayMs / (profile.dailyGoal * 3600000)) * 100);
  const overdueCount = tasks.filter(t => t.status !== 'completed' && isOverdue(t.deadline)).length;
  const remainingMs = Math.max(0, (profile.dailyGoal * 3600000) - todayMs);
  const streak = profile.streak?.current || 0;
  const points = profile.totalPoints || 0;

  // ── Weekly chart data ────────────────────────────────────────────────────

  const days = getWeekDays();
  const tz = profile.timezone;
  const dayRanges = useMemo(() => {
    const ranges: { start: number; end: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = startOfDayInTz(d.getTime(), tz);
      ranges.push({ start, end: start + 86399999 });
    }
    return ranges;
  }, [tz]);
  const todayIdx = dayRanges.length - 1;

  const pastWeekData = useMemo(() => {
    return dayRanges.slice(0, todayIdx).map((range, i) => {
      let hours = 0;
      for (const s of sessions) {
        if (s.startTime >= range.start && s.startTime <= range.end) hours += (s.activeTime || 0) / 3600000;
      }
      return { day: days[i], hours: Math.round(hours * 10) / 10 };
    });
  }, [sessions, dayRanges, todayIdx, days.join()]);

  const todayRange = dayRanges[todayIdx];
  const liveTodayHours = useMemo(() => {
    let hours = 0;
    for (const s of sessions) {
      if (s.startTime >= todayRange.start && s.startTime <= todayRange.end) hours += (s.activeTime || 0) / 3600000;
    }
    if (activeTimerState !== 'idle' && currentSessionStart &&
        currentSessionStart >= todayRange.start && currentSessionStart <= todayRange.end) {
      hours += timerEngine.getElapsedMs() / 3600000;
    }
    return Math.round(hours * 10) / 10;
  }, [sessions, activeTimerState, currentSessionStart, todayRange, tick]);

  const weekData = useMemo(() => {
    return [...pastWeekData, { day: days[todayIdx], hours: liveTodayHours }];
  }, [pastWeekData, days, todayIdx, liveTodayHours]);

  const weekHoursTotal = weekData.reduce((s, d) => s + d.hours, 0);
  const weekAvg = weekHoursTotal / 7;
  const peakDay = weekData.reduce((max, d) => d.hours > max.hours ? d : max, weekData[0]);

  // ── Motivational message ─────────────────────────────────────────────────

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const motivation = useMemo(() => {
    if (dailyGoalProgress >= 100) return "You've crushed today's goal. Incredible focus.";
    if (dailyGoalProgress >= 75) return "Almost there. Keep the momentum going.";
    if (dailyGoalProgress >= 40) return "Solid progress. Stay locked in.";
    if (dailyGoalProgress > 0) return "Great start. Build on this momentum.";
    return "What should you do now?";
  }, [dailyGoalProgress]);

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (dataLoading && tasks.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
        {/* Hero skeleton */}
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-8">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-9 w-64 rounded-xl" />
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-56 rounded mt-2" />
            </div>
            <Skeleton className="h-[140px] w-[140px] rounded-full" />
          </div>
        </div>
        {/* KPI skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <Skeleton className="w-10 h-10 rounded-xl mb-3" />
              <Skeleton className="h-7 w-20 rounded mb-1" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-800 bg-surface-900 p-5 h-28" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 h-56" />
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 h-40" />
          </div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
      {/* ═══════════════ MINIMALIST HERO (Developer Focus) ═══════════════ */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label="Dashboard overview"
        className="relative overflow-hidden rounded-3xl border border-surface-800/60 bg-surface-900
                   shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]
                   p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10">

          {/* LEFT — date, greeting, subtitle, actions */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-400">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                Developer Mission Control
              </Badge>
              {activeTaskId && (
                <Badge tone="warning" className="text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  Timer Running
                </Badge>
              )}
            </div>

            <h1 className="mt-4 text-3xl lg:text-[2.25rem] font-display font-extrabold text-surface-50 tracking-tight leading-tight">
              {greeting}, {profile.name.split(' ')[0]} 👋
            </h1>

            <p className="text-surface-300 text-sm mt-2.5 max-w-lg leading-relaxed">
              {activeTaskId
                ? `Active Session: You are focusing on "${tasks.find(t => t.id === activeTaskId)?.title || 'current task'}"`
                : motivation}
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-7">
              {activeTaskId ? (
                <Button
                  size="lg"
                  leftIcon={<Play size={15} fill="currentColor" />}
                  className="bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold shadow-lg shadow-amber-500/25"
                  onClick={() => navigate('/worklog/focus')}
                >
                  Resume Active Timer Session
                </Button>
              ) : (
                <Button
                  size="lg"
                  leftIcon={<Plus size={16} />}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35"
                  onClick={() => setShowCreate(true)}
                >
                  Start New Task
                </Button>
              )}
              <Button variant="secondary" size="lg" rightIcon={<ChevronRight size={14} />} onClick={() => navigate('/worklog/tasks')}>
                View My Backlog ({activeTasks.length})
              </Button>
            </div>
          </div>

          {/* CENTER — decorative illustration */}
          <motion.img
            variants={fadeIn}
            src={theme.mode === 'dark' ? '/personal_workspace_hub_light.jpg' : '/personal_workspace_hub_light.jpg'}
            alt=""
            aria-hidden="true"
            loading="eager"
            draggable={false}
            className="mx-auto w-auto max-w-[220px] sm:max-w-[260px] lg:max-w-[300px] xl:max-w-[340px] h-auto object-contain select-none pointer-events-none shrink-0"
          />

          {/* RIGHT — compact Daily Goal card */}
          <motion.div variants={scaleIn}
            className="flex-shrink-0 w-full max-w-[260px] mx-auto lg:mr-0 rounded-2xl border border-surface-800 bg-surface-850 p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-surface-400">Daily Goal</p>
            <p className="mt-3 text-center text-4xl font-display font-extrabold text-surface-50">
              <AnimatedValue value={Math.round(dailyGoalProgress)} />%
            </p>
            <div
              className="mt-4 h-1.5 rounded-full bg-surface-800 overflow-hidden"
              role="progressbar"
              aria-label="Daily goal progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(dailyGoalProgress)}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, dailyGoalProgress))}%` }}
              />
            </div>
            <div className="mt-4 pt-3 border-t border-surface-800/70 text-center">
              <p className="text-sm font-semibold text-surface-200">
                {formatHours(todayMs)} <span className="text-surface-500 font-normal">of</span> {profile.dailyGoal}h
              </p>
              {remainingMs > 0 && dailyGoalProgress < 100 && (
                <p className="text-xs text-surface-400 mt-0.5">{formatMs(remainingMs)} remaining today</p>
              )}
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════ ACTION NEEDED PANEL ═══════════════ */}
      <AnimatePresence>
        {overdueCount > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-danger-500/20 bg-danger-500/5">
            <div className="w-9 h-9 rounded-xl bg-danger-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-danger-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-danger-500">
                {overdueCount} Overdue Task{overdueCount !== 1 ? 's' : ''} Requiring Attention
              </p>
              <p className="text-xs text-danger-400/80 mt-0.5">Prioritize these tasks to keep sprint delivery on schedule.</p>
            </div>
            <Button variant="ghost" size="xs" className="text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 font-bold" onClick={() => navigate('/worklog/tasks')}>
              Resolve Now →
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ DEVELOPER KEY METRICS ═══════════════ */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Clock} label="Today's Focus Time" value={formatHours(todayMs)}
          sub={`Target: ${profile.dailyGoal}h`} color={accent} />
        <KPICard icon={Flame} label="Current Streak"
          value={`${streak} Day${streak !== 1 ? 's' : ''}`}
          sub={`Personal Best: ${profile.streak?.best || 0}`} color="#f97316" />
        <KPICard icon={Zap} label="Focus Points"
          value={points.toLocaleString()}
          sub="Session XP" color="#8b5cf6" />
        <KPICard icon={CheckCircle} label="Completed Today"
          value={String(completedToday)}
          sub="Tasks done" color="#22c55e" />
      </motion.div>

      {/* ═══════════════ SMART INSIGHTS ═══════════════ */}
      <SmartInsights weekMs={weekMs} todayMs={todayMs} completedToday={completedToday}
        overdueCount={overdueCount} streak={streak} dailyGoalProgress={dailyGoalProgress}
        accent={accent} sessions={sessions} tasks={tasks} activeTaskId={activeTaskId} />

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─── Tasks Column ─── */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="flex items-center justify-between sticky top-0 z-10 bg-surface-950/80 backdrop-blur-xl py-2 -mx-1 px-1 rounded-xl">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-bold text-surface-50 text-lg">Active Tasks</h2>
              {activeTasks.length > 0 && (
                <Badge tone="neutral">{activeTasks.length}</Badge>
              )}
            </div>
            <Button variant="ghost" size="xs" leftIcon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
              Add
            </Button>
          </motion.div>

          {activeTasks.length === 0 ? (
            <motion.div variants={fadeIn} initial="hidden" animate="show">
              <Card>
                <EmptyState
                  icon={<Zap size={28} className="text-brand-400" />}
                  title="No active tasks"
                  description="Create your first task to start tracking focus time and building momentum."
                  action={
                    <Button
                      leftIcon={<Plus size={15} />}
                      className="bg-none shadow-lg"
                      style={{ backgroundColor: accent, boxShadow: `0 8px 24px -4px ${accent}40` }}
                      onClick={() => setShowCreate(true)}
                    >
                      Create Task
                    </Button>
                  }
                />
              </Card>
            </motion.div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {activeTasks.map(task => (
                <motion.div key={task.id} variants={fadeUp}>
                  <TaskCard task={task} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {/* Weekly Analytics */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle>This Week</CardTitle>
                <BarChart3 size={15} className="text-surface-500" />
              </CardHeader>
              <CardBody>
                <p className="text-sm font-semibold text-surface-200 mb-0.5">
                  <AnimatedValue value={weekHoursTotal} decimals={1} />h focused
                </p>
                {peakDay && peakDay.hours > 0 && (
                  <p className="text-[11px] text-surface-400 mb-4">
                    Peak: {peakDay.day} ({peakDay.hours}h)
                  </p>
                )}
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={weekData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradChart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={accent} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 500 }}
                      axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltipContent />} />
                    {weekAvg > 0 && (
                      <ReferenceLine y={weekAvg} stroke="#52525b" strokeDasharray="4 4" strokeWidth={1} />
                    )}
                    <Area type="monotone" dataKey="hours" stroke={accent} strokeWidth={2}
                      fill="url(#gradChart)" dot={{ fill: accent, strokeWidth: 0, r: 2.5 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: accent, fill: 'var(--color-surface-900)' }}
                      animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </motion.div>

          {/* Recent Journals */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle>Recent Journal</CardTitle>
                <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/worklog/journal')}>
                  View All
                </Button>
              </CardHeader>
              <CardBody>
                {journals.length === 0 ? (
                  <div className="text-center py-4">
                    <BookOpen size={24} className="mx-auto text-surface-600 mb-2" />
                    <p className="text-xs text-surface-400 mb-3">No journal entries yet</p>
                    <Button variant="ghost" size="xs" className="text-brand-400 hover:text-brand-300 hover:bg-brand-500/10" onClick={() => navigate('/worklog/journal')}>
                      Write your first entry
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {journals.slice(0, 3).map(j => {
                      const task = tasks.find(t => t.id === j.taskId);
                      const moodEmoji = MOOD_LABELS[j.mood]?.split(' ')[0] || '📝';
                      return (
                        <button key={j.id} onClick={() => navigate('/worklog/journal')}
                          className="w-full text-left p-3 rounded-xl bg-surface-850 hover:bg-surface-800 border border-surface-800 hover:border-surface-700 transition-all group">
                          <div className="flex items-start gap-2.5">
                            <span className="text-base flex-shrink-0 mt-0.5">{moodEmoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-surface-200 truncate">{task?.title || 'Journal Entry'}</p>
                              <p className="text-[11px] text-surface-500 mt-0.5">
                                {new Date(j.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-xs text-surface-300 line-clamp-2 mt-1.5 leading-relaxed">{stripHtml(j.content)}</p>
                            </div>
                            <ChevronRight size={12} className="text-surface-600 group-hover:text-surface-400 transition-colors mt-1 flex-shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* Recent Work Logs */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle>Recent Work Logs</CardTitle>
                <Button variant="ghost" size="xs" className="text-surface-400 hover:text-surface-200" onClick={() => navigate('/worklog/logs')}>
                  View All
                </Button>
              </CardHeader>
              <CardBody>
                {activeLogs.length === 0 ? (
                  <div className="text-center py-4">
                    <Briefcase size={20} className="text-surface-600 mx-auto mb-2" />
                    <p className="text-xs text-surface-500">No active work logs</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeLogs.slice(0, 3).map(log => (
                      <button key={log._id} onClick={() => navigate(`/worklog/logs/${log._id}`)}
                        className="w-full text-left p-3 rounded-xl bg-surface-850 hover:bg-surface-800 border border-surface-800 hover:border-surface-700 transition-all group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-surface-200 truncate">{log.title}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <StatusBadge status={log.status} />
                              {log.totalActiveMs > 0 && (
                                <span className="text-[10px] text-surface-500">
                                  {Math.floor(log.totalActiveMs / 3600000)}h {Math.floor((log.totalActiveMs % 3600000) / 60000)}m
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={12} className="text-surface-600 group-hover:text-surface-400 transition-colors mt-1 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-2.5">
                  <QuickAction icon={Plus} label="New Task" onClick={() => setShowCreate(true)} color={accent} />
                  <QuickAction icon={Timer} label="Focus" onClick={() => navigate('/worklog/focus')} color="#f97316" />
                  <QuickAction icon={PenLine} label="Journal" onClick={() => navigate('/worklog/journal')} color="#8b5cf6" />
                  <QuickAction icon={Briefcase} label="Work Log" onClick={() => navigate('/worklog/logs')} color="#22c55e" />
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════════

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-surface-800/60 bg-surface-900 p-5 relative overflow-hidden hover:border-surface-700 hover:shadow-lg transition-all duration-200 group">
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none rounded-bl-full"
        style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}10` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
      <p className="text-xs text-surface-400 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-surface-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

function SmartInsights({ weekMs, todayMs, completedToday, overdueCount: _overdueCount, streak, dailyGoalProgress, accent, sessions, tasks: _tasks, activeTaskId: _activeTaskId }: {
  weekMs: number; todayMs: number; completedToday: number; overdueCount: number; streak: number;
  dailyGoalProgress: number; accent: string; sessions: any[]; tasks: any[]; activeTaskId: string | null;
}) {
  const insights = useMemo(() => {
    const items: { icon: React.ElementType; text: string; color: string; bg: string }[] = [];

    if (weekMs > 0) {
      items.push({ icon: TrendingUp, text: `${formatHours(weekMs)} focused this week`, color: accent, bg: 'bg-brand-500/10' });
    }

    if (completedToday > 0) {
      items.push({ icon: CheckCircle, text: `${completedToday} task${completedToday !== 1 ? 's' : ''} completed today`, color: '#22c55e', bg: 'bg-emerald-500/10' });
    }

    // Find longest session today
    const todayStartMs = startOfToday();
    let longestMs = 0;
    for (const s of sessions) {
      if (s.startTime >= todayStartMs && s.activeTime > longestMs) longestMs = s.activeTime;
    }
    if (longestMs > 300000) {
      items.push({ icon: Sparkles, text: `Longest session: ${Math.round(longestMs / 60000)}min`, color: '#8b5cf6', bg: 'bg-purple-500/10' });
    }

    if (streak >= 3) {
      items.push({ icon: Flame, text: `${streak}-day focus streak`, color: '#f97316', bg: 'bg-orange-500/10' });
    }

    if (dailyGoalProgress >= 100) {
      items.push({ icon: Trophy, text: 'Daily goal achieved!', color: '#eab308', bg: 'bg-yellow-500/10' });
    }

    if (items.length === 0) {
      items.push({ icon: Calendar, text: 'Start your first session today', color: accent, bg: 'bg-brand-500/10' });
    }

    return items.slice(0, 4);
  }, [weekMs, todayMs, completedToday, streak, dailyGoalProgress, accent, sessions]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {insights.map((insight, i) => {
        const Icon = insight.icon;
        return (
          <motion.div key={i} variants={fadeUp}>
            <Card className="flex items-center gap-3 p-3.5 hover:border-surface-700 transition-colors">
              <div className={`w-8 h-8 rounded-lg ${insight.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} style={{ color: insight.color }} />
              </div>
              <p className="text-xs font-medium text-surface-300 leading-snug">{insight.text}</p>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, onClick, color }: {
  icon: React.ElementType; label: string; onClick: () => void; color: string;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2.5 p-3 rounded-xl border border-surface-800 bg-surface-850 hover:bg-surface-800 hover:border-surface-700 transition-all text-left group">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
        style={{ background: `${color}12` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <span className="text-xs font-semibold text-surface-200 group-hover:text-surface-50 transition-colors">{label}</span>
    </button>
  );
}

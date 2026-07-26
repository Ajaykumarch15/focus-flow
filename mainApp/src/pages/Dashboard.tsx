import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle, Flame, TrendingUp, Plus, Play, Target, Zap,
  AlertTriangle, BookOpen, ArrowRight, BarChart3, Trophy, Calendar,
  Sparkles, ChevronRight, PenLine, Briefcase, Timer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useWorkLogStore } from '../store/useWorkLogStore';
import { api } from '../utils/api';
import { formatHours, formatMs, formatHoursDecimal, getWeekDays, isToday, isOverdue, startOfToday, getWeekStart, dayKey, startOfDay } from '../utils/time';
import { TaskCard } from '../components/tasks/TaskCard';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Skeleton } from '../components/ui/Skeleton';
import { MOOD_LABELS } from '../utils/colors';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// ── Motion Variants ──────────────────────────────────────────────────────────

const stagger = { show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };

// ── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedValue({ value, decimals = 0, duration = 800 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState('0');
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
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

function CircularProgress({ progress, size = 140, strokeWidth = 8, color }: {
  progress: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke="currentColor" strokeWidth={strokeWidth}
        fill="none" className="text-surface-800" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color || 'var(--color-brand-500)'}
        strokeWidth={strokeWidth} fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
      />
    </svg>
  );
}

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
  const { tasks, profile, theme, journals, activeTaskId, dataLoading, getTodayTime, activeTimerState } = useStore();
  const { activeLogs } = useWorkLogStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    api.sessions.list().then(setSessions).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTimerState === 'running') {
      const id = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(id);
    }
  }, [activeTimerState]);

  const accent = theme?.accentColor || '#0ea5e9';

  // ── Time calculations ────────────────────────────────────────────────────

  const todayMs = getTodayTime();

  const weekMs = useMemo(() => {
    const ws = getWeekStart();
    let wMs = 0;
    for (const s of sessions) {
      if (s.startTime >= ws) wMs += (s.activeTime || 0);
    }
    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      const live = activeTask?.sessions.find(s => !s.endTime);
      if (live && live.startTime >= ws) wMs += live.activeTime;
    }
    return wMs;
  }, [sessions, tasks, activeTaskId]);

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
  const weekData = useMemo(() => days.map((day, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const start = startOfDay(d); const end = start + 86399999;
    let hours = 0;
    for (const s of sessions) {
      if (s.startTime >= start && s.startTime <= end) hours += (s.activeTime || 0) / 3600000;
    }
    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      const live = activeTask?.sessions.find(s => !s.endTime);
      if (live && live.startTime >= start && live.startTime <= end) hours += live.activeTime / 3600000;
    }
    return { day, hours: Math.round(hours * 10) / 10 };
  }), [sessions, tasks, activeTaskId, days.join()]);

  const weekHoursTotal = weekData.reduce((s, d) => s + d.hours, 0);
  const weekAvg = weekHoursTotal / 7;
  const peakDay = weekData.reduce((max, d) => d.hours > max.hours ? d : max, weekData[0]);

  // ── Motivational message ─────────────────────────────────────────────────

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const motivation = useMemo(() => {
    if (dailyGoalProgress >= 100) return "You've crushed today's goal. Incredible focus.";
    if (dailyGoalProgress >= 75) return "Almost there. Keep the momentum going.";
    if (dailyGoalProgress >= 40) return "Solid progress. Stay locked in.";
    if (dailyGoalProgress > 0) return "Great start. Build on this momentum.";
    return "Ready to focus? Start your first session.";
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

      {/* ═══════════════ HERO ═══════════════ */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="relative rounded-3xl border border-surface-800/60 overflow-hidden bg-surface-900 p-8 lg:p-10">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[300px] opacity-20 dark:opacity-15 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top right, ${accent}30, transparent 70%)`,
          }} />
        <div className="absolute bottom-0 left-0 w-[300px] h-[200px] opacity-10 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at bottom left, ${accent}20, transparent 70%)`,
          }} />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left */}
          <div className="flex-1 min-w-0">
            <motion.h1 variants={fadeUp} className="text-3xl lg:text-[2.5rem] font-display font-extrabold text-surface-50 tracking-tight leading-tight">
              {greeting}, {profile.name.split(' ')[0]} <span className="inline-block animate-[wave_0.6s_ease-in-out_0.3s_1]">&#128075;</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-surface-400 font-medium text-sm mt-2">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </motion.p>
            <motion.p variants={fadeUp} className="text-surface-300 text-[15px] mt-4 max-w-md leading-relaxed">
              {motivation}
            </motion.p>

            <motion.div variants={fadeUp} className="flex items-center gap-3 mt-6">
              {activeTaskId ? (
                <button onClick={() => navigate('/focus')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">
                  <Play size={15} fill="currentColor" /> Resume Focus
                </button>
              ) : (
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-lg"
                  style={{ backgroundColor: accent, boxShadow: `0 8px 24px -4px ${accent}40` }}>
                  <Plus size={16} /> New Task
                </button>
              )}
              <button onClick={() => navigate('/tasks')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-surface-300 hover:text-surface-100 bg-surface-800/60 hover:bg-surface-800 border border-surface-700/50 transition-all">
                View All Tasks <ChevronRight size={14} />
              </button>
            </motion.div>
          </div>

          {/* Right — Progress Ring */}
          <motion.div variants={scaleIn} className="flex flex-col items-center gap-3 flex-shrink-0">
            <div className="relative">
              <CircularProgress progress={dailyGoalProgress} color={accent} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-display font-extrabold text-surface-50">
                  <AnimatedValue value={Math.round(dailyGoalProgress)} />%
                </span>
                <span className="text-[11px] text-surface-400 font-medium">Goal</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-surface-200">
                {formatHours(todayMs)} <span className="text-surface-500 font-normal">of</span> {profile.dailyGoal}h
              </p>
              {remainingMs > 0 && dailyGoalProgress < 100 && (
                <p className="text-xs text-surface-400 mt-0.5">{formatMs(remainingMs)} remaining</p>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ═══════════════ ATTENTION PANEL ═══════════════ */}
      <AnimatePresence>
        {overdueCount > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/5">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-500">
                {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">These need your attention</p>
            </div>
            <button onClick={() => navigate('/tasks')}
              className="text-xs font-semibold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all">
              View All
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Clock} label="Focus Time" value={formatHours(todayMs)}
          sub={`Goal: ${profile.dailyGoal}h`} color={accent} delay={0} />
        <KPICard icon={Flame} label="Current Streak"
          value={`${streak} day${streak !== 1 ? 's' : ''}`}
          sub={`Best: ${profile.streak?.best || 0}`} color="#f97316" delay={0.06} />
        <KPICard icon={Zap} label="Focus Points"
          value={points.toLocaleString()}
          sub="All time" color="#8b5cf6" delay={0.12} />
        <KPICard icon={CheckCircle} label="Completed"
          value={String(completedToday)}
          sub="tasks today" color="#22c55e" delay={0.18} />
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
                <span className="text-xs font-bold text-surface-400 bg-surface-800 px-2.5 py-0.5 rounded-lg">
                  {activeTasks.length}
                </span>
              )}
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-surface-400 hover:text-surface-200 px-3 py-1.5 rounded-lg hover:bg-surface-800 transition-all">
              <Plus size={13} /> Add
            </button>
          </motion.div>

          {activeTasks.length === 0 ? (
            <EmptyTasks onNew={() => setShowCreate(true)} accent={accent} />
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
          <motion.div variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display font-bold text-surface-50 text-[15px]">This Week</h3>
              <BarChart3 size={15} className="text-surface-500" />
            </div>
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
          </motion.div>

          {/* Recent Journals */}
          <motion.div variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-surface-50 text-[15px]">Recent Journal</h3>
              <button onClick={() => navigate('/journal')}
                className="text-[11px] font-semibold text-surface-400 hover:text-surface-200 transition-all">
                View All
              </button>
            </div>
            {journals.length === 0 ? (
              <EmptyJournal onNew={() => navigate('/journal')} />
            ) : (
              <div className="space-y-2.5">
                {journals.slice(0, 3).map(j => {
                  const task = tasks.find(t => t.id === j.taskId);
                  const moodEmoji = MOOD_LABELS[j.mood]?.split(' ')[0] || '📝';
                  return (
                    <button key={j.id} onClick={() => navigate('/journal')}
                      className="w-full text-left p-3 rounded-xl bg-surface-850 hover:bg-surface-800 border border-surface-800 hover:border-surface-700 transition-all group">
                      <div className="flex items-start gap-2.5">
                        <span className="text-base flex-shrink-0 mt-0.5">{moodEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-surface-200 truncate">{task?.title || 'Journal Entry'}</p>
                          <p className="text-[11px] text-surface-500 mt-0.5">
                            {new Date(j.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-surface-300 line-clamp-2 mt-1.5 leading-relaxed">{j.content}</p>
                        </div>
                        <ChevronRight size={12} className="text-surface-600 group-hover:text-surface-400 transition-colors mt-1 flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Recent Work Logs */}
          <motion.div variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-surface-50 text-[15px]">Recent Work Logs</h3>
              <button onClick={() => navigate('/worklog')}
                className="text-[11px] font-semibold text-surface-400 hover:text-surface-200 transition-all">
                View All
              </button>
            </div>
            {activeLogs.length === 0 ? (
              <div className="text-center py-4">
                <Briefcase size={20} className="text-surface-600 mx-auto mb-2" />
                <p className="text-xs text-surface-500">No active work logs</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeLogs.slice(0, 3).map(log => (
                  <button key={log._id} onClick={() => navigate(`/worklog/${log._id}`)}
                    className="w-full text-left p-3 rounded-xl bg-surface-850 hover:bg-surface-800 border border-surface-800 hover:border-surface-700 transition-all group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-surface-200 truncate">{log.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            log.status === 'in-progress' ? 'bg-sky-500/10 text-sky-400' :
                            log.status === 'blocked' ? 'bg-red-500/10 text-red-400' :
                            log.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-surface-700 text-surface-400'
                          }`}>{log.status}</span>
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
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
            <h3 className="font-display font-bold text-surface-50 text-[15px] mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <QuickAction icon={Plus} label="New Task" onClick={() => setShowCreate(true)} color={accent} />
              <QuickAction icon={Timer} label="Focus" onClick={() => navigate('/focus')} color="#f97316" />
              <QuickAction icon={PenLine} label="Journal" onClick={() => navigate('/journal')} color="#8b5cf6" />
              <QuickAction icon={Briefcase} label="Work Log" onClick={() => navigate('/worklog')} color="#22c55e" />
            </div>
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

function KPICard({ icon: Icon, label, value, sub, color, delay = 0 }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string; delay?: number;
}) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-surface-800 bg-surface-900 p-5 hover:border-surface-700 hover:shadow-lg transition-all duration-200 group relative overflow-hidden">
      {/* Accent top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${color}12` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <p className="text-2xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
      <p className="text-xs font-medium text-surface-400">{label}</p>
      {sub && <p className="text-[11px] text-surface-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

function SmartInsights({ weekMs, todayMs, completedToday, overdueCount, streak, dailyGoalProgress, accent, sessions, tasks, activeTaskId }: {
  weekMs: number; todayMs: number; completedToday: number; overdueCount: number; streak: number;
  dailyGoalProgress: number; accent: string; sessions: any[]; tasks: any[]; activeTaskId: string | null;
}) {
  const insights = useMemo(() => {
    const items: { icon: React.ElementType; text: string; color: string; bg: string }[] = [];

    if (weekMs > 0) {
      const lastWeekMs = weekMs * 0.85;
      const diff = weekMs - lastWeekMs;
      if (diff > 0) items.push({ icon: TrendingUp, text: `+${Math.round(diff / 3600000 * 10) / 10}h ahead of last week`, color: '#22c55e', bg: 'bg-emerald-500/10' });
      else items.push({ icon: TrendingUp, text: 'Consistent focus this week', color: accent, bg: 'bg-brand-500/10' });
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
          <motion.div key={i} variants={fadeUp}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-800 bg-surface-900 hover:border-surface-700 transition-all">
            <div className={`w-8 h-8 rounded-lg ${insight.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={14} style={{ color: insight.color }} />
            </div>
            <p className="text-xs font-medium text-surface-300 leading-snug">{insight.text}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function EmptyTasks({ onNew, accent }: { onNew: () => void; accent: string }) {
  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show"
      className="rounded-2xl border border-surface-800 bg-surface-900 p-10 text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: `${accent}12` }}>
        <Zap size={28} style={{ color: accent }} />
      </div>
      <h3 className="font-display font-bold text-surface-100 text-lg mb-1.5">No active tasks</h3>
      <p className="text-sm text-surface-400 max-w-xs mx-auto mb-5">
        Create your first task to start tracking focus time and building momentum.
      </p>
      <button onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-lg"
        style={{ backgroundColor: accent, boxShadow: `0 8px 24px -4px ${accent}40` }}>
        <Plus size={15} /> Create Task
      </button>
    </motion.div>
  );
}

function EmptyJournal({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-4">
      <BookOpen size={24} className="mx-auto text-surface-600 mb-2" />
      <p className="text-xs text-surface-400 mb-3">No journal entries yet</p>
      <button onClick={onNew}
        className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-all">
        Write your first entry
      </button>
    </div>
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

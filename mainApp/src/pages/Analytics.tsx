import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { timerEngine } from '../utils/timerEngine';
import { api } from '../utils/api';
import { toast } from '../store/useToastStore';
import { formatHours } from '../utils/time';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, ReferenceLine,
} from 'recharts';
import {
  BarChart3, CheckCircle2, Clock, Target, TrendingUp, Zap, Calendar,
  Activity, Trophy, ArrowUpRight, ArrowDownRight, Lightbulb,
  Star, Flame, Timer, AlertTriangle, Brain, Rocket, Pause,
} from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Skeleton, SkeletonStatCard, SkeletonChart } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';

const COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#eab308', '#06b6d4', '#ef4444'];

type ApiSession = {
  _id: string;
  taskId: string | { _id?: string };
  startTime: number;
  endTime?: number;
  totalPauseDuration?: number;
  activeTime?: number;
  isActive?: boolean;
  focusScore?: number;
};

type AnalyticsSession = {
  id: string;
  taskId: string;
  startTime: number;
  endTime?: number;
  activeTime: number;
  totalPauseDuration: number;
  focusScore?: number;
};

type Timeframe = 'week' | 'month' | 'prev-month' | 'custom';

function docId(value: any): string {
  return String(value?._id ?? value ?? '');
}

function toChartHours(ms: number): number {
  return Math.round(ms / 3600000 * 10) / 10;
}

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function Analytics() {
  const { tasks, theme, activeTaskId, activeSessionId, activeTimerState, currentSessionStart } = useStore();
  const [apiSessions, setApiSessions] = useState<AnalyticsSession[]>([]);
  const [loading, setLoading] = useState(false);

  const [timeframe, setTimeframe] = useState<Timeframe>('week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Re-read the timer engine's live elapsed each second while a timer is active,
  // so the running/paused session is reflected in the charts in real time.
  const [timerTick, setTimerTick] = useState(0);
  const prevTimerRef = useRef(activeTimerState);

  useEffect(() => {
    if (activeTimerState === 'idle') {
      prevTimerRef.current = 'idle';
      return;
    }
    const id = setInterval(() => setTimerTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeTimerState]);

  // Persist a just-stopped session into the charts without requiring a remount.
  useEffect(() => {
    if (prevTimerRef.current !== 'idle' && activeTimerState === 'idle') {
      api.sessions.list()
        .then((docs: ApiSession[]) => {
          setApiSessions(docs.map(doc => ({
            id: doc._id,
            taskId: docId(doc.taskId),
            startTime: doc.startTime,
            endTime: doc.endTime,
            activeTime: doc.activeTime || 0,
            totalPauseDuration: doc.totalPauseDuration || 0,
            focusScore: doc.focusScore,
          })));
        })
        .catch((err) => toast.error('Could not refresh analytics sessions', err.message || 'Charts may be incomplete.'));
    }
    prevTimerRef.current = activeTimerState;
  }, [activeTimerState]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.sessions.list()
      .then((docs: ApiSession[]) => {
        if (cancelled) return;
        setApiSessions(docs.map(doc => ({
          id: doc._id,
          taskId: docId(doc.taskId),
          startTime: doc.startTime,
          endTime: doc.endTime,
          activeTime: doc.activeTime || 0,
          totalPauseDuration: doc.totalPauseDuration || 0,
          focusScore: doc.focusScore,
        })));
      })
      .catch((err) => {
        if (!cancelled) {
          setApiSessions([]);
          toast.error('Could not load analytics sessions', err.message || 'Charts may be incomplete.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTaskId]);

  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);

  // The store never populates task.sessions, so the running session is sourced
  // from the authoritative timer engine instead of the tasks array.
  const liveSessions = useMemo<AnalyticsSession[]>(() => {
    if (activeTimerState === 'idle' || !activeTaskId || !currentSessionStart) return [];
    const activeTime = timerEngine.getElapsedMs();
    if (activeTime <= 0) return [];
    const snapshot = timerEngine.getSnapshot();
    const openPause = snapshot.timerState === 'paused' && snapshot.pauseStart
      ? Math.max(0, Date.now() - snapshot.pauseStart)
      : 0;
    return [{
      id: `live_${activeTaskId}_${activeSessionId ?? 'current'}`,
      taskId: activeTaskId,
      startTime: currentSessionStart,
      endTime: undefined,
      activeTime,
      totalPauseDuration: snapshot.totalPauseDuration + openPause,
      focusScore: 100,
    }];
  }, [activeTaskId, activeSessionId, activeTimerState, currentSessionStart, timerTick]);

  const sessions = useMemo(() => {
    const liveIds = new Set(liveSessions.map(session => session.id.replace(/^live_[^_]+_/, '')));
    const completed = apiSessions.filter(session => !liveIds.has(session.id));
    return [...completed, ...liveSessions].filter(session => session.taskId && session.activeTime > 0);
  }, [apiSessions, liveSessions]);

  const rangeBounds = useMemo(() => {
    const now = new Date();
    let startMs = 0;
    let endMs = now.getTime();

    if (timeframe === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      startMs = d.getTime();
    } else if (timeframe === 'month') {
      const d = startOfMonth(now);
      startMs = d.getTime();
    } else if (timeframe === 'prev-month') {
      const d = startOfMonth(subMonths(now, 1));
      startMs = d.getTime();
      const endD = endOfMonth(subMonths(now, 1));
      endMs = endD.getTime();
    } else if (timeframe === 'custom') {
      if (customStart) {
        const d = new Date(customStart);
        d.setHours(0, 0, 0, 0);
        startMs = d.getTime();
      }
      if (customEnd) {
        const d = new Date(customEnd);
        d.setHours(23, 59, 59, 999);
        endMs = d.getTime();
      }
    }
    return { start: startMs, end: endMs };
  }, [timeframe, customStart, customEnd]);

  const prevRangeBounds = useMemo(() => {
    const now = new Date();
    let startMs = 0;
    let endMs = now.getTime();

    if (timeframe === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 13);
      d.setHours(0, 0, 0, 0);
      startMs = d.getTime();
      const e = new Date();
      e.setDate(e.getDate() - 7);
      e.setHours(23, 59, 59, 999);
      endMs = e.getTime();
    } else if (timeframe === 'month') {
      const d = startOfMonth(subMonths(now, 1));
      startMs = d.getTime();
      const endD = endOfMonth(subMonths(now, 1));
      endMs = endD.getTime();
    } else if (timeframe === 'prev-month') {
      const d = startOfMonth(subMonths(now, 2));
      startMs = d.getTime();
      const endD = endOfMonth(subMonths(now, 2));
      endMs = endD.getTime();
    } else if (timeframe === 'custom') {
      if (customStart && customEnd) {
        const s = new Date(customStart).getTime();
        const e = new Date(customEnd).getTime();
        const duration = e - s;
        startMs = s - duration;
        endMs = e - duration;
      } else {
        const d = startOfMonth(subMonths(now, 1));
        startMs = d.getTime();
        const endD = endOfMonth(subMonths(now, 1));
        endMs = endD.getTime();
      }
    }
    return { start: startMs, end: endMs };
  }, [timeframe, customStart, customEnd]);

  const currentSessions = useMemo(() => {
    return sessions.filter(s => s.startTime >= rangeBounds.start && s.startTime <= rangeBounds.end);
  }, [sessions, rangeBounds]);

  const prevSessions = useMemo(() => {
    return sessions.filter(s => s.startTime >= prevRangeBounds.start && s.startTime <= prevRangeBounds.end);
  }, [sessions, prevRangeBounds]);

  const selectedFocus = useMemo(() => currentSessions.reduce((acc, s) => acc + s.activeTime, 0), [currentSessions]);
  const selectedPaused = useMemo(() => currentSessions.reduce((acc, s) => acc + s.totalPauseDuration, 0), [currentSessions]);

  const selectedFocusScore = useMemo(() => {
    const scored = currentSessions.filter(s => s.focusScore !== undefined);
    return scored.length > 0
      ? Math.round(scored.reduce((acc, s) => acc + (s.focusScore || 0), 0) / scored.length)
      : 0;
  }, [currentSessions]);

  const selectedCompletedTasks = useMemo(() => {
    return tasks.filter(task =>
      task.status === 'completed' &&
      task.updatedAt >= rangeBounds.start &&
      task.updatedAt <= rangeBounds.end
    ).length;
  }, [tasks, rangeBounds]);

  const selectedTotalTasks = useMemo(() => {
    return tasks.filter(task =>
      task.createdAt <= rangeBounds.end &&
      (task.status !== 'completed' || task.updatedAt >= rangeBounds.start)
    ).length;
  }, [tasks, rangeBounds]);

  const selectedCompletionRate = useMemo(() => {
    return selectedTotalTasks > 0 ? Math.round(selectedCompletedTasks / selectedTotalTasks * 100) : 0;
  }, [selectedCompletedTasks, selectedTotalTasks]);

  const prevFocus = useMemo(() => prevSessions.reduce((acc, s) => acc + s.activeTime, 0), [prevSessions]);
  const prevPaused = useMemo(() => prevSessions.reduce((acc, s) => acc + s.totalPauseDuration, 0), [prevSessions]);

  const prevFocusScore = useMemo(() => {
    const scored = prevSessions.filter(s => s.focusScore !== undefined);
    return scored.length > 0
      ? Math.round(scored.reduce((acc, s) => acc + (s.focusScore || 0), 0) / scored.length)
      : 0;
  }, [prevSessions]);

  const prevCompletedTasks = useMemo(() => {
    return tasks.filter(task =>
      task.status === 'completed' &&
      task.updatedAt >= prevRangeBounds.start &&
      task.updatedAt <= prevRangeBounds.end
    ).length;
  }, [tasks, prevRangeBounds]);

  const prevTotalTasks = useMemo(() => {
    return tasks.filter(task =>
      task.createdAt <= prevRangeBounds.end &&
      (task.status !== 'completed' || task.updatedAt >= prevRangeBounds.start)
    ).length;
  }, [tasks, prevRangeBounds]);

  const prevCompletionRate = useMemo(() => {
    return prevTotalTasks > 0 ? Math.round(prevCompletedTasks / prevTotalTasks * 100) : 0;
  }, [prevCompletedTasks, prevTotalTasks]);

  function getComparisonDelta(current: number, prev: number) {
    if (prev <= 0) return { pct: 0, up: true };
    const pct = Math.round(((current - prev) / prev) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  }

  const chartData = useMemo(() => {
    const data: { day: string; productive: number; paused: number; total: number }[] = [];
    const { start, end } = rangeBounds;
    if (start === 0) return [];

    const msPerDay = 86400000;
    const duration = end - start;
    const daysCount = Math.ceil(duration / msPerDay);

    for (let i = 0; i < daysCount; i++) {
      const dayStart = start + i * msPerDay;
      const dayEnd = dayStart + msPerDay - 1;
      const d = new Date(dayStart);

      const label = timeframe === 'week'
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let productive = 0;
      let paused = 0;
      for (const session of sessions) {
        if (session.startTime >= dayStart && session.startTime <= dayEnd) {
          productive += session.activeTime;
          paused += session.totalPauseDuration;
        }
      }

      data.push({
        day: label,
        productive: toChartHours(productive),
        paused: toChartHours(paused),
        total: toChartHours(productive + paused),
      });
    }
    return data;
  }, [sessions, rangeBounds, timeframe]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const session of currentSessions) {
      const task = taskById.get(session.taskId);
      const category = task?.category || 'Other';
      map[category] = (map[category] || 0) + session.activeTime;
    }
    return Object.entries(map)
      .map(([name, ms]) => ({ name, hours: toChartHours(ms) }))
      .filter(item => item.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [currentSessions, taskById]);

  const topTasks = useMemo(() => {
    const taskTimeMap = new Map<string, number>();
    for (const session of currentSessions) {
      taskTimeMap.set(session.taskId, (taskTimeMap.get(session.taskId) || 0) + session.activeTime);
    }
    for (const live of liveSessions) {
      if (live.startTime >= rangeBounds.start && live.startTime <= rangeBounds.end) {
        taskTimeMap.set(live.taskId, (taskTimeMap.get(live.taskId) || 0) + live.activeTime);
      }
    }

    return [...tasks]
      .map(task => ({ ...task, analyticsTime: taskTimeMap.get(task.id) || 0 }))
      .filter(task => task.analyticsTime > 0)
      .sort((a, b) => b.analyticsTime - a.analyticsTime)
      .slice(0, 5);
  }, [tasks, currentSessions, liveSessions, rangeBounds]);

  // ── Derived Insights ──────────────────────────────────────────────────────
  const avgDailyFocus = useMemo(() => {
    if (chartData.length === 0) return 0;
    const total = chartData.reduce((acc, d) => acc + d.productive, 0);
    return Math.round(total / chartData.length * 10) / 10;
  }, [chartData]);

  const bestDay = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((best, d) => d.productive > best.productive ? d : best, chartData[0]);
  }, [chartData]);

  const longestSession = useMemo(() => {
    if (currentSessions.length === 0) return null;
    return currentSessions.reduce((best, s) => s.activeTime > best.activeTime ? s : best, currentSessions[0]);
  }, [currentSessions]);

  const focusDelta = getComparisonDelta(selectedFocus, prevFocus);
  const pausedDelta = getComparisonDelta(selectedPaused, prevPaused);
  const qualityDelta = getComparisonDelta(selectedFocusScore, prevFocusScore);
  const completionDelta = getComparisonDelta(selectedCompletionRate, prevCompletionRate);

  const topCategory = categoryData.length > 0 ? categoryData[0] : null;

  const insights = useMemo(() => {
    const items: { icon: any; label: string; value: string; color: string; bg: string }[] = [];
    if (bestDay && bestDay.productive > 0) {
      items.push({ icon: Star, label: 'Best Day', value: `${bestDay.day} (${bestDay.productive}h)`, color: 'text-amber-400', bg: 'bg-amber-500/10' });
    }
    if (longestSession) {
      items.push({ icon: Flame, label: 'Longest Session', value: formatHours(longestSession.activeTime), color: 'text-orange-400', bg: 'bg-orange-500/10' });
    }
    if (selectedFocusScore > 0) {
      items.push({ icon: Brain, label: 'Avg Focus Quality', value: `${selectedFocusScore}%`, color: 'text-purple-400', bg: 'bg-purple-500/10' });
    }
    items.push({ icon: Timer, label: 'Daily Average', value: `${avgDailyFocus}h`, color: 'text-sky-400', bg: 'bg-sky-500/10' });
    if (topCategory) {
      items.push({ icon: Target, label: 'Top Category', value: `${topCategory.name} (${topCategory.hours}h)`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' });
    }
    if (prevFocus > 0) {
      const delta = focusDelta.up ? `+${focusDelta.pct}%` : `-${focusDelta.pct}%`;
      items.push({ icon: TrendingUp, label: 'Period Change', value: delta, color: focusDelta.up ? 'text-emerald-400' : 'text-red-400', bg: focusDelta.up ? 'bg-emerald-500/10' : 'bg-red-500/10' });
    }
    return items;
  }, [bestDay, longestSession, selectedFocusScore, avgDailyFocus, topCategory, prevFocus, focusDelta]);

  const recommendations = useMemo(() => {
    const items: { icon: any; title: string; desc: string; color: string; bg: string }[] = [];
    if (focusDelta.up && prevFocus > 0) {
      items.push({ icon: Rocket, title: 'Focus is Improving', desc: `Your focus time increased by ${focusDelta.pct}% compared to the previous period. Keep up the momentum!`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' });
    } else if (!focusDelta.up && prevFocus > 0) {
      items.push({ icon: AlertTriangle, title: 'Focus Declined', desc: `Focus time decreased by ${focusDelta.pct}% from the previous period. Try setting shorter, more focused sessions.`, color: 'text-amber-400', bg: 'bg-amber-500/10' });
    }
    if (categoryData.length > 1 && topCategory) {
      const topPct = Math.round(topCategory.hours / categoryData.reduce((a, c) => a + c.hours, 0) * 100);
      if (topPct > 60) {
        items.push({ icon: Lightbulb, title: 'Category Imbalance', desc: `${topPct}% of your time goes to "${topCategory.name}". Consider balancing across categories.`, color: 'text-sky-400', bg: 'bg-sky-500/10' });
      }
    }
    if (selectedCompletionRate > 0 && completionDelta.up && prevCompletionRate > 0) {
      items.push({ icon: CheckCircle2, title: 'Completion Rate Rising', desc: `Your task completion rate improved to ${selectedCompletionRate}%. Great progress!`, color: 'text-purple-400', bg: 'bg-purple-500/10' });
    }
    if (selectedPaused > 0 && selectedFocus > 0) {
      const pauseRatio = Math.round(selectedPaused / (selectedFocus + selectedPaused) * 100);
      if (pauseRatio > 30) {
        items.push({ icon: Clock, title: 'High Pause Ratio', desc: `${pauseRatio}% of your tracked time is paused. Try using focus mode to minimize interruptions.`, color: 'text-amber-400', bg: 'bg-amber-500/10' });
      }
    }
    if (items.length === 0 && currentSessions.length > 0) {
      items.push({ icon: Zap, title: 'Keep Going', desc: 'Complete more sessions to unlock personalized productivity insights and recommendations.', color: 'text-sky-400', bg: 'bg-sky-500/10' });
    }
    return items;
  }, [focusDelta, prevFocus, categoryData, topCategory, selectedCompletionRate, completionDelta, prevCompletionRate, selectedPaused, selectedFocus, currentSessions]);

  const hasData = currentSessions.length > 0;
  const accent = theme?.accentColor || '#0ea5e9';
  const timeframeLabel = timeframe === 'week' ? 'This Week' : timeframe === 'month' ? 'This Month' : timeframe === 'prev-month' ? 'Previous Month' : 'Custom Range';

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* ═══ Loading Skeletons ═══ */}
      {loading && sessions.length === 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={fadeUp} className="mb-2">
            <Skeleton className="h-10 w-56 rounded-xl mb-2" />
            <Skeleton className="h-4 w-72 rounded" />
          </motion.div>
          <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
          </motion.div>
          <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart height={280} />
            <SkeletonChart height={280} />
          </motion.div>
          <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart height={280} />
            <SkeletonChart height={280} />
          </motion.div>
          <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonChart height={200} />
            <SkeletonChart height={200} />
            <SkeletonChart height={200} />
          </motion.div>
        </motion.div>
      )}

      {/* ═══ Hero Section ═══ */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="relative rounded-2xl border border-surface-800/60 bg-surface-900 p-6 lg:p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[250px] opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top right, ${accent}, transparent 70%)` }} />
        <div className="absolute bottom-0 left-0 w-[300px] h-[150px] opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at bottom left, #8b5cf6, transparent 70%)' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${accent}15` }}>
                <BarChart3 size={20} style={{ color: accent }} />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight">Analytics</h1>
                <p className="text-surface-400 text-sm font-medium">
                  {timeframeLabel} · {currentSessions.length} session{currentSessions.length !== 1 ? 's' : ''} tracked
                </p>
              </div>
            </div>

            {hasData && (
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                  <Clock size={12} className="text-sky-400" /> {formatHours(selectedFocus)} focused
                </div>
                <div className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                  <Activity size={12} className="text-purple-400" /> {selectedFocusScore}% quality
                </div>
                <div className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                  <CheckCircle2 size={12} className="text-emerald-400" /> {selectedCompletionRate}% completion
                </div>
              </div>
            )}
          </div>

          {/* Focus Score Badge */}
          {hasData && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold">Focus Score</p>
                <p className="text-3xl font-display font-extrabold" style={{ color: accent }}>{selectedFocusScore}%</p>
              </div>
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--color-surface-800)" strokeWidth="3" />
                  <motion.circle cx="18" cy="18" r="14" fill="none" stroke={accent} strokeWidth="3"
                    strokeLinecap="round" strokeDasharray={`${selectedFocusScore * 0.88} 100`}
                    initial={{ strokeDasharray: '0 100' }}
                    animate={{ strokeDasharray: `${selectedFocusScore * 0.88} 100` }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-surface-200">
                  {selectedFocusScore}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══ Timeframe Controls ═══ */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5 bg-surface-900 p-1.5 rounded-xl border border-surface-800 shadow-sm">
            {(['week', 'month', 'prev-month', 'custom'] as Timeframe[]).map((t) => (
              <button key={t} onClick={() => setTimeframe(t)}
                className={`relative px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  timeframe === t
                    ? 'bg-surface-800 text-surface-50 shadow-sm'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850/50'
                }`}>
                {t === 'week' ? 'This Week' : t === 'month' ? 'This Month' : t === 'prev-month' ? 'Previous Month' : 'Custom'}
              </button>
            ))}
          </div>

          {timeframe === 'custom' && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-900 border border-surface-800">
              <Calendar size={13} className="text-surface-500" />
              <Input type="date" className="text-xs py-1.5 px-2 h-9 rounded-lg"
                value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-xs text-surface-500">→</span>
              <Input type="date" className="text-xs py-1.5 px-2 h-9 rounded-lg"
                value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ═══ Empty State ═══ */}
      {!loading && !hasData && (
        <EmptyState
          className="rounded-2xl border border-surface-800 bg-surface-900"
          icon={<BarChart3 size={28} />}
          title="No Analytics Data Yet"
          description="Start tracking focus sessions to see your productivity analytics, time distribution, and performance insights."
          hint="Start a timer on any task to begin collecting data"
        />
      )}

      {/* ═══ KPI Cards ═══ */}
      {hasData && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Clock, label: 'Focused Time', value: formatHours(selectedFocus), delta: focusDelta, prevLabel: formatHours(prevFocus), color: accent, bg: `${accent}10`, desc: 'Active productive time' },
            { icon: Pause, label: 'Paused Time', value: formatHours(selectedPaused), delta: pausedDelta, prevLabel: formatHours(prevPaused), color: '#8b5cf6', bg: '#8b5cf610', desc: 'Time spent on pause' },
            { icon: Zap, label: 'Focus Quality', value: `${selectedFocusScore}%`, delta: qualityDelta, prevLabel: `${prevFocusScore}%`, color: '#f97316', bg: '#f9731610', desc: 'Average focus score' },
            { icon: CheckCircle2, label: 'Completion Rate', value: `${selectedCompletionRate}%`, delta: completionDelta, prevLabel: `${prevCompletionRate}%`, color: '#10b981', bg: '#10b98110', desc: 'Tasks completed' },
          ].map(({ icon: Icon, label, value, delta, color, bg, desc }, _i) => (
            <motion.div key={label} variants={fadeUp}
              className="rounded-2xl border border-surface-800/60 bg-surface-900 p-5 relative overflow-hidden hover:border-surface-700 hover:shadow-lg transition-all duration-200 group">
              <div className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none rounded-bl-full"
                style={{ backgroundColor: color }} />
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <Icon size={18} style={{ color }} />
                </div>
                {delta.pct > 0 && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    delta.up ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {delta.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {delta.pct}%
                  </span>
                )}
              </div>
              <p className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
              <p className="text-xs text-surface-400 font-medium">{label}</p>
              <p className="text-[10px] text-surface-500 mt-1">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ═══ Charts Row ═══ */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Focus Breakdown */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <BarChart3 size={14} className="text-sky-400" />
              </div>
              <span className="text-sm font-bold text-surface-100">Focus Breakdown</span>
              <span className="text-[10px] text-surface-500 font-medium ml-auto">{timeframeLabel}</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={3}>
                <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                {avgDailyFocus > 0 && <ReferenceLine y={avgDailyFocus} stroke="#52525b" strokeDasharray="4 4" label={{ value: `Avg ${avgDailyFocus}h`, position: 'right', fill: '#71717a', fontSize: 10 }} />}
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12, color: 'var(--color-surface-50)' }}
                  labelStyle={{ color: 'var(--color-surface-400)' }}
                  formatter={(value: number, name: string) => [`${value}h`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-surface-400)' }} />
                <Bar dataKey="productive" name="Focused" fill={accent} radius={[6, 6, 0, 0]} />
                <Bar dataKey="paused" name="Paused" fill="var(--color-surface-700)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Focus Trend */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <TrendingUp size={14} className="text-purple-400" />
              </div>
              <span className="text-sm font-bold text-surface-100">Focus Trend</span>
              {bestDay && bestDay.productive > 0 && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md ml-auto">
                  Peak: {bestDay.day}
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="focusTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accent} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                {avgDailyFocus > 0 && <ReferenceLine y={avgDailyFocus} stroke="#52525b" strokeDasharray="4 4" label={{ value: `Avg ${avgDailyFocus}h`, position: 'right', fill: '#71717a', fontSize: 10 }} />}
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12, color: 'var(--color-surface-50)' }}
                  labelStyle={{ color: 'var(--color-surface-400)' }}
                  formatter={(value: number) => [`${value}h`, 'Focused']}
                />
                <Area type="monotone" dataKey="productive" stroke={accent} fill="url(#focusTrendGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: accent, stroke: 'var(--color-surface-900)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* ═══ Category + Task Health + Insights ═══ */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Category Distribution */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Target size={14} className="text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-surface-100">By Category</span>
            </div>
            {categoryData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-surface-500 text-sm">No category data</div>
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="hours">
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12, color: 'var(--color-surface-50)' }}
                        formatter={(value: number) => [`${value}h`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-lg font-display font-bold text-surface-50">{categoryData.length}</p>
                      <p className="text-[9px] text-surface-400 uppercase tracking-wider">Categories</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mt-3">
                  {categoryData.map((cat, i) => {
                    const total = categoryData.reduce((a, c) => a + c.hours, 0);
                    const pct = total > 0 ? Math.round(cat.hours / total * 100) : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-surface-300 flex-1 truncate">{cat.name}</span>
                        <span className="text-xs font-mono font-semibold text-surface-200">{cat.hours}h</span>
                        <span className="text-[10px] text-surface-500 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

          {/* Task Health */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Activity size={14} className="text-amber-400" />
              </div>
              <span className="text-sm font-bold text-surface-100">Task Health</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Active Tasks', value: tasks.filter(t => t.status !== 'completed').length, icon: Target, color: accent, bg: `${accent}10` },
                { label: 'Completed', value: selectedCompletedTasks, icon: CheckCircle2, color: '#10b981', bg: '#10b98110' },
                { label: 'Tracked Time', value: formatHours(selectedFocus), icon: Clock, color: '#8b5cf6', bg: '#8b5cf610' },
                { label: 'Paused Time', value: formatHours(selectedPaused), icon: Timer, color: '#f97316', bg: '#f9731610' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-surface-850/50 border border-surface-800">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-surface-400 font-medium">{label}</p>
                    <p className="text-base font-display font-bold text-surface-50">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Productivity Insights */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Lightbulb size={14} className="text-sky-400" />
              </div>
              <span className="text-sm font-bold text-surface-100">Insights</span>
            </div>
            <div className="space-y-2.5">
              {insights.length === 0 ? (
                <p className="text-xs text-surface-500 text-center py-4">Complete more sessions to see insights</p>
              ) : (
                insights.map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-surface-850/50 transition-colors">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-surface-500 font-medium uppercase tracking-wider">{label}</p>
                      <p className="text-xs font-semibold text-surface-200 truncate">{value}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ Top Tasks ═══ */}
      {hasData && topTasks.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Trophy size={14} className="text-purple-400" />
            </div>
            <span className="text-sm font-bold text-surface-100">
              {timeframe === 'week' ? "This Week's" : "Period's"} Top Tasks
            </span>
            <span className="text-[10px] text-surface-500 font-medium ml-auto">{topTasks.length} tasks</span>
          </div>
          <div className="space-y-3">
            {topTasks.map((task, i) => {
              const maxTime = topTasks[0].analyticsTime || 1;
              const pct = (task.analyticsTime / maxTime) * 100;
              const totalTracked = topTasks.reduce((a, t) => a + t.analyticsTime, 0);
              const sharePct = totalTracked > 0 ? Math.round(task.analyticsTime / totalTracked * 100) : 0;
              return (
                <div key={task.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-850/50 border border-transparent hover:border-surface-800 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-surface-400">#{i + 1}</span>
                  </div>
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-surface-50 truncate">{task.title}</span>
                      <span className="text-[10px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{task.category}</span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: task.color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.3 + i * 0.08 }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono font-bold text-surface-200">{formatHours(task.analyticsTime)}</p>
                    <p className="text-[10px] text-surface-500">{sharePct}% of total</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ Smart Recommendations ═══ */}
      {hasData && recommendations.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Rocket size={14} className="text-violet-400" />
            </div>
            <span className="text-sm font-bold text-surface-100">Recommendations</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recommendations.map(({ icon: Icon, title, desc, color, bg }, _i) => (
              <motion.div key={title} variants={fadeUp}
                className="flex items-start gap-3 p-4 rounded-xl bg-surface-850/50 border border-surface-800 hover:border-surface-700 transition-all">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: bg }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-bold text-surface-100 mb-0.5">{title}</p>
                  <p className="text-[11px] text-surface-400 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';
import { toast } from '../store/useToastStore';
import { formatHours, getWeekDays, isToday, isThisWeek } from '../utils/time';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { BarChart3, CheckCircle2, Clock, Loader2, Target, TrendingUp, Zap, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Skeleton, SkeletonStatCard, SkeletonChart } from '../components/ui/Skeleton';

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

function dayRange(offsetFromToday: number) {
  const start = new Date();
  start.setDate(start.getDate() - offsetFromToday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function toChartHours(ms: number): number {
  return Math.round(ms / 3600000 * 10) / 10;
}

export function Analytics() {
  const { tasks, activeTaskId, profile, theme } = useStore();
  const [apiSessions, setApiSessions] = useState<AnalyticsSession[]>([]);
  const [loading, setLoading] = useState(false);

  // Timeframe and custom dates
  const [timeframe, setTimeframe] = useState<Timeframe>('week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

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
  }, []);

  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);

  const liveSessions = useMemo<AnalyticsSession[]>(() => {
    return tasks.flatMap(task => {
      const live = task.sessions.find(session => !session.endTime);
      if (!live || live.activeTime <= 0) return [];
      return [{
        id: `live_${task.id}_${live.id}`,
        taskId: task.id,
        startTime: live.startTime,
        endTime: live.endTime,
        activeTime: live.activeTime,
        totalPauseDuration: live.totalPauseDuration,
        focusScore: 100,
      }];
    });
  }, [tasks]);

  const sessions = useMemo(() => {
    const liveIds = new Set(liveSessions.map(session => session.id.replace(/^live_[^_]+_/, '')));
    const completed = apiSessions.filter(session => !liveIds.has(session.id));
    return [...completed, ...liveSessions].filter(session => session.taskId && session.activeTime > 0);
  }, [apiSessions, liveSessions]);

  // Compute boundaries for current selected timeframe
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

  // Compute boundaries for previous period comparison
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

  // Filter sessions
  const currentSessions = useMemo(() => {
    return sessions.filter(s => s.startTime >= rangeBounds.start && s.startTime <= rangeBounds.end);
  }, [sessions, rangeBounds]);

  const prevSessions = useMemo(() => {
    return sessions.filter(s => s.startTime >= prevRangeBounds.start && s.startTime <= prevRangeBounds.end);
  }, [sessions, prevRangeBounds]);

  // Current selected period statistics
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

  // Previous period statistics (for comparison)
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

  // Comparison formatter
  function formatComparison(current: number, prev: number, isPercent = false) {
    if (prev <= 0) return 'No comparison data';
    const percentChange = Math.round(((current - prev) / prev) * 100);
    const sign = percentChange > 0 ? '+' : '';
    if (isPercent) {
      return `${sign}${percentChange}% vs last period`;
    }
    return `${sign}${percentChange}% (${formatHours(prev)} last period)`;
  }

  // Chart data
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

  // Categories
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

  // Top tasks (selected timeframe's most time taken tasks)
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

  const totalToday = useMemo(() => {
    return sessions
      .filter(session => isToday(session.startTime))
      .reduce((acc, session) => acc + session.activeTime, 0);
  }, [sessions]);

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {loading && sessions.length === 0 && (
        <>
          {/* Header skeleton */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-10 w-48 rounded-xl mb-2" />
              <Skeleton className="h-4 w-64 rounded" />
            </div>
            <Skeleton className="h-11 w-72 rounded-xl" />
          </div>

          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>

          {/* Charts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <SkeletonChart height={260} />
            <SkeletonChart height={260} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <SkeletonChart height={260} />
            <div className="card p-6 rounded-[22px]">
              <Skeleton className="h-5 w-28 rounded mb-4" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 flex-1 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Top tasks skeleton */}
          <div className="card p-6 rounded-[22px]">
            <Skeleton className="h-5 w-28 rounded mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 flex-1 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xl">📈</span>
            Analytics
          </h1>
          <p className="text-surface-400 font-medium text-sm mt-1.5">Your Productivity Insights & Time Distribution</p>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2 bg-surface-900 p-1.5 rounded-[14px] border border-surface-800 flex-wrap shadow-sm">
            {(['week', 'month', 'prev-month', 'custom'] as Timeframe[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-4 py-2 rounded-[10px] text-xs font-semibold transition-all ${
                  timeframe === t ? 'bg-brand-500 text-white shadow-sm' : 'text-surface-400 hover:text-surface-50'
                }`}
              >
                {t === 'week' ? 'This Week' : t === 'month' ? 'This Month' : t === 'prev-month' ? 'Previous Month' : 'Custom Range'}
              </button>
            ))}
          </div>

          {timeframe === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-2 rounded-[14px] bg-surface-900 border border-surface-800"
            >
              <input
                type="date"
                className="input text-xs py-1.5 px-3 h-10 rounded-[10px]"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
              <span className="text-xs text-surface-500">to</span>
              <input
                type="date"
                className="input text-xs py-1.5 px-3 h-10 rounded-[10px]"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </motion.div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { icon: Clock, label: 'Focused Time', value: formatHours(selectedFocus), comparison: formatComparison(selectedFocus, prevFocus), color: theme?.accentColor || '#0ea5e9', bg: 'bg-sky-500/10' },
          { icon: TrendingUp, label: 'Paused Time', value: formatHours(selectedPaused), comparison: formatComparison(selectedPaused, prevPaused), color: '#8b5cf6', bg: 'bg-purple-500/10' },
          { icon: Zap, label: 'Focus Quality', value: `${selectedFocusScore}%`, comparison: formatComparison(selectedFocusScore, prevFocusScore, true), color: '#f97316', bg: 'bg-amber-500/10' },
          { icon: CheckCircle2, label: 'Completion Rate', value: `${selectedCompletionRate}%`, comparison: formatComparison(selectedCompletionRate, prevCompletionRate, true), color: '#10b981', bg: 'bg-emerald-500/10' },
        ].map(({ icon: Icon, label, value, comparison, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card p-5 rounded-[22px] shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${bg}`}>
                  <Icon size={18} style={{ color }} />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-display font-bold text-surface-50 mb-0.5">{value}</div>
              <div className="text-sm font-medium text-surface-300">{label}</div>
            </div>
            <div className="text-xs text-surface-400 mt-2 font-medium">{comparison}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-6 rounded-[22px] shadow-sm"
        >
          <h3 className="font-semibold text-surface-50 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-brand-400" /> Focus Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, boxShadow: 'var(--card-shadow)', fontSize: 12, color: 'var(--color-surface-50)' }}
                labelStyle={{ color: 'var(--color-surface-400)' }}
                formatter={(value: number, name: string) => [`${value}h`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-surface-400)' }} />
              <Bar dataKey="productive" name="Focused" fill={theme?.accentColor || '#0ea5e9'} radius={[4, 4, 0, 0]} />
              <Bar dataKey="paused" name="Paused" fill="var(--color-surface-700)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-surface-50 mb-4">Focus Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="focusTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme?.accentColor || '#0ea5e9'} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={theme?.accentColor || '#0ea5e9'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, boxShadow: 'var(--card-shadow)', fontSize: 12, color: 'var(--color-surface-50)' }}
                labelStyle={{ color: 'var(--color-surface-400)' }}
                formatter={(value: number) => [`${value}h`, 'Focused']}
              />
              <Area type="monotone" dataKey="productive" stroke={theme?.accentColor || '#0ea5e9'} fill="url(#focusTrend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-surface-50 mb-4">By Category</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-surface-400">
              No tracked sessions yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="hours"
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, boxShadow: 'var(--card-shadow)', fontSize: 12, color: 'var(--color-surface-50)' }}
                  labelStyle={{ color: 'var(--color-surface-400)' }}
                  formatter={(value: number) => [`${value}h`]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-surface-50 mb-4">Task Health</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Active Tasks', value: String(tasks.filter(t => t.status !== 'completed').length), color: 'text-brand-400' },
              { label: 'Completed', value: String(selectedCompletedTasks), color: 'text-emerald-400' },
              { label: 'Tracked Time', value: formatHours(selectedFocus), color: 'text-purple-400' },
              { label: 'Paused Time', value: formatHours(selectedPaused), color: 'text-yellow-400' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-surface-700 bg-surface-800/40 p-4">
                <p className={`text-xl font-display font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-surface-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="card p-6"
      >
        <h3 className="font-semibold text-surface-50 mb-4">
          {timeframe === 'week' ? "This Week's Most Time Taken Tasks" : "Selected Period's Most Time Taken Tasks"}
        </h3>
        {topTasks.length === 0 ? (
          <p className="text-surface-400">No tasks with tracked time in this period</p>
        ) : (
          <div className="space-y-3">
            {topTasks.map((task, i) => {
              const maxTime = topTasks[0].analyticsTime || 1;
              const pct = (task.analyticsTime / maxTime) * 100;
              return (
                <div key={task.id} className="flex items-center gap-4">
                  <span className="text-surface-400 text-sm w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1 gap-3">
                      <span className="text-sm text-surface-50 font-medium truncate">{task.title}</span>
                      <span className="text-sm text-brand-400 timer-display flex-shrink-0">{formatHours(task.analyticsTime)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: task.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.35 + i * 0.08 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

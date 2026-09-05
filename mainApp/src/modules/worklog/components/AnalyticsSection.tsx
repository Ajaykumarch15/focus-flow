import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  Clock, Pause, Zap, CheckCircle2, Star, Flame, Brain, Timer,
  Target, TrendingUp, Lightbulb, Rocket, AlertTriangle, Trophy,
  ArrowUpRight, ArrowDownRight, BarChart3, Activity,
} from 'lucide-react';
import { formatHours } from '@shared/utils/time';
import { SkeletonStatCard, SkeletonChart } from '@shared/components/ui/Skeleton';
import { EmptyState } from '@shared/components/ui/EmptyState';
import {
  computeRangeStats,
  computeCategoryBreakdown,
  computeTopTasks,
  computeDailySeries,
  getComparisonDelta,
  type SessionLike,
  type TaskLike,
} from '@worklog/services/reportsSelectors';

const COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#eab308', '#06b6d4', '#ef4444'];

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export interface AnalyticsSectionProps {
  sessions: SessionLike[];
  tasks: TaskLike[];
  start: number;
  end: number;
  accent: string;
  loading: boolean;
  rangeLabel: string;
}

export function AnalyticsSection({ sessions, tasks, start, end, accent, loading, rangeLabel }: AnalyticsSectionProps) {
  const stats = useMemo(() => computeRangeStats(sessions, tasks, start, end), [sessions, tasks, start, end]);

  const prevBounds = useMemo(() => {
    const duration = end - start;
    return { start: start - duration, end: start - 1 };
  }, [start, end]);

  const prevStats = useMemo(() => computeRangeStats(sessions, tasks, prevBounds.start, prevBounds.end), [sessions, tasks, prevBounds]);

  const focusDelta = getComparisonDelta(stats.focusedMs, prevStats.focusedMs);
  const pausedDelta = getComparisonDelta(stats.pausedMs, prevStats.pausedMs);
  const qualityDelta = getComparisonDelta(stats.focusScore, prevStats.focusScore);
  const completionDelta = getComparisonDelta(stats.completionRate, prevStats.completionRate);

  const chartData = useMemo(() => computeDailySeries(sessions, start, end), [sessions, start, end]);
  const categoryData = useMemo(() => computeCategoryBreakdown(sessions, tasks, start, end), [sessions, tasks, start, end]);
  const topTasks = useMemo(() => computeTopTasks(sessions, tasks, start, end), [sessions, tasks, start, end]);

  const inRangeSessions = useMemo(() => sessions.filter(s => s.startTime >= start && s.startTime <= end), [sessions, start, end]);

  const avgDailyFocus = useMemo(() => {
    if (chartData.length === 0) return 0;
    const total = chartData.reduce((acc, d) => acc + d.productive, 0);
    return Math.round((total / chartData.length) * 10) / 10;
  }, [chartData]);

  const bestDay = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((best, d) => d.productive > best.productive ? d : best, chartData[0]);
  }, [chartData]);

  const longestSession = useMemo(() => {
    if (inRangeSessions.length === 0) return null;
    return inRangeSessions.reduce((best, s) => s.activeTime > best.activeTime ? s : best, inRangeSessions[0]);
  }, [inRangeSessions]);

  const topCategory = categoryData.length > 0 ? categoryData[0] : null;

  const insights = useMemo(() => {
    const items: { icon: any; label: string; value: string; color: string; bg: string }[] = [];
    if (bestDay && bestDay.productive > 0) {
      items.push({ icon: Star, label: 'Best Day', value: `${bestDay.day} (${bestDay.productive}h)`, color: 'text-amber-400', bg: 'bg-amber-500/10' });
    }
    if (longestSession) {
      items.push({ icon: Flame, label: 'Longest Session', value: formatHours(longestSession.activeTime), color: 'text-orange-400', bg: 'bg-orange-500/10' });
    }
    if (stats.focusScore > 0) {
      items.push({ icon: Brain, label: 'Avg Focus Quality', value: `${stats.focusScore}%`, color: 'text-purple-400', bg: 'bg-purple-500/10' });
    }
    items.push({ icon: Timer, label: 'Daily Average', value: `${avgDailyFocus}h`, color: 'text-sky-400', bg: 'bg-sky-500/10' });
    if (topCategory) {
      items.push({ icon: Target, label: 'Top Category', value: `${topCategory.name} (${topCategory.hours}h)`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' });
    }
    if (prevStats.focusedMs > 0) {
      const delta = focusDelta.up ? `+${focusDelta.pct}%` : `-${focusDelta.pct}%`;
      items.push({ icon: TrendingUp, label: 'Period Change', value: delta, color: focusDelta.up ? 'text-emerald-400' : 'text-red-400', bg: focusDelta.up ? 'bg-emerald-500/10' : 'bg-red-500/10' });
    }
    return items;
  }, [bestDay, longestSession, stats.focusScore, avgDailyFocus, topCategory, prevStats.focusedMs, focusDelta]);

  const recommendations = useMemo(() => {
    const items: { icon: any; title: string; desc: string; color: string; bg: string }[] = [];
    if (focusDelta.up && prevStats.focusedMs > 0) {
      items.push({ icon: Rocket, title: 'Focus is Improving', desc: `Your focus time increased by ${focusDelta.pct}% compared to the previous period. Keep up the momentum!`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' });
    } else if (!focusDelta.up && prevStats.focusedMs > 0) {
      items.push({ icon: AlertTriangle, title: 'Focus Declined', desc: `Focus time decreased by ${focusDelta.pct}% from the previous period. Try setting shorter, more focused sessions.`, color: 'text-amber-400', bg: 'bg-amber-500/10' });
    }
    if (categoryData.length > 1 && topCategory) {
      const topPct = Math.round(topCategory.hours / categoryData.reduce((a, c) => a + c.hours, 0) * 100);
      if (topPct > 60) {
        items.push({ icon: Lightbulb, title: 'Category Imbalance', desc: `${topPct}% of your time goes to "${topCategory.name}". Consider balancing across categories.`, color: 'text-sky-400', bg: 'bg-sky-500/10' });
      }
    }
    if (stats.completionRate > 0 && completionDelta.up && prevStats.completionRate > 0) {
      items.push({ icon: CheckCircle2, title: 'Completion Rate Rising', desc: `Your task completion rate improved to ${stats.completionRate}%. Great progress!`, color: 'text-purple-400', bg: 'bg-purple-500/10' });
    }
    if (stats.pausedMs > 0 && stats.focusedMs > 0) {
      const pauseRatio = Math.round(stats.pausedMs / (stats.focusedMs + stats.pausedMs) * 100);
      if (pauseRatio > 30) {
        items.push({ icon: Clock, title: 'High Pause Ratio', desc: `${pauseRatio}% of your tracked time is paused. Try using focus mode to minimize interruptions.`, color: 'text-amber-400', bg: 'bg-amber-500/10' });
      }
    }
    if (items.length === 0 && inRangeSessions.length > 0) {
      items.push({ icon: Activity, title: 'Keep Going', desc: 'Complete more sessions to unlock personalized productivity insights and recommendations.', color: 'text-sky-400', bg: 'bg-sky-500/10' });
    }
    return items;
  }, [focusDelta, prevStats.focusedMs, prevStats.completionRate, categoryData, topCategory, stats.completionRate, completionDelta, stats.pausedMs, stats.focusedMs, inRangeSessions.length]);

  const hasData = stats.sessionCount > 0;

  if (loading) {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </motion.div>
        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart height={260} />
          <SkeletonChart height={260} />
        </motion.div>
        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart height={220} />
          <SkeletonChart height={220} />
          <SkeletonChart height={220} />
        </motion.div>
      </motion.div>
    );
  }

  if (!hasData) {
    return (
      <EmptyState
        className="rounded-2xl border border-surface-800 bg-surface-900"
        icon={<BarChart3 size={28} />}
        title="No Tracked Time Yet"
        description="Start tracking focus sessions to see your productivity analytics, time distribution, and performance insights."
        hint="Start a timer on any task to begin collecting data"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ KPI Cards ═══ */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Clock, label: 'Focused Time', value: formatHours(stats.focusedMs), delta: focusDelta, prevLabel: formatHours(prevStats.focusedMs), color: accent, bg: `${accent}10`, desc: 'Active productive time' },
          { icon: Pause, label: 'Paused Time', value: formatHours(stats.pausedMs), delta: pausedDelta, prevLabel: formatHours(prevStats.pausedMs), color: '#8b5cf6', bg: '#8b5cf610', desc: 'Time spent on pause' },
          { icon: Zap, label: 'Focus Quality', value: `${stats.focusScore}%`, delta: qualityDelta, prevLabel: `${prevStats.focusScore}%`, color: '#f97316', bg: '#f9731610', desc: 'Average focus score' },
          { icon: CheckCircle2, label: 'Completion Rate', value: `${stats.completionRate}%`, delta: completionDelta, prevLabel: `${prevStats.completionRate}%`, color: '#10b981', bg: '#10b98110', desc: 'Tasks completed' },
        ].map(({ icon: Icon, label, value, delta, color, bg, desc }) => (
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

      {/* ═══ Charts Row ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <BarChart3 size={14} className="text-sky-400" />
            </div>
            <span className="text-sm font-bold text-surface-100">Focus Breakdown</span>
            <span className="text-[10px] text-surface-500 font-medium ml-auto">{rangeLabel}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={3}>
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              {avgDailyFocus > 0 && <ReferenceLine y={avgDailyFocus} stroke="#52525b" strokeDasharray="4 4" label={{ value: `Avg ${avgDailyFocus}h`, position: 'right', fill: '#71717a', fontSize: 10 }} />}
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12, color: 'var(--color-surface-50)' }}
                labelStyle={{ color: 'var(--color-surface-400)' }}
                formatter={(value: number, name: string) => [`${value}h`, name]}
              />
              <Bar dataKey="productive" name="Focused" fill={accent} radius={[6, 6, 0, 0]} />
              <Bar dataKey="paused" name="Paused" fill="var(--color-surface-700)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

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
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
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

      {/* ═══ Category + Task Health + Insights ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              { label: 'Completed', value: stats.completedTasks, icon: CheckCircle2, color: '#10b981', bg: '#10b98110' },
              { label: 'Tracked Time', value: formatHours(stats.focusedMs), icon: Clock, color: '#8b5cf6', bg: '#8b5cf610' },
              { label: 'Paused Time', value: formatHours(stats.pausedMs), icon: Timer, color: '#f97316', bg: '#f9731610' },
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

      {/* ═══ Top Tasks ═══ */}
      {topTasks.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Trophy size={14} className="text-purple-400" />
            </div>
            <span className="text-sm font-bold text-surface-100">Top Tasks</span>
            <span className="text-[10px] text-surface-500 font-medium ml-auto">{topTasks.length} tasks</span>
          </div>
          <div className="space-y-3">
            {topTasks.map((taskItem, i) => {
              const maxTime = topTasks[0].analyticsMs || 1;
              const pct = (taskItem.analyticsMs / maxTime) * 100;
              const totalTracked = topTasks.reduce((a, t) => a + t.analyticsMs, 0);
              const sharePct = totalTracked > 0 ? Math.round(taskItem.analyticsMs / totalTracked * 100) : 0;
              return (
                <div key={taskItem.taskId} className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-850/50 border border-transparent hover:border-surface-800 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-surface-400">#{i + 1}</span>
                  </div>
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: taskItem.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-surface-50 truncate">{taskItem.title}</span>
                      <span className="text-[10px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{taskItem.category}</span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: taskItem.color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.3 + i * 0.08 }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono font-bold text-surface-200">{formatHours(taskItem.analyticsMs)}</p>
                    <p className="text-[10px] text-surface-500">{sharePct}% of total</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ Recommendations ═══ */}
      {recommendations.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Rocket size={14} className="text-violet-400" />
            </div>
            <span className="text-sm font-bold text-surface-100">Recommendations</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recommendations.map(({ icon: Icon, title, desc, color, bg }) => (
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

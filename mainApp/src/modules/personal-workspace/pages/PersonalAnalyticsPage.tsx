import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import {
  TrendingUp, Target, CheckCircle2, Map, Clock,
  ChevronRight, Calendar, Flame, BarChart3, AlertTriangle,
  Download, Image,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { api } from '@shared/utils/api';
import { Card, CardBody } from '@shared/components/ui/Card';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import { Button } from '@shared/components/ui/Button';
import { useStore } from '@worklog/services/useStore';
import { calculateGoalAchievement, calculatePeriodComparison } from '@worklog/services/analyticsCalculations';
import { TrendingUp as TrendingUpIcon, TrendingDown } from 'lucide-react';

const formatFocusedTime = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const TIME_FILTERS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: 0 },
] as const;

const STATUS_BADGE: Record<string, BadgeTone> = {
  active: 'brand',
  planning: 'neutral',
  completed: 'success',
  paused: 'warning',
  archived: 'neutral',
};

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

interface AnalyticsOverview {
  progress: number;
  activeRoadmaps: number;
  completedMilestones: number;
  totalMilestones: number;
  completedTasks: number;
  totalTasks: number;
  focusedTimeMs: number;
}

interface RoadmapStat {
  _id: string;
  title: string;
  description: string;
  status: string;
  color: string;
  icon: string;
  targetDate?: string;
  progress: number;
  phaseTotal: number;
  phaseCompleted: number;
  milestoneTotal: number;
  milestoneCompleted: number;
  taskTotal: number;
  taskCompleted: number;
  focusedTimeMs?: number;
}

interface PhaseStat {
  _id: string;
  title: string;
  status: string;
  order: number;
  roadmapId: string;
  roadmapTitle: string;
  progress: number;
  milestoneTotal: number;
  milestoneCompleted: number;
}

interface ActivityData {
  activeDays: number;
  completedMilestones: number;
  completedTasks: number;
}

interface TodayData {
  tasksCompleted: number;
  milestonesCompleted: number;
  activeRoadmaps: number;
}

interface RecentItem {
  type: 'task' | 'milestone';
  title: string;
  date: string;
  roadmapId: string;
}

interface CategoryItem {
  category: string;
  totalTasks: number;
  completedTasks: number;
  focusedTimeMs: number;
}

interface TopTaskItem {
  _id: string;
  title: string;
  totalTime: number;
  status: string;
  category: string;
  priority: string;
}

interface AnalyticsResponse {
  overview: AnalyticsOverview;
  today: TodayData;
  roadmaps: RoadmapStat[];
  phases: PhaseStat[];
  activity: ActivityData;
  recentActivity: RecentItem[];
  categoryBreakdown: CategoryItem[];
  topTasksByTime: TopTaskItem[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ROADMAP_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-surface-400 mb-0.5">{label}</p>
      <p className="text-surface-50 font-semibold">{payload[0].value}%</p>
    </div>
  );
}

const HEATMAP_LEVEL_CLASSES = [
  'bg-surface-800/60',
  'bg-brand-500/20',
  'bg-brand-500/40',
  'bg-brand-500/60',
  'bg-brand-500/90',
];

function getHeatmapLevel(value: number, max: number): number {
  if (max === 0 || value === 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function PersonalAnalyticsPage() {
  const navigate = useNavigate();
  const profile = useStore(s => s.profile);
  const pageRef = useRef<HTMLDivElement>(null);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [prevData, setPrevData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setPrevData(null);
    setLoading(true);
    setError(null);

    if (days === 0) {
      api.personalRoadmaps.analytics(0)
        .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
        .catch((e) => { if (!cancelled) { setError(e?.message || 'Failed to load analytics'); setLoading(false); } });
    } else {
      const now = new Date();
      const currentFrom = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
      const currentTo = now.toISOString().slice(0, 10);
      const prevFrom = new Date(now.getTime() - days * 2 * 86400000).toISOString().slice(0, 10);
      const prevTo = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);

      Promise.all([
        api.personalRoadmaps.analytics(days, currentFrom, currentTo),
        api.personalRoadmaps.analytics(days, prevFrom, prevTo),
      ])
        .then(([current, previous]) => {
          if (!cancelled) { setData(current); setPrevData(previous); setLoading(false); }
        })
        .catch((e) => { if (!cancelled) { setError(e?.message || 'Failed to load analytics'); setLoading(false); } });
    }

    return () => { cancelled = true; };
  }, [days]);

  const overview = data?.overview;
  const today = data?.today;
  const roadmaps = data?.roadmaps || [];
  const phases = data?.phases || [];
  const activity = data?.activity;
  const recentActivity = data?.recentActivity || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const topTasksByTime = data?.topTasksByTime || [];

  // Period comparisons
  const comparisons = useMemo(() => {
    if (!overview || !prevData?.overview) return null;
    const prev = prevData.overview;
    return {
      focusedTime: calculatePeriodComparison(overview.focusedTimeMs || 0, prev.focusedTimeMs || 0),
      completedTasks: calculatePeriodComparison(overview.completedTasks, prev.completedTasks),
      completedMilestones: calculatePeriodComparison(overview.completedMilestones, prev.completedMilestones),
      progress: calculatePeriodComparison(overview.progress, prev.progress),
    };
  }, [overview, prevData]);

  // Goal achievement
  const goalData = useMemo(() => {
    if (!profile?.personalDailyGoal || !overview) return null;
    const goalMs = profile.personalDailyGoal * 3600000;
    const periodMs = overview.focusedTimeMs || 0;
    const goalDays = days || 30;
    return calculateGoalAchievement(periodMs, goalMs * goalDays, goalDays);
  }, [profile, overview, days]);

  // Composite productivity score (0-100)
  const productivityScore = useMemo(() => {
    if (!overview || !activity) return null;
    const totalDays = days || 30;

    // Factor 1: Goal achievement (0-30 pts)
    const goalScore = goalData ? Math.min(30, (goalData.percentage / 100) * 30) : 15;

    // Factor 2: Completion rate (0-25 pts)
    const completionRate = overview.totalTasks > 0 ? overview.completedTasks / overview.totalTasks : 0;
    const completionScore = completionRate * 25;

    // Factor 3: Consistency - active days ratio (0-25 pts)
    const consistencyRate = Math.min(1, activity.activeDays / totalDays);
    const consistencyScore = consistencyRate * 25;

    // Factor 4: Milestone progress (0-20 pts)
    const milestoneScore = (overview.progress / 100) * 20;

    const total = Math.round(goalScore + completionScore + consistencyScore + milestoneScore);
    return Math.min(100, Math.max(0, total));
  }, [overview, activity, goalData, days]);

  const handleExportCSV = useCallback(() => {
    if (!overview) return;
    const rows = [
      ['Metric', 'Value'],
      ['Overall Progress', `${overview.progress}%`],
      ['Active Roadmaps', String(overview.activeRoadmaps)],
      ['Completed Milestones', `${overview.completedMilestones}/${overview.totalMilestones}`],
      ['Completed Tasks', `${overview.completedTasks}/${overview.totalTasks}`],
      ['Focused Time', formatFocusedTime(overview.focusedTimeMs || 0)],
      [''],
      ['Roadmap', 'Progress', 'Phases', 'Milestones', 'Tasks'],
      ...roadmaps.map(r => [
        r.title,
        `${r.progress}%`,
        `${r.phaseCompleted}/${r.phaseTotal}`,
        `${r.milestoneCompleted}/${r.milestoneTotal}`,
        `${r.taskCompleted}/${r.taskTotal}`,
      ]),
      [''],
      ['Category', 'Tasks', 'Completed', 'Focus Time'],
      ...categoryBreakdown.map(c => [
        c.category,
        String(c.totalTasks),
        String(c.completedTasks),
        formatFocusedTime(c.focusedTimeMs),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [overview, roadmaps, categoryBreakdown]);

  const handleExportPNG = useCallback(async () => {
    if (!pageRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(pageRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch {
      // Export failed silently
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // Build bar chart data from roadmap progress
  const chartData = useMemo(() => {
    if (!roadmaps.length) return [];
    return roadmaps.map((r, i) => ({
      name: r.title.length > 16 ? r.title.slice(0, 16) + '…' : r.title,
      progress: r.progress,
      fill: ROADMAP_COLORS[i % ROADMAP_COLORS.length],
    }));
  }, [roadmaps]);

  // Build heatmap data from recentActivity (completions per day)
  const heatmapData = useMemo(() => {
    const dayCounts: Record<string, number> = {};
    for (const item of recentActivity) {
      const d = item.date?.slice(0, 10);
      if (d) dayCounts[d] = (dayCounts[d] || 0) + 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = 90;
    const result: { date: string; value: number; level: number }[] = [];
    const values: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const val = dayCounts[key] || 0;
      values.push(val);
      result.push({ date: key, value: val, level: 0 });
    }

    const max = Math.max(...values, 0);
    for (const item of result) {
      item.level = getHeatmapLevel(item.value, max);
    }

    return result;
  }, [recentActivity]);

  if (loading && !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-surface-800 rounded animate-pulse" />
          <div className="h-4 w-80 bg-surface-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-surface-800 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-surface-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div ref={pageRef} className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">Personal Analytics</h1>
          <p className="text-sm text-surface-400">Understand your progress, consistency, and growth across your personal roadmaps.</p>
        </div>
        {overview && (
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportPNG} disabled={exporting} className="gap-1.5 text-xs">
              <Image size={13} /> {exporting ? 'Exporting…' : 'PNG'}
            </Button>
          </div>
        )}
      </motion.div>

      {/* Time Filter */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="flex items-center gap-1.5">
        {TIME_FILTERS.map(f => (
          <button key={f.value} onClick={() => setDays(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              days === f.value
                ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
            }`}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Section 1 — Overview */}
      {overview && (
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ...(productivityScore !== null ? [{
              label: 'Productivity Score',
              value: `${productivityScore}`,
              icon: TrendingUp,
              color: productivityScore >= 70 ? 'text-emerald-400' : productivityScore >= 40 ? 'text-amber-400' : 'text-red-400',
              cmp: null,
              isScore: true,
            }] : []),
            { label: 'Overall Progress', value: `${overview.progress}%`, icon: TrendingUp, color: 'text-brand-400', cmp: comparisons?.progress, isScore: false },
            { label: 'Active Roadmaps', value: overview.activeRoadmaps, icon: Map, color: 'text-sky-400', cmp: null, isScore: false },
            { label: 'Milestones', value: `${overview.completedMilestones}/${overview.totalMilestones}`, icon: Target, color: 'text-violet-400', cmp: comparisons?.completedMilestones, isScore: false },
            { label: 'Tasks', value: `${overview.completedTasks}/${overview.totalTasks}`, icon: CheckCircle2, color: 'text-emerald-400', cmp: comparisons?.completedTasks, isScore: false },
            { label: 'Focused Time', value: formatFocusedTime(overview.focusedTimeMs ?? 0), icon: Clock, color: 'text-amber-400', cmp: comparisons?.focusedTime, isScore: false },
          ].map((m) => (
            <motion.div key={m.label} variants={fadeUp}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-surface-800 ${m.color}`}>
                    <m.icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-surface-400 font-medium uppercase tracking-wider">{m.label}</p>
                    <div className="flex items-center gap-1.5">
                      {m.isScore ? (
                        <p className="text-lg font-bold text-surface-50 leading-tight">{m.value}<span className="text-xs text-surface-400">/100</span></p>
                      ) : (
                        <p className="text-lg font-bold text-surface-50 leading-tight">{m.value}</p>
                      )}
                      {m.cmp && m.cmp.direction !== 'flat' && (
                        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                          m.cmp.direction === 'up' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {m.cmp.direction === 'up' ? <TrendingUpIcon size={10} /> : <TrendingDown size={10} />}
                          {Math.abs(m.cmp.pct)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Today */}
      {today && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Today</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tasks Done', value: today.tasksCompleted, icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Milestones Done', value: today.milestonesCompleted, icon: Target, color: 'text-violet-400' },
              { label: 'Active Roadmaps', value: today.activeRoadmaps, icon: Map, color: 'text-sky-400' },
            ].map((c) => (
              <Card key={c.label} className="p-4 text-center">
                <c.icon size={18} className={`mx-auto mb-1.5 ${c.color}`} />
                <p className="text-lg font-bold text-surface-50">{c.value}</p>
                <p className="text-[11px] text-surface-400 font-medium">{c.label}</p>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Goal Achievement */}
      {goalData && profile?.personalDailyGoal && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Goal Progress</h2>
          <Card>
            <CardBody className="py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-surface-300">Daily Focus Goal: {profile.personalDailyGoal}h</span>
                    <span className="text-sm font-bold text-surface-100">{goalData.percentage}%</span>
                  </div>
                  <Progress value={goalData.percentage} className="h-2" />
                  <p className="text-[11px] text-surface-500 mt-1.5">
                    {goalData.daysMet} of {goalData.totalDays} days goal met
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold ${
                  goalData.percentage >= 100 ? 'bg-emerald-500/15 text-emerald-400' :
                  goalData.percentage >= 70 ? 'bg-brand-500/15 text-brand-400' :
                  goalData.percentage >= 40 ? 'bg-amber-500/15 text-amber-400' :
                  'bg-surface-800 text-surface-400'
                }`}>
                  {goalData.percentage}%
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 2 — Roadmap Progress */}
      {roadmaps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Roadmap Progress</h2>
          <div className="space-y-2">
            {roadmaps.map((r, idx) => (
              <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + idx * 0.04 }}>
                <button onClick={() => navigate(`/personal/roadmaps/${r._id}`)}
                  className="w-full text-left rounded-2xl border border-surface-800 bg-surface-900/80 p-4 hover:border-surface-700 hover:bg-surface-800/50 transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ backgroundColor: `${r.color}18`, color: r.color }}>
                      <Map size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-surface-50 truncate">{r.title}</p>
                        <Badge tone={STATUS_BADGE[r.status] || 'neutral'} className="text-[10px]">{r.status}</Badge>
                      </div>
                      {r.description && (
                        <p className="text-xs text-surface-500 truncate mb-2">{r.description}</p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <Progress value={r.progress} className="flex-1 max-w-[200px] h-1.5" />
                        <span className="text-xs font-semibold text-surface-300">{r.progress}%</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-surface-500">
                        <span>Phases {r.phaseCompleted}/{r.phaseTotal}</span>
                        <span>Milestones {r.milestoneCompleted}/{r.milestoneTotal}</span>
                        <span>Tasks {r.taskCompleted}/{r.taskTotal}</span>
                        {r.targetDate && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {formatDate(r.targetDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-surface-600 group-hover:text-surface-300 transition-colors mt-1 flex-shrink-0" />
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Section 3 — Progress Overview Chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Progress by Roadmap</h2>
          <Card>
            <CardBody className="pt-4 pb-2">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="progress" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Empty chart state */}
      {chartData.length === 0 && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Progress Overview</h2>
          <Card>
            <CardBody className="py-10 text-center">
              <BarChart3 className="mx-auto mb-2 text-surface-600" size={28} />
              <p className="text-sm text-surface-400 font-medium">No progress data yet</p>
              <p className="text-xs text-surface-500 mt-1">Create roadmaps and complete milestones to see progress.</p>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 3b — Activity Heatmap */}
      {heatmapData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Activity Heatmap</h2>
          <Card>
            <CardBody className="py-4">
              <div className="flex items-center gap-0">
                <div className="flex flex-col gap-[3px] mr-1.5">
                  {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((day, i) => (
                    <span key={i} className="text-[9px] text-surface-500 h-[10px] leading-[10px]">{day}</span>
                  ))}
                </div>
                <div className="flex gap-[3px] flex-wrap">
                  {(() => {
                    const weeks: typeof heatmapData[] = [];
                    let currentWeek: typeof heatmapData = [];
                    for (const day of heatmapData) {
                      const d = new Date(day.date);
                      if (currentWeek.length === 0 && d.getDay() !== 1) {
                        for (let i = 0; i < d.getDay(); i++) {
                          currentWeek.push({ date: '', value: 0, level: -1 });
                        }
                      }
                      currentWeek.push(day);
                      if (currentWeek.length >= 7) {
                        weeks.push(currentWeek);
                        currentWeek = [];
                      }
                    }
                    if (currentWeek.length > 0) weeks.push(currentWeek);
                    return weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[3px]">
                        {week.map((day, di) => (
                          <div
                            key={`${wi}-${di}`}
                            className={`w-[10px] h-[10px] rounded-[2px] transition-colors ${
                              day.level === -1 ? 'bg-transparent' : HEATMAP_LEVEL_CLASSES[day.level]
                            }`}
                            title={day.date ? `${day.date}: ${day.value} item${day.value !== 1 ? 's' : ''}` : ''}
                          />
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 justify-end">
                <span className="text-[9px] text-surface-500">Less</span>
                {HEATMAP_LEVEL_CLASSES.map((cls, i) => (
                  <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${cls}`} />
                ))}
                <span className="text-[9px] text-surface-500">More</span>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 3c — Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Time by Category</h2>
          <Card>
            <CardBody className="py-4">
              <div className="flex items-start gap-6">
                <div className="w-[140px] h-[140px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown.map(c => ({ name: c.category, value: c.focusedTimeMs }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryBreakdown.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={ROADMAP_COLORS[i % ROADMAP_COLORS.length]} fillOpacity={0.85} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {categoryBreakdown.slice(0, 6).map((c, i) => (
                    <div key={c.category} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: ROADMAP_COLORS[i % ROADMAP_COLORS.length] }} />
                      <span className="text-xs text-surface-300 flex-1 truncate">{c.category}</span>
                      <span className="text-[11px] text-surface-500">{formatFocusedTime(c.focusedTimeMs)}</span>
                      <span className="text-[10px] text-surface-600">{c.completedTasks}/{c.totalTasks}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 3d — Top Tasks by Time */}
      {topTasksByTime.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Top Tasks by Focus Time</h2>
          <Card>
            <CardBody className="py-3 divide-y divide-surface-800/60">
              {topTasksByTime.slice(0, 8).map((t, idx) => {
                const maxTime = topTasksByTime[0]?.totalTime || 1;
                const pct = Math.round((t.totalTime / maxTime) * 100);
                return (
                  <div key={t._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-[11px] text-surface-600 font-mono w-4 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-200 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-500/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-surface-400 flex-shrink-0">{formatFocusedTime(t.totalTime)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 4 — Phase Progress */}
      {phases.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Phase Progress</h2>
          <Card>
            <CardBody className="space-y-3 py-4">
              {phases.slice(0, 12).map((p, idx) => (
                <motion.div key={p._id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.27 + idx * 0.03 }}>
                  <button onClick={() => navigate(`/personal/roadmaps/${p.roadmapId}/phases/${p._id}`)}
                    className="w-full text-left group">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] text-surface-500 font-mono w-5">
                            {String(p.order + 1).padStart(2, '0')}
                          </span>
                          <p className="text-sm text-surface-200 truncate group-hover:text-surface-50 transition-colors">{p.title}</p>
                          {p.roadmapTitle && (
                            <span className="text-[10px] text-surface-600 hidden sm:inline">in {p.roadmapTitle}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-7">
                          <Progress value={p.progress} className="flex-1 h-1.5" />
                          <span className="text-[11px] font-medium text-surface-400 w-8 text-right">{p.progress}%</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-surface-600 group-hover:text-surface-300 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                </motion.div>
              ))}
              {phases.length > 12 && (
                <p className="text-[11px] text-surface-500 text-center pt-1">+{phases.length - 12} more phases</p>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 5 — Consistency */}
      {activity && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Consistency</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active Days', value: activity.activeDays, icon: Flame, color: 'text-orange-400' },
              { label: 'Milestones Done', value: activity.completedMilestones, icon: Target, color: 'text-violet-400' },
              { label: 'Tasks Done', value: activity.completedTasks, icon: CheckCircle2, color: 'text-emerald-400' },
            ].map((c) => (
              <Card key={c.label} className="p-4 text-center">
                <c.icon size={18} className={`mx-auto mb-1.5 ${c.color}`} />
                <p className="text-lg font-bold text-surface-50">{c.value}</p>
                <p className="text-[11px] text-surface-400 font-medium">{c.label}</p>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Section 6 — Recent Personal Progress */}
      {recentActivity.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Recent Progress</h2>
          <Card>
            <CardBody className="py-3 divide-y divide-surface-800/60">
              {recentActivity.slice(0, 10).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.type === 'milestone' ? 'bg-violet-500/15 text-violet-400' : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {item.type === 'milestone' ? <Target size={12} /> : <CheckCircle2 size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-surface-200 truncate">
                      <span className="text-surface-500">
                        {item.type === 'milestone' ? 'Completed milestone' : 'Completed'}
                      </span>{' '}
                      "{item.title}"
                    </p>
                  </div>
                  <span className="text-[11px] text-surface-500 flex-shrink-0">{formatDate(item.date)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto mb-3 text-amber-400" size={32} />
          <p className="text-sm text-surface-300 font-medium mb-1">Failed to load analytics</p>
          <p className="text-xs text-surface-500 mb-4">{error}</p>
          <button onClick={() => setDays(d => d)}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Empty state when no data at all */}
      {!loading && !error && roadmaps.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <Map className="mx-auto mb-3 text-surface-600" size={32} />
          <p className="text-sm text-surface-300 font-medium mb-1">No personal roadmaps yet</p>
          <p className="text-xs text-surface-500 mb-4">Create your first roadmap to start tracking your personal growth.</p>
          <button onClick={() => navigate('/personal/roadmaps')}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">
            Go to Roadmaps
          </button>
        </motion.div>
      )}
    </div>
  );
}

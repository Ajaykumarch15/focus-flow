import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Image, AlertTriangle, Map } from 'lucide-react';
import html2canvas from 'html2canvas';
import { api } from '@shared/utils/api';
import { Button } from '@shared/components/ui/Button';
import { useStore } from '@worklog/services/useStore';
import { calculateGoalAchievement, calculatePeriodComparison } from '@worklog/services/analyticsCalculations';
import {
  AnalyticsHero,
  PerformanceSnapshot,
  ProductivityTrend,
  ActivityHeatmap,
  RoadmapHealth,
  TimeByCategory,
  WhereFocusGoes,
  Consistency,
  RecentProgress,
  YourInsights,
} from '@personal/components/analytics';

const TIME_FILTERS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: 0 },
] as const;

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
  const roadmaps = data?.roadmaps || [];
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

  if (loading && !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-surface-800 rounded animate-pulse" />
          <div className="h-4 w-80 bg-surface-800 rounded animate-pulse" />
        </div>
        <div className="h-[240px] bg-surface-800 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-surface-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
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

      {/* Hero Section */}
      <AnalyticsHero
        productivityScore={productivityScore}
        comparison={comparisons?.progress ?? null}
      />

      {/* Performance Snapshot */}
      {overview && (
        <PerformanceSnapshot
          productivityScore={productivityScore}
          focusedTimeMs={overview.focusedTimeMs || 0}
          completedTasks={overview.completedTasks}
          totalTasks={overview.totalTasks}
          completedMilestones={overview.completedMilestones}
          totalMilestones={overview.totalMilestones}
          activeRoadmaps={overview.activeRoadmaps}
          comparisons={comparisons}
        />
      )}

      {/* Charts Row - Trend + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProductivityTrend
          recentActivity={recentActivity}
          focusedTimeMs={overview?.focusedTimeMs || 0}
        />
        <ActivityHeatmap recentActivity={recentActivity} />
      </div>

      {/* Roadmap Health + Time by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RoadmapHealth roadmaps={roadmaps} />
        <TimeByCategory categoryBreakdown={categoryBreakdown} />
      </div>

      {/* Where Your Focus Goes + Consistency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WhereFocusGoes topTasks={topTasksByTime} />
        <Consistency
          activeDays={activity?.activeDays || 0}
          completedMilestones={activity?.completedMilestones || 0}
          completedTasks={activity?.completedTasks || 0}
        />
      </div>

      {/* Recent Progress + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentProgress recentActivity={recentActivity} />
        <YourInsights
          recentActivity={recentActivity}
          focusedTimeMs={overview?.focusedTimeMs || 0}
          completedTasks={overview?.completedTasks || 0}
          totalTasks={overview?.totalTasks || 0}
          activeDays={activity?.activeDays || 0}
        />
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto mb-3 text-warning-400" size={32} />
          <p className="text-sm text-surface-300 font-medium mb-1">Failed to load analytics</p>
          <p className="text-xs text-surface-500 mb-4">{error}</p>
          <button onClick={() => setDays(d => d)}
            className="px-4 py-2 rounded-xl bg-brand-500 text-surface-50 text-sm font-medium hover:bg-brand-600 transition-colors">
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
            className="px-4 py-2 rounded-xl bg-brand-500 text-surface-50 text-sm font-medium hover:bg-brand-600 transition-colors">
            Go to Roadmaps
          </button>
        </motion.div>
      )}
    </div>
  );
}

const formatFocusedTime = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};
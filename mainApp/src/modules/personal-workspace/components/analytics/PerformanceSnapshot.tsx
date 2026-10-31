import { motion } from 'framer-motion';
import { Zap, Clock, CheckCircle2, Target, Map } from 'lucide-react';
import { StatisticsCard } from '@shared/components/ui/StatisticsCard';

interface TrendInfo {
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

interface PerformanceSnapshotProps {
  productivityScore: number | null;
  focusedTimeMs: number;
  completedTasks: number;
  totalTasks: number;
  completedMilestones: number;
  totalMilestones: number;
  activeRoadmaps: number;
  comparisons: {
    focusedTime?: TrendInfo;
    completedTasks?: TrendInfo;
    completedMilestones?: TrendInfo;
  } | null;
}

const formatTime = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Render a trend badge only when the comparison actually moved. */
function trendFor(trend?: TrendInfo): string | undefined {
  if (!trend || trend.direction === 'flat') return undefined;
  return `${Math.abs(trend.pct)}%`;
}

export function PerformanceSnapshot({
  productivityScore,
  focusedTimeMs,
  completedTasks,
  totalTasks,
  completedMilestones,
  totalMilestones,
  activeRoadmaps,
  comparisons,
}: PerformanceSnapshotProps) {
  const taskCompletionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const milestoneCompletionPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Key Metrics</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatisticsCard
          title="Productivity Score"
          value={productivityScore ?? 0}
          description="/100"
          icon={<Zap size={14} />}
          accent="brand"
          transparent
          alwaysShowBorder
          trend={trendFor(comparisons?.focusedTime)}
          trendDirection={comparisons?.focusedTime?.direction === 'down' ? 'down' : 'up'}
          backgroundImage="/SVG/svg/CHARTS.svg"
          backgroundPosition="bottom-right"
        />
        <StatisticsCard
          title="Focused Time"
          value={formatTime(focusedTimeMs)}
          description="this period"
          icon={<Clock size={14} />}
          accent="warning"
          transparent
          alwaysShowBorder
          trend={trendFor(comparisons?.focusedTime)}
          trendDirection={comparisons?.focusedTime?.direction === 'down' ? 'down' : 'up'}
          backgroundImage="/SVG/svg/time-management_4ss6.svg"
          backgroundPosition="bottom-left"
        />
        <StatisticsCard
          title="Tasks Completed"
          value={`${completedTasks} / ${totalTasks}`}
          description={`${taskCompletionPct}% completion`}
          icon={<CheckCircle2 size={14} />}
          accent="success"
          transparent
          alwaysShowBorder
          trend={trendFor(comparisons?.completedTasks)}
          trendDirection={comparisons?.completedTasks?.direction === 'down' ? 'down' : 'up'}
          backgroundImage="/SVG/svg/check%20boxes.svg"
          backgroundPosition="top-right"
        />
        <StatisticsCard
          title="Milestones Done"
          value={`${completedMilestones} / ${totalMilestones}`}
          description={`${milestoneCompletionPct}% completion`}
          icon={<Target size={14} />}
          accent="info"
          transparent
          alwaysShowBorder
          trend={trendFor(comparisons?.completedMilestones)}
          trendDirection={comparisons?.completedMilestones?.direction === 'down' ? 'down' : 'up'}
          backgroundImage="/SVG/svg/career%20growth.svg"
          backgroundPosition="bottom-right"
        />
        <StatisticsCard
          title="Active Roadmaps"
          value={activeRoadmaps}
          description="in progress"
          icon={<Map size={14} />}
          accent="neutral"
          transparent
          alwaysShowBorder
          backgroundImage="/SVG/svg/navigation.svg"
          backgroundPosition="top"
        />
      </div>
    </motion.div>
  );
}

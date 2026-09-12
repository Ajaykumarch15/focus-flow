import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, CheckCircle2, Clock, Map, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  subValue?: string;
  subLabel?: string;
  color: string;
  bgColor: string;
  borderColor: string;
  trend?: { pct: number; direction: 'up' | 'down' | 'flat' };
}

function KpiCard({ icon, label, value, subValue, subLabel, color, bgColor, borderColor, trend }: KpiCardProps) {
  return (
    <div className={`p-4 rounded-2xl bg-surface-900 border ${borderColor} hover:shadow-md transition-shadow`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-surface-50 leading-tight">{value}</p>
          {subValue && <p className="text-xs text-surface-400">{subValue}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-400 font-medium">{label}</p>
        {trend && trend.direction !== 'flat' && (
          <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${
            trend.direction === 'up' ? 'text-success-400' : 'text-danger-400'
          }`}>
            {trend.direction === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend.pct)}%
          </div>
        )}
        {subLabel && (
          <p className="text-[10px] text-surface-500">{subLabel}</p>
        )}
      </div>
    </div>
  );
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
    focusedTime?: { pct: number; direction: 'up' | 'down' | 'flat' };
    completedTasks?: { pct: number; direction: 'up' | 'down' | 'flat' };
    completedMilestones?: { pct: number; direction: 'up' | 'down' | 'flat' };
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
        <KpiCard
          icon={<Zap size={18} />}
          label="Productivity Score"
          value={`${productivityScore ?? 0}`}
          subValue="/100"
          color="text-brand-400"
          bgColor="bg-brand-500/15"
          borderColor="border-surface-800"
          trend={comparisons?.focusedTime ?? undefined}
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Focused Time"
          value={formatTime(focusedTimeMs)}
          subValue={comparisons?.focusedTime && comparisons.focusedTime.direction !== 'flat' ? 
            `${comparisons.focusedTime.direction === 'up' ? '+' : '-'}${Math.abs(comparisons.focusedTime.pct)}%` : undefined}
          color="text-warning-400"
          bgColor="bg-warning-500/15"
          borderColor="border-surface-800"
        />
        <KpiCard
          icon={<CheckCircle2 size={18} />}
          label="Tasks Completed"
          value={`${completedTasks} / ${totalTasks}`}
          subValue={`${taskCompletionPct}%`}
          color="text-success-400"
          bgColor="bg-success-500/15"
          borderColor="border-surface-800"
          trend={comparisons?.completedTasks}
        />
        <KpiCard
          icon={<Target size={18} />}
          label="Milestones Completed"
          value={`${completedMilestones} / ${totalMilestones}`}
          subValue={`${milestoneCompletionPct}%`}
          color="text-info-400"
          bgColor="bg-info-500/15"
          borderColor="border-surface-800"
          trend={comparisons?.completedMilestones}
        />
        <KpiCard
          icon={<Map size={18} />}
          label="Active Roadmaps"
          value={`${activeRoadmaps}`}
          color="text-brand-300"
          bgColor="bg-brand-500/10"
          borderColor="border-surface-800"
        />
      </div>
    </motion.div>
  );
}
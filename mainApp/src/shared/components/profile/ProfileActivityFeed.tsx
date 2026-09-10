import { motion } from 'framer-motion';
import { CheckCircle2, Timer } from 'lucide-react';
import type { ProfileActivityItem } from '@shared/types';

interface ProfileActivityFeedProps {
  activities: ProfileActivityItem[];
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.04 } } };

export function ProfileActivityFeed({ activities }: ProfileActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
        <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-3">Recent Activity</p>
        <p className="text-sm text-surface-500">No recent activity yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
      <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-4">Recent Activity</p>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
        {activities.map((activity, i) => {
          const isTask = activity.type === 'task_completed';
          const Icon = isTask ? CheckCircle2 : Timer;
          const iconColor = isTask
            ? 'text-emerald-500 dark:text-emerald-400'
            : 'text-violet-500 dark:text-violet-400';
          const iconBg = isTask ? 'bg-emerald-500/10' : 'bg-violet-500/10';

          return (
            <motion.div
              key={`${activity.type}-${i}`}
              variants={fadeUp}
              className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-surface-800/40 transition-colors"
            >
              <div className={`w-7 h-7 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
                <Icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-200 truncate">{activity.title}</p>
                <p className="text-[11px] text-surface-500">{formatRelativeDate(activity.date)}</p>
              </div>
              {activity.durationMs ? (
                <span className="text-xs text-surface-500 font-mono flex-shrink-0">
                  {formatDuration(activity.durationMs)}
                </span>
              ) : null}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { Clock, CheckCircle2, Timer, Flame } from 'lucide-react';
import type { ProfileStats, PublicProfile } from '@shared/types';

interface ProfileStatsGridProps {
  stats: ProfileStats;
  profile: PublicProfile;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const STAT_CARDS = [
  {
    key: 'focus' as const,
    label: 'Total Focus Time',
    icon: Clock,
    color: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    format: (s: ProfileStats) => formatDuration(s.totalFocusMs),
  },
  {
    key: 'tasks' as const,
    label: 'Tasks Completed',
    icon: CheckCircle2,
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    format: (s: ProfileStats) => String(s.tasksCompleted),
  },
  {
    key: 'sessions' as const,
    label: 'Focus Sessions',
    icon: Timer,
    color: 'text-violet-500 dark:text-violet-400',
    bg: 'bg-violet-500/10',
    format: (s: ProfileStats) => String(s.sessionsCount),
  },
  {
    key: 'streak' as const,
    label: 'Best Streak',
    icon: Flame,
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    format: (_s: ProfileStats, bestStreak?: number) =>
      `${bestStreak ?? 0} days`,
  },
];

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

export function ProfileStatsGrid({ stats, profile }: ProfileStatsGridProps) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {STAT_CARDS.map(card => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            variants={fadeUp}
            className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-xl ${card.bg} ${card.color} flex items-center justify-center`}>
                <Icon size={15} />
              </div>
            </div>
            <p className="text-xl font-display font-bold text-surface-50 tracking-tight">
              {card.key === 'streak'
                ? card.format(stats, profile.streak.best)
                : card.format(stats)}
            </p>
            <p className="text-xs text-surface-400 mt-0.5">{card.label}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

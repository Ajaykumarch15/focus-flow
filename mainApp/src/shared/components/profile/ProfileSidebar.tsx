import { motion } from 'framer-motion';
import { Flame, Trophy, Target, Zap } from 'lucide-react';
import type { PublicProfile, ProfileStats } from '@shared/types';

interface ProfileSidebarProps {
  profile: PublicProfile;
  stats: ProfileStats;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function ProfileSidebar({ profile, stats }: ProfileSidebarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm space-y-5"
    >
      {/* Streak */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-2">
          <Flame size={22} className="text-amber-500" />
        </div>
        <p className="text-2xl font-display font-bold text-surface-50">{profile.streak.current}</p>
        <p className="text-xs text-surface-400">Current Streak</p>
        <p className="text-[11px] text-surface-500 mt-0.5">Best: {profile.streak.best} days</p>
      </div>

      <div className="border-t border-surface-800" />

      {/* Leaderboard */}
      {stats.rank && (
        <>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-500/15 flex items-center justify-center mx-auto mb-2">
              <Trophy size={22} className="text-indigo-500" />
            </div>
            <p className="text-2xl font-display font-bold text-surface-50">#{stats.rank}</p>
            <p className="text-xs text-surface-400">Leaderboard Rank</p>
          </div>
          <div className="border-t border-surface-800" />
        </>
      )}

      {/* Points */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
          <Zap size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-200">{profile.totalPoints.toLocaleString()}</p>
          <p className="text-[11px] text-surface-500">Focus Points</p>
        </div>
      </div>

      {/* Daily Goal */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          <Target size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-200">{formatDuration(stats.totalFocusMs / Math.max(Object.keys(stats.dailyHours).length, 1))}</p>
          <p className="text-[11px] text-surface-500">Avg Daily Focus</p>
        </div>
      </div>
    </motion.div>
  );
}

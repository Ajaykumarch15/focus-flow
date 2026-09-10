import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { ProfileStats, PublicProfile } from '@shared/types';

interface ProfileAchievementsProps {
  profile: PublicProfile;
  stats: ProfileStats;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
}

function computeAchievements(profile: PublicProfile, stats: ProfileStats): Achievement[] {
  const totalFocusHours = stats.totalFocusMs / 3600000;
  const activeDays = Object.keys(stats.dailyHours).filter(d => stats.dailyHours[d] > 0).length;

  return [
    {
      id: 'first_task',
      title: 'First Steps',
      description: 'Completed your first task',
      icon: '1',
      earned: stats.tasksCompleted >= 1,
    },
    {
      id: 'streak_7',
      title: 'Week Warrior',
      description: '7-day focus streak',
      icon: '2',
      earned: profile.streak.best >= 7,
    },
    {
      id: 'streak_30',
      title: 'Monthly Master',
      description: '30-day focus streak',
      icon: '3',
      earned: profile.streak.best >= 30,
    },
    {
      id: 'focus_100',
      title: 'Century Club',
      description: '100 hours of focus time',
      icon: '4',
      earned: totalFocusHours >= 100,
    },
    {
      id: 'focus_500',
      title: 'Focus Legend',
      description: '500 hours of focus time',
      icon: '5',
      earned: totalFocusHours >= 500,
    },
    {
      id: 'tasks_100',
      title: 'Task Slayer',
      description: '100 tasks completed',
      icon: '6',
      earned: stats.tasksCompleted >= 100,
    },
    {
      id: 'week_active',
      title: 'Getting Started',
      description: 'Active for 7+ days',
      icon: '7',
      earned: activeDays >= 7,
    },
    {
      id: 'month_active',
      title: 'Dedicated',
      description: 'Active for 30+ days',
      icon: '8',
      earned: activeDays >= 30,
    },
    {
      id: 'quarter_active',
      title: 'Committed',
      description: 'Active for 90+ days',
      icon: '9',
      earned: activeDays >= 90,
    },
  ];
}

const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.04 } } };

export function ProfileAchievements({ profile, stats }: ProfileAchievementsProps) {
  const achievements = useMemo(() => computeAchievements(profile, stats), [profile, stats]);
  const earnedCount = achievements.filter(a => a.earned).length;

  return (
    <div className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Achievements</p>
        <p className="text-xs text-surface-500">{earnedCount}/{achievements.length}</p>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-3 gap-2">
        {achievements.map(achievement => (
          <motion.div
            key={achievement.id}
            variants={fadeUp}
            className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
              achievement.earned
                ? 'border-brand-500/30 bg-brand-500/5'
                : 'border-surface-800/50 bg-surface-850/30 opacity-40'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-display font-bold mb-1.5 ${
              achievement.earned
                ? 'bg-brand-500/20 text-brand-400'
                : 'bg-surface-800 text-surface-500'
            }`}>
              {achievement.earned ? <Trophy size={16} /> : achievement.icon}
            </div>
            <p className="text-[11px] font-semibold text-surface-200 leading-tight">{achievement.title}</p>
            <p className="text-[9px] text-surface-500 mt-0.5 leading-tight">{achievement.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

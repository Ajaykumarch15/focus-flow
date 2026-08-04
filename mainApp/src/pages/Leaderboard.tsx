import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Users } from 'lucide-react';
import { api } from '../utils/api';
import { toast } from '../store/useToastStore';
import { Skeleton, SkeletonCircle } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

interface LeaderboardUser {
  _id: string;
  name: string;
  avatar?: string;
  totalPoints: number;
  streak: {
    current: number;
    best: number;
  };
}

export function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.reports.leaderboard()
      .then(setUsers)
      .catch(err => toast.error('Failed to load leaderboard', err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header skeleton */}
        <div className="text-center mb-12">
          <SkeletonCircle size={56} className="mx-auto mb-4" />
          <Skeleton className="h-8 w-56 rounded mx-auto mb-2" />
          <Skeleton className="h-4 w-48 rounded mx-auto" />
        </div>

        {/* Podium skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
          {/* Silver */}
          <Card className="p-6 border-slate-400/20 order-2 md:order-1 h-48 flex flex-col items-center justify-center">
            <SkeletonCircle size={64} className="mb-3" />
            <Skeleton className="h-4 w-24 rounded mb-2" />
            <Skeleton className="h-4 w-16 rounded" />
          </Card>
          {/* Gold */}
          <Card className="p-8 border-yellow-400/30 bg-yellow-400/5 order-1 md:order-2 h-56 flex flex-col items-center justify-center">
            <SkeletonCircle size={80} className="mb-4" />
            <Skeleton className="h-5 w-28 rounded mb-2" />
            <Skeleton className="h-5 w-20 rounded mb-2" />
            <Skeleton className="h-3 w-24 rounded" />
          </Card>
          {/* Bronze */}
          <Card className="p-6 border-orange-700/20 order-3 h-44 flex flex-col items-center justify-center">
            <SkeletonCircle size={64} className="mb-3" />
            <Skeleton className="h-4 w-24 rounded mb-2" />
            <Skeleton className="h-4 w-16 rounded" />
          </Card>
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="w-6 h-4 rounded" />
              <SkeletonCircle size={40} />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 rounded mb-2" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-12 rounded mb-1" />
                <Skeleton className="h-3 w-10 rounded" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const top3 = users.slice(0, 3);
  const others = users.slice(3);

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <PageHeader title="Focus Leaderboard" description="The Most Dedicated Focusers This Season"
        icon={<span className="text-xl">🏆</span>} iconColor="#f59e0b" />

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
        {/* Silver - 2nd */}
        {top3[1] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6 rounded-[22px] shadow-sm border-slate-300 dark:border-slate-700 order-2 md:order-1 h-52 flex flex-col items-center justify-center relative"
          >
            <div className="absolute -top-4 bg-slate-400 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">2</div>
            <div className="w-16 h-16 rounded-2xl bg-surface-850 mb-3 flex items-center justify-center text-2xl font-bold text-slate-500 border border-surface-800">
              {top3[1].name.charAt(0)}
            </div>
            <h3 className="text-surface-50 font-semibold truncate w-full text-center">{top3[1].name}</h3>
            <p className="text-brand-500 font-bold">{top3[1].totalPoints.toLocaleString()} pts</p>
          </motion.div>
        )}

        {/* Gold - 1st */}
        {top3[0] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8 rounded-[22px] shadow-md border-amber-400/40 bg-gradient-to-b from-[#FFFDF5] to-white dark:from-amber-500/10 dark:to-surface-900 order-1 md:order-2 h-60 flex flex-col items-center justify-center relative"
          >
            <div className="absolute -top-5 bg-amber-400 text-amber-950 w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-lg shadow-md">1</div>
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 mb-4 flex items-center justify-center text-3xl font-bold text-amber-500 border-2 border-amber-400/30">
              {top3[0].name.charAt(0)}
            </div>
            <h3 className="text-surface-50 text-lg font-extrabold truncate w-full text-center">{top3[0].name}</h3>
            <p className="text-amber-500 font-extrabold text-xl">{top3[0].totalPoints.toLocaleString()} pts</p>
            {top3[0].streak.current > 0 && (
              <Badge tone="warning" icon={<Flame size={14} fill="currentColor" />} className="mt-2 px-3 py-1">
                {top3[0].streak.current} day streak
              </Badge>
            )}
          </motion.div>
        )}

        {/* Bronze - 3rd */}
        {top3[2] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6 rounded-[22px] shadow-sm border-amber-700/20 order-3 h-48 flex flex-col items-center justify-center relative"
          >
            <div className="absolute -top-4 bg-amber-700 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">3</div>
            <div className="w-16 h-16 rounded-2xl bg-surface-850 mb-3 flex items-center justify-center text-2xl font-bold text-amber-700 border border-surface-800">
              {top3[2].name.charAt(0)}
            </div>
            <h3 className="text-surface-50 font-semibold truncate w-full text-center">{top3[2].name}</h3>
            <p className="text-brand-500 font-bold">{top3[2].totalPoints.toLocaleString()} pts</p>
          </motion.div>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {others.map((user, i) => (
          <motion.div
            key={user._id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4 rounded-[18px] shadow-sm flex items-center gap-4 hover:bg-surface-850 transition-colors"
          >
            <span className="w-6 text-surface-400 font-display font-bold text-center">{i + 4}</span>
            <div className="w-10 h-10 rounded-xl bg-surface-850 flex items-center justify-center text-surface-300 font-bold border border-surface-800">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-surface-50 font-semibold truncate text-sm">{user.name}</h4>
              <div className="flex items-center gap-3">
                {user.streak.current > 0 && (
                  <Badge tone="warning" icon={<Flame size={10} fill="currentColor" />} className="text-[10px] font-bold uppercase">
                    {user.streak.current} day streak
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-surface-50 font-bold text-sm">{user.totalPoints.toLocaleString()}</p>
              <p className="text-[10px] text-surface-400 uppercase font-semibold">Points</p>
            </div>
          </motion.div>
        ))}

        {users.length === 0 && (
          <EmptyState
            icon={<Users size={40} className="text-surface-400" />}
            title="No leaderboard entries yet"
            description="No users have opted into the leaderboard yet."
          />
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Flame, Star, Loader2, Users, ArrowUpRight } from 'lucide-react';
import { api } from '../utils/api';
import { toast } from '../store/useToastStore';

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
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={32} className="animate-spin text-brand-400" />
      </div>
    );
  }

  const top3 = users.slice(0, 3);
  const others = users.slice(3);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex p-3 rounded-2xl bg-brand-500/10 mb-4"
        >
          <Trophy size={32} className="text-brand-400" />
        </motion.div>
        <h1 className="text-3xl font-display font-bold text-white mb-2">Focus Leaderboard</h1>
        <p className="text-surface-400">The most dedicated focusers this season</p>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
        {/* Silver - 2nd */}
        {top3[1] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6 border-slate-400/20 order-2 md:order-1 h-48 flex flex-col items-center justify-center relative"
          >
            <div className="absolute -top-4 bg-slate-400 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">2</div>
            <div className="w-16 h-16 rounded-2xl bg-surface-800 mb-3 flex items-center justify-center text-2xl font-bold text-slate-400">
              {top3[1].name.charAt(0)}
            </div>
            <h3 className="text-white font-semibold truncate w-full text-center">{top3[1].name}</h3>
            <p className="text-brand-400 font-bold">{top3[1].totalPoints.toLocaleString()} pts</p>
          </motion.div>
        )}

        {/* Gold - 1st */}
        {top3[0] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8 border-yellow-400/30 bg-yellow-400/5 order-1 md:order-2 h-56 flex flex-col items-center justify-center relative"
          >
            <div className="absolute -top-5 bg-yellow-400 text-yellow-900 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">1</div>
            <div className="w-20 h-20 rounded-2xl bg-yellow-400/10 mb-4 flex items-center justify-center text-3xl font-bold text-yellow-400 border-2 border-yellow-400/20">
              {top3[0].name.charAt(0)}
            </div>
            <h3 className="text-white text-lg font-bold truncate w-full text-center">{top3[0].name}</h3>
            <p className="text-yellow-400 font-bold text-xl">{top3[0].totalPoints.toLocaleString()} pts</p>
            {top3[0].streak.current > 0 && (
              <div className="mt-2 flex items-center gap-1 text-orange-400 text-sm font-medium">
                <Flame size={14} fill="currentColor" /> {top3[0].streak.current} day streak
              </div>
            )}
          </motion.div>
        )}

        {/* Bronze - 3rd */}
        {top3[2] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6 border-orange-700/20 order-3 h-44 flex flex-col items-center justify-center relative"
          >
            <div className="absolute -top-4 bg-orange-700 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">3</div>
            <div className="w-16 h-16 rounded-2xl bg-surface-800 mb-3 flex items-center justify-center text-2xl font-bold text-orange-400">
              {top3[2].name.charAt(0)}
            </div>
            <h3 className="text-white font-semibold truncate w-full text-center">{top3[2].name}</h3>
            <p className="text-brand-400 font-bold">{top3[2].totalPoints.toLocaleString()} pts</p>
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
            className="card p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
          >
            <span className="w-6 text-surface-500 font-display font-bold">{i + 4}</span>
            <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center text-surface-400 font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium truncate">{user.name}</h4>
              <div className="flex items-center gap-3">
                {user.streak.current > 0 && (
                  <span className="text-[10px] text-orange-400 font-bold uppercase flex items-center gap-0.5">
                    <Flame size={10} fill="currentColor" /> {user.streak.current} day streak
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">{user.totalPoints.toLocaleString()}</p>
              <p className="text-[10px] text-surface-500 uppercase font-medium">Points</p>
            </div>
          </motion.div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-20 bg-surface-900/50 rounded-3xl border-2 border-dashed border-surface-800">
            <Users size={40} className="mx-auto mb-4 text-surface-700" />
            <p className="text-surface-500">No users have opted into the leaderboard yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

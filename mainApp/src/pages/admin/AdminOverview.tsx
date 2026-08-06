import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Clock, Zap, Activity, Target, TrendingUp, ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/useAuthStore';
import { SkeletonStatCard } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const stagger = { show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="p-5 hover:border-surface-700 transition-all relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}12` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <p className="text-2xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
        <p className="text-xs font-medium text-surface-400">{label}</p>
        {sub && <p className="text-[11px] text-emerald-400 mt-1">{sub}</p>}
      </Card>
    </motion.div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function AdminOverview() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, a, act, u, t] = await Promise.all([
          api.admin.getStats(),
          api.admin.getSystemAnalytics('week'),
          api.admin.getActivity(5),
          api.admin.listUsers(),
          api.teams.list(),
        ]);
        setStats(s); setAnalytics(a); setActivities(act.items); setUsers(u.items); setTeams(t);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-6 lg:p-8 max-w-[1500px] mx-auto"><div role="status" aria-live="polite" className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div></div>;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl border border-surface-800/60 bg-surface-900 p-8 lg:p-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, #8b5cf615, transparent 70%)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at bottom left, #0ea5e915, transparent 70%)' }} />
        <div className="relative">
          <p className="text-surface-400 text-sm mb-1">{getGreeting()}, {user?.name?.split(' ')[0]}</p>
          <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight mb-1">Organization Overview</h1>
          <p className="text-surface-400 text-sm">{today}</p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-surface-400">{users.length} total users</span>
            <span className="text-xs text-surface-400">{teams.length} teams</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <motion.span className="w-2 h-2 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              {stats?.activeUsers || 0} active now
            </span>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={String(stats?.totalUsers || 0)} color="#8b5cf6" />
        <StatCard icon={Zap} label="Active Now" value={String(stats?.activeUsers || 0)}
          sub={stats?.totalUsers ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total` : undefined} color="#f59e0b" />
        <StatCard icon={Clock} label="Focus Hours Today" value={`${(stats?.todayTotalMs || 0) / 3600000}h`} color="#0ea5e9" />
        <StatCard icon={Activity} label="Today Sessions" value={String(stats?.todaySessionCount || 0)} color="#10b981" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Users */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2"><Users size={14} className="text-purple-400" /> New Users (30d)</h3>
            </div>
            <p className="text-3xl font-display font-extrabold text-surface-50 mb-1">{analytics?.newUsers || 0}</p>
            <p className="text-xs text-surface-400">{analytics?.activeUsers || 0} unique active users this period</p>
          </Card>
        </motion.div>

        {/* Task Completion */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2"><Target size={14} className="text-emerald-400" /> Task Completion</h3>
            </div>
            <p className="text-3xl font-display font-extrabold text-surface-50 mb-1">{analytics?.taskCompletionRate || 0}%</p>
            <p className="text-xs text-surface-400">{analytics?.completedTasks || 0} of {analytics?.totalTasks || 0} tasks completed</p>
          </Card>
        </motion.div>

        {/* Focus Score */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2"><TrendingUp size={14} className="text-amber-400" /> Focus Score</h3>
            </div>
            <p className="text-3xl font-display font-extrabold text-surface-50 mb-1">{analytics?.avgFocusScore || 0}</p>
            <p className="text-xs text-surface-400">Average across {analytics?.totalSessions || 0} sessions</p>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-100">Recent Users</h3>
              <Button variant="ghost" size="xs" className="text-surface-500 hover:text-surface-200" rightIcon={<ChevronRight size={12} />} onClick={() => navigate('/admin/people')}>View All</Button>
            </div>
            <div className="space-y-2">
              {users.slice(0, 5).map((u: any) => (
                <div key={u._id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-850 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 font-medium truncate">{u.name}</p>
                    <p className="text-[11px] text-surface-500 truncate">{u.email}</p>
                  </div>
                  <Badge tone={u.role === 'admin' ? 'brand' : 'neutral'} className="rounded-md px-2 text-[10px] font-bold uppercase">{u.role}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-100">Recent Activity</h3>
              <Button variant="ghost" size="xs" className="text-surface-500 hover:text-surface-200" rightIcon={<ChevronRight size={12} />} onClick={() => navigate('/admin/audit?view=activity')}>View All</Button>
            </div>
            <div className="space-y-2">
              {activities.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-6">No recent activity</p>
              ) : activities.slice(0, 5).map((a: any) => {
                const user = a.userId;
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(a.createdAt).getTime();
                  if (diff < 60000) return 'just now';
                  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                  return `${Math.floor(diff / 86400000)}d ago`;
                })();
                return (
                  <div key={a._id} className="flex items-center gap-3 p-2 rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-[10px] font-bold text-surface-400">
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-300 truncate">
                        <span className="font-semibold text-surface-200">{user?.name || 'System'}</span> {a.action.replace(/[._]/g, ' ')}
                      </p>
                    </div>
                    <span className="text-[10px] text-surface-500 flex-shrink-0">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

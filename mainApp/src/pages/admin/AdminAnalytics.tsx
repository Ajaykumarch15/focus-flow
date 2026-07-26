import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Users, Clock, Target, Star, TrendingUp, Globe,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { api } from '../../utils/api';
import { SkeletonStatCard } from '../../components/ui/Skeleton';

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function formatMs(ms: number): string { if (!ms) return '0h'; const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; }

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5 hover:border-surface-700 transition-all relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}12` }}><Icon size={18} style={{ color }} /></div>
      <p className="text-2xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
      <p className="text-xs font-medium text-surface-400">{label}</p>
      {sub && <p className="text-[11px] text-emerald-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

export function AdminAnalytics() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try { const d = await api.admin.getSystemAnalytics(p); setData(d); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  if (loading) return <div className="p-6 lg:p-8 max-w-[1500px] mx-auto"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div></div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-extrabold text-surface-50 mb-1">Analytics</h1><p className="text-sm text-surface-400">Organization-wide metrics and trends</p></div>
        <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800">
          {(['week', 'month', 'quarter'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${period === p ? 'bg-surface-700/80 text-surface-50 shadow-sm border border-surface-600/30' : 'text-surface-400 hover:text-surface-200'}`}>{p}</button>
          ))}
        </div>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Users" value={String(data?.activeUsers || 0)} color="#8b5cf6" />
        <StatCard icon={Clock} label="Total Focus" value={`${(data?.totalFocusMs || 0) / 3600000}h`} color="#0ea5e9" />
        <StatCard icon={Target} label="Completion Rate" value={`${data?.taskCompletionRate || 0}%`} color="#10b981" />
        <StatCard icon={Star} label="Avg Focus Score" value={String(data?.avgFocusScore || 0)} sub="out of 100" color="#f59e0b" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="text-sm font-bold text-surface-100 mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-brand-400" /> Daily Focus Hours</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailyFocus || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-800)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} />
                <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any) => [`${(v / 3600000).toFixed(1)}h`, 'Focus']} />
                <Bar dataKey="totalMs" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="text-sm font-bold text-surface-100 mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-emerald-400" /> User Signups</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.userGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-800)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {data?.topCategories?.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="text-sm font-bold text-surface-100 mb-4 flex items-center gap-2"><Globe size={14} className="text-purple-400" /> Top Categories</h3>
          <div className="space-y-2">
            {data.topCategories.map((cat: any, i: number) => {
              const maxMs = Math.max(...data.topCategories.map((c: any) => c.totalTimeMs), 1);
              const pct = (cat.totalTimeMs / maxMs) * 100;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-xs text-surface-400 w-24 truncate">{cat.category}</span>
                  <div className="flex-1 h-6 rounded-lg bg-surface-800 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full rounded-lg" style={{ background: 'linear-gradient(90deg, #8b5cf640, #8b5cf6)' }} />
                  </div>
                  <span className="text-xs text-surface-400 font-mono w-16 text-right">{formatMs(cat.totalTimeMs)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

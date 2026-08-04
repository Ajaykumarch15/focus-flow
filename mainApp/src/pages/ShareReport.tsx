import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock, CheckCircle2, GitBranch,
  BookMarked, BarChart3, Target,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../utils/api';
import { Skeleton, SkeletonStatCard } from '../components/ui/Skeleton';
import { STATUS_LABELS, MOOD_EMOJIS } from '../lib/config';

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ShareReportPage() {
  const { token } = useParams<{ token?: string }>();
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api.reports.shareToken(token)
      .then(d => { if (d.message) throw new Error(d.message); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-surface-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-48 rounded mb-1" />
              <Skeleton className="h-3 w-36 rounded" />
            </div>
          </div>
          <div className="card p-4">
            <Skeleton className="h-5 w-56 rounded mb-1" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>

        {/* Work logs skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-20 rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full rounded mb-2" />
              <Skeleton className="h-4 w-3/4 rounded mb-2" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="card p-8 text-center max-w-md">
        <p className="text-red-400 font-medium mb-2">Failed to load report</p>
        <p className="text-surface-400 text-sm">{error}</p>
      </div>
    </div>
  );

  const reportDate = data?.date || '';
  const dateLabel = reportDate ? format(parseISO(reportDate), 'EEEE, MMMM d, yyyy') : '';

  return (
    <div className="min-h-screen bg-surface-950 py-10 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md">
              <Target size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-surface-50 text-2xl lg:text-3xl tracking-tight">FocusFlow Work Report</h1>
              <p className="text-surface-400 text-sm font-medium">Daily summary shared by {data?.intern || 'User'}</p>
            </div>
          </div>

          <div className="card p-6 rounded-[22px] shadow-sm bg-gradient-to-b from-[#F6FBFF] to-white dark:from-brand-500/10 dark:to-surface-900 border border-brand-500/20">
            <p className="text-brand-500 dark:text-brand-400 font-extrabold text-xl">{dateLabel}</p>
            <p className="text-surface-300 text-sm mt-1 font-medium">{data?.intern}'s work log</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { icon: Clock,       label: 'Time Worked',  value: formatMs(data?.totalMs || 0),        color: 'text-brand-500 dark:text-brand-400', bg: 'bg-blue-500/10' },
            { icon: CheckCircle2,label: 'Completed',    value: String(data?.completedCount || 0),   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
            { icon: BarChart3,   label: 'Tasks',        value: String(data?.tasks?.length || 0),     color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
            { icon: GitBranch,   label: 'Branches',     value: String(data?.branches?.length || 0),  color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="card p-5 rounded-[22px] shadow-sm">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${bg}`}>
                <Icon size={18} className={color} />
              </div>
              <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
              <p className="text-xs text-surface-400 font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Branches */}
        {data?.branches?.length > 0 && (
          <div className="card p-4 rounded-[18px] shadow-sm flex items-center gap-3 flex-wrap">
            <span className="text-xs text-surface-400 font-semibold">Git branches:</span>
            {data.branches.map((b: string) => (
              <span key={b} className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                <GitBranch size={12} />{b}
              </span>
            ))}
          </div>
        )}

        {/* Work Logs */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-lg text-surface-50 flex items-center gap-2">
            <BookMarked size={18} className="text-brand-400" /> Work Logs
          </h2>
          {data?.workLogs?.length === 0 ? (
            <div className="card p-8 rounded-[22px] text-center"><p className="text-surface-400 font-medium">No work logs for this day</p></div>
          ) : data?.workLogs?.map((log: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-6 rounded-[22px] shadow-sm">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h3 className="font-bold text-surface-50 text-base">{log.title}</h3>
                <span className="text-xs px-3 py-1 rounded-full bg-surface-850 text-surface-300 font-semibold border border-surface-800">{STATUS_LABELS[log.status] || log.status}</span>
                <span className="text-xl ml-auto">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
              </div>

              {log.gitBranch && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 w-fit">
                  <GitBranch size={13} />{log.gitBranch}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                {log.problem && (
                  <div>
                    <p className="text-xs text-surface-400 font-semibold mb-1">Problem Solved</p>
                    <p className="text-sm text-surface-200">{log.problem}</p>
                  </div>
                )}
                {log.currentWork && (
                  <div>
                    <p className="text-xs text-surface-400 font-semibold mb-1">What I Worked On</p>
                    <p className="text-sm text-surface-200">{log.currentWork}</p>
                  </div>
                )}
              </div>

              {log.completedItems?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-surface-400 font-semibold mb-2">Completed ({log.completedItems.length})</p>
                  <div className="space-y-1.5">
                    {log.completedItems.map((item: any) => (
                      <div key={item._id} className="flex items-start gap-2 text-sm text-surface-200">
                        <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-surface-400 font-medium pt-4">
          Generated by FocusFlow · {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

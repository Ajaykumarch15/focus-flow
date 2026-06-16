import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock, CheckCircle2, GitBranch, ExternalLink,
  AlertTriangle, BookMarked, BarChart3, Target, Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../utils/api';

const MOOD_EMOJIS   = ['😔', '😐', '🙂', '😊', '🔥'];
const STATUS_LABELS: Record<string, string> = {
  planning: '🗺️ Planning', 'in-progress': '⚡ In Progress',
  reviewing: '👀 Reviewing', blocked: '🚫 Blocked', done: '✅ Done',
};

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ShareReportPage() {
  const { userId, date, token } = useParams<{ userId?: string; date?: string; token?: string }>();
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (token) {
      api.reports.shareToken(token)
        .then(d => { if (d.message) throw new Error(d.message); setData(d); })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }
    if (!userId || !date) return;
    api.reports.share(userId, date)
      .then(d => { if (d.message) throw new Error(d.message); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId, date, token]);

  if (loading) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-brand-400" />
        <p className="text-surface-400">Loading report…</p>
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

  const reportDate = data?.date || date || '';
  const dateLabel = reportDate ? format(parseISO(reportDate), 'EEEE, MMMM d, yyyy') : '';

  return (
    <div className="min-h-screen bg-surface-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <Target size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white text-xl">FocusFlow Work Report</h1>
              <p className="text-surface-400 text-sm">Daily summary shared by {data.intern}</p>
            </div>
          </div>

          <div className="card p-4 bg-brand-500/5 border-brand-500/20">
            <p className="text-brand-300 font-semibold text-lg">{dateLabel}</p>
            <p className="text-surface-300 text-sm mt-0.5">{data.intern}'s work log</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Clock,       label: 'Time Worked',  value: formatMs(data.totalMs),        color: 'text-brand-400'   },
            { icon: CheckCircle2,label: 'Completed',    value: String(data.completedCount),   color: 'text-emerald-400' },
            { icon: BarChart3,   label: 'Tasks',        value: String(data.tasks.length),     color: 'text-purple-400'  },
            { icon: GitBranch,   label: 'Branches',     value: String(data.branches.length),  color: 'text-yellow-400'  },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card p-4">
              <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
              <div className="flex items-center gap-1.5 mt-1"><Icon size={12} className={color} />
                <p className="text-xs text-surface-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Branches */}
        {data.branches.length > 0 && (
          <div className="card p-3 mb-6 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-surface-400 font-medium">Git branches:</span>
            {data.branches.map((b: string) => (
              <span key={b} className="flex items-center gap-1 text-xs text-emerald-300 font-mono bg-emerald-400/10 px-2 py-1 rounded-lg">
                <GitBranch size={10} />{b}
              </span>
            ))}
          </div>
        )}

        {/* Work Logs */}
        <h2 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
          <BookMarked size={16} className="text-brand-400" /> Work Logs
        </h2>
        <div className="space-y-4 mb-8">
          {data.workLogs.length === 0 ? (
            <div className="card p-6 text-center"><p className="text-surface-400">No work logs for this day</p></div>
          ) : data.workLogs.map((log: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h3 className="font-semibold text-white">{log.title}</h3>
                <span className="text-sm text-surface-400">{STATUS_LABELS[log.status] || log.status}</span>
                <span className="text-xl ml-auto">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
              </div>

              {log.gitBranch && (
                <div className="flex items-center gap-1.5 mb-3 text-sm text-emerald-400 font-mono bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-3 py-1.5 w-fit">
                  <GitBranch size={13} />{log.gitBranch}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {log.problem && (
                  <div>
                    <p className="text-xs text-surface-400 font-medium mb-1">Problem Solved</p>
                    <p className="text-sm text-surface-200">{log.problem}</p>
                  </div>
                )}
                {log.currentWork && (
                  <div>
                    <p className="text-xs text-surface-400 font-medium mb-1">What I Worked On</p>
                    <p className="text-sm text-surface-200">{log.currentWork}</p>
                  </div>
                )}
              </div>

              {log.completedItems.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-surface-400 font-medium mb-1.5">Completed ({log.completedItems.length})</p>
                  <div className="space-y-1">
                    {log.completedItems.map((item: any) => (
                      <div key={item._id} className="flex items-start gap-1.5 text-sm text-surface-200">
                        <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />{item.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {log.blockers && (
                <div className="mt-3 p-2 bg-yellow-400/5 border border-yellow-400/15 rounded-lg">
                  <p className="text-xs text-yellow-400 mb-0.5 flex items-center gap-1"><AlertTriangle size={10} /> Blockers</p>
                  <p className="text-sm text-surface-200">{log.blockers}</p>
                </div>
              )}

              {log.plan && (
                <div className="mt-3">
                  <p className="text-xs text-surface-400 font-medium mb-1">Plan / Next Steps</p>
                  <p className="text-sm text-surface-300 whitespace-pre-wrap">{log.plan}</p>
                </div>
              )}

              {log.designNotes && (
                <div className="mt-3">
                  <p className="text-xs text-surface-400 font-medium mb-1">Design / Architecture Notes</p>
                  <p className="text-sm text-surface-300 whitespace-pre-wrap">{log.designNotes}</p>
                </div>
              )}

              {log.links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {log.links.map((l: any) => (
                    <a key={l._id} href={l.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 px-2 py-1 rounded-lg transition-colors">
                      <ExternalLink size={10} />{l.label}
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Tasks Time Breakdown */}
        {data.tasks.length > 0 && (
          <>
            <h2 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
              <Clock size={16} className="text-brand-400" /> Time Breakdown
            </h2>
            <div className="card p-5 mb-8">
              <div className="space-y-3">
                {data.tasks.map((task: any) => {
                  const pct = data.totalMs > 0 ? (task.totalMs / data.totalMs) * 100 : 0;
                  return (
                    <div key={task.taskId}>
                      <div className="flex justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.color }} />
                          <span className="text-sm text-white">{task.title}</span>
                          <span className="text-xs text-surface-500">{task.category}</span>
                        </div>
                        <span className="text-sm font-mono text-brand-400">{formatMs(task.totalMs)}</span>
                      </div>
                      <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: task.color }} />
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-surface-800 pt-3 flex justify-between">
                  <span className="text-sm font-medium text-white">Total</span>
                  <span className="text-sm font-mono font-bold text-brand-400">{formatMs(data.totalMs)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs text-surface-600">
          Generated by FocusFlow · {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

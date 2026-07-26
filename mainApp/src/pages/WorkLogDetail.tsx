import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Clock, GitBranch, CheckCircle2, AlertTriangle,
  ExternalLink, Link2, BookMarked, Timer, FolderOpen,
  ChevronRight, Loader2, Flame, TrendingUp, Calendar, Zap,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { formatDistanceToNow, format } from 'date-fns';
import { renderMarkdown } from '../components/ui/proEditor';
import { Skeleton } from '../components/ui/Skeleton';
import type { WorkLog, WorkLogStatus } from '../store/useWorkLogStore';

const STATUS_OPTIONS: Record<WorkLogStatus, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  'planning':    { label: 'Planning',    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    emoji: '🗺️' },
  'in-progress': { label: 'In Progress', color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     emoji: '⚡' },
  'reviewing':   { label: 'Reviewing',   color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  emoji: '👀' },
  'blocked':     { label: 'Blocked',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     emoji: '🚫' },
  'done':        { label: 'Done',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', emoji: '✅' },
};

const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function WorkLogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [log, setLog] = useState<WorkLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api.workLogs.get(id)
      .then(doc => {
        const mapped: WorkLog = {
          _id: doc._id,
          title: doc.title || 'Untitled Work Item',
          taskRef: doc.taskRef ? {
            _id: doc.taskRef._id,
            title: doc.taskRef.title,
            color: doc.taskRef.color || '#0ea5e9',
            category: doc.taskRef.category || 'Work',
            totalTime: doc.taskRef.totalTime || 0,
          } : undefined,
          projectRef: doc.projectRef ? {
            _id: doc.projectRef._id,
            name: doc.projectRef.name,
            googleFolderId: doc.projectRef.googleFolderId,
            workLogsFolderId: doc.projectRef.workLogsFolderId,
          } : undefined,
          problem: doc.problem || '',
          gitBranch: doc.gitBranch || '',
          currentWork: doc.currentWork || '',
          plan: doc.plan || '',
          designNotes: doc.designNotes || '',
          blockers: doc.blockers || '',
          workEntries: (doc.workEntries || []).map((e: any) => ({
            _id: e._id,
            date: e.date,
            what: e.what || '',
            startedAt: e.startedAt,
            endedAt: e.endedAt,
            activeMs: e.activeMs || 0,
          })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          totalActiveMs: doc.totalActiveMs || 0,
          completedItems: (doc.completedItems || []).map((i: any) => ({
            _id: i._id, text: i.text, done: i.done,
            createdAt: new Date(i.createdAt || Date.now()).getTime(),
          })),
          links: (doc.links || []).map((l: any) => ({ _id: l._id, label: l.label, url: l.url })),
          status: doc.status || 'in-progress',
          isActive: doc.isActive ?? true,
          closedAt: doc.closedAt,
          reopenedAt: doc.reopenedAt,
          mood: doc.mood || 3,
          tags: doc.tags || [],
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
        setLog(mapped);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 mb-6 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 p-16 text-center">
          <BookMarked size={40} className="text-surface-600 mx-auto mb-3" />
          <p className="text-lg font-semibold text-surface-200">Work log not found</p>
          <p className="text-sm text-surface-500 mt-1">{error || 'This work log may have been deleted.'}</p>
        </div>
      </div>
    );
  }

  const status = STATUS_OPTIONS[log.status] || STATUS_OPTIONS['in-progress'];
  const totalDays = log.workEntries.length;
  const avgPerDay = totalDays > 0 ? (log.totalActiveMs / totalDays / 3600000).toFixed(1) : '0';

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Back button */}
      <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">
        <ArrowLeft size={16} /> Back to Work Logs
      </motion.button>

      {/* Hero Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl ${status.bg} flex items-center justify-center flex-shrink-0 text-lg`}>
            {status.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-surface-50 text-xl">{log.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${status.color} ${status.bg} ${status.border}`}>
                {status.emoji} {status.label}
              </span>
              <span className="text-lg">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
              {log.gitBranch && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  <GitBranch size={11} /> {log.gitBranch}
                </span>
              )}
              {log.taskRef && (
                <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: `${log.taskRef.color}15`, color: log.taskRef.color }}>
                  <Timer size={11} /> {log.taskRef.title}
                </span>
              )}
              {log.projectRef && (
                <span className="flex items-center gap-1 text-[11px] text-surface-400 bg-surface-800 px-2.5 py-1 rounded-lg">
                  <FolderOpen size={11} /> {log.projectRef.name}
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-2">
              Created {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
              {' · '}
              {log.isActive ? 'Active' : `Closed ${log.closedAt ? formatDistanceToNow(new Date(log.closedAt), { addSuffix: true }) : ''}`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Clock, label: 'Total Time', value: formatMs(log.totalActiveMs), color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { icon: Calendar, label: 'Days Active', value: String(totalDays), color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: TrendingUp, label: 'Avg / Day', value: `${avgPerDay}h`, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { icon: CheckCircle2, label: 'Completed', value: String(log.completedItems.length), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <motion.div key={label} variants={fadeUp}
            className="rounded-xl border border-surface-800 bg-surface-900 p-4">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
              <Icon size={14} className={color} />
            </div>
            <p className="text-lg font-display font-bold text-surface-50">{value}</p>
            <p className="text-[11px] text-surface-400 font-medium">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — Context */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-3 space-y-4">
          {log.problem && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={13} className="text-red-400" />
                </div>
                <span className="text-[11px] text-red-400 font-semibold uppercase tracking-wider">Problem I'm Solving</span>
              </div>
              <div className="prose-editor text-sm text-surface-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.problem) }} />
            </motion.div>
          )}

          {log.currentWork && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Zap size={13} className="text-brand-400" />
                </div>
                <span className="text-[11px] text-brand-400 font-semibold uppercase tracking-wider">What I Did</span>
              </div>
              <div className="prose-editor text-sm text-surface-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.currentWork) }} />
            </motion.div>
          )}

          {log.blockers && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-yellow-400/15 bg-yellow-400/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <AlertTriangle size={13} className="text-yellow-400" />
                </div>
                <span className="text-[11px] text-yellow-400 font-semibold uppercase tracking-wider">Blockers</span>
              </div>
              <div className="prose-editor text-sm text-surface-200" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.blockers) }} />
            </motion.div>
          )}

          {log.plan && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <BookMarked size={13} className="text-amber-400" />
                </div>
                <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Plan</span>
              </div>
              <div className="prose-editor text-sm text-surface-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.plan) }} />
            </motion.div>
          )}

          {log.designNotes && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Flame size={13} className="text-purple-400" />
                </div>
                <span className="text-[11px] text-purple-400 font-semibold uppercase tracking-wider">Design & Architecture</span>
              </div>
              <div className="prose-editor text-sm text-surface-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.designNotes) }} />
            </motion.div>
          )}

          {!log.problem && !log.currentWork && !log.blockers && !log.plan && !log.designNotes && (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 p-10 text-center">
              <BookMarked size={28} className="text-surface-600 mx-auto mb-2" />
              <p className="text-sm text-surface-400">No context fields filled in yet</p>
            </div>
          )}
        </motion.div>

        {/* Right — Sessions, Checklist, Links */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
          {/* Completed Items */}
          {log.completedItems.length > 0 && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Completed</span>
                <span className="text-[10px] text-surface-500 font-medium">{log.completedItems.filter(i => i.done).length}/{log.completedItems.length}</span>
              </div>
              <div className="space-y-2">
                {log.completedItems.map(item => (
                  <div key={item._id} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={13} className={`flex-shrink-0 mt-0.5 ${item.done ? 'text-emerald-400' : 'text-surface-600'}`} />
                    <span className={item.done ? 'text-surface-200' : 'text-surface-400'}>{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Links */}
          {log.links.length > 0 && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Link2 size={14} className="text-cyan-400" />
                <span className="text-[11px] text-cyan-400 font-semibold uppercase tracking-wider">Links</span>
              </div>
              <div className="space-y-2">
                {log.links.map(link => (
                  <a key={link._id} href={link.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                    <ExternalLink size={12} /> {link.label}
                  </a>
                ))}
              </div>
            </motion.div>
          )}

          {/* Work History Timeline */}
          <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={14} className="text-brand-400" />
              <span className="text-[11px] text-brand-400 font-semibold uppercase tracking-wider">Work History</span>
              <span className="text-[10px] text-surface-500 font-medium">{log.workEntries.length} days</span>
            </div>
            {log.workEntries.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-4">No work entries yet</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
                {log.workEntries.map(entry => (
                  <div key={entry._id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
                      <div className="w-px flex-1 bg-surface-700" />
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-surface-200">
                          {format(new Date(entry.date), 'MMM d, yyyy')}
                        </span>
                        {entry.activeMs > 0 && (
                          <span className="text-[10px] text-brand-400 font-medium">
                            {formatMs(entry.activeMs)}
                          </span>
                        )}
                      </div>
                      {entry.what && (
                        <div className="text-xs text-surface-400 leading-relaxed line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.what) }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

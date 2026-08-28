import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle2, GitBranch, ExternalLink,
  Share2, Copy, Check, ChevronLeft, ChevronRight,
  BarChart3, BookMarked, AlertTriangle, Link2,
  Loader2, TrendingUp, ArrowLeft, Download, RotateCcw,
  Flame, Target,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
         isToday, subMonths, addMonths, parseISO } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';
import { timerEngine } from '../utils/timerEngine';
import { toast } from '../store/useToastStore';
import { Markdown } from '../lib';
import { Skeleton, SkeletonStatCard, SkeletonCard } from '../components/ui/Skeleton';
import { AnalyticsSection } from '../components/reports/AnalyticsSection';
import type { SessionLike } from '../lib/reportsSelectors';
import { useNavigate } from 'react-router-dom';
import { MOOD_EMOJIS } from '../lib/config';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DaySummary {
  date: string;
  totalMs: number;
  totalHours: number;
  sessionCount: number;
  taskCount: number;
  workLogCount: number;
  completedCount: number;
}

interface DayDetail {
  date: string;
  totalMs: number;
  totalHours: number;
  tasks: {
    taskId: string; title: string; color: string;
    category: string; priority: string; totalMs: number;
    sessions: { _id: string; startTime: number; endTime: number; activeTime: number }[];
  }[];
  workLogs: {
    _id: string; title: string; problem: string; gitBranch: string;
    currentWork: string; plan: string; status: string; mood: number;
    completedItems: { _id: string; title: string; completedAt: number }[];
    links: { _id: string; url: string; label: string }[];
    tags: string[];
    designNotes: string;
    blockers: string[];
    createdAt: number;
  }[];
  completedTasks: {
    taskId: string; title: string; color: string;
    category: string; priority: string; totalTime: number;
    completedAt: string;
  }[];
  sessionCount: number;
  workLogCount: number;
  completedCount: number;
  branches: string[];
}

interface SummaryTotals {
  totalMs: number;
  totalHours: number;
  daysWorked: number;
  sessionCount: number;
  taskCount: number;
  workLogCount: number;
  completedCount: number;
}

interface ApiSession {
  _id: string;
  taskId: string | { _id?: string };
  startTime: number;
  endTime?: number;
  totalPauseDuration?: number;
  activeTime?: number;
  isActive?: boolean;
  focusScore?: number;
}

function mapSessions(docs: ApiSession[]): SessionLike[] {
  return docs.map(doc => ({
    id: doc._id,
    taskId: String((doc.taskId as any)?._id ?? doc.taskId ?? ''),
    startTime: doc.startTime,
    activeTime: doc.activeTime || 0,
    totalPauseDuration: doc.totalPauseDuration || 0,
    focusScore: doc.focusScore,
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMs(ms: number): string {
  if (!ms) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_COLOR: Record<string, string> = {
  planning:    'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'in-progress':'text-sky-400 bg-sky-500/10 border-sky-500/20',
  reviewing:   'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  blocked:     'text-red-400 bg-red-400/10 border-red-400/20',
  done:        'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

function heatLevel(hours: number): number {
  if (hours === 0) return 0;
  if (hours < 2)   return 1;
  if (hours < 4)   return 2;
  if (hours < 6)   return 3;
  return 4;
}

function isFutureDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) > today;
}
const HEAT_STYLES = [
  'bg-surface-800/60 border-surface-700/50',
  'bg-brand-900/50 border-brand-800/40',
  'bg-brand-700/40 border-brand-600/40',
  'bg-brand-500/50 border-brand-500/40',
  'bg-brand-400/80 border-brand-300/60',
];

// ── Motion variants ───────────────────────────────────────────────────────────
const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

// ── Animated counter ──────────────────────────────────────────────────────────
// ── Share link button ─────────────────────────────────────────────────────────
function ShareButton({ date }: { date: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const url = token ? `${window.location.origin}/reports/share/token/${token}` : '';

  const generate = async () => {
    setLoading(true);
    try {
      const share = await api.reports.createShare(date, 30);
      setToken(share.token);
      toast.success('Share link generated', 'This token link expires in 30 days.');
    } catch (err: any) {
      toast.error('Could not generate share link', err.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const revoke = async () => {
    if (!token) return;
    setLoading(true);
    try { await api.reports.revokeShare(token); setToken(''); toast.success('Share link revoked'); }
    catch (err: any) { toast.error('Could not revoke share link', err.message || 'Please try again.'); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopyError(''); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); setCopyError('Copy failed'); setTimeout(() => setCopyError(''), 2500); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 px-3 py-2 bg-surface-850 rounded-xl text-xs text-surface-300 font-mono truncate border border-surface-800">
          {url}
        </div>
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-50 transition-all border border-surface-700">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          {token ? 'Regenerate' : 'Generate'}
        </button>
        <button onClick={copy} disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
            copied ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border-brand-500/20'
          }`}>
          {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> {copyError || 'Copy'}</>}
        </button>
        {token && (
          <button onClick={revoke} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-400/10 hover:bg-red-400/20 text-red-400 transition-all border border-red-400/20">
            Revoke
          </button>
        )}
      </div>
      {token && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Share link active · expires in 30 days</span>
        </div>
      )}
    </div>
  );
}

function summarizeDays(days: DaySummary[]): SummaryTotals {
  const taskDays = days.reduce((a, d) => a + d.taskCount, 0);
  return {
    totalMs: days.reduce((a, d) => a + d.totalMs, 0),
    totalHours: Math.round(days.reduce((a, d) => a + d.totalMs, 0) / 3600000 * 10) / 10,
    daysWorked: days.filter(d => d.totalMs > 0 || d.workLogCount > 0).length,
    sessionCount: days.reduce((a, d) => a + d.sessionCount, 0),
    taskCount: taskDays,
    workLogCount: days.reduce((a, d) => a + d.workLogCount, 0),
    completedCount: days.reduce((a, d) => a + d.completedCount, 0),
  };
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function buildDayExport(data: DayDetail): string {
  const lines = [
    `FocusFlow Daily Report - ${data.date}`,
    `Total time: ${formatMs(data.totalMs)}`,
    `Timer sessions: ${data.sessionCount}`,
    `Work logs: ${data.workLogCount}`,
    `Completed items: ${data.completedCount}`,
    '', 'Work Logs',
  ];
  for (const log of data.workLogs) {
    lines.push(`- ${log.title} [${log.status}]`);
    if (log.gitBranch) lines.push(`  Branch: ${log.gitBranch}`);
    if (log.currentWork) lines.push(`  What I did: ${log.currentWork}`);
    if (log.blockers) lines.push(`  Blockers: ${log.blockers}`);
    for (const item of log.completedItems) lines.push(`  Done: ${item.title}`);
  }
  lines.push('', 'Time by Task');
  for (const task of data.tasks) lines.push(`- ${task.title}: ${formatMs(task.totalMs)}`);
  return lines.join('\n');
}

// ── Day detail panel ──────────────────────────────────────────────────────────
function DayDetailPanel({ date, onBack, onDateChange, viewUserId }: { date: string; onBack: () => void; onDateChange: (date: string) => void; viewUserId?: string }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData]       = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    setLoading(true); setError('');
    const fetcher = viewUserId
      ? () => api.admin.getUserReportDay(viewUserId, date)
      : () => api.reports.day(date);
    fetcher()
      .then(d => setData(d))
      .catch((err) => { setError(err.message || 'Failed to load day report'); toast.error('Could not load report', err.message); })
      .finally(() => setLoading(false));
  }, [date, viewUserId]);

  const dateLabel = format(parseISO(date), 'EEEE, MMMM d, yyyy');

  if (loading) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="h-7 w-64 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard headerWidth="35%" lines={3} />
        <SkeletonCard headerWidth="40%" lines={4} />
      </div>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-10 text-center">
      <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
      <p className="text-red-400 font-semibold">Could not load this day</p>
      <p className="text-sm text-surface-400 mt-1">{error}</p>
    </div>
  );

  if (!data) return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-10 text-center">
      <Calendar size={28} className="text-surface-600 mx-auto mb-3" />
      <p className="text-surface-400">No data for this day</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-50 transition-all border border-surface-700">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-display font-bold text-surface-50 text-xl flex items-center gap-2">
              <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); onDateChange(format(d, 'yyyy-MM-dd')); }}
                className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span>{dateLabel}</span>
              <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); onDateChange(format(d, 'yyyy-MM-dd')); }}
                className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors">
                <ChevronRight size={16} />
              </button>
              {!isToday(parseISO(date)) && (
                <button onClick={() => onDateChange(format(new Date(), 'yyyy-MM-dd'))}
                  className="text-[10px] font-medium text-brand-400 hover:text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-md transition-colors">
                  Today
                </button>
              )}
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">
              {data.workLogCount} work log{data.workLogCount !== 1 ? 's' : ''} · {data.sessionCount} session{data.sessionCount !== 1 ? 's' : ''} · {data.completedCount} task{data.completedCount !== 1 ? 's' : ''} completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShare(!showShare)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-xl text-sm text-surface-300 hover:text-surface-50 transition-all border border-surface-700">
            <Share2 size={14} /> Share
          </button>
          <button onClick={() => downloadText(`focusflow-${date}.txt`, buildDayExport(data))}
            className="flex items-center gap-2 px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-xl text-sm text-surface-300 hover:text-surface-50 transition-all border border-surface-700">
            <Download size={14} /> Export
          </button>
          <button onClick={() => copyText(buildDayExport(data)).then(() => toast.success('Summary copied')).catch((err) => toast.error('Copy failed', err.message))}
            className="flex items-center gap-2 px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-xl text-sm text-surface-300 hover:text-surface-50 transition-all border border-surface-700">
            <Copy size={14} /> Copy
          </button>
        </div>
      </div>

      {/* Share panel */}
      <AnimatePresence>
        {showShare && user && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 mb-5">
            <p className="text-xs text-brand-300 mb-3 flex items-center gap-1.5 font-medium">
              <Link2 size={12} /> Share this link with your lead — no login required
            </p>
            <ShareButton date={date} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Clock, label: 'Time Worked', value: formatMs(data.totalMs), color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { icon: CheckCircle2, label: 'Tasks Completed', value: String(data.completedCount), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: BarChart3, label: 'Tasks Tracked', value: String(data.tasks.length), color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: GitBranch, label: 'Branches', value: String(data.branches.length), color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <motion.div key={label} variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className={`text-xl font-display font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-surface-400 font-medium">{label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Branches */}
      {data.branches.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-4 mb-5 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-surface-400 font-semibold">Branches:</span>
          {data.branches.map(b => (
            <span key={b} className="flex items-center gap-1 text-xs text-emerald-300 font-mono bg-emerald-400/10 px-2.5 py-1 rounded-lg border border-emerald-400/20">
              <GitBranch size={10} /> {b}
            </span>
          ))}
        </div>
      )}

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Work Logs — 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="font-display font-bold text-surface-50 flex items-center gap-2 text-[15px]">
            <BookMarked size={15} className="text-brand-400" /> Work Logs
          </h3>
          {data.workLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-700 p-8 text-center">
              <BookMarked size={24} className="text-surface-600 mx-auto mb-2" />
              <p className="text-sm text-surface-400">No work logs for this day</p>
            </div>
          ) : data.workLogs.map(log => (
            <div key={log._id} className="rounded-2xl border border-surface-800 bg-surface-900 p-5 cursor-pointer hover:border-surface-700 transition-all"
              onClick={() => navigate(`/worklog/logs/${log._id}`)}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="font-semibold text-surface-50 text-[15px] hover:text-brand-400 transition-colors">{log.title}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${STATUS_COLOR[log.status] || 'text-surface-400 bg-surface-800 border-surface-700'}`}>
                  {log.status}
                </span>
                <span className="text-lg ml-auto">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
              </div>

              {log.gitBranch && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-emerald-400 font-mono bg-emerald-400/10 w-fit px-2.5 py-1 rounded-lg border border-emerald-400/20">
                  <GitBranch size={11} /> {log.gitBranch}
                </div>
              )}

              <div className="space-y-3">
                {log.problem && (
                  <div className="p-3 rounded-xl bg-surface-850 border border-surface-800">
                    <p className="text-[11px] text-red-400 font-semibold mb-1 uppercase tracking-wider">Problem</p>
                    <div className="prose-editor text-sm text-surface-200"><Markdown source={log.problem} /></div>
                  </div>
                )}
                {log.currentWork && (
                  <div className="p-3 rounded-xl bg-surface-850 border border-surface-800">
                    <p className="text-[11px] text-brand-400 font-semibold mb-1 uppercase tracking-wider">What I Did</p>
                    <div className="prose-editor text-sm text-surface-200"><Markdown source={log.currentWork} /></div>
                  </div>
                )}
                {log.completedItems.length > 0 && (
                  <div className="p-3 rounded-xl bg-surface-850 border border-surface-800">
                    <p className="text-[11px] text-emerald-400 font-semibold mb-1.5 uppercase tracking-wider">Completed</p>
                    <div className="space-y-1">
                      {log.completedItems.map(item => (
                        <div key={item._id} className="flex items-start gap-1.5 text-xs text-surface-200">
                          <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" /> {item.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {log.blockers && (
                  <div className="p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/15">
                    <p className="text-[11px] text-yellow-400 mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                      <AlertTriangle size={10} /> Blockers
                    </p>
                    <div className="prose-editor text-xs text-surface-200"><Markdown source={Array.isArray(log.blockers) ? log.blockers.join('\n') : log.blockers} /></div>
                  </div>
                )}
                {log.plan && (
                  <div className="p-3 rounded-xl bg-surface-850 border border-surface-800">
                    <p className="text-[11px] text-amber-400 font-semibold mb-1 uppercase tracking-wider">Plan</p>
                    <div className="prose-editor text-xs text-surface-300"><Markdown source={log.plan} /></div>
                  </div>
                )}
                {log.designNotes && (
                  <div className="p-3 rounded-xl bg-surface-850 border border-surface-800">
                    <p className="text-[11px] text-purple-400 font-semibold mb-1 uppercase tracking-wider">Design / Architecture</p>
                    <div className="prose-editor text-xs text-surface-300"><Markdown source={log.designNotes} /></div>
                  </div>
                )}
              </div>

              {log.links.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-surface-800">
                  {log.links.map(l => (
                    <a key={l._id} href={l.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 px-2.5 py-1 rounded-lg border border-cyan-400/20 transition-colors">
                      <ExternalLink size={10} /> {l.label}
                    </a>
                  ))}
                </div>
              )}
              {log.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {log.tags.map(t => (
                    <span key={t} className="text-[10px] font-semibold bg-surface-800 text-surface-400 px-2 py-0.5 rounded-md">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tasks + Time — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-display font-bold text-surface-50 flex items-center gap-2 text-[15px]">
            <Clock size={15} className="text-brand-400" /> Time by Task
          </h3>
          {data.tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-700 p-8 text-center">
              <Clock size={24} className="text-surface-600 mx-auto mb-2" />
              <p className="text-sm text-surface-400">No time tracked for this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.tasks.map(task => {
                const pct = data.totalMs > 0 ? (task.totalMs / data.totalMs) * 100 : 0;
                return (
                  <div key={task.taskId} className="rounded-2xl border border-surface-800 bg-surface-900 p-4">
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                        <span className="text-sm text-surface-50 font-semibold truncate">{task.title}</span>
                      </div>
                      <span className="text-sm font-mono text-brand-400 font-semibold flex-shrink-0 ml-2">{formatMs(task.totalMs)}</span>
                    </div>
                    <div className="h-2 bg-surface-800 rounded-full overflow-hidden mb-2">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: task.color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-surface-500 font-medium">
                      <span>{task.category}</span>
                      <span>{task.sessions.length} session{task.sessions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
              <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-surface-100">Total Time</span>
                  <span className="text-xl font-display font-bold text-brand-400">{formatMs(data.totalMs)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          <div className="mt-4">
            <h3 className="font-display font-bold text-surface-50 flex items-center gap-2 text-[15px] mb-3">
              <CheckCircle2 size={15} className="text-emerald-400" /> Completed Tasks
            </h3>
            {data.completedTasks && data.completedTasks.length > 0 ? (
              <div className="space-y-2">
                {data.completedTasks.map(task => (
                  <div key={task.taskId} className="flex items-center gap-3 rounded-2xl border border-surface-800 bg-surface-900 p-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-surface-50 font-medium truncate block">{task.title}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold bg-surface-800 text-surface-400 px-1.5 py-0.5 rounded">{task.category}</span>
                        <span className="text-[10px] text-surface-500">{task.priority}</span>
                        {task.completedAt && (
                          <span className="text-[10px] text-surface-500">
                            at {format(parseISO(task.completedAt), 'h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-mono text-emerald-400 font-semibold flex-shrink-0">
                      {formatMs(task.totalTime)}
                    </span>
                  </div>
                ))}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-surface-100">Tasks Completed</span>
                    <span className="text-xl font-display font-bold text-emerald-400">{data.completedCount}</span>
                  </div>
                </div>
              </div>
            ) : isFutureDate(data.date) ? (
              <div className="rounded-2xl border border-dashed border-surface-700 p-8 text-center">
                <Calendar size={24} className="text-surface-600 mx-auto mb-2" />
                <p className="text-sm text-surface-300 font-medium mb-0.5">No activity yet</p>
                <p className="text-xs text-surface-500">This day hasn't happened yet.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-surface-700 p-8 text-center">
                <CheckCircle2 size={24} className="text-surface-600 mx-auto mb-2" />
                <p className="text-sm text-surface-300 font-medium mb-0.5">No tasks completed</p>
                <p className="text-xs text-surface-500">Nothing was completed on this day.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Calendar heatmap ──────────────────────────────────────────────────────────
function CalendarHeatmap({
  month, summary, onDayClick, selectedDate,
}: {
  month: Date; summary: DaySummary[]; onDayClick: (date: string) => void; selectedDate: string | null;
}) {
  const days   = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const sumMap = Object.fromEntries(summary.map(s => [s.date, s]));
  const firstDow = startOfMonth(month).getDay();

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-[10px] text-surface-500 py-1 font-semibold uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const ds   = format(day, 'yyyy-MM-dd');
          const data = sumMap[ds];
          const heat = heatLevel(data?.totalHours || 0);
          const sel  = selectedDate === ds;
          const tod  = isToday(day);
          return (
            <motion.button key={ds} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
              onClick={() => onDayClick(ds)}
              className={`aspect-square rounded-lg border transition-all text-xs relative ${HEAT_STYLES[heat]} ${
                sel ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-950' : ''
              } ${tod ? 'ring-1 ring-brand-400' : ''}`}
              title={data ? `${ds}: ${data.totalHours}h, ${data.workLogCount} logs, ${data.completedCount} completed` : ds}>
              <span className={`absolute inset-0 flex items-center justify-center text-xs ${
                heat >= 2 ? 'text-surface-50' : 'text-surface-400'} ${tod ? 'font-bold' : ''}`}>
                {day.getDate()}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared range filter (drives both the time retrospective and the focus view) ──
function RangeControls({ from, to, onFrom, onTo, onApply }: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onApply: (from: Date, to: Date) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Input type="date" className="text-sm rounded-xl" value={from} onChange={e => onFrom(e.target.value)} />
        <Input type="date" className="text-sm rounded-xl" value={to} onChange={e => onTo(e.target.value)} />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: 'Today', from: new Date(), to: new Date() },
          { label: 'This Week', from: startOfWeek(new Date(), { weekStartsOn: 0 }), to: endOfWeek(new Date(), { weekStartsOn: 0 }) },
          { label: 'This Month', from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
        ].map(({ label, from: presetFrom, to: presetTo }) => (
          <button key={label} onClick={() => onApply(presetFrom, presetTo)}
            className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-xs text-surface-300 hover:text-surface-100 transition-all border border-surface-700 font-medium">
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Main Reports Page ─────────────────────────────────────────────────────────
export function ReportsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [month, setMonth]             = useState(new Date());
  const [summary, setSummary]         = useState<DaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [dayInput, setDayInput] = useState(todayKey);
  const [rangeFrom, setRangeFrom] = useState(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'));
  const [rangeTo, setRangeTo] = useState(todayKey);
  const [rangeSummary, setRangeSummary] = useState<DaySummary[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [weekSummary, setWeekSummary] = useState<DaySummary[]>([]);
  const [monthSummary, setMonthSummary] = useState<DaySummary[]>([]);
  const [adminUsers, setAdminUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Merged Analytics state (focus view) — sessions + live timer.
  const { tasks, theme, activeTaskId, activeSessionId, activeTimerState, currentSessionStart } = useStore();
  const [view, setView] = useState<'overview' | 'focus'>('overview');
  const [apiSessions, setApiSessions] = useState<SessionLike[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [timerTick, setTimerTick] = useState(0);
  const prevTimerRef = useRef(activeTimerState);

  useEffect(() => {
    if (isAdmin) {
      api.admin.listUsers().then(d => setAdminUsers(d.items)).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTimerState === 'idle') {
      prevTimerRef.current = 'idle';
      return;
    }
    const id = setInterval(() => setTimerTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeTimerState]);

  useEffect(() => {
    if (prevTimerRef.current !== 'idle' && activeTimerState === 'idle') {
      api.sessions.list()
        .then((docs: ApiSession[]) => setApiSessions(mapSessions(docs)))
        .catch((err) => toast.error('Could not refresh analytics sessions', err.message || 'Charts may be incomplete.'));
    }
    prevTimerRef.current = activeTimerState;
  }, [activeTimerState]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSessions(true);
    api.sessions.list()
      .then((docs: ApiSession[]) => { if (!cancelled) setApiSessions(mapSessions(docs)); })
      .catch((err) => {
        if (!cancelled) {
          setApiSessions([]);
          toast.error('Could not load analytics sessions', err.message || 'Charts may be incomplete.');
        }
      })
      .finally(() => { if (!cancelled) setLoadingSessions(false); });
    return () => { cancelled = true; };
  }, [activeTaskId]);

  useEffect(() => {
    setLoadingSummary(true);
    const from = format(startOfMonth(month), 'yyyy-MM-dd');
    const to   = format(endOfMonth(month),   'yyyy-MM-dd');
    const fetcher = selectedUserId
      ? () => api.admin.getUserReportsSummary(selectedUserId, from, to)
      : () => api.reports.summary(from, to);
    fetcher()
      .then(data => setSummary(data))
      .catch((err) => { setSummary([]); toast.error('Could not load report summary', err.message || 'Please try again.'); })
      .finally(() => setLoadingSummary(false));
  }, [month, selectedUserId]);

  useEffect(() => {
    setRangeLoading(true);
    const fetcher = selectedUserId
      ? () => api.admin.getUserReportsSummary(selectedUserId, rangeFrom, rangeTo)
      : () => api.reports.summary(rangeFrom, rangeTo);
    fetcher()
      .then(data => setRangeSummary(data))
      .catch((err) => { setRangeSummary([]); toast.error('Could not load range summary', err.message || 'Please try again.'); })
      .finally(() => setRangeLoading(false));
  }, [rangeFrom, rangeTo, selectedUserId]);

  useEffect(() => {
    const now = new Date();
    const weekFrom = format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const weekTo = format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const monthFrom = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthTo = format(endOfMonth(now), 'yyyy-MM-dd');
    Promise.all([api.reports.summary(weekFrom, weekTo), api.reports.summary(monthFrom, monthTo)])
      .then(([weekData, monthData]) => { setWeekSummary(weekData); setMonthSummary(monthData); })
      .catch((err) => { toast.error('Could not load time overview', err.message || 'Please try again.'); });
  }, []);

  const monthHours  = summary.reduce((a, d) => a + d.totalHours, 0);
  const monthDays   = summary.filter(d => d.totalHours > 0).length;
  const monthDone   = summary.reduce((a, d) => a + d.completedCount, 0);
  const avgPerDay   = monthDays > 0 ? (monthHours / monthDays).toFixed(1) : '0';
  const rangeTotals = summarizeDays(rangeSummary);
  const weekTotals = summarizeDays(weekSummary);
  const currentMonthTotals = summarizeDays(monthSummary);

  // Calendar monthly insights
  const bestDay = useMemo(() => {
    const active = summary.filter(d => d.totalHours > 0);
    if (active.length === 0) return null;
    return active.reduce((max, d) => d.totalHours > max.totalHours ? d : max, active[0]);
  }, [summary]);

  const applyQuickRange = (from: Date, to: Date) => {
    setRangeFrom(format(from, 'yyyy-MM-dd'));
    setRangeTo(format(to, 'yyyy-MM-dd'));
  };

  // The live session is sourced from the timer engine; merged with completed
  // API sessions so running focus time is reflected in charts in real time.
  const liveSessions = useMemo<SessionLike[]>(() => {
    if (activeTimerState === 'idle' || !activeTaskId || !currentSessionStart) return [];
    const activeTime = timerEngine.getElapsedMs();
    if (activeTime <= 0) return [];
    const snapshot = timerEngine.getSnapshot();
    const openPause = snapshot.timerState === 'paused' && snapshot.pauseStart
      ? Math.max(0, Date.now() - snapshot.pauseStart)
      : 0;
    return [{
      id: `live_${activeTaskId}_${activeSessionId ?? 'current'}`,
      taskId: activeTaskId,
      startTime: currentSessionStart,
      activeTime,
      totalPauseDuration: snapshot.totalPauseDuration + openPause,
      focusScore: 100,
    }];
  }, [activeTaskId, activeSessionId, activeTimerState, currentSessionStart, timerTick]);

  const sessions = useMemo(() => {
    const liveIds = new Set(liveSessions.map(s => s.id.replace(/^live_[^_]+_/, '')));
    const completed = apiSessions.filter(s => !liveIds.has(s.id));
    return [...completed, ...liveSessions].filter(s => s.taskId && s.activeTime > 0);
  }, [apiSessions, liveSessions]);

  const focusRange = useMemo(() => {
    const from = parseISO(rangeFrom).getTime();
    const to = parseISO(rangeTo).getTime() + 86400000 - 1;
    return { start: from, end: to };
  }, [rangeFrom, rangeTo]);

  const accent = theme?.accentColor || '#0ea5e9';
  const focusLabel = rangeFrom === rangeTo
    ? format(parseISO(rangeFrom), 'MMM d')
    : `${format(parseISO(rangeFrom), 'MMM d')} – ${format(parseISO(rangeTo), 'MMM d')}`;

  const activeDays = summary.filter(d => d.totalHours > 0 || d.workLogCount > 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">

      {/* ═══ Hero Header ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight">
              Personal Reports
            </h1>
            <p className="text-surface-400 text-sm mt-1">
              {selectedUserId
                ? `Viewing reports for ${adminUsers.find(u => u._id === selectedUserId)?.name || 'user'}`
                : 'Time + focus retrospective — click any day to drill in.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && adminUsers.length > 0 && (
              <select value={selectedUserId} onChange={e => { setSelectedUserId(e.target.value); setSelectedDate(null); }}
                className="text-xs font-semibold text-surface-300 bg-surface-800 px-3 py-1.5 rounded-lg border border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500/50 cursor-pointer">
                <option value="">My Reports</option>
                {adminUsers.map(u => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            )}
            <span className="text-xs font-semibold text-surface-400 bg-surface-800 px-3 py-1.5 rounded-lg border border-surface-700">
              {format(month, 'MMMM yyyy')}
            </span>
          </div>
        </div>

        {/* View toggle: Analytics merged in as a view of Reports */}
        <div className="flex items-center gap-1.5 bg-surface-900 p-1.5 rounded-xl border border-surface-800 w-fit mt-4">
          {([['overview', 'Overview'], ['focus', 'Focus & Analytics']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                view === key ? 'bg-surface-800 text-surface-50 shadow-sm' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850/50'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {selectedDate ? (
        <DayDetailPanel date={selectedDate} onBack={() => setSelectedDate(null)} onDateChange={setSelectedDate} viewUserId={selectedUserId || undefined} />
      ) : view === 'focus' ? (
        <div className="space-y-6">
          {/* Shared range filter drives the focus KPIs and charts */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Clock size={15} />
              </div>
              <div>
                <h2 className="font-display font-bold text-surface-50 text-[15px]">Range Filter</h2>
                <p className="text-xs text-surface-400 mt-0.5">Drives the focus KPIs and charts below.</p>
              </div>
            </div>
            <RangeControls from={rangeFrom} to={rangeTo} onFrom={setRangeFrom} onTo={setRangeTo} onApply={applyQuickRange} />
          </motion.div>

          <AnalyticsSection
            sessions={sessions}
            tasks={tasks}
            start={focusRange.start}
            end={focusRange.end}
            accent={accent}
            loading={loadingSessions && sessions.length === 0}
            rangeLabel={focusLabel}
          />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ═══ Overview + Peak Performance (top) ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Month Overview */}
            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <h3 className="font-display font-bold text-surface-50 text-[15px] mb-4">{format(month, 'MMMM')} Overview</h3>
              <div className="space-y-3">
                {[
                  { icon: Clock, label: 'Total Hours', value: `${monthHours.toFixed(1)}h`, color: 'text-brand-400', bg: 'bg-brand-500/10' },
                  { icon: TrendingUp, label: 'Avg / Day', value: `${avgPerDay}h`, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { icon: Calendar, label: 'Days Active', value: String(monthDays), color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { icon: CheckCircle2, label: 'Completed', value: String(monthDone), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { icon: Flame, label: 'Sessions', value: String(summary.reduce((a, d) => a + d.sessionCount, 0)), color: 'text-orange-400', bg: 'bg-orange-500/10' },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-surface-400 font-medium">{label}</p>
                      <p className="text-sm font-bold text-surface-100">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Peak Performance */}
            {bestDay && (
              <motion.div variants={fadeUp} initial="hidden" animate="show"
                className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/5 to-surface-900 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={14} className="text-brand-400" />
                  <span className="text-sm font-bold text-surface-100">Peak Performance</span>
                </div>
                <p className="text-3xl font-display font-extrabold text-brand-400">{bestDay.totalHours}h</p>
                <p className="text-xs text-surface-400 mt-1">{format(parseISO(bestDay.date), 'EEEE, MMMM d')}</p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-surface-400">
                  <span>{bestDay.completedCount} completed</span>
                  <span>·</span>
                  <span>{bestDay.sessionCount} sessions</span>
                </div>
              </motion.div>
            )}

            {/* Quick Tips */}
            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <h3 className="font-display font-bold text-surface-50 text-[13px] mb-3">Quick Tips</h3>
              <div className="space-y-2.5 text-xs text-surface-400">
                <p>• Click any calendar day to see the full report</p>
                <p>• Use quick filters for rapid time range analysis</p>
                <p>• Share daily reports with your lead — no login needed</p>
              </div>
            </motion.div>
          </div>

          {/* ═══ Main content ═══ */}
          <div className="space-y-6 min-w-0">

            {/* ═══ Time Lookup ═══ */}
            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                <div>
                  <h2 className="font-display font-bold text-surface-50 text-[15px] flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <Clock size={15} />
                    </div>
                    Time Lookup
                  </h2>
                  <p className="text-xs text-surface-400 mt-1">Check work for one day, a custom range, or quick presets.</p>
                </div>
                {rangeLoading && (
                  <span className="text-xs text-surface-400 flex items-center gap-1.5 font-medium">
                    <Loader2 size={13} className="animate-spin text-brand-500" /> Loading
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                {/* Single day */}
                <div className="rounded-xl border border-surface-800 bg-surface-850/50 p-4">
                  <label className="block text-xs text-surface-400 font-semibold mb-2 uppercase tracking-wider">View Single Day</label>
                  <div className="flex gap-2">
                    <Input type="date" className="text-sm rounded-xl flex-1" value={dayInput} onChange={e => setDayInput(e.target.value)} />
                    <Button onClick={() => dayInput && setSelectedDate(dayInput)}
                      leftIcon={<Calendar size={14} />}>
                      View
                    </Button>
                  </div>
                </div>

                {/* Custom range */}
                <div className="rounded-xl border border-surface-800 bg-surface-850/50 p-4">
                  <label className="block text-xs text-surface-400 font-semibold mb-2 uppercase tracking-wider">Custom Range</label>
                  <RangeControls from={rangeFrom} to={rangeTo} onFrom={setRangeFrom} onTo={setRangeTo} onApply={applyQuickRange} />
                </div>
              </div>

              {/* Range KPIs */}
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Selected Range', value: formatMs(rangeTotals.totalMs), sub: `${rangeTotals.daysWorked} day${rangeTotals.daysWorked !== 1 ? 's' : ''} worked`, color: 'text-brand-400', icon: Clock, bg: 'bg-brand-500/10' },
                  { label: 'This Week', value: formatMs(weekTotals.totalMs), sub: `${weekTotals.sessionCount} session${weekTotals.sessionCount !== 1 ? 's' : ''}`, color: 'text-purple-400', icon: TrendingUp, bg: 'bg-purple-500/10' },
                  { label: 'This Month', value: formatMs(currentMonthTotals.totalMs), sub: `${currentMonthTotals.daysWorked} day${currentMonthTotals.daysWorked !== 1 ? 's' : ''} worked`, color: 'text-yellow-400', icon: Calendar, bg: 'bg-yellow-500/10' },
                  { label: 'Completed', value: String(rangeTotals.completedCount), sub: `${rangeTotals.workLogCount} work log${rangeTotals.workLogCount !== 1 ? 's' : ''}`, color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
                ].map(({ label, value, sub, color, icon: Icon, bg }) => (
                  <motion.div key={label} variants={fadeUp}
                    className="rounded-xl border border-surface-800 bg-surface-850/50 p-4">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2.5`}>
                      <Icon size={14} className={color} />
                    </div>
                    <p className={`text-xl font-display font-bold ${color}`}>{value}</p>
                    <p className="text-[11px] text-surface-400 font-medium mt-0.5">{label}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">{sub}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* ═══ Calendar Heatmap ═══ */}
            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => setMonth(m => subMonths(m, 1))}
                  className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-50 transition-all border border-surface-700">
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <h2 className="font-display font-bold text-surface-50 text-lg">{format(month, 'MMMM yyyy')}</h2>
                  {loadingSummary && <p className="text-xs text-surface-500 mt-0.5">Loading…</p>}
                </div>
                <button onClick={() => setMonth(m => addMonths(m, 1))}
                  className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-50 transition-all border border-surface-700">
                  <ChevronRight size={16} />
                </button>
              </div>

              <CalendarHeatmap month={month} summary={summary} onDayClick={setSelectedDate} selectedDate={selectedDate} />

              {/* Legend + Insights */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-800">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 font-medium">Less</span>
                  {HEAT_STYLES.map((cls, i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded border ${cls}`} />
                  ))}
                  <span className="text-[10px] text-surface-500 font-medium">More</span>
                </div>
                {bestDay && (
                  <p className="text-[11px] text-surface-400">
                    Best day: <span className="text-brand-400 font-semibold">{bestDay.totalHours}h</span> on {format(parseISO(bestDay.date), 'MMM d')}
                  </p>
                )}
              </div>
            </motion.div>

            {/* ═══ Recent Days ═══ */}
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <h3 className="font-display font-bold text-surface-50 text-[15px] mb-3">Recent Activity</h3>
              {activeDays.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 p-10 text-center">
                  <Calendar size={32} className="text-surface-600 mx-auto mb-3" />
                  <p className="text-surface-400 font-medium">No work logged this month yet</p>
                </div>
              ) : (
                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
                  {activeDays.slice(0, 10).map(day => (
                    <motion.div key={day.date} variants={fadeUp}
                      className="rounded-2xl border border-surface-800 bg-surface-900 p-4 flex items-center gap-4 cursor-pointer hover:border-surface-700 hover:shadow-md transition-all group"
                      onClick={() => setSelectedDate(day.date)}>
                      <div className="text-center w-12 flex-shrink-0">
                        <p className="text-xl font-display font-bold text-surface-50">{format(parseISO(day.date), 'd')}</p>
                        <p className="text-[10px] text-surface-400 font-semibold uppercase">{format(parseISO(day.date), 'EEE')}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          {day.totalHours > 0 && (
                            <span className="flex items-center gap-1 text-sm text-brand-400 font-semibold">
                              <Clock size={13} /> {day.totalHours}h
                            </span>
                          )}
                          {day.workLogCount > 0 && (
                            <span className="flex items-center gap-1 text-xs text-purple-400 font-medium">
                              <BookMarked size={12} /> {day.workLogCount} log{day.workLogCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {day.completedCount > 0 && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <CheckCircle2 size={12} /> {day.completedCount} done
                            </span>
                          )}
                        </div>
                        {day.totalHours > 0 && (
                          <div className="h-1.5 bg-surface-800 rounded-full mt-2 overflow-hidden w-48">
                            <motion.div className="h-full bg-brand-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (day.totalHours / 8) * 100)}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-surface-600 group-hover:text-surface-300 transition-colors">
                        <Share2 size={13} />
                        <ChevronRight size={14} />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}

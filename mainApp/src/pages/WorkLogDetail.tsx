import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, GitBranch, CheckCircle2, AlertTriangle,
  ExternalLink, Link2, BookMarked, Timer, FolderOpen,
  Flame, TrendingUp, Calendar, Zap,
  FileText, Download,
  LayoutList, Lightbulb, AlertOctagon, Target, HeartPulse,
  Paperclip, Eye, Bug,
} from 'lucide-react';

const DocumentationPreview = lazy(() => import('../components/DocumentationPreview').then(m => ({ default: m.DocumentationPreview })));
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { formatDistanceToNow, format } from 'date-fns';
import { Markdown } from '../lib';
import { Skeleton } from '../components/ui/Skeleton';
import type { WorkLog } from '../store/useWorkLogStore';
import { useWorkLogStore } from '../store/useWorkLogStore';
import { TimelineView } from '../components/worklog/TimelineView';
import { ProblemFlowEditor } from '../components/worklog/ProblemFlowEditor';
import { TechnicalDecisionsView } from '../components/worklog/TechnicalDecisionsView';
import { StructuredBlockersView } from '../components/worklog/StructuredBlockersView';
import { TomorrowPlanView } from '../components/worklog/TomorrowPlanView';
import { ReflectionView } from '../components/worklog/ReflectionView';
import { AttachmentsView } from '../components/worklog/AttachmentsView';
import { ReadingModeView } from '../components/worklog/ReadingModeView';
import { WorkLogExporterModal } from '../components/worklog/WorkLogExporterModal';
import { calculateWorkLogMetrics } from '../utils/workLogMetrics';
import { STATUS_MAP, MOOD_EMOJIS } from '../lib/config';
import { mapLog } from '../lib/dataMapper';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DETAIL_TABS = [
  { id: 'overview',   label: 'Overview',   icon: LayoutList,   color: 'text-brand-400' },
  { id: 'timeline',   label: 'Timeline',   icon: Clock,        color: 'text-sky-400' },
  { id: 'problem',    label: 'Debugging',  icon: Bug,          color: 'text-red-400' },
  { id: 'decisions',  label: 'Decisions',  icon: Lightbulb,    color: 'text-amber-400' },
  { id: 'blockers',   label: 'Blockers',   icon: AlertOctagon, color: 'text-red-400' },
  { id: 'tomorrow',   label: 'Tomorrow',   icon: Target,       color: 'text-sky-400' },
  { id: 'reflection', label: 'Reflection', icon: HeartPulse,   color: 'text-purple-400' },
  { id: 'resources',  label: 'Resources',  icon: Paperclip,    color: 'text-purple-400' },
  { id: 'reading',    label: 'Read Mode',  icon: Eye,          color: 'text-emerald-400' },
];

export function WorkLogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();


  const [log, setLog] = useState<WorkLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');


  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api.workLogs.get(id)
      .then(doc => setLog(mapLog(doc)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Re-fetch whenever sub-document mutations happen (store triggers refreshLog)
  // We subscribe to the store's version of this log and sync it back
  const storeLog = useWorkLogStore(s =>
    [...s.activeLogs, ...s.closedLogs].find(l => l._id === id)
  );
  useEffect(() => {
    if (storeLog) setLog(storeLog);
  }, [storeLog]);



  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="max-w-5xl mx-auto p-6">
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

  const status = STATUS_MAP[log.status] || STATUS_MAP['in-progress'];
  const totalDays = log.workEntries.length;
  const avgPerDay = totalDays > 0 ? (log.totalActiveMs / totalDays / 3600000).toFixed(1) : '0';
  const metrics = calculateWorkLogMetrics(log);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {/* Back button */}
      <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">
        <ArrowLeft size={16} /> Back to Work Logs
      </motion.button>

      {/* Hero Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
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
                {' Â· '}
                {log.isActive ? 'Active' : `Closed ${log.closedAt ? formatDistanceToNow(new Date(log.closedAt), { addSuffix: true }) : ''}`}
              </p>
            </div>
          </div>
          {/* Export button */}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 transition-all flex-shrink-0"
          >
            <Download size={14} /> Export
          </button>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Clock, label: 'Total Time', value: formatMs(log.totalActiveMs), color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { icon: Calendar, label: 'Days Active', value: String(totalDays), color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: TrendingUp, label: 'Avg / Day', value: `${avgPerDay}h`, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { icon: CheckCircle2, label: 'Completed', value: `${metrics.completedCount}/${metrics.totalItemsCount}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
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

      {/* Tab Navigation */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 min-w-max">
          {DETAIL_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                  isActive ? 'text-surface-50' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                }`}>
                {isActive && (
                  <motion.div layoutId="detailActiveTab"
                    className="absolute inset-0 bg-surface-700/80 rounded-lg border border-surface-600/30"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon size={13} className={isActive ? tab.color : ''} />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* â”€â”€ Overview (original 2-col layout) â”€â”€ */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left â€” Context */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-3 space-y-4">
              {log.problem && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <AlertTriangle size={13} className="text-red-400" />
                    </div>
                    <span className="text-[11px] text-red-400 font-semibold uppercase tracking-wider">Problem I'm Solving</span>
                  </div>
                  <div className="prose-editor text-sm text-surface-200 leading-relaxed"><Markdown source={log.problem} /></div>
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
                  <div className="prose-editor text-sm text-surface-200 leading-relaxed"><Markdown source={log.currentWork} /></div>
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
                  <div className="prose-editor text-sm text-surface-200"><Markdown source={log.blockers} /></div>
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
                  <div className="prose-editor text-sm text-surface-300"><Markdown source={log.plan} /></div>
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
                  <div className="prose-editor text-sm text-surface-300"><Markdown source={log.designNotes} /></div>
                </motion.div>
              )}

              {!log.problem && !log.currentWork && !log.blockers && !log.plan && !log.designNotes && (
                <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 p-10 text-center">
                  <BookMarked size={28} className="text-surface-600 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">No context fields filled in yet</p>
                </div>
              )}
            </motion.div>

            {/* Right â€” Sessions, Checklist, Links, Export */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
              {/* Export Documentation */}
              <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-brand-400" />
                  <span className="text-[11px] text-surface-400 font-semibold uppercase tracking-wider">Export</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDocPreview(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all
                      bg-brand-500 text-white hover:bg-brand-400"
                  >
                    <FileText size={12} /> Preview
                  </button>
                  <button
                    onClick={() => setShowExport(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all
                      bg-surface-800 text-surface-300 border border-surface-700 hover:bg-surface-700"
                  >
                    <Download size={12} /> .MD / JSON
                  </button>
                </div>
              </motion.div>

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
                            <div className="text-xs text-surface-400 leading-relaxed line-clamp-3">
                              <Markdown source={entry.what} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* â”€â”€ Timeline Tab â”€â”€ */}
        {activeTab === 'timeline' && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <TimelineView workLog={log} />
          </motion.div>
        )}

        {/* â”€â”€ Problem Flow Tab â”€â”€ */}
        {activeTab === 'problem' && (
          <motion.div key="problem" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <ProblemFlowEditor workLog={log} />
          </motion.div>
        )}

        {/* â”€â”€ Decisions Tab â”€â”€ */}
        {activeTab === 'decisions' && (
          <motion.div key="decisions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <TechnicalDecisionsView workLog={log} />
          </motion.div>
        )}

        {/* â”€â”€ Blockers Tab â”€â”€ */}
        {activeTab === 'blockers' && (
          <motion.div key="blockers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <StructuredBlockersView workLog={log} />
          </motion.div>
        )}

        {/* â”€â”€ Tomorrow Plan Tab â”€â”€ */}
        {activeTab === 'tomorrow' && (
          <motion.div key="tomorrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <TomorrowPlanView workLog={log} />
          </motion.div>
        )}

        {/* â”€â”€ Reflection Tab â”€â”€ */}
        {activeTab === 'reflection' && (
          <motion.div key="reflection" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <ReflectionView workLog={log} />
          </motion.div>
        )}

        {/* â”€â”€ Attachments & Links Tab â”€â”€ */}
        {activeTab === 'resources' && (
          <motion.div key="resources" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <AttachmentsView workLog={log} />
          </motion.div>
        )}

        {/* â”€â”€ Reading Mode Tab â”€â”€ */}
        {activeTab === 'reading' && (
          <motion.div key="reading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ReadingModeView workLog={log} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Documentation Preview Modal */}
      <Suspense fallback={null}>
        <DocumentationPreview
          log={log}
          open={showDocPreview}
          onClose={() => setShowDocPreview(false)}
        />
      </Suspense>

      {/* Export modal */}
      <WorkLogExporterModal
        workLog={log}
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}

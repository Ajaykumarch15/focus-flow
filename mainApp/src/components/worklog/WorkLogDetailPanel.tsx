import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, GitBranch, CheckCircle2, AlertTriangle,
  ExternalLink, Link2, BookMarked, Timer, FolderOpen,
  Flame, TrendingUp, Calendar, Zap,
  FileText, Download,
  LayoutList, Lightbulb, AlertOctagon, Target, HeartPulse,
  Paperclip, Eye, Bug, MapPin,
} from 'lucide-react';

const DocumentationPreview = lazy(() => import('../DocumentationPreview').then(m => ({ default: m.DocumentationPreview })));
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { Markdown } from '../../lib';
import { Button } from '../ui/Button';
import { Badge, type BadgeTone } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { WorkLog } from '../../store/useWorkLogStore';
import { TimelineView } from './TimelineView';
import { ProblemFlowEditor } from './ProblemFlowEditor';
import { TechnicalDecisionsView } from './TechnicalDecisionsView';
import { StructuredBlockersView } from './StructuredBlockersView';
import { TomorrowPlanView } from './TomorrowPlanView';
import { ReflectionView } from './ReflectionView';
import { AttachmentsView } from './AttachmentsView';
import { ReadingModeView } from './ReadingModeView';
import { WorkLogExporterModal } from './WorkLogExporterModal';
import { calculateWorkLogMetrics } from '../../utils/workLogMetrics';
import { STATUS_MAP, MOOD_EMOJIS } from '../../lib/config';
import { selectMemory } from '../../lib/memorySelectors';

// ── WorkLogDetailPanel (S3-T1) ────────────────────────────────────────────────
// The single-surface detail view of a work log, extracted from the retired
// standalone WorkLogDetail page (IA §8.7-4). Renders hero → stats → "Where I
// stopped" (highlighted last node, via selectMemory) → tabs. Pure on the
// `workLog` prop, so the Work Log page can embed it inline for the
// master/detail merge without re-fetching.

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

const STATUS_TONE: Record<string, BadgeTone> = {
  planning: 'info',
  'in-progress': 'brand',
  reviewing: 'brand',
  blocked: 'danger',
  done: 'success',
};

export function WorkLogDetailPanel({ workLog: log, onBack }: { workLog: WorkLog; onBack?: () => void }) {
  const navigate = useNavigate();
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const memory = selectMemory(log);
  const status = STATUS_MAP[log.status] || STATUS_MAP['in-progress'];
  const totalDays = log.workEntries.length;
  const avgPerDay = totalDays > 0 ? (log.totalActiveMs / totalDays / 3600000).toFixed(1) : '0';
  const metrics = calculateWorkLogMetrics(log);
  const whereStopped = memory.whereStopped;

  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        onClick={handleBack}
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
                <Badge tone={STATUS_TONE[log.status] ?? 'neutral'} icon={<span>{status.emoji}</span>} className="rounded-lg">
                  {status.label}
                </Badge>
                <span className="text-lg">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
                {log.gitBranch && (
                  <Badge tone="success" icon={<GitBranch size={11} />} className="font-mono">
                    {log.gitBranch}
                  </Badge>
                )}
                {log.taskRef && (
                  <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold"
                    style={{ background: `${log.taskRef.color}15`, color: log.taskRef.color }}>
                    <Timer size={11} /> {log.taskRef.title}
                  </span>
                )}
                {log.projectRef && (
                  <Badge tone="neutral" icon={<FolderOpen size={11} />}>
                    {log.projectRef.name}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-surface-500 mt-2">
                Created {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                {' · '}
                {log.isActive ? 'Active' : `Closed ${log.closedAt ? formatDistanceToNow(new Date(log.closedAt), { addSuffix: true }) : ''}`}
              </p>
            </div>
          </div>
          {/* Export button */}
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}
            className="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border-brand-500/20 flex-shrink-0"
            leftIcon={<Download size={14} />}>
            Export
          </Button>
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

      {/* Where I stopped (S3-T1 highlighted last node) */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-surface-900 p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center flex-shrink-0">
            <MapPin size={14} className="text-brand-400" />
          </div>
          <span className="text-[11px] text-brand-300 font-semibold uppercase tracking-wider">Where I stopped</span>
          {whereStopped && (
            <span className="ml-auto text-[11px] text-surface-500">
              {formatDistanceToNow(new Date(whereStopped.timestamp), { addSuffix: true })}
            </span>
          )}
        </div>
        {whereStopped ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-surface-50 truncate">{whereStopped.title}</p>
              <p className="text-xs text-surface-400 mt-0.5">
                {whereStopped.label}
                {whereStopped.description ? ` · ${whereStopped.description}` : ''}
              </p>
            </div>
            <Button variant="ghost" size="xs" className="flex-shrink-0 text-brand-300 hover:text-brand-200"
              onClick={() => setActiveTab('timeline')}>
              View timeline →
            </Button>
          </div>
        ) : (
          <p className="text-sm text-surface-400">No activity captured on this work log yet.</p>
        )}
      </motion.div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto scrollbar-none">
        <div role="tablist" aria-label="Work log sections" className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 min-w-max">
          {DETAIL_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button key={tab.id} role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab.id)}
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
        {/* ── Overview (original 2-col layout) ── */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 overflow-hidden">
                  <EmptyState
                    icon={<BookMarked size={28} className="text-surface-600" />}
                    title="No context fields filled in yet"
                    description=""
                  />
                </div>
              )}
            </motion.div>

            {/* Right — Sessions, Checklist, Links, Export */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
              {/* Export Documentation */}
              <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-brand-400" />
                  <span className="text-[11px] text-surface-400 font-semibold uppercase tracking-wider">Export</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setShowDocPreview(true)}
                    leftIcon={<FileText size={12} />}>
                    Preview
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowExport(true)}
                    leftIcon={<Download size={12} />}>
                    .MD / JSON
                  </Button>
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

        {/* ── Timeline Tab ── */}
        {activeTab === 'timeline' && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <TimelineView workLog={log} />
          </motion.div>
        )}

        {/* ── Problem Flow Tab ── */}
        {activeTab === 'problem' && (
          <motion.div key="problem" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <ProblemFlowEditor workLog={log} />
          </motion.div>
        )}

        {/* ── Decisions Tab ── */}
        {activeTab === 'decisions' && (
          <motion.div key="decisions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <TechnicalDecisionsView workLog={log} />
          </motion.div>
        )}

        {/* ── Blockers Tab ── */}
        {activeTab === 'blockers' && (
          <motion.div key="blockers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <StructuredBlockersView workLog={log} />
          </motion.div>
        )}

        {/* ── Tomorrow Plan Tab ── */}
        {activeTab === 'tomorrow' && (
          <motion.div key="tomorrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <TomorrowPlanView workLog={log} />
          </motion.div>
        )}

        {/* ── Reflection Tab ── */}
        {activeTab === 'reflection' && (
          <motion.div key="reflection" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <ReflectionView workLog={log} />
          </motion.div>
        )}

        {/* ── Attachments & Links Tab ── */}
        {activeTab === 'resources' && (
          <motion.div key="resources" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <AttachmentsView workLog={log} />
          </motion.div>
        )}

        {/* ── Reading Mode Tab ── */}
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

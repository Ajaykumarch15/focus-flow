import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, GitBranch, CheckCircle2, AlertTriangle, AlertCircle,
  ExternalLink, BookMarked, Timer, FolderOpen,
  Flame, TrendingUp, Calendar, Zap,
  FileText, Download, Plus, X,
  LayoutList, Lightbulb, AlertOctagon,
  Paperclip, Eye, MapPin, Play, Pause, Square,
} from 'lucide-react';

const DocumentationPreview = lazy(() => import('@shared/components/DocumentationPreview').then(m => ({ default: m.DocumentationPreview })));
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { Markdown } from '@shared/utils/MarkdownView';
import { Button } from '@shared/components/ui/Button';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Input } from '@shared/components/ui/Input';
import { AutoProEditor } from '@shared/components/ui/proEditor';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import { useStore } from '@worklog/services/useStore';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';
import { TimelineView } from './TimelineView';
import { TechnicalDecisionsView } from './TechnicalDecisionsView';
import { StructuredBlockersView } from './StructuredBlockersView';
import { TomorrowPlanView } from './TomorrowPlanView';
import { ReflectionView } from './ReflectionView';
import { AttachmentsView } from './AttachmentsView';
import { ReadingModeView } from './ReadingModeView';
import { WorkLogExporterModal } from './WorkLogExporterModal';
import { CompletionPromptPanel } from '@worklog/components/focus/CompletionPromptPanel';
import { calculateWorkLogMetrics } from '@worklog/services/workLogMetrics';
import { STATUS_MAP, MOOD_EMOJIS } from '@worklog/services/config';
import { selectMemory } from '@personal/services/memorySelectors';

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
  { id: 'overview',  label: 'Overview',  icon: LayoutList,   color: 'text-brand-400' },
  { id: 'context',   label: 'Context',   icon: AlertCircle,  color: 'text-red-400' },
  { id: 'planning',  label: 'Planning',  icon: Lightbulb,    color: 'text-amber-400' },
  { id: 'progress',  label: 'Progress',  icon: CheckCircle2, color: 'text-emerald-400' },
  { id: 'blockers',  label: 'Blockers',  icon: AlertOctagon, color: 'text-red-400' },
  { id: 'timeline',  label: 'Timeline',  icon: Clock,        color: 'text-sky-400' },
  { id: 'resources', label: 'Resources', icon: Paperclip,    color: 'text-purple-400' },
  { id: 'reading',   label: 'Read Mode', icon: Eye,          color: 'text-emerald-400' },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  planning: 'info',
  'in-progress': 'brand',
  reviewing: 'brand',
  blocked: 'danger',
  done: 'success',
};

// ── Sticky Toolbar ──────────────────────────────────────────────────────────
function WorkLogToolbar({ log, onBack, onComplete }: { log: WorkLog; onBack: () => void; onComplete: () => void }) {
  const { startParallelTimer, pauseParallelTimer, resumeParallelTimer, stopParallelTimer, completeTask } = useStore();
  const { closeLog } = useWorkLogStore();
  const [completing, setCompleting] = useState(false);

  const taskId = log.taskRef?._id;
  const hasTask = !!taskId;

  // Check parallel timer engine directly for this specific task's state
  const [parallelState, setParallelState] = useState(() =>
    taskId ? parallelTimerEngine.getState(taskId) : 'idle'
  );
  const [display, setDisplay] = useState(() =>
    taskId ? parallelTimerEngine.getFormattedDisplay(taskId) : ''
  );

  useEffect(() => {
    if (!taskId) return;
    setParallelState(parallelTimerEngine.getState(taskId));
    setDisplay(parallelTimerEngine.getFormattedDisplay(taskId));

    const unsubscribe = parallelTimerEngine.subscribe((changedTaskId) => {
      if (changedTaskId === taskId || changedTaskId === '') {
        setParallelState(parallelTimerEngine.getState(taskId));
        setDisplay(parallelTimerEngine.getFormattedDisplay(taskId));
      }
    });
    return unsubscribe;
  }, [taskId]);

  const isRunning = parallelState === 'running';
  const isPaused = parallelState === 'paused';
  const isIdle = parallelState === 'idle';
  const isDone = log.status === 'done';

  const handleStart = () => {
    if (!taskId) return;
    startParallelTimer(taskId);
  };

  const handlePause = () => {
    if (!taskId) return;
    if (isRunning) pauseParallelTimer(taskId);
  };

  const handleResume = () => {
    if (!taskId) return;
    if (isPaused) resumeParallelTimer(taskId);
  };

  const handleStop = () => {
    if (!taskId) return;
    stopParallelTimer(taskId);
  };

  const handleComplete = async () => {
    if (!taskId || completing) return;
    setCompleting(true);
    try {
      if (isRunning || isPaused) {
        await stopParallelTimer(taskId);
      }
      await completeTask(taskId);
      await closeLog(log._id);
      onComplete();
    } finally {
      setCompleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800 px-4 lg:px-6 py-3"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Back button + title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all flex-shrink-0"
            aria-label="Back to Work Logs"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-surface-200 truncate">{log.title}</h2>
            {log.taskRef && (
              <p className="text-[11px] text-surface-500 truncate">Task: {log.taskRef.title}</p>
            )}
          </div>
        </div>

        {/* Right: Timer controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDone ? (
            <Badge tone="success" icon={<CheckCircle2 size={12} />}>Completed</Badge>
          ) : !hasTask ? (
            <span className="text-xs text-surface-500 hidden sm:block">Link a task to enable timer</span>
          ) : (
            <>
              {/* Timer display */}
              {(isRunning || isPaused) && (
                <span className="font-mono text-sm text-brand-400 mr-1 hidden sm:block">{display}</span>
              )}

              {/* Start / Resume */}
              {(isIdle || isPaused) && (
                <Button
                  size="sm"
                  onClick={isPaused ? handleResume : handleStart}
                  leftIcon={<Play size={14} />}
                  className={isPaused ? '' : ''}
                >
                  {isPaused ? 'Resume' : 'Start'}
                </Button>
              )}

              {/* Pause */}
              {isRunning && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePause}
                  leftIcon={<Pause size={14} />}
                >
                  Pause
                </Button>
              )}

              {/* Stop */}
              {(isRunning || isPaused) && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleStop}
                  leftIcon={<Square size={14} />}
                >
                  Stop
                </Button>
              )}

              {/* Complete */}
              <Button
                size="sm"
                variant="success"
                onClick={handleComplete}
                loading={completing}
                leftIcon={completing ? undefined : <CheckCircle2 size={14} />}
              >
                Complete
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function WorkLogDetailPanel({ workLog: log, onBack }: { workLog: WorkLog; onBack?: () => void }) {
  const navigate = useNavigate();
  const { updateField, addCompleted, deleteCompleted } = useWorkLogStore();
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [newItem, setNewItem] = useState('');
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);

  const memory = selectMemory(log);
  const status = STATUS_MAP[log.status] || STATUS_MAP['in-progress'];
  const totalDays = log.workEntries.length;
  const avgPerDay = totalDays > 0 ? (log.totalActiveMs / totalDays / 3600000).toFixed(1) : '0';
  const metrics = calculateWorkLogMetrics(log);
  const whereStopped = memory.whereStopped;

  const handleBack = onBack ?? (() => navigate(-1));

  const kanbanWorkspaceId = log.projectRef?.workspaceRef;
  const kanbanProjectId = log.projectRef?._id;
  const kanbanTaskId = log.taskRef?._id;
  const canOpenKanban = !!kanbanWorkspaceId && !!kanbanProjectId && !!kanbanTaskId;

  // Check if task was just completed (for showing CompletionPromptPanel)
  const { tasks } = useStore();
  const linkedTask = kanbanTaskId ? tasks.find(t => t.id === kanbanTaskId) : null;
  const isTaskCompleted = linkedTask?.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Sticky Toolbar */}
      <WorkLogToolbar log={log} onBack={handleBack} onComplete={() => setShowCompletionPrompt(true)} />

      {/* Completion Prompt (shows after task is completed) */}
      {showCompletionPrompt && kanbanTaskId && (
        <CompletionPromptPanel
          completed={isTaskCompleted}
          taskId={kanbanTaskId}
          workLogTitle={log.title}
        />
      )}

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
                {canOpenKanban && log.taskRef && (
                  <>
                    <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold"
                      style={{ background: `${log.taskRef.color}15`, color: log.taskRef.color }}>
                      <Timer size={11} /> {log.taskRef.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => navigate(`/collab/${kanbanWorkspaceId}/projects/${kanbanProjectId}/kanban?select=${kanbanTaskId}`)}
                      className="text-brand-400 hover:text-brand-300 hover:bg-brand-500/10"
                      leftIcon={<ExternalLink size={11} />}
                      aria-label="View in Kanban"
                    >
                      Kanban
                    </Button>
                  </>
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
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}
            className="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border-brand-500/20 flex-shrink-0"
            leftIcon={<Download size={14} />}>
            Export
          </Button>
        </div>
      </motion.div>

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

      <AnimatePresence mode="wait">
        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-3 space-y-4">
              {!log.problem && !log.currentWork && !log.plan && !log.designNotes && (
                <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 overflow-hidden p-8 text-center">
                  <BookMarked size={28} className="text-surface-600 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">No context fields filled in yet. Use the Context and Planning tabs to add details.</p>
                </div>
              )}
              {log.problem && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-red-500/15 bg-red-500/5 p-5">
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
                    <span className="text-[11px] text-brand-400 font-semibold uppercase tracking-wider">What I'm Working On</span>
                  </div>
                  <div className="prose-editor text-sm text-surface-200 leading-relaxed"><Markdown source={log.currentWork} /></div>
                </motion.div>
              )}
              {log.plan && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <BookMarked size={13} className="text-amber-400" />
                    </div>
                    <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Plan</span>
                  </div>
                  <div className="prose-editor text-sm text-surface-300"><Markdown source={log.plan} /></div>
                </motion.div>
              )}
            </motion.div>

            <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
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

        {/* ── Context (Problem/CurrentWork) ── */}
        {activeTab === 'context' && (
          <motion.div key="context" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-4">
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={13} className="text-red-400" />
                </div>
                <span className="text-[11px] text-red-400 font-semibold uppercase tracking-wider">Problem I'm Solving</span>
              </div>
              <AutoProEditor
                logId={log._id} field="problem" value={log.problem}
                placeholder="What ticket/feature/bug? What user pain?" minRows={3}
                updateFn={(id, field, val) => updateField(id, field, val)} />
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Zap size={13} className="text-brand-400" />
                </div>
                <span className="text-[11px] text-brand-400 font-semibold uppercase tracking-wider">What I'm Working On</span>
              </div>
              <AutoProEditor
                logId={log._id} field="currentWork" value={log.currentWork}
                placeholder="Specific function, component, API..." minRows={3}
                updateFn={(id, field, val) => updateField(id, field, val)} />
            </motion.div>
          </motion.div>
        )}

        {/* ── Planning (Plan/Design/GitBranch + TomorrowPlan) ── */}
        {activeTab === 'planning' && (
          <motion.div key="planning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-4">
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <BookMarked size={13} className="text-amber-400" />
                </div>
                <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Plan</span>
              </div>
              <AutoProEditor
                logId={log._id} field="plan" value={log.plan}
                placeholder={"1. First...\n2. Then..."} minRows={4}
                updateFn={(id, field, val) => updateField(id, field, val)} />
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Flame size={13} className="text-purple-400" />
                </div>
                <span className="text-[11px] text-purple-400 font-semibold uppercase tracking-wider">Design & Architecture</span>
              </div>
              <AutoProEditor
                logId={log._id} field="designNotes" value={log.designNotes}
                placeholder="Schema, components, tradeoffs..." minRows={3}
                updateFn={(id, field, val) => updateField(id, field, val)} />
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <GitBranch size={13} className="text-emerald-400" />
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Git Branch</span>
              </div>
              <AutoProEditor
                logId={log._id} field="gitBranch" value={log.gitBranch}
                placeholder="feature/branch-name" minRows={1}
                updateFn={(id, field, val) => updateField(id, field, val)} />
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
              <TomorrowPlanView workLog={log} />
            </motion.div>
          </motion.div>
        )}

        {/* ── Progress (Completed + Decisions) ── */}
        {activeTab === 'progress' && (
          <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-4">
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Completed</span>
                <span className="text-[10px] text-surface-500 font-medium">{log.completedItems.length}</span>
              </div>
              <div className="space-y-1 mb-3">
                {log.completedItems.length === 0 && (
                  <p className="text-xs text-surface-600 italic py-1">Add things as you finish them...</p>
                )}
                {log.completedItems.map(item => (
                  <div key={item._id}
                    className="flex items-start gap-2 group p-2 rounded-lg hover:bg-surface-850 border border-transparent hover:border-surface-800 transition-all">
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="flex-1 text-xs text-surface-200">{item.text}</span>
                    <button onClick={() => deleteCompleted(log._id, item._id)}
                      className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all" aria-label="Remove completed item">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                await addCompleted(log._id, newItem.trim());
                setNewItem('');
              }} className="flex gap-2">
                <Input className="flex-1 text-xs py-2 rounded-xl" placeholder="I just completed..." aria-label="New completed item"
                  value={newItem} onChange={e => setNewItem(e.target.value)} />
                <Button type="submit" disabled={!newItem.trim()}
                  size="sm" className="rounded-xl px-3" aria-label="Add completed item" leftIcon={<Plus size={13} />} />
              </form>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
              <TechnicalDecisionsView workLog={log} />
            </motion.div>
          </motion.div>
        )}

        {/* ── Blockers (kept as-is) ── */}
        {activeTab === 'blockers' && (
          <motion.div key="blockers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <StructuredBlockersView workLog={log} />
          </motion.div>
        )}

        {/* ── Timeline (TimelineView + ReflectionView) ── */}
        {activeTab === 'timeline' && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-4">
            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
              <TimelineView workLog={log} />
            </motion.div>
            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
              <ReflectionView workLog={log} />
            </motion.div>
          </motion.div>
        )}

        {/* ── Resources ── */}
        {activeTab === 'resources' && (
          <motion.div key="resources" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="card p-6 rounded-2xl border border-surface-800 bg-surface-900">
            <AttachmentsView workLog={log} />
          </motion.div>
        )}

        {/* ── Read Mode ── */}
        {activeTab === 'reading' && (
          <motion.div key="reading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ReadingModeView workLog={log} />
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <DocumentationPreview
          log={log}
          open={showDocPreview}
          onClose={() => setShowDocPreview(false)}
        />
      </Suspense>

      <WorkLogExporterModal
        workLog={log}
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}

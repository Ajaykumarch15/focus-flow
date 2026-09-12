import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Plus, Trash2,
  Link2, BookMarked,
  ChevronDown,
  CheckCheck, RotateCcw, X, Clock,
  Play,
  Search, AlertOctagon, Eye,
  MessageSquare,
} from 'lucide-react';
import { useWorkLogStore, WorkLog, WorkLogStatus } from '@worklog/services/useWorkLogStore';
import { WorkLogMasterDetail } from '@worklog/components/worklog/WorkLogMasterDetail';
import { useStore } from '@worklog/services/useStore';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useProjectStore } from '@worklog/services/useProjectStore';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { Field } from '@shared/components/ui/Field';
import { Dialog } from '@shared/components/ui/Dialog';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: {
  value: WorkLogStatus; label: string; color: string; bg: string; border: string; emoji: string;
}[] = [
  { value: 'planning',    label: 'Planning',    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    emoji: '🗺️' },
  { value: 'in-progress', label: 'In Progress', color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     emoji: '⚡' },
  { value: 'reviewing',   label: 'Reviewing',   color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  emoji: '👀' },
  { value: 'blocked',     label: 'Blocked',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     emoji: '🚫' },
  { value: 'done',        label: 'Done',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', emoji: '✅' },
];
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s])) as Record<WorkLogStatus, typeof STATUS_OPTIONS[0]>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Motion variants ───────────────────────────────────────────────────────────
const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

// ── Compact grid card ────────────────────────────────────────────────────────
function WorkLogGridCard({ log, onClick }: { log: WorkLog; onClick: () => void }) {
  const { activeTaskId, activeTimerState, parallelTimers } = useStore();
  const linkedTaskId = log.taskRef?._id;

  // Check both legacy and parallel timer engines for this task
  const isLegacyActive = activeTaskId === linkedTaskId && !!linkedTaskId;

  // For running state, check the specific timer state from parallelTimers map
  const parallelState = linkedTaskId ? parallelTimers[linkedTaskId] : undefined;
  const isRunning = (isLegacyActive && activeTimerState === 'running')
    || parallelState === 'running';

  const statusInfo = STATUS_MAP[log.status] || STATUS_MAP['in-progress'];

  const commentCount = log.completedItems.length;
  const linkCount = log.links.length;

  // Live elapsed time for running logs
  const [elapsed, setElapsed] = useState(() =>
    linkedTaskId ? parallelTimerEngine.getFormattedDisplay(linkedTaskId) : ''
  );

  useEffect(() => {
    if (!isRunning || !linkedTaskId) return;
    const interval = setInterval(() => {
      setElapsed(parallelTimerEngine.getFormattedDisplay(linkedTaskId));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, linkedTaskId]);

  const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
    'planning':    { label: 'low',    color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    'in-progress': { label: 'medium', color: 'text-amber-400',   bg: 'bg-amber-500/15' },
    'reviewing':   { label: 'medium', color: 'text-amber-400',   bg: 'bg-amber-500/15' },
    'blocked':     { label: 'high',   color: 'text-red-400',     bg: 'bg-red-500/15' },
    'done':        { label: 'low',    color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  };
  const priority = PRIORITY_MAP[log.status] || PRIORITY_MAP['in-progress'];

  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      animate={isRunning ? {
        borderColor: ['rgba(245,158,11,0.4)', 'rgba(245,158,11,0.15)', 'rgba(245,158,11,0.4)'],
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      } : {
        borderColor: undefined,
      }}
      className={`relative text-left rounded-2xl border p-4 transition-all hover:border-brand-500/30 hover:bg-surface-850/80 cursor-pointer overflow-hidden ${
        isRunning
          ? 'bg-amber-500/5 shadow-lg shadow-amber-500/10'
          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900'
      }`}
    >
      {/* Running glow overlay */}
      {isRunning && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 pointer-events-none rounded-2xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Top row: running dot + category + priority */}
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          )}
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: log.taskRef?.color || '#6366f1' }} />
          <span className="text-xs font-medium text-surface-400 truncate">{statusInfo.label}</span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${priority.color} ${priority.bg}`}>
          {priority.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-surface-50 truncate mb-2 leading-snug relative">{log.title}</h3>

      {/* Bottom row: meta + avatar */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-surface-800/50 relative">
        <div className="flex items-center gap-3">
          {isRunning && elapsed && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono font-bold tabular-nums">
              <Clock size={10} /> {elapsed}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-surface-500">
              <MessageSquare size={11} />
              {commentCount}
            </span>
          )}
          {linkCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-surface-500">
              <Link2 size={11} />
              {linkCount}
            </span>
          )}
        </div>
        {log.taskRef && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: log.taskRef.color || '#6366f1' }}
            title={log.taskRef.title}>
            {log.taskRef.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ── Closed log mini card ───────────────────────────────────────────────────────
function ClosedLogCard({ log }: { log: WorkLog }) {
  const { continueLog, deleteLog } = useWorkLogStore();
  const navigate = useNavigate();
  const [continuing, setContinuing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = STATUS_MAP[log.status] || STATUS_MAP['done'];

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-200 dark:border-surface-800/70 bg-white dark:bg-surface-900/60 p-4 flex items-center gap-3 hover:border-brand-500/30 transition-all group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${status.bg} border ${status.border}`}>
        {status.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-surface-300 truncate group-hover:text-surface-100 transition-colors">{log.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-surface-500">
            {log.closedAt ? formatDistanceToNow(new Date(log.closedAt), { addSuffix: true }) : formatDistanceToNow(new Date(log.updatedAt), { addSuffix: true })}
          </span>
          {log.totalActiveMs > 0 && (
            <span className="text-[11px] text-surface-500 font-mono flex items-center gap-1">
              <Clock size={10} /> {formatMs(log.totalActiveMs)}
            </span>
          )}
          {log.completedItems.length > 0 && (
            <span className="text-[11px] text-emerald-500 flex items-center gap-1">
              <CheckCircle2 size={10} /> {log.completedItems.length}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={() => navigate(`/worklog/logs/${log._id}`)}
          className="p-1.5 text-surface-500 hover:bg-brand-500/10 hover:text-brand-500 rounded-lg transition-colors" title="View details" aria-label="View details">
          <Eye size={13} />
        </button>
        <Button
          size="sm"
          variant="outline"
          className="text-brand-400 border-brand-500/20 bg-brand-500/10 hover:bg-brand-500/20 hover:text-brand-400"
          onClick={async () => { setContinuing(true); try { await continueLog(log._id); } finally { setContinuing(false); } }}
          disabled={continuing}
          loading={continuing}
          leftIcon={continuing ? undefined : <RotateCcw size={11} />}
        >
          Continue
        </Button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <Button size="xs" variant="danger" className="text-white bg-danger-500 hover:bg-danger-400" onClick={() => deleteLog(log._id)}>Yes</Button>
            <Button size="xs" variant="secondary" className="text-surface-50 bg-surface-700 hover:bg-surface-600" onClick={() => setConfirmDelete(false)}>No</Button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-surface-600 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors" aria-label="Delete closed log">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────
function CreateLogModal({ onClose }: { onClose: () => void }) {
  const { createLog, creating } = useWorkLogStore();
  const { tasks } = useStore();
  const { projects, loadProjects } = useProjectStore();
  const [title, setTitle]         = useState('');
  const [taskRefId, setTaskRefId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError]         = useState('');

  useEffect(() => { loadProjects(); }, [loadProjects]);
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const handleTaskChange = (id: string) => {
    setTaskRefId(id);
    if (id && !title) { const t = activeTasks.find(t => t.id === id); if (t) setTitle(t.title); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    try { await createLog(title.trim(), taskRefId || undefined, projectId || undefined); onClose(); }
    catch (err: any) { setError(err.message || 'Failed to create'); }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Work Log"
      description="Link a task to enable Start/Pause/Stop timer controls."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            form="create-worklog-form"
            type="submit"
            disabled={creating || !title.trim()}
            loading={creating}
            leftIcon={creating ? undefined : <Plus size={15} />}
          >
            Create
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-sm text-danger-500">
          {error}
        </div>
      )}
      <form id="create-worklog-form" onSubmit={handleCreate} className="space-y-4">
        <Field label="Work Item Title" htmlFor="create-log-title" required>
          <Input id="create-log-title" placeholder="e.g. Fix login bug, Build profile page…"
            value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Link to Project" htmlFor="create-log-project">
          <Select id="create-log-project" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">— Standalone (No project) —</option>
            {projects.map(p => (<option key={p._id} value={p._id}>{p.name}</option>))}
          </Select>
        </Field>
        <Field label="Link to Task" htmlFor="create-log-task"
          hint="Selecting a task enables timer controls in the work log.">
          <Select id="create-log-task" value={taskRefId} onChange={e => handleTaskChange(e.target.value)}>
            <option value="">— No task link —</option>
            {activeTasks.map(t => (<option key={t.id} value={t.id}>{t.title}</option>))}
          </Select>
          {taskRefId && (
            <p className="text-xs text-brand-400 mt-1.5 flex items-center gap-1">
              <Play size={11} /> Timer controls will appear in the work log
            </p>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function WorkLogPage() {
  const { activeLogs, closedLogs, loading, loadAll } = useWorkLogStore();
  const { user } = useAuthStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<WorkLogStatus | 'all'>('all');

  useEffect(() => { loadAll(); }, []);

  const allLogs        = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);
  const totalActiveMs  = activeLogs.reduce((s, l) => s + l.totalActiveMs, 0);

  const filteredActive = useMemo(() => {
    let logs = activeLogs;
    if (search.trim()) {
      const q = search.toLowerCase();
      logs = logs.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.taskRef?.title?.toLowerCase().includes(q) ||
        l.gitBranch?.toLowerCase().includes(q) ||
        l.problem?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') logs = logs.filter(l => l.status === filterStatus);
    return logs;
  }, [activeLogs, search, filterStatus]);

  const filteredClosed = useMemo(() => {
    if (!search.trim()) return closedLogs;
    const q = search.toLowerCase();
    return closedLogs.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.taskRef?.title?.toLowerCase().includes(q)
    );
  }, [closedLogs, search]);

  // S3-T1 master/detail merge: a selected work log renders inline within this
  // single surface (IA §8.7-4, §8.8; ECIS §B.4). The standalone WorkLogDetail
  // page is retired — /worklog/:id now resolves here.
  if (id) {
    return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
        <WorkLogMasterDetail
          logs={allLogs}
          selectedId={id}
          onSelect={logId => navigate(`/worklog/logs/${logId}`)}
          onBack={() => navigate('/worklog/logs')}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto">

      {/* IES-P1-24: a failed Drive sync is surfaced here with a recovery hint —
          the Google Drive connection is managed in Settings → Integrations. */}
      {user?.googleConnected && user?.driveSyncError && (
        <div className="flex items-start gap-3 p-4 mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <AlertOctagon size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-300">Google Drive sync needs attention</p>
            <p className="text-xs text-amber-200/80 mt-0.5">{user.driveSyncError}</p>
            <p className="text-xs text-amber-200/60 mt-1">Fix it in <span className="font-semibold">Settings → Integrations</span> by reconnecting Drive.</p>
          </div>
        </div>
      )}

      {/* ═══ Header ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight">Work Logs</h1>
            <p className="text-surface-400 text-sm mt-1">
              {activeLogs.length} active · {formatMs(totalActiveMs)} tracked · {closedLogs.length} completed
            </p>
          </div>
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)} className="self-start sm:self-auto">
            New Work Log
          </Button>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input className="h-10 pl-9 pr-9 rounded-xl text-sm"
              placeholder="Search logs, tasks, branches…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search work logs" />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200 transition-colors" aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-1 rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
            {(['all', ...STATUS_OPTIONS.map(s => s.value)] as const).map(val => {
              const opt   = STATUS_OPTIONS.find(s => s.value === val);
              const label = val === 'all' ? 'All' : opt?.label;
              const count = val === 'all' ? activeLogs.length : activeLogs.filter(l => l.status === val).length;
              const isActive = filterStatus === val;
              return (
                <button key={val} onClick={() => setFilterStatus(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 shadow-sm'
                      : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                  }`}>
                  {val !== 'all' && opt?.emoji} {label}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ═══ Compact card grid ═══ */}
      {filteredActive.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredActive.map(log => (
            <WorkLogGridCard key={log._id} log={log} onClick={() => navigate(`/worklog/logs/${log._id}`)} />
          ))}
        </motion.div>
      )}

      {/* Empty states */}
      {loading && activeLogs.length === 0 ? (
        <div role="status" aria-live="polite" className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 rounded mb-2" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-full rounded" />
            </div>
          ))}
        </div>
      ) : filteredActive.length === 0 && !search ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 overflow-hidden">
          <EmptyState
            icon={<BookMarked size={28} className="text-brand-400" />}
            title="No work logs yet"
            description="Create a work log for any feature, bug, or task. Link it to a task to unlock timer controls and automatic time tracking."
            action={
              <Button leftIcon={<Plus size={15} />} onClick={() => setShowCreate(true)}>
                Create First Work Log
              </Button>
            }
          />
        </motion.div>
      ) : filteredActive.length === 0 && search ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 overflow-hidden">
          <EmptyState
            icon={<Search size={24} className="text-surface-500" />}
            title="No matching logs"
            description={`No logs match "${search}".`}
            action={
              <Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button>
            }
          />
        </motion.div>
      ) : null}

      {/* Closed logs section */}
      {filteredClosed.length > 0 && (
        <div>
          <Button variant="ghost" size="sm"
            leftIcon={<CheckCheck size={15} className="text-emerald-400" />}
            onClick={() => setShowClosed(!showClosed)}>
            Completed
            <span className="text-xs text-surface-500 bg-surface-200 dark:bg-surface-800 px-2 py-0.5 rounded-full font-normal">
              {filteredClosed.length}
            </span>
            <motion.div animate={{ rotate: showClosed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} />
            </motion.div>
          </Button>
          <AnimatePresence>
            {showClosed && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden mt-2">
                {filteredClosed.map(log => <ClosedLogCard key={log._id} log={log} />)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateLogModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}

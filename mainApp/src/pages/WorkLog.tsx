import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, AlertCircle, CheckCircle2, Plus, Trash2,
  ExternalLink, Link2, Lightbulb, Pencil, BookMarked,
  Zap, Loader2, ChevronDown, ChevronUp, Save,
  CheckCheck, RotateCcw, X, Sparkles, Clock,
  Calendar, TrendingUp, Play, Pause, Square, Timer,FolderOpen,
} from 'lucide-react';
import { useWorkLogStore, WorkLog, WorkEntry, WorkLogStatus } from '../store/useWorkLogStore';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { toast } from '../store/useToastStore';
import { AutoProEditor } from '../components/ui/proEditor.tsx';
import { formatDistanceToNow, format } from 'date-fns';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: {
  value: WorkLogStatus; label: string; chipClass: string; color: string; bg: string; border: string;
}[] = [
  { value: 'planning',    label: '🗺️ Planning',    chipClass: 'chip-planning',    color: 'text-[#2563EB] dark:text-blue-400',    bg: 'bg-[#EEF5FF] dark:bg-blue-500/10', border: 'border-blue-200/50' },
  { value: 'in-progress', label: '⚡ In Progress', chipClass: 'chip-in-progress', color: 'text-[#0284C7] dark:text-sky-400',     bg: 'bg-[#E8F5FF] dark:bg-sky-500/10',  border: 'border-[#38BDF8]' },
  { value: 'reviewing',   label: '👀 Reviewing',   chipClass: 'chip-review',      color: 'text-[#7C3AED] dark:text-purple-400',  bg: 'bg-[#F5F3FF] dark:bg-purple-500/10', border: 'border-purple-200/50' },
  { value: 'blocked',     label: '🚫 Blocked',     chipClass: 'chip-blocked',     color: 'text-[#DC2626] dark:text-red-400',     bg: 'bg-[#FFF1F2] dark:bg-red-500/10',    border: 'border-red-200/50' },
  { value: 'done',        label: '✅ Done',         chipClass: 'chip-done',        color: 'text-[#059669] dark:text-emerald-400', bg: 'bg-[#ECFDF5] dark:bg-emerald-500/10',border: 'border-emerald-200/50'},
];
const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];

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

function formatClock(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function formatTime(epoch?: number) {
  if (!epoch) return '—';
  return format(new Date(epoch), 'h:mm a');
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const t = new Date();        t.setHours(0,0,0,0);
  return d.getTime() === t.getTime();
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

// ── Auto-saving input ─────────────────────────────────────────────────────────
function AutoInput({ logId, field, placeholder, value: initial, mono = false }: {
  logId: string; field: string; placeholder: string; value: string; mono?: boolean;
}) {
  const { updateField } = useWorkLogStore();
  const [val, setVal]     = useState(initial);
  const [saved, setSaved] = useState(true);
  const debounced         = useDebounce(val, 700);
  useEffect(() => { setVal(initial); }, [initial]);
  useEffect(() => {
    if (debounced === initial) return;
    setSaved(false);
    updateField(logId, field, debounced).then(() => setSaved(true)).catch(() => setSaved(false));
  }, [debounced]);
  return (
    <div className="relative">
      <input className={`input text-sm w-full pr-8 ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder} value={val}
        onChange={e => { setVal(e.target.value); setSaved(false); }} />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {saved ? <Save size={11} className="text-surface-700" /> : <Loader2 size={11} className="text-brand-400 animate-spin" />}
      </div>
    </div>
  );
}

// ── Auto-saving textarea ──────────────────────────────────────────────────────
function AutoTextarea({ logId, field, placeholder, value: initial, rows = 3 }: {
  logId: string; field: string; placeholder: string; value: string; rows?: number;
}) {
  const { updateField } = useWorkLogStore();
  const [val, setVal]     = useState(initial);
  const [saved, setSaved] = useState(true);
  const debounced         = useDebounce(val, 700);
  useEffect(() => { setVal(initial); }, [initial]);
  useEffect(() => {
    if (debounced === initial) return;
    setSaved(false);
    updateField(logId, field, debounced).then(() => setSaved(true)).catch(() => setSaved(false));
  }, [debounced]);
  return (
    <div className="relative">
      <textarea rows={rows} className="input resize-none text-sm w-full pr-8"
        placeholder={placeholder} value={val}
        onChange={e => { setVal(e.target.value); setSaved(false); }} />
      <div className="absolute right-2.5 bottom-2.5">
        {saved ? <Save size={11} className="text-surface-700" /> : <Loader2 size={11} className="text-brand-400 animate-spin" />}
      </div>
    </div>
  );
}

// ── Inline timer panel ────────────────────────────────────────────────────────
// This is the key new component — shows inside the card
function TimerPanel({ log }: { log: WorkLog }) {
  const {
    startTimer, pauseTimer, resumeTimer, stopTimer,
    activeTaskId, activeTimerState, tasks, tick,
  } = useStore();
  const { syncTime } = useWorkLogStore();

  // Live elapsed display
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const linkedTaskId = log.taskRef?._id;
  const isThisActive = activeTaskId === linkedTaskId;
  const isRunning    = isThisActive && activeTimerState === 'running';
  const isPaused     = isThisActive && activeTimerState === 'paused';

  // Get the live session from the tasks store
  const liveTask = tasks.find(t => t.id === linkedTaskId);
  const liveSession = liveTask?.sessions[liveTask.sessions.length - 1];

  // Tick the elapsed display every second while running
  useEffect(() => {
    if (isRunning && liveSession) {
      const update = () => setElapsed(liveSession.activeTime);
      update();
      intervalRef.current = setInterval(() => {
        tick(); // advance the store
        setElapsed(liveSession.activeTime);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (isPaused && liveSession) setElapsed(liveSession.activeTime);
      else if (!isThisActive)      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isPaused, liveSession?.activeTime]);

  // After stop — auto-sync time into work entries
  const handleStop = async () => {
    if (!linkedTaskId) return;
    try {
      await stopTimer(linkedTaskId);
      await syncTime(log._id);
      toast.success('Time synced', 'Work log history was updated from the stopped timer.');
    } catch (err: any) {
      toast.error('Timer stopped, sync failed', err.message || 'Try syncing the work log again.');
    }
  };

  // No linked task — show a message explaining how to link
  if (!linkedTaskId) {
    return (
      <div className="rounded-[18px] border border-surface-800 bg-[#FFFDF5] dark:bg-surface-850 p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Timer size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-100">No task linked</p>
            <p className="text-xs text-surface-400 mt-0.5">
              Link this work log to a task below. Time will then be tracked here automatically when you use the timer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-[22px] border p-5 mb-5 transition-all shadow-sm ${
      isRunning
        ? 'border-amber-400/50 bg-[#FFFDF5] dark:bg-amber-500/10'
        : isPaused
        ? 'border-yellow-400/40 bg-[#FFFDF5] dark:bg-amber-500/5'
        : 'border-amber-200/80 bg-[#FFFDF5] dark:bg-surface-850'
    }`}>
      <div className="flex items-center justify-between flex-wrap gap-4">

        {/* Left: task name + live clock */}
        <div className="flex items-center gap-4">
          {/* Animated ring when running */}
          <div className="relative flex items-center justify-center w-12 h-12 flex-shrink-0">
            {isRunning && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-amber-500 opacity-40"
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
              isRunning ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' :
              isPaused  ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
              'border-surface-800 bg-surface-900 text-surface-400'
            }`}>
              <Timer size={20} />
            </div>
          </div>

          <div>
            {/* Linked task name */}
            <p className="text-xs font-medium text-surface-400 mb-0.5">
              Tracking: <span style={{ color: log.taskRef?.color }} className="font-semibold">{log.taskRef?.title}</span>
            </p>

            {/* Live clock — big, amber accent, monospaced */}
            <div className={`font-mono text-3xl lg:text-4xl font-extrabold tracking-wider ${
              isRunning ? 'text-amber-500' : isPaused ? 'text-amber-500/80' : 'text-surface-300'
            }`}>
              {isThisActive ? formatClock(elapsed) : formatClock(log.totalActiveMs)}
            </div>

            {/* Status label */}
            <p className="text-xs mt-1">
              {isRunning ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  <motion.span
                    className="inline-block w-2 h-2 rounded-full bg-amber-500"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  Running
                </span>
              ) : isPaused ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Paused</span>
              ) : (
                <span className="text-surface-400 font-medium">
                  {log.totalActiveMs > 0 ? `Total logged: ${formatMs(log.totalActiveMs)}` : 'Not started'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: control buttons */}
        <div className="flex items-center gap-2.5">
          {/* Another task is running — show warning */}
          {activeTaskId && activeTaskId !== linkedTaskId && (
            <p className="text-xs text-amber-600 font-medium mr-2">
              Another task is running — stop it first
            </p>
          )}

          {/* START */}
          {!isThisActive && (!activeTaskId || activeTaskId === linkedTaskId) && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startTimer(linkedTaskId)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[14px] font-semibold text-sm transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <Play size={15} fill="white" />
              Start Timer
            </motion.button>
          )}

          {/* PAUSE */}
          {isRunning && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => pauseTimer(linkedTaskId)}
              className="btn-secondary"
            >
              <Pause size={15} />
              Pause
            </motion.button>
          )}

          {/* RESUME */}
          {isPaused && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => resumeTimer(linkedTaskId)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[14px] font-semibold text-sm transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <Play size={15} fill="white" />
              Resume
            </motion.button>
          )}

          {/* STOP */}
          {isThisActive && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleStop}
              className="btn-danger"
            >
              <Square size={14} fill="currentColor" />
              Stop
            </motion.button>
          )}
        </div>
      </div>

      {/* Today's session quick stats */}
      {isThisActive && liveSession && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-surface-700/50 flex items-center gap-4 text-xs text-surface-400 flex-wrap"
        >
          <span className="flex items-center gap-1">
            <Clock size={11} /> Started {format(new Date(liveSession.startTime), 'h:mm a')}
          </span>
          <span className="flex items-center gap-1">
            <Timer size={11} />
            Pause time: {formatMs(liveSession.totalPauseDuration)}
          </span>
          <span className="ml-auto text-surface-500 italic">
            Time saves automatically when you click Stop
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ── Work entry row (one day) ──────────────────────────────────────────────────
function WorkEntryRow({ logId, entry }: { logId: string; entry: WorkEntry }) {
  const { updateEntry } = useWorkLogStore();
  const [what, setWhat]   = useState(entry.what);
  const [saved, setSaved] = useState(true);
  const debounced         = useDebounce(what, 700);

  useEffect(() => { setWhat(entry.what); }, [entry.what]);
  useEffect(() => {
    if (debounced === entry.what) return;
    setSaved(false);
    updateEntry(logId, entry._id, debounced).then(() => setSaved(true)).catch(() => setSaved(false));
  }, [debounced]);

  const today     = isToday(entry.date);
  const dateLabel = today ? 'Today' : format(new Date(entry.date), 'EEE, MMM d');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${today ? 'border-brand-500/30 bg-brand-500/5' : 'border-surface-700 bg-surface-800/40'}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={13} className={today ? 'text-brand-400' : 'text-surface-400'} />
          <span className={`text-sm font-medium ${today ? 'text-brand-300' : 'text-surface-50'}`}>{dateLabel}</span>
          {today && (
            <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full border border-brand-500/30">
              Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {entry.startedAt && (
            <span className="text-xs text-surface-400 flex items-center gap-1">
              <Clock size={11} />
              {formatTime(entry.startedAt)} → {formatTime(entry.endedAt)}
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs font-mono font-medium px-2.5 py-1 rounded-full ${
            entry.activeMs > 0
              ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
              : 'bg-surface-700 text-surface-500'
          }`}>
            <Timer size={11} />
            {formatMs(entry.activeMs)}
          </span>
        </div>
      </div>

      {/* What I did — ProEditor */}
      <AutoProEditor
        logId={logId}
        field={`entry_${entry._id}`}
        value={what}
        placeholder={today ? 'What are you working on today?' : 'What did you do on this day?'}
        minRows={2}
        hint="Supports **bold**, *italic*, - lists, `code`"
        updateFn={async (_id, _field, val) => {
          setWhat(val);
          await updateEntry(logId, entry._id, val);
        }}
      />
    </motion.div>
  );
}

// ── Time summary panel ────────────────────────────────────────────────────────
function TimeSummaryPanel({ log }: { log: WorkLog }) {
  const totalMs     = log.totalActiveMs;
  const taskTotalMs = log.taskRef?.totalTime || 0;
  const entries     = log.workEntries;
  const daysWorked  = entries.filter(e => e.activeMs > 0).length;
  const avgMs       = daysWorked > 0 ? totalMs / daysWorked : 0;

  return (
    <div className="card p-4 mb-4 bg-gradient-to-r from-brand-500/8 to-purple-500/5 border-brand-500/20">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-brand-400" />
        <span className="text-sm font-medium text-surface-50">Time Summary</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xl font-display font-bold text-brand-400">{formatMs(totalMs)}</p>
          <p className="text-xs text-surface-400 mt-0.5">This work log</p>
        </div>
        {log.taskRef && (
          <div className="text-center">
            <p className="text-xl font-display font-bold text-purple-400">{formatMs(taskTotalMs)}</p>
            <p className="text-xs text-surface-400 mt-0.5">Task total (all time)</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-xl font-display font-bold text-yellow-400">{daysWorked}</p>
          <p className="text-xs text-surface-400 mt-0.5">Days worked</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-display font-bold text-emerald-400">{formatMs(avgMs)}</p>
          <p className="text-xs text-surface-400 mt-0.5">Avg per day</p>
        </div>
      </div>

      {/* Bar chart */}
      {entries.filter(e => e.activeMs > 0).length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-surface-400 mb-2">Daily breakdown</p>
          <div className="flex items-end gap-1.5 h-12">
            {[...entries].reverse().slice(0, 14).map(entry => {
              const maxMs = Math.max(...entries.map(e => e.activeMs), 1);
              const pct   = (entry.activeMs / maxMs) * 100;
              const tod   = isToday(entry.date);
              return (
                <div key={entry._id} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <motion.div
                    className={`w-full rounded-sm ${tod ? 'bg-brand-400' : 'bg-brand-600/60'} group-hover:bg-brand-400 transition-colors`}
                    style={{ height: `${Math.max(4, pct)}%` }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, pct)}%` }}
                    transition={{ duration: 0.4 }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1 text-xs text-surface-50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {format(new Date(entry.date), 'MMM d')}: {formatMs(entry.activeMs)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Work history section ──────────────────────────────────────────────────────
function WorkHistorySection({ log }: { log: WorkLog }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="card overflow-hidden mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-4 hover:bg-white/5 transition-colors border-b border-surface-800"
      >
        <Calendar size={14} className="text-brand-400" />
        <span className="text-sm font-medium text-surface-50">Work History</span>
        <span className="text-xs text-surface-500 ml-1">
          ({log.workEntries.length} day{log.workEntries.length !== 1 ? 's' : ''})
        </span>
        <div className="ml-auto">
          {open ? <ChevronUp size={13} className="text-surface-500" /> : <ChevronDown size={13} className="text-surface-500" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {log.workEntries.length === 0 ? (
                <div className="text-center py-6">
                  <Clock size={28} className="text-surface-700 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">
                    {log.taskRef
                      ? 'Press Start Timer above — entries appear here after you stop'
                      : 'Link a task when creating the log to enable time tracking'}
                  </p>
                </div>
              ) : (
                log.workEntries.map(entry => (
                  <WorkEntryRow key={entry._id} logId={log._id} entry={entry} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Full work log card ────────────────────────────────────────────────────────
function TaskLinkControl({ log }: { log: WorkLog }) {
  const { tasks } = useStore();
  const { linkTask } = useWorkLogStore();
  const [selected, setSelected] = useState(log.taskRef?._id || '');
  const [saving, setSaving] = useState(false);
  const activeTasks = tasks.filter(t => t.status !== 'completed' || t.id === log.taskRef?._id);

  useEffect(() => {
    setSelected(log.taskRef?._id || '');
  }, [log.taskRef?._id]);

  const save = async () => {
    setSaving(true);
    try {
      await linkTask(log._id, selected || undefined);
      toast.success(selected ? 'Task linked' : 'Task unlinked', 'Work log time history has been refreshed.');
    } catch (err: any) {
      toast.error('Could not update task link', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-800/40 p-4 mb-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="flex items-center gap-1.5 text-xs text-surface-300 font-medium mb-1.5">
            <Timer size={12} className="text-brand-400" /> Linked Task
          </label>
          <select className="input text-sm" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">No task link</option>
            {activeTasks.map(task => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || selected === (log.taskRef?._id || '')}
          className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Link
        </button>
      </div>
      <p className="text-xs text-surface-500 mt-2">
        Changing the linked task refreshes this log's daily time history from completed sessions.
      </p>
    </div>
  );
}

function WorkLogCard({ log, defaultExpanded = false }: { log: WorkLog; defaultExpanded?: boolean }) {
  const {
    closeLog, continueLog, deleteLog,
    addCompleted, deleteCompleted, addLink, deleteLink, updateField,
  } = useWorkLogStore();

  const [expanded, setExpanded]           = useState(defaultExpanded);
  const [newItem, setNewItem]             = useState('');
  const [newLink, setNewLink]             = useState({ label: '', url: '' });
  const [showLinkForm, setShowLinkForm]   = useState(false);
  const [closing, setClosing]             = useState(false);
  const [continuing, setContinuing]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { activeTaskId, activeTimerState } = useStore();
  const linkedTaskId  = log.taskRef?._id;
  const isThisActive  = activeTaskId === linkedTaskId && !!linkedTaskId;
  const isRunning     = isThisActive && activeTimerState === 'running';

  const status    = STATUS_OPTIONS.find(s => s.value === log.status) || STATUS_OPTIONS[1];
  const age       = formatDistanceToNow(new Date(log.createdAt), { addSuffix: true });
  const doneCount = log.completedItems.length;

  const handleAddCompleted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    await addCompleted(log._id, newItem.trim());
    setNewItem('');
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.label.trim() || !newLink.url.trim()) return;
    await addLink(log._id, newLink.label, newLink.url);
    setNewLink({ label: '', url: '' });
    setShowLinkForm(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`card overflow-hidden transition-all ${
        isRunning
          ? 'border-brand-500/50 shadow-lg shadow-brand-500/10'
          : log.isActive
          ? 'border-surface-700'
          : 'border-surface-800 opacity-70'
      }`}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Running indicator */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isRunning ? 'bg-brand-400 animate-pulse' :
          log.isActive ? 'bg-surface-500' : 'bg-surface-700'
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-surface-50 text-sm">{log.title}</span>
            <span className={`badge text-xs ${status.bg} ${status.color} border ${status.border}`}>
              {status.label}
            </span>
            {log.gitBranch && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                <GitBranch size={10} />{log.gitBranch}
              </span>
            )}
            {log.taskRef && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${log.taskRef.color}20`, color: log.taskRef.color }}>
                <Timer size={10} /> {log.taskRef.title}
              </span>
            )}
            {isRunning && (
              <span className="text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20 animate-pulse">
                ● Timer running
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-surface-500">{age}</span>
            {log.totalActiveMs > 0 && (
              <span className="flex items-center gap-1 text-xs text-brand-400 font-mono">
                <Clock size={10} /> {formatMs(log.totalActiveMs)} logged
              </span>
            )}
            {log.taskRef && log.taskRef.totalTime > 0 && (
              <span className="flex items-center gap-1 text-xs text-purple-400 font-mono">
                <TrendingUp size={10} /> {formatMs(log.taskRef.totalTime)} total on task
              </span>
            )}
            {doneCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 size={10} />{doneCount} done
              </span>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-lg">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
          {/* Open Google Doc */}
{log.googleDocUrl && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      window.open(log.googleDocUrl, "_blank", "noopener,noreferrer");
    }}
    title="Open Google Document"
    className="flex items-center gap-1.5 px-3 py-1.5
      bg-blue-500/15 hover:bg-blue-500/25
      text-blue-400 rounded-lg text-xs font-medium
      transition-all border border-blue-500/20
      hover:border-blue-400/40"
  >
    <ExternalLink size={13} />
    <span>Open Doc</span>
  </button>
)}

          {log.isActive ? (
            <button
              onClick={async () => { setClosing(true); try { await closeLog(log._id); } finally { setClosing(false); } }}
              disabled={closing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg text-xs font-medium transition-all"
            >
              {closing ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Done
            </button>
          ) : (
            <button
              onClick={async () => { setContinuing(true); try { await continueLog(log._id); } finally { setContinuing(false); } }}
              disabled={continuing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 rounded-lg text-xs font-medium transition-all"
            >
              {continuing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Continue
            </button>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => deleteLog(log._id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-surface-700 text-surface-50 rounded-lg text-xs">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-surface-600 hover:text-red-400 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}

          {expanded
            ? <ChevronUp size={15} className="text-surface-500 ml-1" />
            : <ChevronDown size={15} className="text-surface-500 ml-1" />}
        </div>
      </div>

      {/* ── Expanded body ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-surface-800"
          >
            <div className="p-5">

              {/* Status + mood bar */}
              <div className="flex items-center gap-4 flex-wrap mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-400">Status</span>
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.filter(s => s.value !== 'done').map(s => (
                      <button key={s.value}
                        onClick={() => updateField(log._id, 'status', s.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          log.status === s.value
                            ? `${s.bg} ${s.color} ring-1 ring-current`
                            : 'bg-surface-800 text-surface-500 hover:text-surface-50'
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-surface-400">Energy</span>
                  {MOOD_EMOJIS.map((emoji, i) => (
                    <button key={i} onClick={() => updateField(log._id, 'mood', i + 1)}
                      className={`text-base transition-all ${log.mood === i + 1 ? 'scale-125' : 'opacity-30 hover:opacity-60'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* ★ TIMER PANEL — the new key feature ★ */}
              <TaskLinkControl log={log} />
              <TimerPanel log={log} />

              {/* Time summary */}
              <TimeSummaryPanel log={log} />

              {/* Work history */}
              <WorkHistorySection log={log} />

              {/* Detail fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-red-400 font-medium mb-1.5">
                      <AlertCircle size={12} /> Problem I'm Solving
                    </label>
                    <AutoProEditor logId={log._id} field="problem" value={log.problem}
                      placeholder="What ticket/feature/bug? What user pain?" minRows={3}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mb-1.5">
                      <GitBranch size={12} /> Git Branch
                    </label>
                    <AutoInput logId={log._id} field="gitBranch"
                      placeholder="feature/branch-name" value={log.gitBranch} mono />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-brand-400 font-medium mb-1.5">
                      <Zap size={12} /> What I'm Working On
                    </label>
                    <AutoProEditor logId={log._id} field="currentWork" value={log.currentWork}
                      placeholder="Specific function, component, API…" minRows={3}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium mb-1.5">
                      <AlertCircle size={12} /> Blockers
                    </label>
                    <AutoProEditor logId={log._id} field="blockers" value={log.blockers}
                      placeholder="What's blocking you?" minRows={2}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Completed checklist */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mb-1.5">
                      <CheckCircle2 size={12} /> Completed
                    </label>
                    <div className="space-y-1.5 mb-2">
                      <AnimatePresence>
                        {log.completedItems.length === 0 && (
                          <p className="text-xs text-surface-600 italic">Add things as you finish them…</p>
                        )}
                        {log.completedItems.map(item => (
                          <motion.div key={item._id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                            className="flex items-start gap-2 group p-1.5 rounded-lg hover:bg-surface-800/50">
                            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="flex-1 text-xs text-surface-200">{item.text}</span>
                            <button onClick={() => deleteCompleted(log._id, item._id)}
                              className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all">
                              <X size={11} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <form onSubmit={handleAddCompleted} className="flex gap-2">
                      <input className="input flex-1 text-xs py-1.5" placeholder="I just completed…"
                        value={newItem} onChange={e => setNewItem(e.target.value)} />
                      <button type="submit" disabled={!newItem.trim()} className="btn-primary px-2.5 py-1.5">
                        <Plus size={13} />
                      </button>
                    </form>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium mb-1.5">
                      <Lightbulb size={12} /> Plan
                    </label>
                    <AutoProEditor logId={log._id} field="plan" value={log.plan}
                      placeholder={"1. First…\n2. Then…"} minRows={4}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-purple-400 font-medium mb-1.5">
                      <Pencil size={12} /> Design / Architecture
                    </label>
                    <AutoProEditor logId={log._id} field="designNotes" value={log.designNotes}
                      placeholder="Schema, components, tradeoffs…" minRows={3}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>

                  {/* Links */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium mb-1.5">
                      <Link2 size={12} /> Links
                    </label>
                    <div className="space-y-1.5 mb-2">
                      {log.links.map(link => (
                        <div key={link._id} className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-800/50 group">
                          <ExternalLink size={11} className="text-cyan-400 flex-shrink-0" />
                          <a href={link.url} target="_blank" rel="noreferrer"
                            className="flex-1 text-xs text-cyan-300 hover:text-cyan-200 truncate">{link.label}</a>
                          <button onClick={() => deleteLink(log._id, link._id)}
                            className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {showLinkForm ? (
                        <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          onSubmit={handleAddLink} className="space-y-1.5">
                          <input className="input text-xs py-1.5" placeholder="Label (PR #42…)"
                            value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))} />
                          <input className="input text-xs py-1.5" type="url" placeholder="https://…"
                            value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowLinkForm(false)} className="btn-secondary flex-1 text-xs py-1.5">Cancel</button>
                            <button type="submit" className="btn-primary flex-1 text-xs py-1.5">Add</button>
                          </div>
                        </motion.form>
                      ) : (
                        <button onClick={() => setShowLinkForm(true)}
                          className="text-xs text-surface-500 hover:text-surface-50 flex items-center gap-1 transition-colors">
                          <Plus size={12} /> Add link
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const handleTaskChange = (id: string) => {
    setTaskRefId(id);
    if (id && !title) {
      const t = activeTasks.find(t => t.id === id);
      if (t) setTitle(t.title);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    try {
      await createLog(title.trim(), taskRefId || undefined, projectId || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center">
            <Sparkles size={17} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-surface-50">New Work Log</h2>
            <p className="text-xs text-surface-400">Link a task to get Start/Pause/Stop controls</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-surface-300 mb-1.5">Work Item Title *</label>
            <input className="input" placeholder="e.g. Fix login bug, Build profile page…"
              value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>

          <div>
            <label className="block text-sm text-surface-300 mb-1.5">Link to Project</label>
            <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">— Standalone Log (No project) —</option>
              {projects.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-surface-300 mb-1.5">
              Link to Task <span className="text-surface-500 text-xs">(enables timer controls here)</span>
            </label>
            <select className="input" value={taskRefId} onChange={e => handleTaskChange(e.target.value)}>
              <option value="">— No task link —</option>
              {activeTasks.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            {taskRefId && (
              <p className="text-xs text-brand-400 mt-1.5 flex items-center gap-1">
                <Play size={11} /> Start / Pause / Stop will appear inside the work log card
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={creating || !title.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Create
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function WorkLogPage() {
  const { activeLogs, closedLogs, loading, loadAll } = useWorkLogStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => { loadAll(); }, []);

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">📋</span>
            Work Logs
          </h1>
          <p className="text-surface-400 font-medium text-sm mt-1">
            {activeLogs.length} Active · {closedLogs.length} Completed
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} /> New Work Log
        </button>
      </motion.div>

      {loading && activeLogs.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-lg" />
                  <Skeleton className="h-5 w-16 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-3 w-16 rounded mb-2" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
                <div>
                  <Skeleton className="h-3 w-16 rounded mb-2" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeLogs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-12 text-center mb-6">
          <BookMarked size={40} className="text-surface-700 mx-auto mb-4" />
          <h3 className="font-medium text-surface-50 mb-2">No active work logs</h3>
          <p className="text-surface-400 text-sm mb-5">
            Create a log and link it to a task. You'll get<br />
            Start / Pause / Stop controls right inside the card.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto flex items-center gap-2">
            <Plus size={15} /> Create First Work Log
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3 mb-6">
          <AnimatePresence mode="popLayout">
            {activeLogs.map((log, i) => (
              <WorkLogCard key={log._id} log={log} defaultExpanded={i === 0} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {closedLogs.length > 0 && (
        <div>
          <button onClick={() => setShowClosed(!showClosed)}
            className="flex items-center gap-2 text-surface-400 hover:text-surface-50 text-sm font-medium transition-colors mb-3">
            <CheckCheck size={15} className="text-emerald-400" />
            Completed ({closedLogs.length})
            {showClosed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {showClosed && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                {closedLogs.map(log => <WorkLogCard key={log._id} log={log} />)}
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

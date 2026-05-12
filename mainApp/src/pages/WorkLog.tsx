import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, AlertCircle, CheckCircle2, Plus, Trash2,
  ExternalLink, Link2, Lightbulb, Pencil, BookMarked,
  Zap, Loader2, ChevronDown, ChevronUp, Save,
  CheckCheck, RotateCcw, X, Sparkles, Clock,
  Calendar, TrendingUp, Play, Pause, Square, Timer,
} from 'lucide-react';
import { useWorkLogStore, WorkLog, WorkEntry, WorkLogStatus } from '../store/useWorkLogStore';
import { useStore } from '../store/useStore';
import { formatDistanceToNow, format } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: {
  value: WorkLogStatus; label: string; color: string; bg: string; border: string;
}[] = [
  { value: 'planning',    label: '🗺️ Planning',    color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
  { value: 'in-progress', label: '⚡ In Progress', color: 'text-brand-400',  bg: 'bg-brand-400/10',  border: 'border-brand-400/30'  },
  { value: 'reviewing',   label: '👀 Reviewing',   color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  { value: 'blocked',     label: '🚫 Blocked',     color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30'    },
  { value: 'done',        label: '✅ Done',         color: 'text-emerald-400',bg: 'bg-emerald-400/10',border: 'border-emerald-400/30'},
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
    stopTimer(linkedTaskId);
    // Give the session route ~600ms to persist, then sync
    setTimeout(() => syncTime(log._id), 800);
  };

  // No linked task — show a message explaining how to link
  if (!linkedTaskId) {
    return (
      <div className="rounded-xl border border-surface-700 bg-surface-800/40 p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center flex-shrink-0">
            <Timer size={16} className="text-surface-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-surface-300">No task linked</p>
            <p className="text-xs text-surface-500 mt-0.5">
              Link this work log to a task when creating it (or delete & recreate).
              Time will then be tracked here automatically when you use the timer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 mb-4 transition-all ${
      isRunning
        ? 'border-brand-500/40 bg-brand-500/5'
        : isPaused
        ? 'border-yellow-500/30 bg-yellow-500/5'
        : 'border-surface-700 bg-surface-800/40'
    }`}>
      <div className="flex items-center justify-between flex-wrap gap-4">

        {/* Left: task name + live clock */}
        <div className="flex items-center gap-3">
          {/* Animated ring when running */}
          <div className="relative flex items-center justify-center w-10 h-10 flex-shrink-0">
            {isRunning && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-brand-400 opacity-40"
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
              isRunning ? 'border-brand-400 bg-brand-500/10' :
              isPaused  ? 'border-yellow-400 bg-yellow-500/10' :
              'border-surface-600 bg-surface-700/50'
            }`}>
              <Timer size={16} className={isRunning ? 'text-brand-400' : isPaused ? 'text-yellow-400' : 'text-surface-400'} />
            </div>
          </div>

          <div>
            {/* Linked task name */}
            <p className="text-xs text-surface-400 mb-0.5">
              Tracking: <span style={{ color: log.taskRef?.color }}>{log.taskRef?.title}</span>
            </p>

            {/* Live clock — big and monospaced */}
            <div className={`font-mono text-2xl font-bold tracking-wider ${
              isRunning ? 'text-brand-400' : isPaused ? 'text-yellow-400' : 'text-surface-400'
            }`}>
              {isThisActive ? formatClock(elapsed) : formatClock(log.totalActiveMs)}
            </div>

            {/* Status label */}
            <p className="text-xs mt-0.5">
              {isRunning ? (
                <span className="text-brand-400 flex items-center gap-1">
                  <motion.span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  Running
                </span>
              ) : isPaused ? (
                <span className="text-yellow-400">Paused</span>
              ) : (
                <span className="text-surface-500">
                  {log.totalActiveMs > 0 ? `Total logged: ${formatMs(log.totalActiveMs)}` : 'Not started'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: control buttons */}
        <div className="flex items-center gap-2">
          {/* Another task is running — show warning */}
          {activeTaskId && activeTaskId !== linkedTaskId && (
            <p className="text-xs text-yellow-400 mr-2">
              Another task is running — stop it first
            </p>
          )}

          {/* START */}
          {!isThisActive && (!activeTaskId || activeTaskId === linkedTaskId) && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => startTimer(linkedTaskId)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-brand-500/20"
            >
              <Play size={15} fill="white" />
              Start Timer
            </motion.button>
          )}

          {/* PAUSE */}
          {isRunning && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => pauseTimer(linkedTaskId)}
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-400 border border-yellow-400/25 rounded-xl font-medium text-sm transition-all"
            >
              <Pause size={15} />
              Pause
            </motion.button>
          )}

          {/* RESUME */}
          {isPaused && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => resumeTimer(linkedTaskId)}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 border border-brand-400/25 rounded-xl font-medium text-sm transition-all"
            >
              <Play size={15} />
              Resume
            </motion.button>
          )}

          {/* STOP */}
          {isThisActive && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-400/15 hover:bg-red-400/25 text-red-400 border border-red-400/25 rounded-xl font-medium text-sm transition-all"
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
          <span className={`text-sm font-medium ${today ? 'text-brand-300' : 'text-white'}`}>{dateLabel}</span>
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

      {/* What I did */}
      <div className="relative">
        <textarea rows={2} className="input resize-none text-sm w-full pr-8 bg-surface-800/60"
          placeholder={today ? 'What are you working on today?' : 'What did you do on this day?'}
          value={what} onChange={e => { setWhat(e.target.value); setSaved(false); }} />
        <div className="absolute right-2.5 bottom-2.5">
          {saved ? <Save size={11} className="text-surface-700" /> : <Loader2 size={11} className="text-brand-400 animate-spin" />}
        </div>
      </div>
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
        <span className="text-sm font-medium text-white">Time Summary</span>
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
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
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
        <span className="text-sm font-medium text-white">Work History</span>
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
            <span className="font-medium text-white text-sm">{log.title}</span>
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
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-surface-700 text-white rounded-lg text-xs">No</button>
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
                            : 'bg-surface-800 text-surface-500 hover:text-white'
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
                    <AutoTextarea logId={log._id} field="problem"
                      placeholder="What ticket/feature/bug? What user pain?" value={log.problem} rows={3} />
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
                    <AutoTextarea logId={log._id} field="currentWork"
                      placeholder="Specific function, component, API…" value={log.currentWork} rows={3} />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium mb-1.5">
                      <AlertCircle size={12} /> Blockers
                    </label>
                    <AutoTextarea logId={log._id} field="blockers"
                      placeholder="What's blocking you?" value={log.blockers} rows={2} />
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
                    <AutoTextarea logId={log._id} field="plan"
                      placeholder={"1. First…\n2. Then…"} value={log.plan} rows={4} />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-purple-400 font-medium mb-1.5">
                      <Pencil size={12} /> Design / Architecture
                    </label>
                    <AutoTextarea logId={log._id} field="designNotes"
                      placeholder="Schema, components, tradeoffs…" value={log.designNotes} rows={3} />
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
                          className="text-xs text-surface-500 hover:text-white flex items-center gap-1 transition-colors">
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
  const [title, setTitle]         = useState('');
  const [taskRefId, setTaskRefId] = useState('');
  const [error, setError]         = useState('');

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
      await createLog(title.trim(), taskRefId || undefined);
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
            <h2 className="text-base font-display font-bold text-white">New Work Log</h2>
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
    <div className="p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BookMarked size={22} className="text-brand-400" /> Work Logs
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            {activeLogs.length} active · {closedLogs.length} completed
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Work Log
        </button>
      </motion.div>

      {loading && activeLogs.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      ) : activeLogs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-12 text-center mb-6">
          <BookMarked size={40} className="text-surface-700 mx-auto mb-4" />
          <h3 className="font-medium text-white mb-2">No active work logs</h3>
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
            className="flex items-center gap-2 text-surface-400 hover:text-white text-sm font-medium transition-colors mb-3">
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

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, AlertCircle, CheckCircle2, Plus, Trash2,
  ExternalLink, Link2, Lightbulb, Pencil, BookMarked,
  Zap, Loader2, ChevronDown, ChevronUp, Save,
  CheckCheck, RotateCcw, X, Sparkles, Clock,
  Calendar, TrendingUp, Play, Pause, Square, Timer, FolderOpen,
  Search, Filter, BarChart3, Flame, Target, ArrowUpRight,
} from 'lucide-react';
import { useWorkLogStore, WorkLog, WorkEntry, WorkLogStatus } from '../store/useWorkLogStore';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useNavigate } from 'react-router-dom';
import { toast } from '../store/useToastStore';
import { AutoProEditor } from '../components/ui/proEditor.tsx';
import { formatDistanceToNow, format } from 'date-fns';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: {
  value: WorkLogStatus; label: string; chipClass: string; color: string; bg: string; border: string;
}[] = [
  { value: 'planning',    label: 'Planning',    chipClass: 'chip-planning',    color: 'text-[#2563EB] dark:text-blue-400',    bg: 'bg-[#EEF5FF] dark:bg-blue-500/10', border: 'border-blue-200/50' },
  { value: 'in-progress', label: 'In Progress', chipClass: 'chip-in-progress', color: 'text-[#0284C7] dark:text-sky-400',     bg: 'bg-[#E8F5FF] dark:bg-sky-500/10',  border: 'border-[#38BDF8]' },
  { value: 'reviewing',   label: 'Reviewing',   chipClass: 'chip-review',      color: 'text-[#7C3AED] dark:text-purple-400',  bg: 'bg-[#F5F3FF] dark:bg-purple-500/10', border: 'border-purple-200/50' },
  { value: 'blocked',     label: 'Blocked',     chipClass: 'chip-blocked',     color: 'text-[#DC2626] dark:text-red-400',     bg: 'bg-[#FFF1F2] dark:bg-red-500/10',    border: 'border-red-200/50' },
  { value: 'done',        label: 'Done',         chipClass: 'chip-done',        color: 'text-[#059669] dark:text-emerald-400', bg: 'bg-[#ECFDF5] dark:bg-emerald-500/10',border: 'border-emerald-200/50'},
];
const STATUS_EMOJI: Record<WorkLogStatus, string> = {
  'planning': '🗺️', 'in-progress': '⚡', 'reviewing': '👀', 'blocked': '🚫', 'done': '✅',
};
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

// ── Motion variants ───────────────────────────────────────────────────────────
const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

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
    <div className="relative group">
      <input className={`input text-sm w-full pr-8 rounded-xl ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder} value={val}
        onChange={e => { setVal(e.target.value); setSaved(false); }} />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {saved ? <Save size={11} className="text-surface-600" /> : <Loader2 size={11} className="text-brand-400 animate-spin" />}
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
    <div className="relative group">
      <textarea rows={rows} className="input resize-none text-sm w-full pr-8 rounded-xl"
        placeholder={placeholder} value={val}
        onChange={e => { setVal(e.target.value); setSaved(false); }} />
      <div className="absolute right-2.5 bottom-2.5">
        {saved ? <Save size={11} className="text-surface-600" /> : <Loader2 size={11} className="text-brand-400 animate-spin" />}
      </div>
    </div>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedValue({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState('0');
  const frameRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) { setDisplay(to.toFixed(decimals)); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / 700, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay((from + (to - from) * eased).toFixed(decimals));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, decimals]);
  return <>{display}</>;
}

// ── Timer Panel ───────────────────────────────────────────────────────────────
function TimerPanel({ log }: { log: WorkLog }) {
  const {
    startTimer, pauseTimer, resumeTimer, stopTimer,
    activeTaskId, activeTimerState, tasks, tick,
  } = useStore();
  const { syncTime } = useWorkLogStore();
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const linkedTaskId = log.taskRef?._id;
  const isThisActive = activeTaskId === linkedTaskId;
  const isRunning    = isThisActive && activeTimerState === 'running';
  const isPaused     = isThisActive && activeTimerState === 'paused';
  const liveTask = tasks.find(t => t.id === linkedTaskId);
  const liveSession = liveTask?.sessions[liveTask.sessions.length - 1];

  useEffect(() => {
    if (isRunning && liveSession) {
      const update = () => setElapsed(liveSession.activeTime);
      update();
      intervalRef.current = setInterval(() => { tick(); setElapsed(liveSession.activeTime); }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (isPaused && liveSession) setElapsed(liveSession.activeTime);
      else if (!isThisActive)      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isPaused, liveSession?.activeTime]);

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

  if (!linkedTaskId) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-850/50 p-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
            <Timer size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-200">No task linked</p>
            <p className="text-xs text-surface-400 mt-0.5">
              Link this work log to a task below to enable timer controls.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 mb-5 transition-all duration-300 ${
      isRunning
        ? 'border-amber-400/50 bg-gradient-to-br from-amber-500/5 to-surface-900 shadow-lg shadow-amber-500/10'
        : isPaused
        ? 'border-yellow-400/40 bg-yellow-500/5'
        : 'border-surface-800 bg-surface-850/50'
    }`}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {/* Timer icon with pulse */}
          <div className="relative flex items-center justify-center w-14 h-14 flex-shrink-0">
            {isRunning && (
              <>
                <motion.div className="absolute inset-0 rounded-2xl border-2 border-amber-500/30"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                <motion.div className="absolute inset-0 rounded-2xl border-2 border-amber-500/20"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
              </>
            )}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
              isRunning ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' :
              isPaused  ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' :
              'border-surface-700 bg-surface-800 text-surface-400'
            }`}>
              <Timer size={22} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-surface-400 mb-1">
              Tracking: <span style={{ color: log.taskRef?.color }} className="font-semibold">{log.taskRef?.title}</span>
            </p>
            <div className={`font-mono text-3xl lg:text-4xl font-extrabold tracking-wider ${
              isRunning ? 'text-amber-400' : isPaused ? 'text-amber-400/80' : 'text-surface-300'
            }`}>
              {isThisActive ? formatClock(elapsed) : formatClock(log.totalActiveMs)}
            </div>
            <p className="text-xs mt-1.5">
              {isRunning ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <motion.span className="inline-block w-2 h-2 rounded-full bg-amber-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }} />
                  Recording focus time
                </span>
              ) : isPaused ? (
                <span className="text-amber-400/80 font-medium">Paused</span>
              ) : (
                <span className="text-surface-500">
                  {log.totalActiveMs > 0 ? `${formatMs(log.totalActiveMs)} total logged` : 'Ready to start'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2.5">
          {activeTaskId && activeTaskId !== linkedTaskId && (
            <p className="text-xs text-amber-500 font-medium mr-2">Another task running</p>
          )}

          {!isThisActive && (!activeTaskId || activeTaskId === linkedTaskId) && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => startTimer(linkedTaskId)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2">
              <Play size={15} fill="white" /> Start
            </motion.button>
          )}
          {isRunning && (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => pauseTimer(linkedTaskId)}
              className="btn-secondary rounded-xl">
              <Pause size={15} /> Pause
            </motion.button>
          )}
          {isPaused && (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => resumeTimer(linkedTaskId)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2">
              <Play size={15} fill="white" /> Resume
            </motion.button>
          )}
          {isThisActive && (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={handleStop}
              className="btn-danger rounded-xl">
              <Square size={14} fill="currentColor" /> Stop
            </motion.button>
          )}
        </div>
      </div>

      {/* Session stats */}
      {isThisActive && liveSession && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-3 border-t border-surface-700/50 flex items-center gap-4 text-xs text-surface-400 flex-wrap">
          <span className="flex items-center gap-1"><Clock size={11} /> Started {format(new Date(liveSession.startTime), 'h:mm a')}</span>
          <span className="flex items-center gap-1"><Timer size={11} /> Paused: {formatMs(liveSession.totalPauseDuration)}</span>
          <span className="ml-auto text-surface-500 italic">Auto-saves on stop</span>
        </motion.div>
      )}
    </div>
  );
}

// ── Work entry row ────────────────────────────────────────────────────────────
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
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border p-4 transition-all ${
        today ? 'border-brand-500/30 bg-brand-500/5' : 'border-surface-800 bg-surface-850/50'
      }`}>
      {/* Timeline dot for today */}
      {today && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-brand-500" />}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={13} className={today ? 'text-brand-400' : 'text-surface-500'} />
          <span className={`text-sm font-semibold ${today ? 'text-brand-300' : 'text-surface-200'}`}>{dateLabel}</span>
          {today && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-500/15 text-brand-400 px-2 py-0.5 rounded-md border border-brand-500/20">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {entry.startedAt && (
            <span className="text-xs text-surface-400 flex items-center gap-1">
              <Clock size={11} /> {formatTime(entry.startedAt)} → {formatTime(entry.endedAt)}
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg ${
            entry.activeMs > 0
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-surface-800 text-surface-500'
          }`}>
            <Timer size={11} /> {formatMs(entry.activeMs)}
          </span>
        </div>
      </div>
      <AutoProEditor
        logId={logId} field={`entry_${entry._id}`} value={what}
        placeholder={today ? 'What are you working on today?' : 'What did you do on this day?'}
        minRows={2} hint="Supports **bold**, *italic*, - lists, `code`"
        updateFn={async (_id, _field, val) => { setWhat(val); await updateEntry(logId, entry._id, val); }}
      />
    </motion.div>
  );
}

// ── Time summary mini analytics ───────────────────────────────────────────────
function TimeSummaryPanel({ log }: { log: WorkLog }) {
  const totalMs     = log.totalActiveMs;
  const taskTotalMs = log.taskRef?.totalTime || 0;
  const entries     = log.workEntries;
  const daysWorked  = entries.filter(e => e.activeMs > 0).length;
  const avgMs       = daysWorked > 0 ? totalMs / daysWorked : 0;
  const activeEntries = entries.filter(e => e.activeMs > 0);

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <BarChart3 size={14} className="text-brand-400" />
        </div>
        <span className="text-sm font-bold text-surface-100">Time Analytics</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'This Log', value: formatMs(totalMs), color: 'text-brand-400' },
          ...(log.taskRef ? [{ label: 'Task Total', value: formatMs(taskTotalMs), color: 'text-purple-400' }] : []),
          { label: 'Days Active', value: String(daysWorked), color: 'text-amber-400' },
          { label: 'Daily Avg', value: formatMs(avgMs), color: 'text-emerald-400' },
        ].map((item, i) => (
          <div key={i} className="text-center p-3 rounded-xl bg-surface-850 border border-surface-800">
            <p className={`text-lg font-display font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-surface-400 mt-0.5 uppercase tracking-wider font-medium">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {activeEntries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-800">
          <p className="text-xs text-surface-400 mb-2.5 font-medium">Daily breakdown</p>
          <div className="flex items-end gap-1 h-14">
            {[...entries].reverse().slice(0, 14).map(entry => {
              const maxMs = Math.max(...entries.map(e => e.activeMs), 1);
              const pct   = (entry.activeMs / maxMs) * 100;
              const tod   = isToday(entry.date);
              return (
                <div key={entry._id} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <motion.div
                    className={`w-full rounded-sm transition-colors ${tod ? 'bg-brand-400' : 'bg-brand-600/50 group-hover:bg-brand-400'}`}
                    style={{ height: `${Math.max(4, pct)}%` }}
                    initial={{ height: 0 }} animate={{ height: `${Math.max(4, pct)}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }} />
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1 text-xs text-surface-50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
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

// ── Work history timeline ─────────────────────────────────────────────────────
function WorkHistorySection({ log }: { log: WorkLog }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden mb-5">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 p-4 hover:bg-surface-850/50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Calendar size={14} className="text-purple-400" />
        </div>
        <span className="text-sm font-bold text-surface-100">Work History</span>
        <span className="text-xs text-surface-500 font-medium">
          {log.workEntries.length} day{log.workEntries.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto">
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-surface-500" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-surface-800">
            <div className="p-4 space-y-3">
              {log.workEntries.length === 0 ? (
                <div className="text-center py-6">
                  <Clock size={24} className="text-surface-600 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">
                    {log.taskRef ? 'Start the timer — entries appear here after stopping' : 'Link a task to enable time tracking'}
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

// ── Task link control ─────────────────────────────────────────────────────────
function TaskLinkControl({ log }: { log: WorkLog }) {
  const { tasks } = useStore();
  const { linkTask } = useWorkLogStore();
  const [selected, setSelected] = useState(log.taskRef?._id || '');
  const [saving, setSaving] = useState(false);
  const activeTasks = tasks.filter(t => t.status !== 'completed' || t.id === log.taskRef?._id);
  useEffect(() => { setSelected(log.taskRef?._id || ''); }, [log.taskRef?._id]);

  const save = async () => {
    setSaving(true);
    try {
      await linkTask(log._id, selected || undefined);
      toast.success(selected ? 'Task linked' : 'Task unlinked', 'Work log time history has been refreshed.');
    } catch (err: any) {
      toast.error('Could not update task link', err.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-850/50 p-4 mb-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="flex items-center gap-1.5 text-xs text-surface-300 font-semibold mb-1.5">
            <Timer size={12} className="text-brand-400" /> Linked Task
          </label>
          <select className="input text-sm rounded-xl" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">No task link</option>
            {activeTasks.map(task => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={save}
          disabled={saving || selected === (log.taskRef?._id || '')}
          className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Link
        </button>
      </div>
      <p className="text-xs text-surface-500 mt-2">Changing the linked task refreshes this log's daily time history.</p>
    </div>
  );
}

// ── Section label component ───────────────────────────────────────────────────
function SectionLabel({ icon: Icon, color, label }: { icon: React.ElementType; color: string; label: string }) {
  return (
    <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${color}`}>
      <Icon size={12} /> {label}
    </label>
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
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { activeTaskId, activeTimerState } = useStore();
  const linkedTaskId  = log.taskRef?._id;
  const isThisActive  = activeTaskId === linkedTaskId && !!linkedTaskId;
  const isRunning     = isThisActive && activeTimerState === 'running';
  const status        = STATUS_OPTIONS.find(s => s.value === log.status) || STATUS_OPTIONS[1];
  const age           = formatDistanceToNow(new Date(log.createdAt), { addSuffix: true });
  const doneCount     = log.completedItems.length;

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
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
        isRunning ? 'border-brand-500/40 bg-surface-900 shadow-lg shadow-brand-500/10'
        : log.isActive ? 'border-surface-800 bg-surface-900 hover:border-surface-700'
        : 'border-surface-800 bg-surface-900/60 opacity-75'
      }`}>

      {/* Header */}
      <div className="flex items-center gap-3 p-5 cursor-pointer hover:bg-surface-850/30 transition-colors"
        onClick={() => navigate(`/worklog/${log._id}`)}>
        {/* Status dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          isRunning ? 'bg-brand-400 animate-pulse' :
          log.isActive ? 'bg-surface-500' : 'bg-surface-700'
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-surface-50 text-[15px]">{log.title}</span>
            <span className={`inline-flex items-center gap-1 badge text-[11px] font-semibold ${status.bg} ${status.color} border ${status.border} px-2 py-0.5 rounded-lg`}>
              {STATUS_EMOJI[log.status]} {status.label}
            </span>
            {log.gitBranch && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                <GitBranch size={10} /> {log.gitBranch}
              </span>
            )}
            {log.taskRef && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg font-semibold"
                style={{ background: `${log.taskRef.color}15`, color: log.taskRef.color }}>
                <Timer size={10} /> {log.taskRef.title}
              </span>
            )}
            {log.projectRef && (
              <span className="flex items-center gap-1 text-[11px] text-surface-400 bg-surface-800 px-2 py-0.5 rounded-lg">
                <FolderOpen size={10} /> {log.projectRef.name}
              </span>
            )}
            {isRunning && (
              <span className="text-[11px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-lg border border-brand-500/20 font-semibold">
                ● Timer running
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-surface-500">{age}</span>
            {log.totalActiveMs > 0 && (
              <span className="flex items-center gap-1 text-xs text-brand-400 font-mono font-medium">
                <Clock size={10} /> {formatMs(log.totalActiveMs)} logged
              </span>
            )}
            {log.taskRef && log.taskRef.totalTime > 0 && (
              <span className="flex items-center gap-1 text-xs text-purple-400 font-mono">
                <TrendingUp size={10} /> {formatMs(log.taskRef.totalTime)} task total
              </span>
            )}
            {doneCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={10} /> {doneCount} done
              </span>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-lg">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
          {log.googleDocUrl && (
            <button onClick={e => { e.stopPropagation(); window.open(log.googleDocUrl, "_blank", "noopener,noreferrer"); }}
              title="Open Google Document"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-all border border-blue-500/20 hover:border-blue-400/30">
              <ExternalLink size={12} /> Doc
            </button>
          )}
          {log.isActive ? (
            <button onClick={async () => { setClosing(true); try { await closeLog(log._id); } finally { setClosing(false); } }}
              disabled={closing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold transition-all border border-emerald-500/20">
              {closing ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />} Done
            </button>
          ) : (
            <button onClick={async () => { setContinuing(true); try { await continueLog(log._id); } finally { setContinuing(false); } }}
              disabled={continuing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded-lg text-xs font-semibold transition-all border border-brand-500/20">
              {continuing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Continue
            </button>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => deleteLog(log._id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-surface-700 text-surface-50 rounded-lg text-xs">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-surface-600 hover:text-red-400 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={15} className="text-surface-500 ml-1" />
          </motion.div>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-surface-800">
            <div className="p-5 space-y-5">

              {/* Status + Mood */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-400 font-medium">Status</span>
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.filter(s => s.value !== 'done').map(s => (
                      <button key={s.value} onClick={() => updateField(log._id, 'status', s.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          log.status === s.value
                            ? `${s.bg} ${s.color} ring-1 ring-current/30`
                            : 'bg-surface-800 text-surface-500 hover:text-surface-200 hover:bg-surface-700'
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-surface-400 font-medium">Energy</span>
                  {MOOD_EMOJIS.map((emoji, i) => (
                    <button key={i} onClick={() => updateField(log._id, 'mood', i + 1)}
                      className={`text-base transition-all ${log.mood === i + 1 ? 'scale-125' : 'opacity-30 hover:opacity-60'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task link + Timer */}
              <TaskLinkControl log={log} />
              <TimerPanel log={log} />

              {/* Time summary */}
              <TimeSummaryPanel log={log} />

              {/* Work history */}
              <WorkHistorySection log={log} />

              {/* Detail fields — two column */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <SectionLabel icon={AlertCircle} color="text-red-400" label="Problem I'm Solving" />
                    <AutoProEditor logId={log._id} field="problem" value={log.problem}
                      placeholder="What ticket/feature/bug? What user pain?" minRows={3}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>
                  <div>
                    <SectionLabel icon={GitBranch} color="text-emerald-400" label="Git Branch" />
                    <AutoInput logId={log._id} field="gitBranch"
                      placeholder="feature/branch-name" value={log.gitBranch} mono />
                  </div>
                  <div>
                    <SectionLabel icon={Zap} color="text-brand-400" label="What I'm Working On" />
                    <AutoProEditor logId={log._id} field="currentWork" value={log.currentWork}
                      placeholder="Specific function, component, API…" minRows={3}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>
                  <div>
                    <SectionLabel icon={AlertCircle} color="text-yellow-400" label="Blockers" />
                    <AutoProEditor logId={log._id} field="blockers" value={log.blockers}
                      placeholder="What's blocking you?" minRows={2}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Completed checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <SectionLabel icon={CheckCircle2} color="text-emerald-400" label="Completed" />
                      {doneCount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {doneCount}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 mb-2">
                      <AnimatePresence>
                        {log.completedItems.length === 0 && (
                          <p className="text-xs text-surface-600 italic py-1">Add things as you finish them…</p>
                        )}
                        {log.completedItems.map(item => (
                          <motion.div key={item._id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                            className="flex items-start gap-2 group p-2 rounded-lg hover:bg-surface-850 border border-transparent hover:border-surface-800 transition-all">
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
                      <input className="input flex-1 text-xs py-2 rounded-xl" placeholder="I just completed…"
                        value={newItem} onChange={e => setNewItem(e.target.value)} />
                      <button type="submit" disabled={!newItem.trim()}
                        className="btn-primary px-3 py-2 rounded-xl">
                        <Plus size={13} />
                      </button>
                    </form>
                  </div>

                  <div>
                    <SectionLabel icon={Lightbulb} color="text-yellow-400" label="Plan" />
                    <AutoProEditor logId={log._id} field="plan" value={log.plan}
                      placeholder={"1. First…\n2. Then…"} minRows={4}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>

                  <div>
                    <SectionLabel icon={Pencil} color="text-purple-400" label="Design / Architecture" />
                    <AutoProEditor logId={log._id} field="designNotes" value={log.designNotes}
                      placeholder="Schema, components, tradeoffs…" minRows={3}
                      updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                  </div>

                  {/* Links */}
                  <div>
                    <SectionLabel icon={Link2} color="text-cyan-400" label="Links" />
                    <div className="space-y-1.5 mb-2">
                      {log.links.map(link => (
                        <div key={link._id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-surface-850 border border-surface-800 group hover:border-surface-700 transition-all">
                          <ExternalLink size={11} className="text-cyan-400 flex-shrink-0" />
                          <a href={link.url} target="_blank" rel="noreferrer"
                            className="flex-1 text-xs text-cyan-300 hover:text-cyan-200 truncate font-medium">{link.label}</a>
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
                          <input className="input text-xs py-2 rounded-xl" placeholder="Label (PR #42…)"
                            value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))} />
                          <input className="input text-xs py-2 rounded-xl" type="url" placeholder="https://…"
                            value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowLinkForm(false)} className="btn-secondary flex-1 text-xs py-2 rounded-xl">Cancel</button>
                            <button type="submit" className="btn-primary flex-1 text-xs py-2 rounded-xl">Add</button>
                          </div>
                        </motion.form>
                      ) : (
                        <button onClick={() => setShowLinkForm(true)}
                          className="text-xs text-surface-500 hover:text-surface-200 flex items-center gap-1 transition-colors font-medium py-1">
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
            <Sparkles size={18} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-surface-50">New Work Log</h2>
            <p className="text-xs text-surface-400">Link a task for Start/Pause/Stop controls</p>
          </div>
        </div>
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-surface-300 font-medium mb-1.5">Work Item Title *</label>
            <input className="input rounded-xl" placeholder="e.g. Fix login bug, Build profile page…"
              value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm text-surface-300 font-medium mb-1.5">Link to Project</label>
            <select className="input rounded-xl" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">— Standalone (No project) —</option>
              {projects.map(p => (<option key={p._id} value={p._id}>{p.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-surface-300 font-medium mb-1.5">
              Link to Task <span className="text-surface-500 text-xs">(enables timer controls)</span>
            </label>
            <select className="input rounded-xl" value={taskRefId} onChange={e => handleTaskChange(e.target.value)}>
              <option value="">— No task link —</option>
              {activeTasks.map(t => (<option key={t.id} value={t.id}>{t.title}</option>))}
            </select>
            {taskRefId && (
              <p className="text-xs text-brand-400 mt-1.5 flex items-center gap-1">
                <Play size={11} /> Timer controls will appear in the work log
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 rounded-xl">Cancel</button>
            <button type="submit" disabled={creating || !title.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-xl">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function ProductivitySidebar({ activeLogs, closedLogs }: { activeLogs: WorkLog[]; closedLogs: WorkLog[] }) {
  const { profile, tasks, activeTaskId, activeTimerState } = useStore();
  const accent = '#0ea5e9';

  const totalActiveMs = activeLogs.reduce((s, l) => s + l.totalActiveMs, 0);
  const blockedCount  = activeLogs.filter(l => l.status === 'blocked').length;
  const completedToday = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-4 sticky top-24">
      {/* Quick stats */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
        <h3 className="font-display font-bold text-surface-50 text-[15px] mb-4">Workspace</h3>
        <div className="space-y-3">
          {[
            { icon: Clock, label: 'Active Logs', value: String(activeLogs.length), color: 'text-brand-400', bg: 'bg-brand-500/10' },
            { icon: TrendingUp, label: 'Total Time', value: formatMs(totalActiveMs), color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { icon: CheckCircle2, label: 'Completed', value: String(closedLogs.length), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { icon: Flame, label: 'Streak', value: `${profile.streak?.current || 0}d`, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-surface-400 font-medium">{label}</p>
                <p className="text-sm font-bold text-surface-100">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked warning */}
      {blockedCount > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-sm font-semibold text-red-400">{blockedCount} blocked</span>
          </div>
          <p className="text-xs text-red-400/70">Some work logs need attention</p>
        </div>
      )}

      {/* Active timer */}
      {activeTaskId && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <motion.div className="w-2 h-2 rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            <span className="text-sm font-semibold text-amber-400">Timer Active</span>
          </div>
          <p className="text-xs text-amber-400/70 capitalize">{activeTimerState}</p>
        </div>
      )}

      {/* Recent logs */}
      {activeLogs.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="font-display font-bold text-surface-50 text-[13px] mb-3">Recent Work</h3>
          <div className="space-y-2">
            {activeLogs.slice(0, 4).map(log => (
              <div key={log._id} className="flex items-center gap-2 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  log.status === 'blocked' ? 'bg-red-400' : log.status === 'in-progress' ? 'bg-brand-400' : 'bg-surface-600'
                }`} />
                <span className="text-xs text-surface-300 truncate flex-1">{log.title}</span>
                {log.totalActiveMs > 0 && (
                  <span className="text-[10px] text-surface-500 font-mono">{formatMs(log.totalActiveMs)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function WorkLogPage() {
  const { activeLogs, closedLogs, loading, loadAll } = useWorkLogStore();
  const { profile, activeTaskId, activeTimerState } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<WorkLogStatus | 'all'>('all');

  useEffect(() => { loadAll(); }, []);

  const totalActiveMs = activeLogs.reduce((s, l) => s + l.totalActiveMs, 0);
  const blockedCount = activeLogs.filter(l => l.status === 'blocked').length;

  const filteredActive = useMemo(() => {
    let logs = activeLogs;
    if (search.trim()) {
      const q = search.toLowerCase();
      logs = logs.filter(l => l.title.toLowerCase().includes(q) || l.taskRef?.title?.toLowerCase().includes(q) || l.gitBranch?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') logs = logs.filter(l => l.status === filterStatus);
    return logs;
  }, [activeLogs, search, filterStatus]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">

      {/* ═══ Workspace Header ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
              Work Logs
              <span className="text-xs font-bold text-surface-400 bg-surface-800 px-2.5 py-1 rounded-lg">
                {activeLogs.length} active
              </span>
            </h1>
            <p className="text-surface-400 text-sm mt-1">
              {formatMs(totalActiveMs)} tracked today · {closedLogs.length} completed
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/20">
            <Plus size={16} /> New Work Log
          </button>
        </div>

        {/* Search + Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input className="input h-10 pl-9 pr-4 rounded-xl text-sm"
              placeholder="Search work logs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', ...STATUS_OPTIONS.map(s => s.value)] as const).map(val => {
              const label = val === 'all' ? 'All' : STATUS_OPTIONS.find(s => s.value === val)?.label;
              const isActive = filterStatus === val;
              return (
                <button key={val} onClick={() => setFilterStatus(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                      : 'bg-surface-800 text-surface-400 border border-surface-800 hover:text-surface-200 hover:border-surface-700'
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ═══ Stats + Alerts (top) ═══ */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Clock, label: 'Active Logs', value: String(activeLogs.length), color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { icon: TrendingUp, label: 'Total Time', value: formatMs(totalActiveMs), color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: CheckCircle2, label: 'Completed', value: String(closedLogs.length), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: Flame, label: 'Streak', value: `${profile?.streak?.current || 0}d`, color: 'text-orange-400', bg: 'bg-orange-500/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <motion.div key={label} variants={fadeUp}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-[11px] text-surface-400 font-medium">{label}</p>
              <p className="text-lg font-display font-bold text-surface-100">{value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Alerts row */}
      {(blockedCount > 0 || activeTaskId) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {blockedCount > 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <div>
                <span className="text-sm font-semibold text-red-400">{blockedCount} blocked</span>
                <p className="text-xs text-red-400/70">Some work logs need attention</p>
              </div>
            </div>
          )}
          {activeTaskId && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
              <motion.div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <div>
                <span className="text-sm font-semibold text-amber-400">Timer Active</span>
                <p className="text-xs text-amber-400/70 capitalize">{activeTimerState}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Main content ═══ */}
      <div className="space-y-4 min-w-0">
          {loading && activeLogs.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24 rounded-lg" />
                      <Skeleton className="h-5 w-16 rounded-lg" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              ))}
            </div>
          ) : filteredActive.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-surface-700 bg-surface-900 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                <BookMarked size={28} className="text-brand-400" />
              </div>
              <h3 className="font-display font-bold text-surface-100 text-lg mb-2">No work logs found</h3>
              <p className="text-sm text-surface-400 max-w-sm mx-auto mb-5">
                Create a work log and link it to a task. You'll get timer controls and time tracking right inside the card.
              </p>
              <button onClick={() => setShowCreate(true)}
                className="btn-primary mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/20">
                <Plus size={15} /> Create First Work Log
              </button>
            </motion.div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {filteredActive.map((log, i) => (
                <WorkLogCard key={log._id} log={log} defaultExpanded={i === 0 && !search && filterStatus === 'all'} />
              ))}
            </motion.div>
          )}

          {/* Closed logs */}
          {closedLogs.length > 0 && (
            <div className="mt-6">
              <button onClick={() => setShowClosed(!showClosed)}
                className="flex items-center gap-2 text-surface-400 hover:text-surface-50 text-sm font-semibold transition-colors mb-3">
                <CheckCheck size={15} className="text-emerald-400" />
                Completed ({closedLogs.length})
                <motion.div animate={{ rotate: showClosed ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={14} />
                </motion.div>
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
        </div>

      <AnimatePresence>
        {showCreate && <CreateLogModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}

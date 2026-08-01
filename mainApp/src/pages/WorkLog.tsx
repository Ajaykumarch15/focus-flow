import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, AlertCircle, CheckCircle2, Plus, Trash2,
  ExternalLink, Link2, Lightbulb, Pencil, BookMarked,
  Zap, Loader2, ChevronDown, ChevronRight, Save,
  CheckCheck, RotateCcw, X, Sparkles, Clock,
  Calendar, TrendingUp, Play, Pause, Square, Timer, FolderOpen,
  Search, BarChart3, Flame, ArrowUpRight, AlertOctagon, Layers, Eye,
  Download,
} from 'lucide-react';
import { useWorkLogStore, WorkLog, WorkEntry, WorkLogStatus } from '../store/useWorkLogStore';
import { WorkLogExporterModal } from '../components/worklog/WorkLogExporterModal';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useNavigate } from 'react-router-dom';
import { toast } from '../store/useToastStore';
import { AutoProEditor } from '../components/ui/proEditor.tsx';
import { formatDistanceToNow, format, subDays, isToday as dfIsToday } from 'date-fns';
import { Skeleton } from '../components/ui/Skeleton';
import { isToday as isTodayCentral } from '../utils/time';

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
const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];
const MOOD_LABELS = ['Exhausted', 'Meh', 'Okay', 'Good', 'Fired up'];

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
  return isTodayCentral(dateStr);
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

// ── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string; icon: React.ElementType; color: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800">
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              isActive ? 'text-surface-50' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
            }`}>
            {isActive && (
              <motion.div layoutId="activeTab"
                className="absolute inset-0 bg-surface-700/80 rounded-lg border border-surface-600/30"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />
            )}
            <span className="relative flex items-center gap-1.5">
              <tab.icon size={13} className={isActive ? tab.color : ''} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                  isActive ? 'bg-surface-600 text-surface-200' : 'bg-surface-800 text-surface-500'
                }`}>{tab.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Collapsible field card ───────────────────────────────────────────────────
function FieldCard({ icon: Icon, color, bg, label, value, children, field, expandedFields, toggleField }: {
  icon: React.ElementType; color: string; bg: string; label: string; value: string;
  children: React.ReactNode; field: string; expandedFields: Set<string>; toggleField: (f: string) => void;
}) {
  const isOpen = expandedFields.has(field);
  const preview = value ? value.replace(/[#*_`>\-[\]]/g, '').replace(/\n+/g, ' ').trim().slice(0, 90) : '';

  return (
    <motion.div layout
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${
        isOpen ? 'border-surface-700 bg-surface-900 shadow-lg shadow-black/10' : 'border-surface-800 bg-surface-850/40 hover:border-surface-700 hover:bg-surface-850/70'
      }`}>
      <button onClick={() => toggleField(field)}
        className="w-full flex items-center gap-3 p-4 text-left transition-colors">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={14} className={color} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-surface-200">{label}</span>
          {!isOpen && (
            <p className={`text-[11px] mt-0.5 truncate ${preview ? 'text-surface-500' : 'text-surface-600 italic'}`}>
              {preview || 'Click to start writing...'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isOpen && value && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Has content" />
          )}
          <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight size={14} className="text-surface-500" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-surface-800">
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Metric pill ────────────────────────────────────────────────────────────────
function MetricPill({ icon: Icon, value, label, color }: {
  icon: React.ElementType; value: string | number; label: string; color: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-surface-800/80 border border-surface-700/50 ${color}`}>
      <Icon size={11} />
      <span className="font-semibold">{value}</span>
      <span className="text-surface-500 font-normal">{label}</span>
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
  const [activeTab, setActiveTab]         = useState('context');
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [newItem, setNewItem]             = useState('');
  const [newLink, setNewLink]             = useState({ label: '', url: '' });
  const [showLinkForm, setShowLinkForm]   = useState(false);
  const [closing, setClosing]             = useState(false);
  const [continuing, setContinuing]       = useState(false);
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showExport, setShowExport]       = useState(false);

  const { activeTaskId, activeTimerState } = useStore();
  const linkedTaskId  = log.taskRef?._id;
  const isThisActive  = activeTaskId === linkedTaskId && !!linkedTaskId;
  const isRunning     = isThisActive && activeTimerState === 'running';
  const status        = STATUS_MAP[log.status] || STATUS_MAP['in-progress'];
  const age           = formatDistanceToNow(new Date(log.createdAt), { addSuffix: true });
  const doneCount     = log.completedItems.length;
  const blockerCount  = (log.blockerList || []).filter(b => b.status !== 'resolved').length;
  const decisionsCount = (log.decisions || []).length;

  const toggleField = (field: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };

  const hasContext = !!(log.problem || log.currentWork || log.blockers);
  const hasPlanning = !!(log.plan || log.designNotes || log.gitBranch);
  const hasProgress = !!(log.completedItems.length || log.links.length);

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

      {/* Running indicator strip */}
      {isRunning && (
        <div className="h-0.5 bg-gradient-to-r from-brand-500 via-sky-400 to-brand-500" />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 p-5 cursor-pointer hover:bg-surface-850/20 transition-colors"
        onClick={() => setExpanded(e => !e)}>

        {/* Status emoji icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base mt-0.5 ${status.bg} border ${status.border}`}>
          {status.emoji}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + live badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-semibold text-surface-50 text-[15px] leading-tight">{log.title}</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20 font-bold uppercase tracking-wide">
                <motion.span className="w-1.5 h-1.5 rounded-full bg-brand-400 inline-block"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                Live
              </span>
            )}
          </div>

          {/* Meta chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${status.color} ${status.bg} ${status.border}`}>
              {status.label}
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
              <span className="flex items-center gap-1 text-[11px] text-surface-400 bg-surface-800 px-2 py-0.5 rounded-lg border border-surface-700/50">
                <FolderOpen size={10} /> {log.projectRef.name}
              </span>
            )}
          </div>

          {/* At-a-glance metrics */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-xs text-surface-500">{age}</span>
            <span className="text-surface-700">·</span>
            <span className="text-lg" title={MOOD_LABELS[(log.mood || 3) - 1]}>{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
            {log.totalActiveMs > 0 && (
              <MetricPill icon={Clock} value={formatMs(log.totalActiveMs)} label="logged" color="text-brand-400" />
            )}
            {doneCount > 0 && (
              <MetricPill icon={CheckCircle2} value={doneCount} label="done" color="text-emerald-400" />
            )}
            {blockerCount > 0 && (
              <MetricPill icon={AlertOctagon} value={blockerCount} label={blockerCount === 1 ? 'blocker' : 'blockers'} color="text-red-400" />
            )}
            {decisionsCount > 0 && (
              <MetricPill icon={Lightbulb} value={decisionsCount} label={decisionsCount === 1 ? 'decision' : 'decisions'} color="text-amber-400" />
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2" onClick={e => e.stopPropagation()}>
          {log.googleDocUrl && (
            <button onClick={() => window.open(log.googleDocUrl, '_blank', 'noopener,noreferrer')}
              title="Open Google Doc"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-all border border-blue-500/20">
              <ExternalLink size={11} />
            </button>
          )}
          <button onClick={() => navigate(`/worklog/${log._id}`)}
            title="View full details"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded-lg text-xs font-semibold transition-all border border-brand-500/20">
            <Eye size={12} /> Details
          </button>
          <button onClick={() => setShowExport(true)}
            title="Export"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-400 rounded-lg text-xs transition-all border border-surface-700">
            <Download size={12} />
          </button>
          {log.isActive ? (
            <button onClick={async () => { setClosing(true); try { await closeLog(log._id); } finally { setClosing(false); } }}
              disabled={closing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold transition-all border border-emerald-500/20">
              {closing ? <Loader2 size={11} className="animate-spin" /> : <CheckCheck size={11} />} Done
            </button>
          ) : (
            <button onClick={async () => { setContinuing(true); try { await continueLog(log._id); } finally { setContinuing(false); } }}
              disabled={continuing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded-lg text-xs font-semibold transition-all border border-brand-500/20">
              {continuing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Continue
            </button>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => deleteLog(log._id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-surface-700 text-surface-50 rounded-lg text-xs">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-surface-600 hover:text-red-400 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="cursor-pointer"
            onClick={() => setExpanded(e => !e)}>
            <ChevronDown size={15} className="text-surface-500 ml-0.5" />
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
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-surface-400 font-medium">Energy</span>
                  {MOOD_EMOJIS.map((emoji, i) => (
                    <button key={i} onClick={() => updateField(log._id, 'mood', i + 1)}
                      title={MOOD_LABELS[i]}
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

              {/* Detail fields — tabbed card layout */}
              <div>
                <TabBar
                  active={activeTab}
                  onChange={setActiveTab}
                  tabs={[
                    { id: 'context', label: 'Context', icon: AlertCircle, color: 'text-red-400', count: hasContext ? undefined : 0 },
                    { id: 'planning', label: 'Planning', icon: Lightbulb, color: 'text-amber-400', count: hasPlanning ? undefined : 0 },
                    { id: 'progress', label: 'Progress', icon: CheckCircle2, color: 'text-emerald-400', count: doneCount },
                  ]}
                />

                <div className="mt-3">
                  <AnimatePresence mode="wait">
                    {/* ── Context Tab ─────────────────────────────────────── */}
                    {activeTab === 'context' && (
                      <motion.div key="context" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}
                        className="space-y-3">
                        <FieldCard icon={AlertCircle} color="text-red-400" bg="bg-red-500/10"
                          label="Problem I'm Solving" value={log.problem} field="problem"
                          expandedFields={expandedFields} toggleField={toggleField}>
                          <AutoProEditor logId={log._id} field="problem" value={log.problem}
                            placeholder="What ticket/feature/bug? What user pain?" minRows={3}
                            updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                        </FieldCard>

                        <FieldCard icon={Zap} color="text-brand-400" bg="bg-brand-500/10"
                          label="What I'm Working On" value={log.currentWork} field="currentWork"
                          expandedFields={expandedFields} toggleField={toggleField}>
                          <AutoProEditor logId={log._id} field="currentWork" value={log.currentWork}
                            placeholder="Specific function, component, API..." minRows={3}
                            updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                        </FieldCard>

                        <FieldCard icon={AlertCircle} color="text-yellow-400" bg="bg-yellow-500/10"
                          label="Blockers" value={log.blockers} field="blockers"
                          expandedFields={expandedFields} toggleField={toggleField}>
                          <AutoProEditor logId={log._id} field="blockers" value={log.blockers}
                            placeholder="What's blocking you?" minRows={2}
                            updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                        </FieldCard>
                      </motion.div>
                    )}

                    {/* ── Planning Tab ────────────────────────────────────── */}
                    {activeTab === 'planning' && (
                      <motion.div key="planning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}
                        className="space-y-3">
                        <FieldCard icon={Lightbulb} color="text-amber-400" bg="bg-amber-500/10"
                          label="Plan" value={log.plan} field="plan"
                          expandedFields={expandedFields} toggleField={toggleField}>
                          <AutoProEditor logId={log._id} field="plan" value={log.plan}
                            placeholder={"1. First...\n2. Then..."} minRows={4}
                            updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                        </FieldCard>

                        <FieldCard icon={Pencil} color="text-purple-400" bg="bg-purple-500/10"
                          label="Design / Architecture" value={log.designNotes} field="designNotes"
                          expandedFields={expandedFields} toggleField={toggleField}>
                          <AutoProEditor logId={log._id} field="designNotes" value={log.designNotes}
                            placeholder="Schema, components, tradeoffs..." minRows={3}
                            updateFn={(id, field, val) => useWorkLogStore.getState().updateField(id, field, val)} />
                        </FieldCard>

                        <FieldCard icon={GitBranch} color="text-emerald-400" bg="bg-emerald-500/10"
                          label="Git Branch" value={log.gitBranch} field="gitBranch"
                          expandedFields={expandedFields} toggleField={toggleField}>
                          <AutoInput logId={log._id} field="gitBranch"
                            placeholder="feature/branch-name" value={log.gitBranch} mono />
                        </FieldCard>
                      </motion.div>
                    )}

                    {/* ── Progress Tab ────────────────────────────────────── */}
                    {activeTab === 'progress' && (
                      <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}
                        className="space-y-3">

                        {/* Completed checklist — always expanded */}
                        <div className="rounded-xl border border-surface-800 bg-surface-900 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            </div>
                            <span className="text-xs font-semibold text-surface-200">Completed</span>
                            {doneCount > 0 && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                {doneCount}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 mb-3">
                            <AnimatePresence>
                              {log.completedItems.length === 0 && (
                                <p className="text-xs text-surface-600 italic py-1">Add things as you finish them...</p>
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
                            <input className="input flex-1 text-xs py-2 rounded-xl" placeholder="I just completed..."
                              value={newItem} onChange={e => setNewItem(e.target.value)} />
                            <button type="submit" disabled={!newItem.trim()}
                              className="btn-primary px-3 py-2 rounded-xl">
                              <Plus size={13} />
                            </button>
                          </form>
                        </div>

                        {/* Links card */}
                        <FieldCard icon={Link2} color="text-cyan-400" bg="bg-cyan-500/10"
                          label="Links" value={log.links.map(l => l.label).join(', ')} field="links"
                          expandedFields={expandedFields} toggleField={toggleField}>
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
                                <input className="input text-xs py-2 rounded-xl" placeholder="Label (PR #42...)"
                                  value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))} />
                                <input className="input text-xs py-2 rounded-xl" type="url" placeholder="https://..."
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
                        </FieldCard>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export modal */}
      <WorkLogExporterModal
        workLog={log}
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </motion.div>
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
      className="rounded-xl border border-surface-800/70 bg-surface-900/60 p-4 flex items-center gap-3 hover:border-surface-700/70 transition-all group">
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
        <button onClick={() => navigate(`/worklog/${log._id}`)}
          className="p-1.5 text-surface-500 hover:text-brand-400 rounded-lg transition-colors" title="View details">
          <Eye size={13} />
        </button>
        <button onClick={async () => { setContinuing(true); try { await continueLog(log._id); } finally { setContinuing(false); } }}
          disabled={continuing}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded-lg text-xs font-semibold transition-all border border-brand-500/20">
          {continuing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Continue
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={() => deleteLog(log._id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-surface-700 text-surface-50 rounded-lg text-xs">No</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-surface-600 hover:text-red-400 rounded-lg transition-colors">
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

// ── Activity Heatmap ───────────────────────────────────────────────────────────
function ActivityHeatmap({ allLogs }: { allLogs: WorkLog[] }) {
  const days = 35;
  const cells = useMemo(() => {
    const result: { date: Date; ms: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const key  = format(date, 'yyyy-MM-dd');
      let totalMs = 0;
      for (const log of allLogs) {
        for (const entry of log.workEntries) {
          if (entry.date.startsWith(key)) totalMs += entry.activeMs;
        }
      }
      result.push({ date, ms: totalMs });
    }
    return result;
  }, [allLogs]);

  const maxMs = Math.max(...cells.map(c => c.ms), 1);

  const getColor = (ms: number) => {
    if (ms === 0) return 'bg-surface-800';
    const pct = ms / maxMs;
    if (pct < 0.25) return 'bg-brand-900/80';
    if (pct < 0.5)  return 'bg-brand-700/80';
    if (pct < 0.75) return 'bg-brand-500/80';
    return 'bg-brand-400';
  };

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <Flame size={14} className="text-brand-400" />
        </div>
        <span className="text-sm font-bold text-surface-100">Activity</span>
        <span className="text-xs text-surface-500 ml-auto">Last {days}d</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const isToday = dfIsToday(cell.date);
          return (
            <div key={i} className="relative group">
              <div className={`aspect-square rounded-sm transition-all cursor-default ${getColor(cell.ms)} ${
                isToday ? 'ring-1 ring-brand-400 ring-offset-1 ring-offset-surface-900' : ''
              }`} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-100 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl text-center">
                <p className="font-semibold">{format(cell.date, 'MMM d')}</p>
                <p className="text-surface-400">{cell.ms > 0 ? formatMs(cell.ms) : 'No activity'}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 mt-3 justify-end">
        <span className="text-[10px] text-surface-600">Less</span>
        {['bg-surface-800', 'bg-brand-900/80', 'bg-brand-700/80', 'bg-brand-500/80', 'bg-brand-400'].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-[10px] text-surface-600">More</span>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function ProductivitySidebar({ activeLogs, closedLogs, allLogs }: {
  activeLogs: WorkLog[]; closedLogs: WorkLog[]; allLogs: WorkLog[];
}) {
  const { profile, activeTaskId, activeTimerState } = useStore();
  const navigate = useNavigate();

  const totalActiveMs  = activeLogs.reduce((s, l) => s + l.totalActiveMs, 0);
  const blockedLogs    = activeLogs.filter(l => l.status === 'blocked');
  const totalDecisions = activeLogs.reduce((s, l) => s + (l.decisions?.length || 0), 0);
  const totalCompleted = activeLogs.reduce((s, l) => s + l.completedItems.length, 0);

  return (
    <div className="space-y-4 sticky top-24">
      {/* Workspace stats grid */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
        <h3 className="font-display font-bold text-surface-50 text-[14px] mb-4 flex items-center gap-2">
          <Layers size={14} className="text-brand-400" /> Workspace
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Active', value: String(activeLogs.length), color: 'text-brand-400', bg: 'bg-brand-500/10', icon: BookMarked },
            { label: 'Time', value: formatMs(totalActiveMs), color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Clock },
            { label: 'Done', value: String(closedLogs.length), color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
            { label: 'Streak', value: `${profile?.streak?.current || 0}d`, color: 'text-orange-400', bg: 'bg-orange-500/10', icon: Flame },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={`rounded-xl p-3 ${bg} border border-surface-700/30`}>
              <p className={`text-base font-display font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-surface-400 font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        {(totalCompleted > 0 || totalDecisions > 0) && (
          <div className="mt-3 pt-3 border-t border-surface-800 flex items-center gap-4 text-xs text-surface-400">
            {totalCompleted > 0 && <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" /> {totalCompleted} items</span>}
            {totalDecisions > 0 && <span className="flex items-center gap-1"><Lightbulb size={11} className="text-amber-400" /> {totalDecisions} decisions</span>}
          </div>
        )}
      </div>

      {/* Active timer */}
      {activeTaskId && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <motion.div className="w-2 h-2 rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            <span className="text-sm font-semibold text-amber-400">Timer Active</span>
          </div>
          <p className="text-xs text-amber-400/60 capitalize">{activeTimerState}</p>
        </div>
      )}

      {/* Blocked logs */}
      {blockedLogs.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon size={14} className="text-red-400" />
            <span className="text-sm font-semibold text-red-400">{blockedLogs.length} blocked</span>
          </div>
          <div className="space-y-1.5">
            {blockedLogs.slice(0, 3).map(log => (
              <button key={log._id} onClick={() => navigate(`/worklog/${log._id}`)}
                className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-red-500/10 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300/80 truncate">{log.title}</span>
                <ArrowUpRight size={10} className="text-red-400/60 flex-shrink-0 ml-auto" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity heatmap */}
      <ActivityHeatmap allLogs={allLogs} />

      {/* Recent active logs */}
      {activeLogs.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="font-display font-bold text-surface-50 text-[13px] mb-3 flex items-center gap-2">
            <TrendingUp size={13} className="text-brand-400" /> Recent Work
          </h3>
          <div className="space-y-1">
            {activeLogs.slice(0, 5).map(log => {
              const s = STATUS_MAP[log.status];
              return (
                <button key={log._id} onClick={() => navigate(`/worklog/${log._id}`)}
                  className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-800 transition-colors text-left group">
                  <span className="text-sm flex-shrink-0">{s?.emoji}</span>
                  <span className="text-xs text-surface-300 truncate flex-1 group-hover:text-surface-100 transition-colors">{log.title}</span>
                  {log.totalActiveMs > 0 && (
                    <span className="text-[10px] text-surface-500 font-mono flex-shrink-0">{formatMs(log.totalActiveMs)}</span>
                  )}
                </button>
              );
            })}
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

  const allLogs        = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);
  const totalActiveMs  = activeLogs.reduce((s, l) => s + l.totalActiveMs, 0);
  const totalCompleted = activeLogs.reduce((s, l) => s + l.completedItems.length, 0);

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

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto">

      {/* ═══ Header ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight">Work Logs</h1>
            <p className="text-surface-400 text-sm mt-1">
              {activeLogs.length} active · {formatMs(totalActiveMs)} tracked · {closedLogs.length} completed
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/20 self-start sm:self-auto">
            <Plus size={16} /> New Work Log
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input className="input h-10 pl-9 pr-9 rounded-xl text-sm"
              placeholder="Search logs, tasks, branches…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', ...STATUS_OPTIONS.map(s => s.value)] as const).map(val => {
              const opt   = STATUS_OPTIONS.find(s => s.value === val);
              const label = val === 'all' ? 'All' : opt?.label;
              const count = val === 'all' ? activeLogs.length : activeLogs.filter(l => l.status === val).length;
              const isActive = filterStatus === val;
              return (
                <button key={val} onClick={() => setFilterStatus(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                      : 'bg-surface-800 text-surface-400 border border-surface-800 hover:text-surface-200 hover:border-surface-700'
                  }`}>
                  {val !== 'all' && opt?.emoji} {label}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-700 text-surface-400'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ═══ Stats bar ═══ */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { icon: BookMarked, label: 'Active Logs', display: String(activeLogs.length), color: 'text-brand-400', bg: 'from-brand-500/10 to-brand-500/5', border: 'border-brand-500/15', sub: `${filteredActive.length} shown` },
          { icon: Clock,      label: 'Time Logged', display: formatMs(totalActiveMs),    color: 'text-purple-400', bg: 'from-purple-500/10 to-purple-500/5', border: 'border-purple-500/15', sub: `across ${activeLogs.length} logs` },
          { icon: CheckCircle2, label: 'Items Done', display: String(totalCompleted),   color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/15', sub: 'in active logs' },
          { icon: Flame,      label: 'Streak',       display: `${profile?.streak?.current || 0}d`, color: 'text-orange-400', bg: 'from-orange-500/10 to-orange-500/5', border: 'border-orange-500/15', sub: profile?.streak?.best ? `best ${profile.streak.best}d` : 'keep going!' },
        ].map(({ icon: Icon, label, display, color, bg, border, sub }) => (
          <motion.div key={label} variants={fadeUp}
            className={`rounded-2xl border ${border} bg-gradient-to-br ${bg} p-5`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-surface-800/60 flex items-center justify-center">
                <Icon size={16} className={color} />
              </div>
              <span className={`text-2xl font-display font-extrabold ${color}`}>{display}</span>
            </div>
            <p className="text-xs font-semibold text-surface-300">{label}</p>
            <p className="text-[10px] text-surface-500 mt-0.5">{sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ Main 2-col layout ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">

        {/* Left — log list */}
        <div className="min-w-0 space-y-4">
          {loading && activeLogs.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
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
              className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/50 p-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 flex items-center justify-center mx-auto mb-4 border border-brand-500/20">
                <BookMarked size={28} className="text-brand-400" />
              </div>
              <h3 className="font-display font-bold text-surface-100 text-lg mb-2">No work logs yet</h3>
              <p className="text-sm text-surface-400 max-w-sm mx-auto mb-6">
                Create a work log for any feature, bug, or task. Link it to a task to unlock timer controls and automatic time tracking.
              </p>
              <button onClick={() => setShowCreate(true)}
                className="btn-primary mx-auto flex items-center gap-2 px-6 py-3 rounded-xl shadow-lg shadow-brand-500/20">
                <Plus size={15} /> Create First Work Log
              </button>
            </motion.div>
          ) : filteredActive.length === 0 && search ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/50 p-10 text-center">
              <Search size={24} className="text-surface-600 mx-auto mb-3" />
              <p className="text-sm text-surface-400">No logs matching <span className="text-surface-200 font-medium">"{search}"</span></p>
              <button onClick={() => setSearch('')} className="text-xs text-brand-400 hover:text-brand-300 mt-2 transition-colors">Clear search</button>
            </motion.div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {filteredActive.map((log, i) => (
                <WorkLogCard key={log._id} log={log} defaultExpanded={i === 0 && !search && filterStatus === 'all'} />
              ))}
            </motion.div>
          )}

          {/* Closed logs section */}
          {filteredClosed.length > 0 && (
            <div className="mt-6">
              <button onClick={() => setShowClosed(!showClosed)}
                className="flex items-center gap-2 text-surface-400 hover:text-surface-50 text-sm font-semibold transition-colors mb-3 group">
                <CheckCheck size={15} className="text-emerald-400" />
                Completed
                <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-full font-normal group-hover:bg-surface-700 transition-colors">
                  {filteredClosed.length}
                </span>
                <motion.div animate={{ rotate: showClosed ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={14} />
                </motion.div>
              </button>
              <AnimatePresence>
                {showClosed && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                    {filteredClosed.map(log => <ClosedLogCard key={log._id} log={log} />)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right — Sidebar */}
        <ProductivitySidebar activeLogs={activeLogs} closedLogs={closedLogs} allLogs={allLogs} />
      </div>

      <AnimatePresence>
        {showCreate && <CreateLogModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}

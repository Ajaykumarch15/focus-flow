import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, Square, StickyNote, AlertTriangle, Target,
  CheckCircle2, ArrowRight,
} from 'lucide-react';
import { usePersonalTaskStore } from '../../store/usePersonalTaskStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { formatDuration, formatHours, formatDateShort } from '../../utils/time';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Skeleton } from '../ui/Skeleton';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
      <dt className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold">{label}</dt>
      <dd className="text-lg font-display font-bold text-surface-50 mt-0.5 truncate">{value}</dd>
    </div>
  );
}

export function PersonalFocusSessionPanel() {
  const {
    tasks,
    loading,
    error,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    toggleSubtask,
    addJournal,
    getJournalsForTask,
  } = usePersonalTaskStore();
  const { display } = useActiveTimer();
  const navigate = useNavigate();

  const [focusTaskId, setFocusTaskId] = useState<string>('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const activeSnapshot = useActiveTimer();
  const activeTaskId = activeSnapshot.activeTaskId;
  const activeTimerState = activeSnapshot.activeTimerState;

  const candidates: { id: string; title: string }[] = useMemo(() =>
    tasks.filter((t) => t.status !== 'completed').map((t) => ({ id: t.id, title: t.title })),
    [tasks]
  );

  // Resolve the active task from timer engine or focused task
  const targetId = focusTaskId || activeTaskId;
  const activeTask = targetId ? tasks.find((t) => t.id === targetId) : null;
  const taskJournals = activeTask ? getJournalsForTask(activeTask.id) : [];
  const latestNote = taskJournals[0];

  // ── Loading / error / empty ────────────────────────────────────────────────
  if (loading && tasks.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-8">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded mt-3" />
        </div>
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-8 flex flex-col items-center gap-3">
          <Skeleton className="h-16 w-44 rounded-lg" />
          <Skeleton className="h-8 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 p-4 flex items-center gap-3" role="alert">
          <AlertTriangle size={18} className="text-danger-500 flex-shrink-0" />
          <p className="text-sm text-surface-300 flex-1">{error}</p>
          <Button variant="danger" size="xs" onClick={() => usePersonalTaskStore.getState().fetchTasks()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!activeTask) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <section aria-label="Focus session" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-800/70 flex items-center justify-center mx-auto">
            <Target size={24} className="text-brand-400" />
          </div>
          <h2 className="mt-4 font-display font-bold text-surface-50 text-lg">Nothing focused yet</h2>
          {candidates.length > 0 ? (
            <>
              <p className="text-sm text-surface-400 mt-1 max-w-sm mx-auto">
                Pick a task to start a focus session.
              </p>
              <div className="mt-5 flex justify-center">
                <Select
                  aria-label="Select a task to focus on"
                  value=""
                  onChange={(e) => { if (e.target.value) setFocusTaskId(e.target.value); }}
                  className="sm:max-w-xs text-center"
                >
                  <option value="">— Select a task to focus on —</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-surface-400 mt-1 max-w-sm mx-auto">
                No unfinished tasks right now. Create one in your backlog to start a focus session.
              </p>
              <Button className="mt-5" onClick={() => navigate('/personal/tasks')}>Go to Backlog</Button>
            </>
          )}
        </section>
      </div>
    );
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const hasActiveSession = activeTaskId === activeTask.id && activeTimerState !== 'idle';
  const running = hasActiveSession && activeTimerState === 'running';
  const paused = hasActiveSession && activeTimerState === 'paused';
  const canStart = !running;
  const badgeStatus = running ? 'running' : paused ? 'paused' : 'idle';
  const sessionLabel = running ? 'Running' : paused ? 'Paused' : 'No active session';

  const subtasksDone = activeTask.subtasks.filter((s) => s.completed).length;

  const handleStart = () => { if (activeTask.id) void startTimer(activeTask.id); };
  const handlePause = () => { if (activeTask.id) pauseTimer(activeTask.id); };
  const handleResume = () => { if (activeTask.id) resumeTimer(activeTask.id); };
  const handleStop = () => { if (activeTask.id) void stopTimer(activeTask.id); };

  const handleComplete = async () => {
    if (!activeTask.id || !activeTask.title) return;
    await usePersonalTaskStore.getState().completeTask(activeTask.id);
  };

  const toggleSubtaskHandler = (subtaskId: string, completed: boolean) => {
    if (activeTask.id) void toggleSubtask(activeTask.id, subtaskId, completed);
  };

  const saveNote = async () => {
    if (!activeTask.id || !noteText.trim()) return;
    try {
      await addJournal({ taskId: activeTask.id, content: noteText.trim(), mood: 3, focusRating: 3 });
      setNoteText('');
      setNoteOpen(false);
    } catch {
      // Note stays in editor so user can retry
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      {/* ═══════════ CONTEXT HERO: task → objective ═══════════ */}
      <section aria-labelledby="focus-task-title" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6 lg:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge tone="brand">Focus Session</Badge>
              <StatusBadge status={activeTask.status} />
              {taskJournals.length && (
                <Badge tone="info" icon={<StickyNote size={11} />}>Session notes</Badge>
              )}
            </div>
            <h2 id="focus-task-title" className="text-2xl font-display font-extrabold text-surface-50 tracking-tight break-words">
              {activeTask.title}
            </h2>
            {activeTask.description && (
              <p className="text-sm text-surface-300 mt-3 leading-relaxed line-clamp-2">{activeTask.description}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={12} />} className="flex-shrink-0" onClick={() => navigate(`/personal/tasks/${activeTask.id}`)}>
            Open Task
          </Button>
        </div>
      </section>

      {/* ═══════════ SESSION TIMER + CONTROLS ═══════════ */}
      <section aria-label="Session timer" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6 lg:p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="timer-display text-5xl lg:text-6xl font-extrabold text-brand-400" aria-live="polite">
              {hasActiveSession ? display : formatDuration(0)}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <StatusBadge status={badgeStatus} label={sessionLabel} />
              <span className="text-xs text-surface-500">{sessionLabel === 'No active session' ? 'No session running on this task' : 'Session status'}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {running ? (
              <Button size="lg" className="px-8 bg-amber-500 hover:bg-amber-400 text-surface-950 font-bold shadow-lg shadow-amber-500/25" leftIcon={<Pause size={18} fill="currentColor" />} onClick={handlePause}>
                Pause Session
              </Button>
            ) : paused ? (
              <Button size="lg" className="px-8 shadow-lg" leftIcon={<Play size={18} fill="currentColor" />} onClick={handleResume}>
                Resume Session
              </Button>
            ) : (
              <Button size="lg" className="px-8 shadow-lg" leftIcon={<Play size={18} fill="currentColor" />} disabled={!canStart} onClick={handleStart}>
                Start Focus Session
              </Button>
            )}
            {hasActiveSession && (
              <Button variant="danger" size="lg" className="px-4" title="Stop session" onClick={handleStop}>
                <Square size={16} fill="currentColor" />
              </Button>
            )}
            <Button variant="success" size="lg" className="px-5" leftIcon={<CheckCircle2 size={16} />} onClick={handleComplete}>
              Complete Task
            </Button>
          </div>

          <div className="w-full sm:max-w-sm">
            <label htmlFor="focus-switch-task" className="sr-only">Switch task</label>
            <Select
              id="focus-switch-task"
              value={focusTaskId || (activeTask.id ?? '')}
              onChange={(e) => setFocusTaskId(e.target.value)}
              aria-label="Switch task"
            >
              {!focusTaskId && activeTask.id && <option value={activeTask.id}>{activeTask.title}</option>}
              {candidates
                .filter((c) => c.id !== (focusTaskId || activeTask.id))
                .map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <p className="text-center text-[11px] text-surface-500 mt-1.5">
              Select a task, then start a focus session on it.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ METRICS ═══════════ */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Time tracked today" value={formatHours(activeTask.sessions?.reduce((sum, s) => sum + (s.activeTime ?? 0), 0) ?? 0)} />
        <Metric label="Total time on task" value={formatHours(activeTask.totalTime)} />
        <Metric label="Subtasks done" value={`${subtasksDone}/${activeTask.subtasks.length}`} />
        <Metric label="Last worked" value={activeTask.updatedAt ? formatDateShort(activeTask.updatedAt) : '—'} />
      </dl>

      {/* ═══════════ NEXT SUBTASK ═══════════ */}
      <section aria-label="Next subtask" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 font-display font-bold text-surface-50">
            <CheckCircle2 size={16} className="text-brand-400" />
            Next Subtask
          </h3>
          {activeTask.subtasks.length > 0 && <Badge tone="neutral">{subtasksDone}/{activeTask.subtasks.length} done</Badge>}
        </div>
        {activeTask.subtasks.length === 0 ? (
          <p className="text-sm text-surface-500">No subtasks on this task yet.</p>
        ) : (
          <ul className="space-y-2">
            {activeTask.subtasks.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => toggleSubtaskHandler(s.id, !s.completed)}
                  aria-pressed={s.completed}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    s.completed
                      ? 'border-surface-800 bg-surface-950/40 opacity-60'
                      : 'border-surface-800 bg-surface-900 hover:border-brand-500/40'
                  }`}
                >
                  <CheckCircle2 size={16} className={s.completed ? 'text-success-400' : 'text-surface-600'} />
                  <span className={`text-sm ${s.completed ? 'line-through text-surface-500' : 'text-surface-200 font-medium'}`}>
                    {s.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ═══════════ NOTES ═══════════ */}
      <section aria-label="Session notes" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6">
        <h3 className="flex items-center gap-2 font-display font-bold text-surface-50 mb-3">
          <StickyNote size={16} className="text-amber-400" />
          Session Notes
        </h3>
        {latestNote && (
          <p className="text-sm text-surface-300 leading-relaxed line-clamp-2">
            <span className="text-surface-500 text-xs mr-1">{formatDateShort(latestNote.createdAt)}</span>
            {latestNote.content}
          </p>
        )}
        {!latestNote && !noteOpen && <p className="text-sm text-surface-500">No notes on this session yet.</p>}
        {noteOpen ? (
          <div className="mt-3">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Capture what you're working on, decisions, or blockers…"
              aria-label="Session note"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" disabled={!noteText.trim()} onClick={saveNote}>Save Note</Button>
              <Button variant="ghost" size="sm" onClick={() => { setNoteOpen(false); setNoteText(''); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" leftIcon={<StickyNote size={13} />} className="mt-3" onClick={() => setNoteOpen(true)}>
            Add Session Note
          </Button>
        )}
        <Button variant="ghost" size="xs" className="mt-2 text-surface-400" onClick={() => navigate('/personal/journal')}>
          View Journal →
        </Button>
      </section>
    </div>
  );
}
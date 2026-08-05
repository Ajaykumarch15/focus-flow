import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, Square, StickyNote, FileText, AlertTriangle, Target,
  CheckCircle2, LayoutGrid, FolderOpen, Layers, Sparkles, ArrowRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { selectFocusSession, type FocusSessionView } from '../../lib/focusSelectors';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Skeleton } from '../ui/Skeleton';
import { formatDuration, formatHours, formatDateShort } from '../../utils/time';

// ── FocusSessionPanel (S1-T5) ─────────────────────────────────────────────────
// The primary execution workspace at /focus. Distraction-free column that
// answers "What am I working on right now?" (task → feature → sprint → project
// → session → notes → work log) and "What should I do next?" (next subtask).
// All session control reuses the existing timerEngine store actions — no
// duplicated timer logic, no alternative session management. Every value comes
// from state that already exists; missing references simply don't render.

interface Candidate {
  id: string;
  title: string;
}

function ChainChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-surface-400 min-w-0">
      <span className="text-surface-500 flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function ChainSeparator() {
  return <span className="text-surface-700 select-none" aria-hidden="true">›</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
      <dt className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold">{label}</dt>
      <dd className="text-lg font-display font-bold text-surface-50 mt-0.5 truncate">{value}</dd>
    </div>
  );
}

export function FocusSessionPanel() {
  const {
    tasks, journals, activeTaskId, activeSessionId, activeTimerState,
    dataLoading, dataError, loadAll, startTimer, pauseTimer, resumeTimer, stopTimer,
    toggleSubtask, addJournal, getTodayTime,
  } = useStore();
  const {
    workspaces, projects, sprints, features,
    tasks: collabTasks, blockers,
  } = useCollaborationStore();
  const { activeLogs, closedLogs } = useWorkLogStore();
  const { display } = useActiveTimer();
  const navigate = useNavigate();

  const [focusTaskId, setFocusTaskId] = useState<string>('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const workLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);

  const view: FocusSessionView = useMemo(
    () => selectFocusSession({
      tasks, collabTasks, workspaces, projects, sprints, features,
      workLogs, blockers, journals,
      activeTaskId, activeSessionId, activeTimerState,
      focusTaskId: focusTaskId || null,
    }),
    [tasks, collabTasks, workspaces, projects, sprints, features, workLogs, blockers, journals, activeTaskId, activeSessionId, activeTimerState, focusTaskId],
  );

  const todayMs = getTodayTime();

  const candidates: Candidate[] = useMemo(() => {
    const personal = tasks.filter((t) => t.status !== 'completed');
    const collab = collabTasks.filter((t) => t.sprintStatus !== 'done');
    return [...personal, ...collab].map((t) => ({ id: t.id, title: t.title }));
  }, [tasks, collabTasks]);

  // ── Loading / error / empty ────────────────────────────────────────────────
  if (dataLoading && tasks.length === 0) {
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

  if (dataError) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 p-4 flex items-center gap-3" role="alert">
          <AlertTriangle size={18} className="text-danger-500 flex-shrink-0" />
          <p className="text-sm text-surface-300 flex-1">{dataError}</p>
          <Button variant="danger" size="xs" onClick={() => loadAll()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!view.taskId || !view.title) {
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
                Pick a task to start a focus session. Its feature, sprint, and work-log context will appear here.
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
              <Button className="mt-5" onClick={() => navigate('/tasks')}>Go to Backlog</Button>
            </>
          )}
        </section>
      </div>
    );
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const running = view.hasActiveSession && view.sessionState === 'running';
  const paused = view.hasActiveSession && view.sessionState === 'paused';
  const canStart = !view.completed && !running;
  const badgeStatus = running ? 'running' : paused ? 'paused' : view.completed ? 'completed' : 'idle';
  const sessionLabel = running ? 'Running' : paused ? 'Paused' : view.completed ? 'Complete' : 'No active session';

  const chain: { icon: ReactNode; label: string }[] = [];
  if (view.workspace) chain.push({ icon: <LayoutGrid size={12} />, label: view.workspace.label });
  if (view.project) chain.push({ icon: <FolderOpen size={12} />, label: view.project.label });
  if (view.sprint) chain.push({ icon: <Layers size={12} />, label: view.sprint.label });
  if (view.feature) chain.push({ icon: <Sparkles size={12} />, label: view.feature.label });

  const handleStart = () => { if (view.taskId) void startTimer(view.taskId); };
  const handlePause = () => { if (view.taskId) pauseTimer(view.taskId); };
  const handleResume = () => { if (view.taskId) resumeTimer(view.taskId); };
  const handleStop = () => { if (view.taskId) void stopTimer(view.taskId); };

  const toggleSubtaskHandler = (subtaskId: string, completed: boolean) => {
    if (view.taskId) void toggleSubtask(view.taskId, subtaskId, completed);
  };

  const saveNote = () => {
    if (!view.taskId || !noteText.trim()) return;
    void addJournal({ taskId: view.taskId, content: noteText.trim(), mood: 3, focusRating: 3 });
    setNoteText('');
    setNoteOpen(false);
  };

  const openTask = () => {
    if (!view.taskId) return;
    navigate(view.isPersonal ? `/tasks/${view.taskId}` : `/w/${view.workspaceId}/sprints`);
  };

  const subtasksDone = view.subtasks.filter((s) => s.completed).length;
  const linkedLog = view.workLog;
  const latestNote = view.latestNote;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      {/* ═══════════ CONTEXT HERO: task → objective ═══════════ */}
      <section aria-labelledby="focus-task-title" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6 lg:p-7">
        {view.completed && (
          <div className="mb-4 rounded-xl border border-success-500/20 bg-success-500/5 px-3 py-2 text-xs font-semibold text-success-400" role="status">
            This task is complete — pick another task to start a new focus session.
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge tone="brand">Focus Session</Badge>
              <StatusBadge status={view.status ?? 'todo'} />
              {view.hasSessionNotes && (
                <Badge tone="info" icon={<StickyNote size={11} />}>Session notes</Badge>
              )}
              {view.workLog && (
                <Badge tone="success" icon={<FileText size={11} />}>Work log linked</Badge>
              )}
              {view.blocker && (
                <Badge tone="danger" icon={<AlertTriangle size={11} />}>{view.blocker.severity} blocker</Badge>
              )}
            </div>
            <h2 id="focus-task-title" className="text-2xl font-display font-extrabold text-surface-50 tracking-tight break-words">
              {view.title}
            </h2>
            {chain.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2 min-w-0">
                {chain.map((c, i) => (
                  <span key={c.label + i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <ChainSeparator />}
                    <ChainChip icon={c.icon} label={c.label} />
                  </span>
                ))}
              </div>
            )}
            {view.objective && (
              <p className="text-sm text-surface-300 mt-3 leading-relaxed line-clamp-2">{view.objective}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={12} />} className="flex-shrink-0" onClick={openTask}>
            Open Task
          </Button>
        </div>
      </section>

      {/* ═══════════ SESSION TIMER + CONTROLS ═══════════ */}
      <section aria-label="Session timer" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6 lg:p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="timer-display text-5xl lg:text-6xl font-extrabold text-brand-400" aria-live="polite">
              {view.hasActiveSession ? display : formatDuration(0)}
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
            {view.hasActiveSession && (
              <Button variant="danger" size="lg" className="px-4" title="Stop session" onClick={handleStop}>
                <Square size={16} fill="currentColor" />
              </Button>
            )}
          </div>

          <div className="w-full sm:max-w-sm">
            <label htmlFor="focus-switch-task" className="sr-only">Switch task</label>
            <Select
              id="focus-switch-task"
              value={focusTaskId || (view.taskId ?? '')}
              onChange={(e) => setFocusTaskId(e.target.value)}
              aria-label="Switch task"
            >
              {!focusTaskId && view.taskId && <option value={view.taskId}>{view.title}</option>}
              {candidates
                .filter((c) => c.id !== (focusTaskId || view.taskId))
                .map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <p className="text-center text-[11px] text-surface-500 mt-1.5">
              Switching tasks starts a new session on the selected task and closes the current one.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ METRICS ═══════════ */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Time tracked today" value={formatHours(todayMs)} />
        <Metric label="Total time on task" value={view.totalTimeMs != null ? formatHours(view.totalTimeMs) : '—'} />
        <Metric label="Est. remaining" value={view.estimatedRemainingHours != null ? formatHours(view.estimatedRemainingHours * 3_600_000) : '—'} />
        <Metric label="Last worked" value={view.lastWorkedAt != null ? formatDateShort(view.lastWorkedAt) : '—'} />
      </dl>

      {/* ═══════════ NEXT SUBTASK ═══════════ */}
      <section aria-label="Next subtask" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 font-display font-bold text-surface-50">
            <CheckCircle2 size={16} className="text-brand-400" />
            Next Subtask
          </h3>
          {view.subtasks.length > 0 && <Badge tone="neutral">{subtasksDone}/{view.subtasks.length} done</Badge>}
        </div>
        {view.subtasks.length === 0 ? (
          <p className="text-sm text-surface-500">No subtasks on this task yet.</p>
        ) : (
          <ul className="space-y-2">
            {view.subtasks.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => toggleSubtaskHandler(s.id, !s.completed)}
                  aria-pressed={s.completed}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    s.completed
                      ? 'border-surface-800 bg-surface-950/40 opacity-60'
                      : 'border-surface-800 bg-surface-900 hover:border-brand-500/40'
                  } ${view.nextSubtask?.id === s.id ? 'ring-1 ring-brand-500/40 border-brand-500/40' : ''}`}
                >
                  <CheckCircle2 size={16} className={s.completed ? 'text-success-400' : 'text-surface-600'} />
                  <span className={`text-sm ${s.completed ? 'line-through text-surface-500' : 'text-surface-200 font-medium'}`}>
                    {s.title}
                  </span>
                  {view.nextSubtask?.id === s.id && (
                    <Badge tone="brand" className="ml-auto flex-shrink-0">Up next</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ═══════════ NOTES + WORK LOG ═══════════ */}
      <div className="grid md:grid-cols-2 gap-5">
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
          <Button variant="ghost" size="xs" className="mt-2 text-surface-400" onClick={() => navigate('/journal')}>
            View Journal →
          </Button>
        </section>

        <section aria-label="Work log" className="rounded-3xl border border-surface-800/60 bg-surface-900 p-6">
          <h3 className="flex items-center gap-2 font-display font-bold text-surface-50 mb-3">
            <FileText size={16} className="text-emerald-400" />
            Work Log
          </h3>
          {linkedLog ? (
            <>
              <p className="text-sm font-medium text-surface-200 truncate">{linkedLog.title}</p>
              <Button size="sm" rightIcon={<ArrowRight size={13} />} className="mt-3" onClick={() => navigate(`/worklog/${linkedLog.id}`)}>
                Open Work Log
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-surface-500">No work log linked to this task yet.</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate('/worklog')}>
                Open Work Logs
              </Button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

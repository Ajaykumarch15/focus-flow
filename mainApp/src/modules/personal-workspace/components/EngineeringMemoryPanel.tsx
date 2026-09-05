import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainCircuit, CheckCircle2, Clock, StickyNote, FileText, GitBranch,
  History, PenLine, AlertTriangle, CircleDashed,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { api } from '@shared/utils/api';
import {
  mapSession, selectEngineeringMemory,
  type MemoryDecision, type MemorySession, type MemoryView,
} from '@personal/services/memorySelectors';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { Textarea } from '@shared/components/ui/Textarea';
import { formatMs, formatHours, formatDateShort } from '@shared/utils/time';

// ── EngineeringMemoryPanel (S1-T6) ─────────────────────────────────────────────
// Reusable right-column panel at /focus. It is a read-only projection of ARK's
// existing engineering memory: timer sessions (server documents), work logs,
// journal entries, tasks and blockers. It reuses the S1-T5 focus selector for
// the task + context chain and only renders values that already exist — no AI
// summaries, no invented decisions. The panel is fully responsive (stacked on
// small screens) and keyboard friendly (links/buttons only).

function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function sectionLabel(icon: React.ReactNode, text: string) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-surface-500">
      {icon}
      {text}
    </h3>
  );
}

interface EngineeringMemoryPanelProps {
  taskId?: string | null;
  className?: string;
}

export function EngineeringMemoryPanel({ taskId = null, className }: EngineeringMemoryPanelProps) {
  const {
    tasks, journals, activeTaskId, activeSessionId, activeTimerState,
    currentSessionStart, currentPauseStart,
    dataLoading, dataError, loadAll, addJournal,
  } = useStore();
  const {
    workspaces, projects, sprints, features,
    tasks: collabTasks, blockers,
  } = useCollaborationStore();
  const { activeLogs, closedLogs } = useWorkLogStore();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<MemorySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');

  const workLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    setSessionsError(null);
    api.sessions
      .list()
      .then((docs: any[]) => setSessions(docs.map(mapSession)))
      .catch((err: any) => setSessionsError(err?.message || 'Could not load session history.'))
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const view: MemoryView = useMemo(
    () => selectEngineeringMemory({
      tasks, collabTasks, workspaces, projects, sprints, features,
      workLogs, blockers, journals,
      activeTaskId, activeSessionId, activeTimerState,
      focusTaskId: taskId || null,
      sessions,
      currentSessionStart: currentSessionStart ?? null,
      currentPauseStart: currentPauseStart ?? null,
    }),
    [tasks, collabTasks, workspaces, projects, sprints, features, workLogs, blockers, journals, activeTaskId, activeSessionId, activeTimerState, taskId, sessions, currentSessionStart, currentPauseStart],
  );

  const saveQuickNote = async () => {
    const text = quickText.trim();
    if (!text || !view.taskId) return;
    await addJournal({ taskId: view.taskId, content: text, mood: 4, focusRating: 3 });
    setQuickText('');
    setQuickOpen(false);
  };

  const showPageSkeleton = dataLoading && tasks.length === 0;

  if (showPageSkeleton) {
    return (
      <section aria-label="Engineering memory" className={className}>
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-5 space-y-4">
          <Skeleton className="h-5 w-40 rounded" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-16 rounded-full" />)}
          </div>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </section>
    );
  }

  if (dataError) {
    return (
      <section aria-label="Engineering memory" className={className}>
        <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 p-4 flex items-start gap-3" role="alert">
          <AlertTriangle size={18} className="text-danger-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-surface-300">{dataError}</p>
            <Button variant="danger" size="xs" className="mt-2" onClick={() => loadAll()}>Retry</Button>
          </div>
        </div>
      </section>
    );
  }

  const sessionStateBadge =
    view.sessionState === 'running' ? <StatusBadge status="running" label="Running" />
    : view.sessionState === 'paused' ? <StatusBadge status="paused" label="Paused" />
    : null;

  return (
    <section aria-label="Engineering memory" className={className}>
      <div className="rounded-3xl border border-surface-800 bg-surface-900 p-5 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-surface-50">
            <BrainCircuit size={16} className="text-brand-500" aria-hidden="true" />
            Engineering Memory
          </h2>
          <Badge
            tone={view.completeness === view.totalFacets ? 'success' : 'neutral'}
            aria-label={`Context completeness ${view.completeness} of ${view.totalFacets}`}
          >
            {view.completeness}/{view.totalFacets} context
          </Badge>
        </div>

        {/* Facet chips */}
        <div
          className="flex flex-wrap gap-1.5"
          aria-label={`Context completeness ${view.completeness} of ${view.totalFacets}`}
        >
          {view.facets.map((f) => (
            <span
              key={f.key}
              aria-label={`${f.label} ${f.present ? 'present' : 'missing'}`}
              className={
                f.present
                  ? 'inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-400'
                  : 'inline-flex items-center gap-1 rounded-full bg-surface-800/50 px-2 py-0.5 text-[10px] font-medium text-surface-600'
              }
            >
              {f.present
                ? <CheckCircle2 size={11} aria-hidden="true" />
                : <CircleDashed size={11} aria-hidden="true" />}
              {f.label}
            </span>
          ))}
        </div>

        {/* Total time on task */}
        {view.totalTimeOnTaskMs != null && view.totalTimeOnTaskMs > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">Total time on task</span>
            <span className="text-sm font-display font-bold text-surface-100">{formatHours(view.totalTimeOnTaskMs)}</span>
          </div>
        )}

        {/* Active session strip */}
        {view.hasActiveSession && (
          <div className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-surface-200">
                <Clock size={14} className="text-brand-500" aria-hidden="true" />
                Session {sessionStateBadge}
              </span>
            </div>
            <dl className="flex flex-col gap-1 text-xs text-surface-400 sm:flex-row sm:flex-wrap sm:gap-x-4">
              {view.sessionStartAt != null && (
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Started</dt>
                  <dd>Started {clockTime(view.sessionStartAt)}</dd>
                </div>
              )}
              {view.lastResumeAt != null && view.sessionStartAt != null && view.lastResumeAt > view.sessionStartAt && (
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Last resumed</dt>
                  <dd>Resumed {clockTime(view.lastResumeAt)}</dd>
                </div>
              )}
              {view.sessionState === 'paused' && view.currentPauseAt != null && (
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Paused</dt>
                  <dd>Paused {clockTime(view.currentPauseAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Previous session summary */}
        {view.previousSession && (
          <div className="flex flex-col gap-2">
            {sectionLabel(<History size={13} aria-hidden="true" />, 'Previous session')}
            <div className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-semibold text-surface-100">{formatMs(view.previousSession.activeTime)}</span>
                <span className="text-xs text-surface-500">{formatDateShort(view.previousSession.startTime)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-400">
                {view.previousSession.taskTitle && (
                  <span className="truncate max-w-full">Task: {view.previousSession.taskTitle}</span>
                )}
                {view.previousSession.pauseCount > 0 && (
                  <span>{view.previousSession.pauseCount} pause{view.previousSession.pauseCount !== 1 ? 's' : ''}</span>
                )}
                {view.previousSession.focusScore != null && (
                  <span>Focus {view.previousSession.focusScore}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Last work log */}
        {(view.linkedWorkLog || view.lastWorkLog) && (
          <div className="flex flex-col gap-2">
            {sectionLabel(<FileText size={13} aria-hidden="true" />, 'Last work log')}
            <div className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-semibold text-surface-100 truncate">
                  {view.linkedWorkLog?.title ?? view.lastWorkLog!.title}
                </span>
                <StatusBadge status={view.linkedWorkLog?.status ?? view.lastWorkLog!.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-400">
                <span>{formatDateShort(view.linkedWorkLog?.updatedAt ?? view.lastWorkLog!.updatedAt)}</span>
                {((view.linkedWorkLog?.sessionCount ?? 0) > 0) && (
                  <span>{view.linkedWorkLog!.sessionCount} session{view.linkedWorkLog!.sessionCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              <Button
                variant="secondary"
                size="xs"
                rightIcon={<PenLine size={12} aria-hidden="true" />}
                onClick={() => navigate(`/worklog/logs/${view.linkedWorkLog?.id ?? view.lastWorkLog!.id}`)}
              >
                Open work log
              </Button>
            </div>
          </div>
        )}

        {/* Recent decisions */}
        {view.recentDecisions.length > 0 && (
          <div className="flex flex-col gap-2">
            {sectionLabel(<GitBranch size={13} aria-hidden="true" />, `Recent decisions (${view.recentDecisions.length})`)}
            <ul className="flex flex-col gap-2">
              {view.recentDecisions.map((d: MemoryDecision) => (
                <li key={d.id} className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
                  <p className="text-sm font-semibold text-surface-100">{d.title}</p>
                  <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{d.decision}</p>
                  <p className="text-[11px] text-surface-600 mt-1">Recorded in {d.workLogTitle}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last journal note + quick continue */}
        {(view.lastJournalNote || view.taskJournalNote) && (
          <div className="flex flex-col gap-2">
            {sectionLabel(<StickyNote size={13} aria-hidden="true" />, 'Last journal note')}
            <div className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-3 flex flex-col gap-2">
              <p className="text-xs text-surface-300 line-clamp-3">{view.lastJournalNote?.content ?? view.taskJournalNote!.content}</p>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-surface-600">
                  {formatDateShort(view.lastJournalNote?.createdAt ?? view.taskJournalNote!.createdAt)}
                </span>
                <Button variant="ghost" size="xs" onClick={() => setQuickOpen((o) => !o)}>
                  {quickOpen ? 'Cancel' : 'Continue writing'}
                </Button>
              </div>
              {quickOpen && (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    placeholder="Capture a quick reflection…"
                    aria-label="Quick journal note"
                    className="min-h-20 text-xs"
                  />
                  <div className="flex justify-end">
                    <Button size="xs" onClick={() => saveQuickNote()} disabled={!quickText.trim() || !view.taskId}>
                      Save note
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Honest empty state */}
        {!view.hasAnyMemory && (
          <div className="rounded-2xl border border-surface-800/60 bg-surface-950/40 px-4 py-6 flex flex-col items-center gap-2 text-center">
            <BrainCircuit size={20} className="text-surface-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-surface-300">No memory yet</p>
            <p className="text-xs text-surface-500 max-w-xs">
              Your work log, journal notes, timer sessions and decisions will appear here automatically as you work.
            </p>
          </div>
        )}

        {/* Session history loading / error */}
        {sessionsLoading && sessions.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        )}
        {sessionsError && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-danger-500/20 bg-danger-500/5 px-4 py-2.5" role="alert">
            <p className="text-xs text-surface-400 flex-1">{sessionsError}</p>
            <Button variant="danger" size="xs" onClick={() => loadSessions()}>Retry</Button>
          </div>
        )}
      </div>
    </section>
  );
}

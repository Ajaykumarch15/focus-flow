import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainCircuit, CircleDashed, GitBranch, GitPullRequest, LayoutGrid,
  FolderOpen, Layers, Sparkles, ListChecks, PenLine, Zap,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import { selectTaskContinuation, type StoppedWhere } from '@personal/services/continuationSelectors';
import { Button } from '@shared/components/ui/Button';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { formatHours, formatRelativeTime } from '@shared/utils/time';

// ── TaskContinuationPanel (S2-T1) ─────────────────────────────────────────────
// Reusable "Current Task continuation" surface for TaskDetail. It projects what
// already exists: workspace → project → sprint → feature chain, session state +
// clock, git context (branch / PR), and "where I stopped" (the most recent prose
// written about the task — work log progress/entries, else the last journal
// note). It reuses the S1-T5 focus selector through selectTaskContinuation and
// renders only values that exist — no fabricated continuation. The panel is
// read-only for session controls (the TaskDetail timer card owns those) so no
// timer control is mounted twice.

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-800/60 bg-surface-950/40 px-2.5 py-1">
      <span className="text-surface-500 flex-shrink-0">{icon}</span>
      <span className="text-xs text-surface-400 truncate">{label}</span>
    </span>
  );
}

function sectionLabel(icon: ReactNode, text: string) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-surface-500">
      {icon}
      {text}
    </h3>
  );
}

function stoppedSourceLabel(source: StoppedWhere['source']): string {
  switch (source) {
    case 'progress': return 'Progress snapshot';
    case 'entry': return 'Last entry';
    case 'journal': return 'Last note';
    case 'worklog': return 'Current work';
  }
}

interface TaskContinuationPanelProps {
  taskId: string;
  className?: string;
}

export function TaskContinuationPanel({ taskId, className }: TaskContinuationPanelProps) {
  const navigate = useNavigate();
  const {
    tasks, journals, activeTaskId, activeSessionId, activeTimerState,
    dataLoading, dataError, loadAll,
  } = useStore();
  const {
    workspaces, projects, sprints, features,
    tasks: collabTasks, blockers,
  } = useCollaborationStore();
  const { activeLogs, closedLogs } = useWorkLogStore();
  const { display } = useActiveTimer();

  const workLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);

  const view = useMemo(
    () => selectTaskContinuation({
      tasks, collabTasks, workspaces, projects, sprints, features,
      workLogs, blockers, journals,
      activeTaskId, activeSessionId, activeTimerState,
      focusTaskId: taskId,
    }),
    [tasks, collabTasks, workspaces, projects, sprints, features, workLogs, blockers, journals, activeTaskId, activeSessionId, activeTimerState, taskId],
  );

  if (dataLoading && tasks.length === 0 && collabTasks.length === 0) {
    return (
      <section aria-label="Continuation" className={className}>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-4">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </section>
    );
  }

  if (dataError) {
    return (
      <section aria-label="Continuation" className={className}>
        <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 p-4 flex items-start gap-3" role="alert">
          <BrainCircuit size={18} className="text-danger-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-surface-300">{dataError}</p>
            <Button variant="danger" size="xs" className="mt-2" onClick={() => loadAll()}>Retry</Button>
          </div>
        </div>
      </section>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-surface-50">
        <BrainCircuit size={16} className="text-brand-500" aria-hidden="true" />
        Continuation
      </h2>
      {view.completed && <StatusBadge status="completed" label="Done" />}
    </div>
  );

  const hasAnyContext =
    view.taskId !== null &&
    Boolean(
      view.workspace || view.project || view.sprint || view.feature ||
      view.hasActiveSession || (view.totalTimeMs ?? 0) > 0 ||
      view.git.branch || view.git.pr ||
      view.whereIStopped || view.workLog ||
      view.subtasksTotal > 0,
    );

  if (!hasAnyContext) {
    return (
      <section aria-label="Continuation" className={className}>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          {header}
          <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-6 mt-4 flex flex-col items-center gap-2 text-center">
            <CircleDashed size={20} className="text-surface-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-surface-300">Nothing to continue yet</p>
            <p className="text-xs text-surface-500 max-w-xs">
              Start a timer, open the work log or add a note to build your continuation context.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Continuation" className={className}>
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 flex flex-col gap-4">
        {header}

        {/* Context chain */}
        {(view.workspace || view.project || view.sprint || view.feature) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {view.workspace && <Chip icon={<LayoutGrid size={12} />} label={view.workspace.label} />}
            {view.project && <Chip icon={<FolderOpen size={12} />} label={view.project.label} />}
            {view.sprint && <Chip icon={<Layers size={12} />} label={view.sprint.label} />}
            {view.feature && <Chip icon={<Sparkles size={12} />} label={view.feature.label} />}
          </div>
        )}

        {/* Session state + clock (read-only; the timer card owns controls) */}
        {view.hasActiveSession && (
          <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3 flex items-center gap-3">
            <Zap size={14} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
            <StatusBadge status={view.sessionState} />
            <span className="font-mono text-sm font-bold text-brand-400">{display}</span>
            <span className="text-[11px] text-surface-500 hidden sm:inline">Live session</span>
            <Button variant="ghost" size="xs" className="ml-auto flex-shrink-0" onClick={() => navigate(`/worklog/tasks/${taskId}`)}>
              View Task
            </Button>
          </div>
        )}

        {!view.hasActiveSession && (view.totalTimeMs ?? 0) > 0 && (
          <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3 flex items-center gap-2">
            <Zap size={14} className="text-surface-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium text-surface-400">Total focused</span>
            <span className="text-sm font-mono font-bold text-surface-200 ml-auto">{formatHours(view.totalTimeMs ?? 0)}</span>
          </div>
        )}

        {/* Subtask progress summary (the interactive list lives on this page) */}
        {view.subtasksTotal > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-surface-400">
              <ListChecks size={13} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
              {view.subtasksDone}/{view.subtasksTotal} subtasks
            </span>
            {view.nextSubtask && (
              <span className="text-[11px] text-surface-500 truncate">Up next: {view.nextSubtask.title}</span>
            )}
          </div>
        )}

        {/* Git context */}
        {(view.git.branch || view.git.pr) && (
          <div className="flex flex-col gap-2">
            {sectionLabel(<GitBranch size={13} aria-hidden="true" />, 'Git')}
            <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {view.git.branch && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-200">
                  <GitBranch size={13} className="text-surface-500 flex-shrink-0" aria-hidden="true" />
                  {view.git.branch}
                </span>
              )}
              {view.git.pr && (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <GitPullRequest size={13} className="text-purple-400 flex-shrink-0" aria-hidden="true" />
                  {view.git.pr.url ? (
                    <a
                      href={view.git.pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
                    >
                      {view.git.pr.number ? `PR #${view.git.pr.number}` : 'Open pull request'}
                    </a>
                  ) : view.git.pr.number ? (
                    <span className="text-surface-200 font-semibold">PR #{view.git.pr.number}</span>
                  ) : (
                    <span className="text-surface-200 font-semibold">Open pull request</span>
                  )}
                  {view.git.pr.reviewStatus && <StatusBadge status={view.git.pr.reviewStatus} />}
                  {view.git.pr.mergeStatus && <StatusBadge status={view.git.pr.mergeStatus} />}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Where I stopped */}
        {view.whereIStopped && (() => {
          const stopped = view.whereIStopped;
          return (
          <div className="flex flex-col gap-2">
            {sectionLabel(<PenLine size={13} aria-hidden="true" />, 'Where I stopped')}
            <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
              <p className="text-sm text-surface-200 leading-relaxed line-clamp-3">{stopped.text}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-surface-500">
                  {stoppedSourceLabel(stopped.source)}
                  {stopped.at != null && ` · ${formatRelativeTime(stopped.at)}`}
                </span>
                {view.workLog && (
                  <Button
                    variant="ghost"
                    size="xs"
                    rightIcon={<PenLine size={12} aria-hidden="true" />}
                    onClick={() => navigate(`/worklog/logs/${view.workLog!.id}`)}
                  >
                    Open work log
                  </Button>
                )}
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </section>
  );
}

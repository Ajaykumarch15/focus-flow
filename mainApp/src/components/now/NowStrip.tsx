import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, LayoutGrid, FolderOpen, Layers, Sparkles, GitBranch,
  Pause, Play, RefreshCw,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { selectNowStrip } from '../../lib/nowSelectors';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { Skeleton } from '../ui/Skeleton';

// ── NowStrip (S1-T3) ───────────────────────────────────────────────────────────
// Persistent context bar under the global header on every authenticated work
// surface. Composes "what am I working on right now" from state that already
// exists: workspace → project → sprint → feature → task → subtasks → session
// state → timer → branch → Resume/Pause. Only existing values render; the bar
// collapses to a compact row on mobile.

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="text-surface-500 flex-shrink-0">{icon}</span>
      <span className="text-surface-400 truncate">{label}</span>
    </span>
  );
}

export function NowStrip() {
  const {
    tasks, activeTaskId, activeSessionId, activeTimerState,
    dataLoading, dataError, loadAll, pauseTimer, resumeTimer,
  } = useStore();
  const { workspaces, projects, sprints, features, tasks: collabTasks } = useCollaborationStore();
  const { display } = useActiveTimer();
  const navigate = useNavigate();

  const now = useMemo(
    () => selectNowStrip({
      tasks, collabTasks, workspaces, projects, sprints, features,
      activeTaskId, activeSessionId, activeTimerState,
    }),
    [tasks, collabTasks, workspaces, projects, sprints, features, activeTaskId, activeSessionId, activeTimerState],
  );

  const noDataYet = dataLoading && tasks.length === 0 && collabTasks.length === 0;
  const loadFailed = Boolean(dataError) && !now.title && activeTimerState === 'idle';

  if (noDataYet) {
    return (
      <aside aria-label="Current work" className="h-10 border-b border-surface-800/60 bg-surface-950/60 flex items-center gap-3 px-3 sm:px-6">
        <Skeleton className="h-2.5 w-24 rounded" />
        <Skeleton className="h-2.5 w-40 rounded hidden sm:block" />
        <Skeleton className="h-5 w-16 rounded ml-auto" />
      </aside>
    );
  }

  if (loadFailed) {
    return (
      <aside aria-label="Current work" className="h-10 border-b border-danger-500/20 bg-danger-500/5 flex items-center gap-2 px-3 sm:px-6">
        <RefreshCw size={13} className="text-danger-500 flex-shrink-0" />
        <span className="text-xs text-danger-400 truncate">Couldn't load current context</span>
        <Button variant="ghost" size="xs" className="ml-auto text-danger-400 hover:text-danger-300 font-bold flex-shrink-0" onClick={() => loadAll()}>
          Retry
        </Button>
      </aside>
    );
  }

  const empty = now.state === 'none';

  return (
    <aside aria-label="Current work" className="h-10 border-b border-surface-800/60 bg-surface-950/60 flex items-center gap-2 px-3 sm:px-6 overflow-hidden">
      {/* Now anchor */}
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Now</span>
      </span>

      {empty ? (
        <>
          <span className="text-xs text-surface-500 truncate">No active task</span>
          {activeTimerState !== 'idle' && (
            <span className="timer-display text-xs font-bold text-brand-400 flex-shrink-0">{display}</span>
          )}
          <Button variant="ghost" size="xs" className="ml-auto flex-shrink-0" onClick={() => navigate('/dashboard')}>
            Start something
          </Button>
        </>
      ) : (
        <>
          {/* Context chain: workspace → project → sprint → feature */}
          <div className="hidden md:flex items-center gap-1.5 min-w-0">
            {now.workspace && <Chip icon={<LayoutGrid size={11} />} label={now.workspace.label} />}
            {now.project && <Chip icon={<FolderOpen size={11} />} label={now.project.label} />}
            {now.sprint && <Chip icon={<Layers size={11} />} label={now.sprint.label} />}
            {now.feature && <Chip icon={<Sparkles size={11} />} label={now.feature.label} />}
          </div>

          {/* Current task */}
          <button
            type="button"
            onClick={() => navigate(now.state === 'collab' && now.workspaceId ? `/w/${now.workspaceId}/sprints` : `/tasks/${now.taskId}`)}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left group"
            aria-label={`Open ${now.title}`}
          >
            <Zap size={12} className="text-amber-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-surface-50 truncate group-hover:text-brand-300 transition-colors">{now.title}</span>
          </button>

          {now.completed && <StatusBadge status="completed" className="flex-shrink-0" />}

          {now.subtasksTotal > 0 && (
            <Badge tone="neutral" className="hidden sm:inline-flex flex-shrink-0">
              {now.subtasksDone}/{now.subtasksTotal} subtasks
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {activeTimerState !== 'idle' && (
              <>
                <StatusBadge status={activeTimerState} className="hidden sm:inline-flex" />
                <span className="timer-display text-sm font-bold text-brand-400">{display}</span>
              </>
            )}
            {now.branch && (
              <Badge tone="neutral" icon={<GitBranch size={11} />} className="hidden lg:inline-flex flex-shrink-0">
                {now.branch}
              </Badge>
            )}
            {!now.completed && activeTimerState === 'running' && now.taskId && (
              <Button size="sm" variant="outline" leftIcon={<Pause size={11} />} onClick={() => pauseTimer(now.taskId!)}>
                Pause
              </Button>
            )}
            {!now.completed && activeTimerState === 'paused' && now.taskId && (
              <Button size="sm" leftIcon={<Play size={11} />} onClick={() => resumeTimer(now.taskId!)}>
                Resume
              </Button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

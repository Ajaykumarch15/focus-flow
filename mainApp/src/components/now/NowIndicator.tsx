import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { timerEngine } from '../../utils/timerEngine';
import { selectNowStrip } from '../../lib/nowSelectors';

// ── NowIndicator ──────────────────────────────────────────────────────────────
// A compact `● NOW` indicator for the global header. This is the only visible
// remnant of the old NowStrip bar: it surfaces the current active task title
// (or an honest "No active task" state). It deliberately carries no timer,
// Pause/Resume, branch, subtasks, or other context — those live in the
// sidebar's active-timer section and the (now removed) NowStrip bar.
//
// State/data logic is reused from the existing `selectNowStrip` selector.
// The indicator is workspace-scoped: a personal running task does not appear
// in the worklog/collab header and vice-versa.

export function NowIndicator() {
  const {
    tasks, activeTaskId, activeSessionId, activeTimerState,
  } = useStore();
  const { workspaces, projects, sprints, features, tasks: collabTasks } = useCollaborationStore();
  const workspace = useAuthStore((s) => s.workspace);
  const navigate = useNavigate();

  const now = useMemo(
    () => selectNowStrip({
      tasks, collabTasks, workspaces, projects, sprints, features,
      activeTaskId, activeSessionId, activeTimerState,
    }),
    [tasks, collabTasks, workspaces, projects, sprints, features, activeTaskId, activeSessionId, activeTimerState],
  );

  // Only surface the active task when the running session belongs to the
  // current workspace.  The timer engine tracks `sessionKind` ('work' |
  // 'personal' | null) which we compare against the active workspace.
  const sessionKind = timerEngine.getSnapshot().sessionKind;
  const timerMatchesWorkspace =
    (workspace === 'personal' && sessionKind === 'personal') ||
    (workspace !== 'personal' && sessionKind !== 'personal');

  const hasActive = timerMatchesWorkspace && now.state !== 'none' && Boolean(now.title);

  const goToTask = () => {
    if (!hasActive) return;
    navigate(now.state === 'collab' && now.workspaceId ? `/w/${now.workspaceId}/sprints` : `/worklog/tasks/${now.taskId}`);
  };

  if (hasActive) {
    return (
      <button
        type="button"
        onClick={goToTask}
        title={`Now: ${now.title}`}
        aria-label={`Now: ${now.title}`}
        className="group flex items-center gap-1.5 min-w-0 px-2 h-9 rounded-xl text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse flex-shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500 flex-shrink-0">Now</span>
        <span className="text-xs font-semibold text-surface-200 truncate max-w-[180px] lg:max-w-[260px] group-hover:text-brand-300 transition-colors">
          {now.title}
        </span>
      </button>
    );
  }

  return (
    <span
      className="flex items-center gap-1.5 px-2 h-9 min-w-0"
      title="No active task"
      aria-label="No active task"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-surface-600 flex-shrink-0" aria-hidden="true" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500 flex-shrink-0">Now</span>
      <span className="text-xs text-surface-500 truncate">No active task</span>
    </span>
  );
}

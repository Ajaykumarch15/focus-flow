import { useState, useCallback } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import { Button } from '@shared/components/ui/Button';
import { TimerSwitchConfirmDialog } from '@shared/components/ui/TimerSwitchConfirmDialog';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';

// EEP2-P5.4.2: start/pause/resume/stop the shared global timer from a sprint
// board card. The timer engine + session API are app-wide, so a board timer is
// the same timer as the sidebar's — stopping it writes the worklog row that the
// card's WorklogPanel reads (server session-stop is the single writer).
// `baseMs` is the collab task's accumulated totalTime so a resumed card clock
// continues from its logged total instead of restarting at 0.
//
// Now supports parallel timers with confirmation dialog.
export function TaskTimerButton({ taskId, title, baseMs = 0 }: {
  taskId: string;
  title: string;
  baseMs?: number;
}) {
  const { startTimer, pauseTimer, resumeTimer, stopTimer, tasks } = useStore();
  const { activeTaskId, activeTimerState, display } = useActiveTimer();

  // Parallel timer state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingTaskTitle, setPendingTaskTitle] = useState('');

  // Check if this task has a parallel timer running
  const parallelState = parallelTimerEngine.getState(taskId);
  const isParallelRunning = parallelState === 'running';
  const isParallelPaused = parallelState === 'paused';

  // Legacy single-timer state
  const isActive = activeTaskId === taskId;
  const isRunning = isActive && activeTimerState === 'running';
  const isPaused = isActive && activeTimerState === 'paused';

  // Combined state (either parallel or legacy timer is active)
  const anyActive = isActive || isParallelRunning || isParallelPaused;
  const anyRunning = isRunning || isParallelRunning;
  const anyPaused = isPaused || isParallelPaused;

  // Get current running task info for confirmation dialog
  const getRunningTaskInfo = useCallback(() => {
    const activeIds = parallelTimerEngine.getActiveTaskIds();
    const otherRunning = activeIds.find(id => id !== taskId);
    if (otherRunning) {
      const task = tasks.find(t => t.id === otherRunning);
      return task ? { id: otherRunning, title: task.title } : null;
    }
    // Also check legacy single timer
    if (activeTaskId && activeTaskId !== taskId) {
      const task = tasks.find(t => t.id === activeTaskId);
      return task ? { id: activeTaskId, title: task.title } : null;
    }
    return null;
  }, [taskId, tasks, activeTaskId]);

  const handleStartClick = useCallback(() => {
    const runningTask = getRunningTaskInfo();
    if (runningTask) {
      // Another timer is running, show confirmation
      setPendingTaskId(taskId);
      setPendingTaskTitle(title);
      setShowConfirmDialog(true);
    } else {
      // No other timer running, start directly
      startTimer(taskId, baseMs);
    }
  }, [taskId, title, baseMs, startTimer, getRunningTaskInfo]);

  const handleSwitchAndPause = useCallback(() => {
    if (pendingTaskId) {
      startTimer(pendingTaskId, baseMs);
    }
    setShowConfirmDialog(false);
    setPendingTaskId(null);
    setPendingTaskTitle('');
  }, [pendingTaskId, baseMs, startTimer]);

  const handleRunParallel = useCallback(() => {
    if (pendingTaskId) {
      // Use parallel timer to keep both running
      const { startParallelTimer } = useStore.getState();
      startParallelTimer(pendingTaskId, baseMs);
    }
    setShowConfirmDialog(false);
    setPendingTaskId(null);
    setPendingTaskTitle('');
  }, [pendingTaskId, baseMs]);

  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingTaskId(null);
    setPendingTaskTitle('');
  }, []);

  // Determine which timer controls to show
  const handlePause = useCallback(() => {
    if (isParallelRunning) {
      const { pauseParallelTimer } = useStore.getState();
      pauseParallelTimer(taskId);
    } else {
      pauseTimer(taskId);
    }
  }, [taskId, isParallelRunning, pauseTimer]);

  const handleResume = useCallback(() => {
    if (isParallelPaused) {
      const { resumeParallelTimer } = useStore.getState();
      resumeParallelTimer(taskId);
    } else {
      resumeTimer(taskId);
    }
  }, [taskId, isParallelPaused, resumeTimer]);

  const handleStop = useCallback(() => {
    if (isParallelRunning || isParallelPaused) {
      const { stopParallelTimer } = useStore.getState();
      stopParallelTimer(taskId);
    } else {
      stopTimer(taskId);
    }
  }, [taskId, isParallelRunning, isParallelPaused, stopTimer]);

  // Get display time for this task's timer
  const getDisplayTime = () => {
    if (anyActive) {
      if (isParallelRunning || isParallelPaused) {
        return parallelTimerEngine.getFormattedDisplay(taskId);
      }
      return display;
    }
    return '—';
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2" data-testid={`timer-control-${taskId}`}>
        <span className="font-mono text-[11px] font-bold text-surface-300 tabular-nums">
          {getDisplayTime()}
        </span>
        <div className="flex items-center gap-1">
          {!anyActive && (
            <Button
              size="xs"
              variant="ghost"
              onClick={handleStartClick}
              aria-label={`Start timer for ${title}`}
              leftIcon={<Play size={11} />}
              className="text-surface-400 hover:text-brand-400 hover:bg-transparent">
              {baseMs > 0 ? 'Resume' : 'Start'}
            </Button>
          )}
          {anyRunning && (
            <Button
              size="xs"
              variant="ghost"
              onClick={handlePause}
              aria-label={`Pause timer for ${title}`}
              leftIcon={<Pause size={11} />}
              className="text-amber-400 hover:text-amber-300 hover:bg-transparent">
              Pause
            </Button>
          )}
          {anyPaused && (
            <Button
              size="xs"
              variant="ghost"
              onClick={handleResume}
              aria-label={`Resume timer for ${title}`}
              leftIcon={<Play size={11} />}
              className="text-brand-400 hover:text-brand-300 hover:bg-transparent">
              Resume
            </Button>
          )}
          {anyActive && (
            <Button
              size="xs"
              variant="ghost"
              onClick={handleStop}
              aria-label={`Stop timer for ${title}`}
              leftIcon={<Square size={11} />}
              className="text-red-400 hover:text-red-300 hover:bg-transparent">
              Stop
            </Button>
          )}
        </div>
      </div>

      <TimerSwitchConfirmDialog
        isOpen={showConfirmDialog}
        currentTaskTitle={getRunningTaskInfo()?.title ?? ''}
        newTaskTitle={pendingTaskTitle}
        onSwitchAndPause={handleSwitchAndPause}
        onRunParallel={handleRunParallel}
        onCancel={handleCancel}
      />
    </>
  );
}

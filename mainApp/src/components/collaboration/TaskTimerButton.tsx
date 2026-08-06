import { Play, Pause, Square } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { Button } from '../ui/Button';

// EEP2-P5.4.2: start/pause/resume/stop the shared global timer from a sprint
// board card. The timer engine + session API are app-wide, so a board timer is
// the same timer as the sidebar's — stopping it writes the worklog row that the
// card's WorklogPanel reads (server session-stop is the single writer).
// `baseMs` is the collab task's accumulated totalTime so a resumed card clock
// continues from its logged total instead of restarting at 0.
export function TaskTimerButton({ taskId, title, baseMs = 0 }: {
  taskId: string;
  title: string;
  baseMs?: number;
}) {
  const { startTimer, pauseTimer, resumeTimer, stopTimer } = useStore();
  const { activeTaskId, activeTimerState, display } = useActiveTimer();

  const isActive = activeTaskId === taskId;
  const isRunning = isActive && activeTimerState === 'running';
  const isPaused = isActive && activeTimerState === 'paused';

  return (
    <div className="flex items-center justify-between gap-2" data-testid={`timer-control-${taskId}`}>
      <span className="font-mono text-[11px] font-bold text-surface-300 tabular-nums">
        {isActive ? display : '—'}
      </span>
      <div className="flex items-center gap-1">
        {!isActive && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => startTimer(taskId, baseMs)}
            aria-label={`Start timer for ${title}`}
            leftIcon={<Play size={11} />}
            className="text-surface-400 hover:text-brand-400 hover:bg-transparent">
            {baseMs > 0 ? 'Resume' : 'Start'}
          </Button>
        )}
        {isRunning && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => pauseTimer(taskId)}
            aria-label={`Pause timer for ${title}`}
            leftIcon={<Pause size={11} />}
            className="text-amber-400 hover:text-amber-300 hover:bg-transparent">
            Pause
          </Button>
        )}
        {isPaused && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => resumeTimer(taskId)}
            aria-label={`Resume timer for ${title}`}
            leftIcon={<Play size={11} />}
            className="text-brand-400 hover:text-brand-300 hover:bg-transparent">
            Resume
          </Button>
        )}
        {isActive && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => stopTimer(taskId)}
            aria-label={`Stop timer for ${title}`}
            leftIcon={<Square size={11} />}
            className="text-red-400 hover:text-red-300 hover:bg-transparent">
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}

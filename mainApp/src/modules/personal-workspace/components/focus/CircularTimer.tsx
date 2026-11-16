import { motion } from 'framer-motion';
import { Play, Pause, Square } from 'lucide-react';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';

interface CircularTimerProps {
  taskId: string;
  state: 'idle' | 'running' | 'paused';
  display: string;
  totalTime: number;
  isReducedMotion?: boolean;
  /**
   * Optional action overrides so other modules (e.g. worklog TaskDetail) can
   * wire their own store — defaults to the personal task store actions.
   */
  onStart?: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onStop?: (taskId: string) => void;
}

/**
 * A focus block counts as deep work at 25+ uninterrupted minutes
 * (mirrors DEEP_WORK_MIN_MS in insightsSelectors).
 */
const FOCUS_BLOCK_MS = 25 * 60 * 1000;
const BLOCK_MINUTES = FOCUS_BLOCK_MS / 60000;

export function CircularTimer({
  taskId,
  state,
  display,
  totalTime,
  isReducedMotion = false,
  onStart: onStartOverride,
  onPause: onPauseOverride,
  onResume: onResumeOverride,
  onStop: onStopOverride,
}: CircularTimerProps) {
  const { startParallelTimer, pauseParallelTimer, resumeParallelTimer, stopParallelTimer } =
    usePersonalTaskStore();

  const handleStart = (id: string) => (onStartOverride ?? startParallelTimer)(id);
  const handlePause = (id: string) => (onPauseOverride ?? pauseParallelTimer)(id);
  const handleResume = (id: string) => (onResumeOverride ?? resumeParallelTimer)(id);
  const handleStop = (id: string) => (onStopOverride ?? stopParallelTimer)(id);

  const isRunning = state === 'running';
  const isPaused = state === 'paused';
  const isActive = state !== 'idle';

  // Progress through the current uninterrupted focus block. The parent re-renders
  // every second while a timer is active, so this value stays live.
  const sessionMs = isActive ? parallelTimerEngine.getElapsedMs(taskId) : 0;
  const blockPct = Math.min(100, (sessionMs / FOCUS_BLOCK_MS) * 100);
  const blockMinutes = Math.floor(sessionMs / 60000);
  const blockComplete = blockPct >= 100;
  const hasHours = display.split(':').length > 2;

  return (
    <div className="w-full">
      {/* Time + status */}
      <div className="flex items-end justify-between gap-2">
        <span
          className={`font-mono font-extrabold tabular-nums leading-none tracking-tight transition-colors duration-300 ${
            hasHours ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
          } ${isRunning ? 'text-amber-400' : isPaused ? 'text-amber-400/70' : 'text-surface-200'}`}
        >
          {display}
        </span>
        <span className="flex items-center gap-1.5 pb-0.5 text-[10px] font-semibold sm:text-[11px]">
          {isRunning ? (
            <>
              <motion.span
                className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
                animate={isReducedMotion ? {} : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                aria-hidden="true"
              />
              <span className="text-amber-400">Recording</span>
            </>
          ) : isPaused ? (
            <span className="text-amber-400/70">Paused</span>
          ) : totalTime > 0 ? (
            <span className="text-surface-500">{formatHours(totalTime)} focused</span>
          ) : (
            <span className="text-surface-500">Ready</span>
          )}
        </span>
      </div>

      {/* Horizontal focus meter */}
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800"
        role="progressbar"
        aria-valuenow={Math.round(blockPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${blockMinutes} of ${BLOCK_MINUTES} minutes`}
        aria-label="Focus block progress"
      >
        <motion.div
          className={`h-full rounded-full ${
            isRunning
              ? 'bg-gradient-to-r from-amber-500 to-amber-400'
              : isPaused
              ? 'bg-gradient-to-r from-yellow-500 to-amber-400/80'
              : 'bg-gradient-to-r from-brand-500 to-brand-400'
          }`}
          initial={false}
          animate={{ width: `${blockPct}%` }}
          transition={isReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-medium">
        <span className="text-surface-500">
          {blockMinutes}m of {BLOCK_MINUTES}m block
        </span>
        <span className={blockComplete ? 'font-semibold text-emerald-400' : 'text-surface-500'}>
          {blockComplete ? 'Deep work ✓' : `${Math.round(blockPct)}%`}
        </span>
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-2">
        {!isActive && (
          <motion.button
            type="button"
            whileHover={isReducedMotion ? {} : { scale: 1.01 }}
            whileTap={isReducedMotion ? {} : { scale: 0.98 }}
            onClick={() => handleStart(taskId)}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Play size={13} fill="white" /> Start Focus
          </motion.button>
        )}
        {isRunning && (
          <>
            <motion.button
              type="button"
              whileTap={isReducedMotion ? {} : { scale: 0.98 }}
              onClick={() => handlePause(taskId)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800 text-xs font-semibold text-surface-200 transition-all hover:bg-surface-750 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Pause size={13} /> Pause
            </motion.button>
            <motion.button
              type="button"
              whileTap={isReducedMotion ? {} : { scale: 0.98 }}
              onClick={() => handleStop(taskId)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/15 text-xs font-semibold text-red-400 transition-all hover:bg-red-400/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Square size={12} fill="currentColor" /> Stop
            </motion.button>
          </>
        )}
        {isPaused && (
          <>
            <motion.button
              type="button"
              whileHover={isReducedMotion ? {} : { scale: 1.01 }}
              whileTap={isReducedMotion ? {} : { scale: 0.98 }}
              onClick={() => handleResume(taskId)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Play size={13} fill="white" /> Resume
            </motion.button>
            <motion.button
              type="button"
              whileTap={isReducedMotion ? {} : { scale: 0.98 }}
              onClick={() => handleStop(taskId)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/15 text-xs font-semibold text-red-400 transition-all hover:bg-red-400/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Square size={12} fill="currentColor" /> Stop
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

function formatHours(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

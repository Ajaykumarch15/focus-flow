import { motion } from 'framer-motion';
import { Play, Pause, Square } from 'lucide-react';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';

interface CircularTimerProps {
  taskId: string;
  state: 'idle' | 'running' | 'paused';
  display: string;
  totalTime: number;
  isReducedMotion?: boolean;
}

const SIZE = 110;
const STROKE_WIDTH = 7;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CircularTimer({
  taskId,
  state,
  display,
  totalTime,
  isReducedMotion = false,
}: CircularTimerProps) {
  const { startParallelTimer, pauseParallelTimer, resumeParallelTimer, stopParallelTimer } =
    usePersonalTaskStore();

  const isRunning = state === 'running';
  const isPaused = state === 'paused';
  const isActive = state !== 'idle';

  const progress = isRunning ? 0 : isPaused ? 0.5 : totalTime > 0 ? 1 : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex items-center gap-4">
      {/* Circular Timer */}
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        {/* Glow effect when running */}
        {isRunning && !isReducedMotion && (
          <motion.div
            className="absolute inset-[-6px] rounded-full border-2 border-amber-500/20"
            animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Background circle */}
        <svg
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 -rotate-90"
        >
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-surface-800"
          />
          {/* Progress arc */}
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#timerGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isRunning ? '#f59e0b' : isPaused ? '#eab308' : '#6366f1'} />
              <stop offset="100%" stopColor={isRunning ? '#d97706' : isPaused ? '#ca8a04' : '#4f46e5'} />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={`font-mono font-extrabold tabular-nums tracking-tight transition-colors duration-300 ${
              display.includes(':') && display.split(':').length > 2
                ? 'text-base'
                : 'text-2xl'
            } ${isRunning ? 'text-amber-400' : isPaused ? 'text-amber-400/70' : 'text-surface-200'}`}
          >
            {display}
          </div>
          <p className="text-[10px] font-medium mt-0.5">
            {isRunning ? (
              <span className="text-amber-400 flex items-center gap-1">
                <motion.span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                Recording
              </span>
            ) : isPaused ? (
              <span className="text-amber-400/70">Paused</span>
            ) : totalTime > 0 ? (
              <span className="text-surface-500">{formatHours(totalTime)}</span>
            ) : (
              <span className="text-surface-500">Ready</span>
            )}
          </p>
        </div>
      </div>

      {/* Controls beside the timer */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        {!isActive && (
          <motion.button
            type="button"
            whileHover={isReducedMotion ? {} : { scale: 1.03 }}
            whileTap={isReducedMotion ? {} : { scale: 0.97 }}
            onClick={() => startParallelTimer(taskId)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-all shadow-lg shadow-blue-500/25 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Play size={13} fill="white" /> Start Focus
          </motion.button>
        )}
        {isRunning && (
          <>
            <motion.button
              type="button"
              whileTap={isReducedMotion ? {} : { scale: 0.97 }}
              onClick={() => pauseParallelTimer(taskId)}
              className="px-4 py-2 bg-surface-800 hover:bg-surface-750 text-surface-200 rounded-lg font-semibold text-xs transition-all border border-surface-700 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Pause size={13} /> Pause
            </motion.button>
            <motion.button
              type="button"
              whileTap={isReducedMotion ? {} : { scale: 0.97 }}
              onClick={() => stopParallelTimer(taskId)}
              className="px-4 py-2 bg-red-400/15 hover:bg-red-400/25 text-red-400 rounded-lg font-semibold text-xs transition-all border border-red-400/20 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Square size={12} fill="currentColor" /> Stop
            </motion.button>
          </>
        )}
        {isPaused && (
          <>
            <motion.button
              type="button"
              whileHover={isReducedMotion ? {} : { scale: 1.03 }}
              whileTap={isReducedMotion ? {} : { scale: 0.97 }}
              onClick={() => resumeParallelTimer(taskId)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-all shadow-lg shadow-blue-500/25 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Play size={13} fill="white" /> Resume
            </motion.button>
            <motion.button
              type="button"
              whileTap={isReducedMotion ? {} : { scale: 0.97 }}
              onClick={() => stopParallelTimer(taskId)}
              className="px-4 py-2 bg-red-400/15 hover:bg-red-400/25 text-red-400 rounded-lg font-semibold text-xs transition-all border border-red-400/20 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
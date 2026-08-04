import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Coffee, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { formatDuration } from '../utils/time';
import { pomodoroTimeLeft, pomodoroProgress, isPomodoroComplete } from '../utils/pomodoro';
import { getNotificationSettings } from '../hooks/useNotifications';
import { toast } from '../store/useToastStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Select';

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "Focus is the bridge between where you are and where you want to be.",
  "Do the hard work. Especially when you don't feel like it.",
  "Deep work is the superpower of the 21st century.",
  "One task at a time. One hour at a time.",
];

export function FocusMode() {
  const { profile, theme, tasks, startTimer, pauseTimer, resumeTimer, stopTimer } = useStore();
  const { activeTaskId, activeTimerState, elapsedMs } = useActiveTimer();

  const [mode, setMode] = useState<'pomodoro' | 'break'>('pomodoro');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [quoteIdx, setQuoteIdx] = useState(0);

  // Break countdown — a break is not task time so it cannot run through the
  // engine; it is a timestamp-based countdown (no per-tick accumulation drift).
  const [breakEndAt, setBreakEndAt] = useState<number | null>(null);
  const [breakRemainingMs, setBreakRemainingMs] = useState(profile.pomodoroBreak * 60000);

  const workDurationMs = profile.pomodoroWork * 60000;
  const breakDurationMs = profile.pomodoroBreak * 60000;

  // Focus (pomodoro) sessions run through the timerEngine and record a real
  // session. The countdown is derived from engine elapsed time.
  const engineOnTask = selectedTaskId !== '' && activeTaskId === selectedTaskId;
  const focusElapsedMs = engineOnTask ? elapsedMs : 0;
  const timeLeftMs = pomodoroTimeLeft(workDurationMs, focusElapsedMs);
  const progress = pomodoroProgress(workDurationMs, focusElapsedMs);
  const focusRunning = engineOnTask && activeTimerState === 'running';
  const focusPaused = engineOnTask && activeTimerState === 'paused';

  const breakRunning = breakEndAt !== null;
  const breakPaused = breakEndAt === null && breakRemainingMs < breakDurationMs;

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completionHandledRef = useRef(false);

  const notify = (title: string, body: string, tag: string, kind: 'success' | 'info') => {
    const prefs = getNotificationSettings();
    if (!prefs.pomodoroAlerts) return;
    try {
      new Notification(title, { body, tag, icon: '/favicon.svg' });
    } catch { /* ignore */ }
    if (kind === 'success') toast.success(title, body);
    else toast.info(title, body);
  };

  const startBreak = useCallback(() => {
    setMode('break');
    setBreakRemainingMs(breakDurationMs);
    setBreakEndAt(Date.now() + breakDurationMs);
  }, [breakDurationMs]);

  const pauseBreak = useCallback(() => {
    if (breakEndAt === null) return;
    setBreakRemainingMs(Math.max(0, breakEndAt - Date.now()));
    setBreakEndAt(null);
  }, [breakEndAt]);

  const resumeBreak = useCallback(() => {
    setBreakEndAt(Date.now() + breakRemainingMs);
  }, [breakRemainingMs]);

  const resetBreak = useCallback(() => {
    setBreakEndAt(null);
    setBreakRemainingMs(breakDurationMs);
  }, [breakDurationMs]);

  const enterPomodoro = useCallback(() => {
    setMode('pomodoro');
    resetBreak();
    completionHandledRef.current = false;
  }, [resetBreak]);

  // Auto-complete the focus session when engine elapsed reaches the work duration.
  useEffect(() => {
    if (mode !== 'pomodoro' || !engineOnTask || activeTimerState !== 'running') return;
    if (!isPomodoroComplete(workDurationMs, elapsedMs)) return;
    if (completionHandledRef.current) return;
    completionHandledRef.current = true;
    notify('Focus Session Complete', 'Time for a break! Great work.', 'pomodoro-break', 'success');
    stopTimer(selectedTaskId).finally(() => {
      completionHandledRef.current = false;
      startBreak();
    });
  }, [mode, engineOnTask, activeTimerState, workDurationMs, elapsedMs, selectedTaskId]);

  // Break countdown ticker.
  useEffect(() => {
    if (mode !== 'break' || breakEndAt === null) return;
    const id = window.setInterval(() => {
      setBreakRemainingMs(Math.max(0, breakEndAt - Date.now()));
    }, 250);
    return () => window.clearInterval(id);
  }, [mode, breakEndAt]);

  // Break completion.
  useEffect(() => {
    if (mode !== 'break' || breakEndAt === null) return;
    if (breakRemainingMs > 0) return;
    notify('Break Over', 'Ready for the next focus session?', 'pomodoro-work', 'info');
    enterPomodoro();
  }, [mode, breakEndAt, breakRemainingMs]);

  // Quote rotation.
  useEffect(() => {
    const qi = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 8000);
    return () => clearInterval(qi);
  }, []);

  // Switching to break stops the engine, recording any partial focus session.
  const handleModeChange = async (m: 'pomodoro' | 'break') => {
    if (m === mode) return;
    if (m === 'break') {
      if (engineOnTask) await stopTimer(selectedTaskId);
      startBreak();
    } else {
      enterPomodoro();
    }
  };

  const handleMainToggle = async () => {
    if (mode === 'pomodoro') {
      if (!selectedTaskId) return;
      if (focusRunning) pauseTimer(selectedTaskId);
      else if (focusPaused) resumeTimer(selectedTaskId);
      else await startTimer(selectedTaskId);
    } else {
      if (breakRunning) pauseBreak();
      else if (breakPaused) resumeBreak();
      else startBreak();
    }
  };

  const handleReset = async () => {
    if (mode === 'pomodoro') {
      if (engineOnTask) await stopTimer(selectedTaskId);
    } else {
      resetBreak();
    }
  };

  const handleStop = async () => {
    if (!selectedTaskId) return;
    await stopTimer(selectedTaskId);
    setSelectedTaskId('');
  };

  // Circle math
  const r = 120;
  const circumference = 2 * Math.PI * r;
  const displayedMs = mode === 'pomodoro' ? timeLeftMs : breakRemainingMs;
  const displayedProgress = mode === 'pomodoro'
    ? progress
    : pomodoroProgress(breakDurationMs, breakDurationMs - breakRemainingMs);
  const strokeDashoffset = circumference - (displayedProgress / 100) * circumference;
  const isRunning = mode === 'pomodoro' ? focusRunning : breakRunning;

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: mode === 'pomodoro' ? `radial-gradient(circle, ${theme?.accentColor || '#0ea5e9'}, transparent)` : 'radial-gradient(circle, #22c55e, transparent)' }}
          animate={{ scale: isRunning ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-xl w-full">
        {/* Mode Toggle */}
        <div className="flex bg-surface-900 border border-surface-800 rounded-[14px] p-1.5 mb-8 shadow-sm relative">
          {(['pomodoro', 'break'] as const).map(m => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`relative px-6 py-2.5 rounded-[10px] text-xs font-semibold transition-colors ${
                  active ? 'text-white' : 'text-surface-400 hover:text-surface-50'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="focusModeTab"
                    className="absolute inset-0 rounded-[10px] bg-brand-500 shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {m === 'pomodoro' ? <Zap size={14} /> : <Coffee size={14} />}
                  {m === 'pomodoro' ? 'Focus Session' : 'Break Session'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Timer Elevated Card */}
        <Card className="p-8 flex flex-col items-center mb-8 w-full bg-[#FFFDF5] dark:bg-surface-900">
          <div className="relative mb-6">
            <svg viewBox="0 0 280 280" width="100%" style={{ maxWidth: 280 }} className="-rotate-90">
              <circle cx="140" cy="140" r={r} fill="none" stroke="var(--color-surface-800)" strokeWidth="8" />
              <motion.circle
                cx="140" cy="140" r={r}
                fill="none"
                stroke={mode === 'pomodoro' ? '#f59e0b' : '#22c55e'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="timer-display text-5xl lg:text-6xl font-extrabold text-surface-50 mb-1">
                {formatDuration(displayedMs)}
              </div>
              <div className={`text-xs font-bold uppercase tracking-wider ${mode === 'pomodoro' ? 'text-amber-500' : 'text-emerald-500'}`}>
                {mode === 'pomodoro'
                  ? focusRunning ? 'Focusing' : focusPaused ? 'Paused' : 'Ready to Focus'
                  : breakRunning ? 'Break Time' : breakPaused ? 'Break Paused' : 'Break Ready'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="px-4"
              onClick={handleReset}
              title="Reset Timer"
              leftIcon={<RotateCcw size={18} />}
            />
            <Button
              size="lg"
              className={`px-8 text-base ${isRunning ? 'bg-none shadow-amber-500/25' : ''}`}
              style={isRunning ? { backgroundColor: '#f59e0b' } : undefined}
              onClick={handleMainToggle}
              disabled={mode === 'pomodoro' && !selectedTaskId}
              leftIcon={isRunning ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            >
              {isRunning ? 'Pause'
                : mode === 'pomodoro' ? (focusPaused ? 'Resume Focus' : 'Start Focus')
                : (breakPaused ? 'Resume Break' : 'Start Break')}
            </Button>
            {mode === 'pomodoro' && selectedTaskId && activeTaskId === selectedTaskId && (
              <Button
                variant="danger"
                size="lg"
                className="px-4"
                onClick={handleStop}
                title="Stop Timer"
                leftIcon={<Square size={16} fill="currentColor" />}
              />
            )}
          </div>
        </Card>

        {/* Task selector */}
        <div className="w-full mb-6">
          <Select
            className="text-center font-medium"
            value={selectedTaskId}
            onChange={e => setSelectedTaskId(e.target.value)}
            disabled={focusRunning || focusPaused}
          >
            <option value="">— Select a task to focus on —</option>
            {activeTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
          {mode === 'pomodoro' && !selectedTaskId && (
            <p className="text-center text-xs text-surface-500 mt-2">
              Select a task to record your focus time to your work log.
            </p>
          )}
        </div>

        {/* Quote */}
        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-surface-400 text-center italic text-sm max-w-sm font-medium"
          >
            "{QUOTES[quoteIdx]}"
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

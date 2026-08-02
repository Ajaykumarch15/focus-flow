import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Coffee, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/time';
import { getNotificationSettings } from '../hooks/useNotifications';
import { toast } from '../store/useToastStore';

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "Focus is the bridge between where you are and where you want to be.",
  "Do the hard work. Especially when you don't feel like it.",
  "Deep work is the superpower of the 21st century.",
  "One task at a time. One hour at a time.",
];

export function FocusMode() {
  const { profile, theme, tasks, startTimer, pauseTimer, resumeTimer, stopTimer, activeTaskId } = useStore();
  const [mode, setMode] = useState<'pomodoro' | 'break'>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(profile.pomodoroWork * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [quoteIdx, setQuoteIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalTime = mode === 'pomodoro' ? profile.pomodoroWork * 60 : profile.pomodoroBreak * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  useEffect(() => {
    setTimeLeft(mode === 'pomodoro' ? profile.pomodoroWork * 60 : profile.pomodoroBreak * 60);
    setIsRunning(false);
  }, [mode, profile]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            setIsRunning(false);
            const prefs = getNotificationSettings();
            if (prefs.pomodoroAlerts) {
              if (mode === 'pomodoro') {
                try {
                  new Notification('Focus Session Complete', {
                    body: 'Time for a break! Great work.',
                    tag: 'pomodoro-break',
                    icon: '/favicon.svg',
                  });
                } catch { /* ignore */ }
                toast.success('Focus Session Complete', 'Time for a break! Great work.');
              } else {
                try {
                  new Notification('Break Over', {
                    body: 'Ready for the next focus session?',
                    tag: 'pomodoro-work',
                    icon: '/favicon.svg',
                  });
                } catch { /* ignore */ }
                toast.info('Break Over', 'Ready for the next focus session?');
              }
            }
            if (mode === 'pomodoro') setMode('break');
            else setMode('pomodoro');
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, mode]);

  useEffect(() => {
    const qi = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 8000);
    return () => clearInterval(qi);
  }, []);

  const handleToggle = () => {
    setIsRunning(!isRunning);
    if (selectedTaskId) {
      if (!isRunning) {
        if (activeTaskId !== selectedTaskId) startTimer(selectedTaskId);
        else resumeTimer(selectedTaskId);
      } else {
        pauseTimer(selectedTaskId);
      }
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'pomodoro' ? profile.pomodoroWork * 60 : profile.pomodoroBreak * 60);
    if (selectedTaskId && activeTaskId === selectedTaskId) stopTimer(selectedTaskId);
  };

  // Circle math
  const r = 120;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

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
        <div className="flex bg-surface-900 border border-surface-800 rounded-[14px] p-1.5 mb-8 shadow-sm">
          {(['pomodoro', 'break'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-6 py-2.5 rounded-[10px] text-xs font-semibold transition-all ${mode === m ? 'bg-brand-500 text-white shadow-sm' : 'text-surface-400 hover:text-surface-50'}`}
            >
              {m === 'pomodoro' ? <span className="flex items-center gap-1.5"><Zap size={14} /> Focus Session</span> : <span className="flex items-center gap-1.5"><Coffee size={14} /> Break Session</span>}
            </button>
          ))}
        </div>

        {/* Timer Elevated Card */}
        <div className="card p-8 rounded-[22px] shadow-sm border border-surface-800 flex flex-col items-center mb-8 w-full bg-[#FFFDF5] dark:bg-surface-900">
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
                {formatDuration(timeLeft * 1000)}
              </div>
              <div className={`text-xs font-bold uppercase tracking-wider ${mode === 'pomodoro' ? 'text-amber-500' : 'text-emerald-500'}`}>
                {mode === 'pomodoro' ? 'Focusing' : 'Break Time'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="btn-secondary px-4"
              title="Reset Timer"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={handleToggle}
              className={`btn-primary px-8 text-base font-semibold ${
                isRunning ? 'bg-amber-500 text-white' : ''
              }`}
            >
              {isRunning ? <span className="flex items-center gap-2"><Pause size={18} /> Pause</span>
                         : <span className="flex items-center gap-2"><Play size={18} fill="white" /> Start Focus</span>}
            </button>
            {selectedTaskId && activeTaskId === selectedTaskId && (
              <button
                onClick={() => { stopTimer(selectedTaskId); setSelectedTaskId(''); }}
                className="btn-danger px-4"
                title="Stop Timer"
              >
                <Square size={16} fill="currentColor" />
              </button>
            )}
          </div>
        </div>

        {/* Task selector */}
        <div className="w-full mb-6">
          <select
            className="input h-12 rounded-[14px] text-center font-medium"
            value={selectedTaskId}
            onChange={e => setSelectedTaskId(e.target.value)}
          >
            <option value="">— Select a task to focus on —</option>
            {activeTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
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

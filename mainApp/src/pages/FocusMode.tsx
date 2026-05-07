import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Minimize2, Coffee, Zap, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/time';

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "Focus is the bridge between where you are and where you want to be.",
  "Do the hard work. Especially when you don't feel like it.",
  "Deep work is the superpower of the 21st century.",
  "One task at a time. One hour at a time.",
];

export function FocusMode() {
  const { profile, tasks, startTimer, pauseTimer, resumeTimer, stopTimer, activeTaskId, activeTimerState } = useStore();
  const [mode, setMode] = useState<'pomodoro' | 'break'>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(profile.pomodoroWork * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [quoteIdx, setQuoteIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalTime = mode === 'pomodoro' ? profile.pomodoroWork * 60 : profile.pomodoroBreak * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

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
          style={{ background: mode === 'pomodoro' ? 'radial-gradient(circle, #0ea5e9, transparent)' : 'radial-gradient(circle, #22c55e, transparent)' }}
          animate={{ scale: isRunning ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-xl w-full">
        {/* Mode Toggle */}
        <div className="flex bg-surface-900 border border-surface-800 rounded-2xl p-1 mb-8">
          {(['pomodoro', 'break'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${mode === m ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white'}`}
            >
              {m === 'pomodoro' ? <span className="flex items-center gap-1.5"><Zap size={14} /> Focus</span> : <span className="flex items-center gap-1.5"><Coffee size={14} /> Break</span>}
            </button>
          ))}
        </div>

        {/* Timer Circle */}
        <div className="relative mb-8">
          <svg width="300" height="300" className="-rotate-90">
            <circle cx="150" cy="150" r={r} fill="none" stroke="#27272a" strokeWidth="8" />
            <motion.circle
              cx="150" cy="150" r={r}
              fill="none"
              stroke={mode === 'pomodoro' ? '#0ea5e9' : '#22c55e'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="timer-display text-6xl font-bold text-white mb-1">
              {formatDuration(timeLeft * 1000)}
            </div>
            <div className={`text-sm font-medium ${mode === 'pomodoro' ? 'text-brand-400' : 'text-emerald-400'}`}>
              {mode === 'pomodoro' ? 'Focus Time' : 'Break Time'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleReset}
            className="p-3 rounded-2xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white transition-all"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={handleToggle}
            className={`px-10 py-4 rounded-2xl font-semibold text-white text-lg transition-all active:scale-95 ${
              isRunning ? 'bg-yellow-500/80 hover:bg-yellow-500' : 'bg-brand-500 hover:bg-brand-400'
            }`}
          >
            {isRunning ? <span className="flex items-center gap-2"><Pause size={20} /> Pause</span>
                       : <span className="flex items-center gap-2"><Play size={20} /> Start</span>}
          </button>
          {selectedTaskId && activeTaskId === selectedTaskId && (
            <button
              onClick={() => { stopTimer(selectedTaskId); setSelectedTaskId(''); }}
              className="p-3 rounded-2xl bg-surface-800 hover:bg-red-500/20 text-surface-300 hover:text-red-400 transition-all"
            >
              <Square size={20} />
            </button>
          )}
        </div>

        {/* Task selector */}
        <div className="w-full mb-6">
          <select
            className="input text-center"
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
            className="text-surface-400 text-center italic text-sm max-w-xs"
          >
            "{QUOTES[quoteIdx]}"
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

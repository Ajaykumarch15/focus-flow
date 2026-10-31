import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, Clock, Pause, Play, Plus, SmilePlus, Square, Target, Trash2, X, Flame, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Habit, HabitFeeling, getTodayHabitEntry, useHabitStore } from '@worklog/services/useHabitStore';
import { Skeleton, SkeletonStatCard } from '@shared/components/ui/Skeleton';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { StatisticsCard } from '@shared/components/ui/StatisticsCard';
import { NoHabits } from '@shared/components/illustrations';

const COLORS = ['#22c55e', '#0ea5e9', '#a855f7', '#f97316', '#ef4444'];
const FEELING_SCORES: Record<HabitFeeling, number> = { rough: 1, okay: 2, good: 3, great: 4, energized: 5 };
const FEELINGS: { value: HabitFeeling; label: string }[] = [
  { value: 'rough', label: 'Rough' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'great', label: 'Great' },
  { value: 'energized', label: 'Energized' },
];

function computeStreak(habit: Habit): number {
  const sorted = [...habit.entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = sorted.find(e => e.date?.slice(0, 10) === key);
    if (entry && entry.completedItems.length > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function computeCompletionHistory(habit: Habit, days: number): { date: string; completed: number; total: number }[] {
  const result: { date: string; completed: number; total: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const total = habit.checklist.length || 1;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = habit.entries.find(e => e.date?.slice(0, 10) === key);
    result.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      completed: entry ? entry.completedItems.length : 0,
      total,
    });
  }
  return result;
}

function computeFeelingTrend(habit: Habit, days: number): { date: string; score: number }[] {
  const result: { date: string; score: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = habit.entries.find(e => e.date?.slice(0, 10) === key);
    result.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      score: entry?.feeling ? FEELING_SCORES[entry.feeling] : 0,
    });
  }
  return result;
}

function HabitAnalytics({ habit }: { habit: Habit }) {
  const streak = computeStreak(habit);
  const completionData = useMemo(() => computeCompletionHistory(habit, 30), [habit]);
  const feelingData = useMemo(() => computeFeelingTrend(habit, 30), [habit]);
  const totalEntries = habit.entries.filter(e => e.completedItems.length > 0).length;
  const avgMinutes = habit.entries.length > 0 ? Math.round(habit.entries.reduce((s, e) => s + e.minutes, 0) / habit.entries.length) : 0;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="flex items-center gap-2 p-3 bg-surface-800/50 rounded-xl">
          <Flame size={16} className="text-orange-400" />
          <div>
            <p className="text-lg font-bold text-surface-50">{streak}</p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wider">Day Streak</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-surface-800/50 rounded-xl">
          <TrendingUp size={16} className="text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-surface-50">{totalEntries}</p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wider">Total Days Done</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-surface-800/50 rounded-xl">
          <Clock size={16} className="text-blue-400" />
          <div>
            <p className="text-lg font-bold text-surface-50">{avgMinutes}m</p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wider">Avg Daily Time</p>
          </div>
        </div>
      </div>
      {completionData.some(d => d.completed > 0) && (
        <div className="bg-surface-800/50 rounded-xl p-3 mb-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-2">30-Day Completion</p>
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionData}>
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip contentStyle={{ fontSize: 11, background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="completed" fill={habit.color} radius={[3, 3, 0, 0]} maxBarSize={12} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {feelingData.some(d => d.score > 0) && (
        <div className="bg-surface-800/50 rounded-xl p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-2">30-Day Feeling Trend</p>
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feelingData}>
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis hide domain={[0, 5]} />
                <Tooltip contentStyle={{ fontSize: 11, background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => ['😐😊'[Math.min(4, Math.max(0, v - 1))] || '—', 'Feeling']} />
                <Bar dataKey="score" fill="#a855f7" radius={[3, 3, 0, 0]} maxBarSize={12} fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function completionPercent(habit: Habit): number {
  if (habit.checklist.length === 0) return 0;
  const entry = getTodayHabitEntry(habit);
  return Math.round((entry.completedItems.length / habit.checklist.length) * 100);
}

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatMinutes(minutes: number): string {
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
}

function NewHabitForm({ onClose }: { onClose: () => void }) {
  const { createHabit, creating } = useHabitStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetMinutes, setTargetMinutes] = useState(20);
  const [color, setColor] = useState(COLORS[0]);
  const [items, setItems] = useState(['']);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await createHabit({
      title: title.trim(),
      description: description.trim(),
      targetMinutes,
      color,
      checklist: items.map(item => item.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={submit}
      className="card p-5 mb-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3 mb-3">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Habit name"
          autoFocus
        />
        <div className="relative">
          <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <Input
            className="pl-9"
            type="number"
            min={0}
            value={targetMinutes}
            onChange={e => setTargetMinutes(Number(e.target.value))}
            placeholder="Minutes"
          />
        </div>
      </div>

      <Textarea
        className="resize-none mb-3"
        rows={2}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="What does this habit help you maintain?"
      />

      <div className="flex items-center gap-2 mb-4">
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
            style={{ background: c }}
            aria-label={`Use color ${c}`}
          />
        ))}
      </div>

      <div className="space-y-2 mb-4">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              className="text-sm"
              value={item}
              onChange={e => setItems(current => current.map((v, i) => i === index ? e.target.value : v))}
              placeholder={`Checklist item ${index + 1}`}
            />
            <Button
              type="button"
              variant="danger"
              size="icon-sm"
              onClick={() => setItems(current => current.filter((_, i) => i !== index))}
              disabled={items.length === 1}
              aria-label="Remove checklist item"
            >
              <X size={15} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setItems(current => [...current, ''])}
          className="text-sm"
          leftIcon={<Plus size={14} />}
        >
          Add checklist item
        </Button>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={!title.trim() || creating} className="flex-1">
          {creating ? 'Creating...' : 'Create Habit'}
        </Button>
      </div>
    </motion.form>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const {
    addChecklistItem, deleteChecklistItem, deleteHabit, updateToday,
    activeHabitId, habitTimerState, startTimer, pauseTimer, resumeTimer, stopTimer,
    getLiveElapsedMs, getLiveMinutes,
  } = useHabitStore();
  const entry = getTodayHabitEntry(habit);
  const [newItem, setNewItem] = useState('');
  const [note, setNote] = useState(entry.note);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [, forceTick] = useState(0);
  const streak = useMemo(() => computeStreak(habit), [habit]);

  const isThisActive = activeHabitId === habit._id;
  const isRunning = isThisActive && habitTimerState === 'running';
  const isPaused = isThisActive && habitTimerState === 'paused';
  const liveElapsedMs = getLiveElapsedMs(habit._id);
  const liveMinutes = getLiveMinutes(habit._id);
  const extraMinutes = Math.max(0, liveMinutes - habit.targetMinutes);

  useEffect(() => {
    setNote(entry.note);
  }, [entry.note]);

  useEffect(() => {
    if (!isThisActive) return;
    const timer = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [isThisActive, habitTimerState]);

  const toggleItem = (itemId: string) => {
    const completedItems = entry.completedItems.includes(itemId)
      ? entry.completedItems.filter(id => id !== itemId)
      : [...entry.completedItems, itemId];
    updateToday(habit._id, { completedItems });
  };

  const addItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newItem.trim()) return;
    await addChecklistItem(habit._id, newItem.trim());
    setNewItem('');
  };

  const percent = completionPercent(habit);
  const minutesPercent = habit.targetMinutes > 0
    ? Math.min(100, Math.round((liveMinutes / habit.targetMinutes) * 100))
    : 0;

  const minutesRingR = 26;
  const minutesRingC = 2 * Math.PI * minutesRingR;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isRunning
          ? 'border-emerald-400/40 bg-emerald-400/[0.04] shadow-lg shadow-emerald-500/10'
          : isPaused
          ? 'border-yellow-400/40 bg-yellow-400/[0.04] shadow-lg shadow-yellow-500/10'
          : 'border-surface-800 bg-transparent hover:border-surface-700'
      }`}
    >
      {/* Habit-colored top accent strip */}
      <div className="absolute top-0 inset-x-0 h-[3px] z-10" style={{ background: habit.color }} />

      <div className="p-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{ background: `${habit.color}1f`, color: habit.color }}
              aria-hidden="true"
            >
              {habit.title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-semibold text-surface-50 truncate">{habit.title}</h2>
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> RUNNING
                  </span>
                )}
                {streak > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-orange-400 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                    <Flame size={11} /> {streak} day{streak !== 1 ? 's' : ''} streak
                  </span>
                )}
              </div>
              {habit.description && (
                <p className="text-sm text-surface-400 line-clamp-2 mt-1">{habit.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isThisActive && (
              <Button
                onClick={() => startTimer(habit._id)}
                disabled={!!activeHabitId}
                size="sm"
                className="disabled:opacity-40 disabled:cursor-not-allowed"
                leftIcon={<Play size={13} fill="currentColor" />}
              >
                Start
              </Button>
            )}
            {isRunning && (
              <Button variant="secondary" size="sm" onClick={() => pauseTimer(habit._id)}
                className="text-yellow-300" leftIcon={<Pause size={13} />}>
                Pause
              </Button>
            )}
            {isPaused && (
              <Button size="sm" onClick={() => resumeTimer(habit._id)}
                leftIcon={<Play size={13} fill="currentColor" />}>
                Resume
              </Button>
            )}
            {isThisActive && (
              <Button variant="secondary" size="sm" onClick={() => stopTimer(habit._id)}
                className="text-red-300" leftIcon={<Square size={12} fill="currentColor" />}>
                Stop
              </Button>
            )}
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`p-2 rounded-lg transition-all ${showAnalytics ? 'text-brand-400 bg-brand-500/10' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800'}`}
              aria-label="Toggle analytics"
              title="View analytics"
            >
              <TrendingUp size={15} />
            </button>
            <button
              onClick={() => deleteHabit(habit._id)}
              className="p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
              aria-label="Delete habit"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showAnalytics && <HabitAnalytics habit={habit} />}
        </AnimatePresence>

        {/* ── Timer panel ── */}
        <div className={`rounded-xl border p-4 mb-4 ${
          isRunning
            ? 'border-emerald-400/30 bg-emerald-400/10'
            : isPaused
            ? 'border-yellow-400/30 bg-yellow-400/10'
            : 'border-surface-800 bg-surface-900/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Status + big clock */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                <span className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-emerald-400 animate-pulse' : isPaused ? 'bg-yellow-400' : 'bg-surface-600'
                }`} />
                <span className={isRunning ? 'text-emerald-300' : isPaused ? 'text-yellow-300' : 'text-surface-400'}>
                  {isRunning ? 'Running' : isPaused ? 'Paused' : 'Ready to track'}
                </span>
              </div>
              <div className={`timer-display text-3xl sm:text-4xl font-bold tabular-nums tracking-tight ${
                isRunning ? 'text-emerald-300' : isPaused ? 'text-yellow-300' : 'text-surface-300'
              }`}>
                {isThisActive ? formatClock(liveElapsedMs) : formatClock(0)}
              </div>
              {!!activeHabitId && !isThisActive && (
                <p className="text-xs text-yellow-300 mt-2">
                  Another habit timer is running. Stop it before starting this one.
                </p>
              )}
            </div>

            {/* Minutes ring */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="relative w-16 h-16">
                <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                  <circle cx="32" cy="32" r={minutesRingR} fill="none" stroke="currentColor"
                    strokeWidth="5" className="text-surface-800" />
                  <circle cx="32" cy="32" r={minutesRingR} fill="none" stroke="currentColor"
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={`${(minutesPercent / 100) * minutesRingC} ${minutesRingC}`}
                    className={minutesPercent >= 100 ? 'text-success-400' : 'text-brand-400'} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-surface-100">{minutesPercent}%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-surface-400 font-semibold uppercase tracking-wider mb-0.5">Today total</div>
                <div className="text-lg font-display font-bold text-surface-50">
                  {formatMinutes(liveMinutes)}m <span className="text-surface-500 font-normal">/ {habit.targetMinutes}m</span>
                </div>
                {extraMinutes > 0 && (
                  <div className="text-xs text-emerald-300 mt-1">
                    +{formatMinutes(extraMinutes)}m extra
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Checklist progress ── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-surface-800 bg-transparent p-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-surface-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: habit.color }} />
                Checklist
              </span>
              <span className="font-bold text-surface-100">{percent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: habit.color }} />
            </div>
          </div>
          <div className="rounded-xl border border-surface-800 bg-transparent p-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-surface-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-brand-400" />
                Time
              </span>
              <span className="font-bold text-surface-100">{formatMinutes(liveMinutes)}/{habit.targetMinutes}m</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
              <div className="h-full rounded-full bg-brand-400 transition-all duration-500" style={{ width: `${minutesPercent}%` }} />
            </div>
          </div>
        </div>

        {/* ── Checklist ── */}
        <div className="space-y-1.5 mb-4">
          {habit.checklist.length > 0 && (
            <div className="flex items-center justify-between text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">
              <span>Checklist</span>
              <span>{entry.completedItems.length}/{habit.checklist.length} done</span>
            </div>
          )}
          {habit.checklist.map(item => {
            const checked = entry.completedItems.includes(item._id);
            return (
              <div key={item._id} className="flex items-center gap-3 p-2 -mx-1.5 rounded-lg group hover:bg-surface-800/50 transition-colors">
                <button
                  onClick={() => toggleItem(item._id)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checked ? 'text-surface-50' : 'border-surface-600 text-transparent hover:text-surface-400'
                  }`}
                  style={checked ? { background: habit.color, borderColor: habit.color } : undefined}
                  aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
                >
                  <Check size={13} strokeWidth={3} />
                </button>
                <span className={`flex-1 text-sm transition-colors ${
                  checked ? 'text-surface-500 line-through' : 'text-surface-200 group-hover:text-surface-50'
                }`}>
                  {item.text}
                </span>
                <button
                  onClick={() => deleteChecklistItem(habit._id, item._id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-surface-600 hover:text-red-400 transition-all"
                  aria-label="Delete checklist item"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <form onSubmit={addItem} className="flex gap-2 mb-4">
          <Input
            className="text-sm py-2 rounded-xl"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add checklist item"
          />
          <Button type="submit" variant="secondary" size="icon-sm" aria-label="Add checklist item">
            <Plus size={15} />
          </Button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 rounded-xl border border-surface-800 bg-surface-900/30 p-4 mb-4">
          <div>
            <label className="text-[11px] text-surface-400 flex items-center gap-1.5 font-semibold uppercase tracking-wider mb-2">
              <Clock size={11} /> Time count
            </label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={liveMinutes}
              disabled={isThisActive}
              onChange={e => updateToday(habit._id, { minutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[11px] text-surface-400 flex items-center gap-1.5 font-semibold uppercase tracking-wider mb-2">
              <SmilePlus size={11} /> How I felt
            </label>
            <div className="flex gap-2 flex-wrap">
              {FEELINGS.map(feeling => (
                <button
                  key={feeling.value}
                  onClick={() => updateToday(habit._id, { feeling: feeling.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    entry.feeling === feeling.value
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-surface-800 text-surface-300 hover:text-surface-50 hover:bg-surface-700'
                  }`}
                >
                  {feeling.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Textarea
          className="resize-none text-sm"
          rows={2}
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={() => updateToday(habit._id, { note })}
          placeholder="Add a note about today's habit session"
        />
      </div>
    </motion.div>
  );
}

export function Habits() {
  const { habits, loading, loadHabits, getLiveMinutes } = useHabitStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadHabits();
  }, []);

  const todayMinutes = habits.reduce((sum, habit) => sum + getLiveMinutes(habit._id), 0);
  const completedToday = habits.filter(habit => completionPercent(habit) === 100 && habit.checklist.length > 0).length;

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader title="Habits" description={`${habits.length} Habits · ${completedToday} Completed Today · ${todayMinutes}m Logged`}
        
        actions={<Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={18} />}>New Habit</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <StatisticsCard
          title="Completed Today"
          value={completedToday}
          description="Habits fully checked"
          icon={<Target size={14} />}
          accent="success"
          transparent
          alwaysShowBorder
          backgroundImage="/SVG/svg/thumbs%20up.svg"
          backgroundPosition="bottom-right"
        />
        <StatisticsCard
          title="Habit Time Today"
          value={`${todayMinutes}m`}
          description="Total minutes tracked"
          icon={<Clock size={14} />}
          accent="info"
          transparent
          alwaysShowBorder
          backgroundImage="/SVG/svg/time-management_4ss6.svg"
          backgroundPosition="bottom-left"
        />
        <StatisticsCard
          title="Checklist Items Done"
          value={habits.reduce((sum, habit) => sum + getTodayHabitEntry(habit).completedItems.length, 0)}
          description="Across all habits"
          icon={<Check size={14} />}
          accent="brand"
          transparent
          alwaysShowBorder
          backgroundImage="/SVG/svg/PLAN.svg"
          backgroundPosition="top-right"
        />
      </div>

      <AnimatePresence>
        {showCreate && <NewHabitForm onClose={() => setShowCreate(false)} />}
      </AnimatePresence>

      {loading && habits.length === 0 ? (
        <div className="space-y-4">
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>

          {/* Habit card skeletons */}
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="h-5 w-32 rounded" />
                </div>
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-full rounded-full mb-3" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : habits.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            illustration={<NoHabits />}
            title="No habits yet"
            description="Create your first habit and track today in one place."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {habits.map(habit => <HabitCard key={habit._id} habit={habit} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Check, Clock, Pause, Play, Plus, SmilePlus, Square, Target, Trash2, X,
} from 'lucide-react';
import { Habit, HabitFeeling, getTodayHabitEntry, useHabitStore } from '../store/useHabitStore';
import { Skeleton, SkeletonStatCard } from '../components/ui/Skeleton';

const COLORS = ['#22c55e', '#0ea5e9', '#a855f7', '#f97316', '#ef4444'];
const FEELINGS: { value: HabitFeeling; label: string }[] = [
  { value: 'rough', label: 'Rough' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'great', label: 'Great' },
  { value: 'energized', label: 'Energized' },
];

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
        <input
          className="input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Habit name"
          autoFocus
        />
        <div className="relative">
          <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-9"
            type="number"
            min={0}
            value={targetMinutes}
            onChange={e => setTargetMinutes(Number(e.target.value))}
            placeholder="Minutes"
          />
        </div>
      </div>

      <textarea
        className="input resize-none mb-3"
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
            <input
              className="input text-sm"
              value={item}
              onChange={e => setItems(current => current.map((v, i) => i === index ? e.target.value : v))}
              placeholder={`Checklist item ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => setItems(current => current.filter((_, i) => i !== index))}
              className="btn-secondary px-3"
              disabled={items.length === 1}
              aria-label="Remove checklist item"
            >
              <X size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems(current => [...current, ''])}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <Plus size={14} /> Add checklist item
        </button>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={!title.trim() || creating} className="btn-primary flex-1">
          {creating ? 'Creating...' : 'Create Habit'}
        </button>
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
  const [, forceTick] = useState(0);

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: habit.color }} />
            <h2 className="font-display font-semibold text-surface-50 truncate">{habit.title}</h2>
          </div>
          {habit.description && <p className="text-sm text-surface-400 line-clamp-2">{habit.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!isThisActive && (
            <button
              onClick={() => startTimer(habit._id)}
              disabled={!!activeHabitId}
              className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={14} fill="currentColor" /> Start
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => pauseTimer(habit._id)}
              className="btn-secondary flex items-center gap-2 text-yellow-300"
            >
              <Pause size={14} /> Pause
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => resumeTimer(habit._id)}
              className="btn-primary flex items-center gap-2"
            >
              <Play size={14} fill="currentColor" /> Resume
            </button>
          )}
          {isThisActive && (
            <button
              onClick={() => stopTimer(habit._id)}
              className="btn-secondary flex items-center gap-2 text-red-300"
            >
              <Square size={13} fill="currentColor" /> Stop
            </button>
          )}
          <button
            onClick={() => deleteHabit(habit._id)}
            className="p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
            aria-label="Delete habit"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className={`rounded-xl border p-4 mb-5 ${
        isRunning
          ? 'border-emerald-400/30 bg-emerald-400/10'
          : isPaused
          ? 'border-yellow-400/30 bg-yellow-400/10'
          : 'border-surface-800 bg-surface-900/50'
      }`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-surface-400 mb-1">
              {isRunning ? 'Running' : isPaused ? 'Paused' : 'Ready to track'}
            </div>
            <div className={`timer-display text-3xl font-bold ${
              isRunning ? 'text-emerald-300' : isPaused ? 'text-yellow-300' : 'text-surface-300'
            }`}>
              {isThisActive ? formatClock(liveElapsedMs) : formatClock(0)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-surface-400 mb-1">Today total</div>
            <div className="text-lg font-display font-bold text-surface-50">
              {formatMinutes(liveMinutes)}m / {habit.targetMinutes}m
            </div>
            {extraMinutes > 0 && (
              <div className="text-xs text-emerald-300 mt-1">
                +{formatMinutes(extraMinutes)}m more time worked
              </div>
            )}
          </div>
        </div>
        {!!activeHabitId && !isThisActive && (
          <div className="text-xs text-yellow-300 mt-3">
            Another habit timer is running. Stop it before starting this one.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-surface-900/60 border border-surface-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-surface-400 mb-2">
            <span>Checklist</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: habit.color }} />
          </div>
        </div>
        <div className="bg-surface-900/60 border border-surface-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-surface-400 mb-2">
            <span>Time</span>
            <span>{formatMinutes(liveMinutes)}/{habit.targetMinutes}m</span>
          </div>
          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div className="h-full rounded-full bg-brand-400" style={{ width: `${minutesPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {habit.checklist.map(item => {
          const checked = entry.completedItems.includes(item._id);
          return (
            <div key={item._id} className="flex items-center gap-2 group">
              <button
                onClick={() => toggleItem(item._id)}
                className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                  checked ? 'text-surface-50' : 'border-surface-600 text-transparent hover:text-surface-400'
                }`}
                style={checked ? { background: habit.color, borderColor: habit.color } : undefined}
                aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
              >
                <Check size={14} />
              </button>
              <span className={`flex-1 text-sm ${checked ? 'text-surface-400 line-through' : 'text-surface-200'}`}>
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

      <form onSubmit={addItem} className="flex gap-2 mb-5">
        <input
          className="input text-sm py-2"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Add checklist item"
        />
        <button type="submit" className="btn-secondary px-3" aria-label="Add checklist item">
          <Plus size={15} />
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
        <div>
          <label className="text-xs text-surface-400 flex items-center gap-1.5 mb-2">
            <Clock size={12} /> Time count
          </label>
          <input
            className="input"
            type="number"
            min={0}
            step={0.1}
            value={liveMinutes}
            disabled={isThisActive}
            onChange={e => updateToday(habit._id, { minutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs text-surface-400 flex items-center gap-1.5 mb-2">
            <SmilePlus size={12} /> How I felt
          </label>
          <div className="flex gap-2 flex-wrap">
            {FEELINGS.map(feeling => (
              <button
                key={feeling.value}
                onClick={() => updateToday(habit._id, { feeling: feeling.value })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  entry.feeling === feeling.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-800 text-surface-300 hover:text-surface-50'
                }`}
              >
                {feeling.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <textarea
        className="input resize-none mt-4 text-sm"
        rows={2}
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => updateToday(habit._id, { note })}
        placeholder="Add a note about today's habit session"
      />
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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl">⚡</span>
            Habits
          </h1>
          <p className="text-surface-400 font-medium text-sm mt-1.5">
            {habits.length} Habits · {completedToday} Completed Today · {todayMinutes}m Logged
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} /> New Habit
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="card p-5 rounded-[22px] shadow-sm hover:-translate-y-1 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <Target size={18} />
          </div>
          <div className="text-2xl lg:text-3xl font-display font-bold text-surface-50 mb-0.5">{completedToday}</div>
          <div className="text-sm font-medium text-surface-300">Fully checked today</div>
        </div>
        <div className="card p-5 rounded-[22px] shadow-sm hover:-translate-y-1 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <Clock size={18} />
          </div>
          <div className="text-2xl lg:text-3xl font-display font-bold text-surface-50 mb-0.5">{todayMinutes}m</div>
          <div className="text-sm font-medium text-surface-300">Habit time today</div>
        </div>
        <div className="card p-5 rounded-[22px] shadow-sm hover:-translate-y-1 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
            <Check size={18} />
          </div>
          <div className="text-2xl lg:text-3xl font-display font-bold text-surface-50 mb-0.5">
            {habits.reduce((sum, habit) => sum + getTodayHabitEntry(habit).completedItems.length, 0)}
          </div>
          <div className="text-sm font-medium text-surface-300">Checklist items done</div>
        </div>
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
            <div key={i} className="card p-5">
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
            </div>
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="card p-10 text-center">
          <Activity size={38} className="text-surface-600 mx-auto mb-3" />
          <p className="text-surface-200 font-medium">No habits yet</p>
          <p className="text-surface-500 text-sm mt-1">Create your first habit and track today in one place.</p>
        </div>
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

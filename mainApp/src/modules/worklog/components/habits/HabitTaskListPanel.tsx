import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Clock, Flame, Plus, X, Target } from 'lucide-react';
import {
  Habit, getTodayHabitEntry, useHabitStore,
} from '@worklog/services/useHabitStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { cn } from '@shared/utils/cn';

const COLORS = ['#22c55e', '#0ea5e9', '#a855f7', '#f97316', '#ef4444'];

function completionPercent(habit: Habit): number {
  if (!habit.checklist.length) return 0;
  return Math.round((getTodayHabitEntry(habit).completedItems.length / habit.checklist.length) * 100);
}

function streakFor(habit: Habit): number {
  const active = new Set(
    habit.entries.filter((e) => e.completedItems?.length).map((e) => String(e.date).slice(0, 10)),
  );
  const cursor = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!active.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(key(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
      checklist: items.map((item) => item.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={submit}
      className="rounded-xl border border-surface-800 bg-surface-900 p-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Habit name" autoFocus />
        <Input className="pl-3" type="number" min={0} value={targetMinutes}
          onChange={(e) => setTargetMinutes(Number(e.target.value))} placeholder="Minutes" />
      </div>
      <Textarea className="resize-none" rows={2} value={description}
        onChange={(e) => setDescription(e.target.value)} placeholder="What does this habit help you maintain?" />
      <div className="flex items-center gap-2">
        {COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)}
            className={cn('w-6 h-6 rounded-full border-2', color === c ? 'border-white' : 'border-transparent')}
            style={{ background: c }} aria-label={`Use color ${c}`} />
        ))}
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input className="text-sm"
              value={item}
              onChange={(e) => setItems((current) => current.map((v, i) => (i === index ? e.target.value : v)))}
              placeholder={`Checklist item ${index + 1}`} />
            <Button type="button" variant="danger" size="icon-sm"
              onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
              disabled={items.length === 1} aria-label="Remove checklist item"><X size={14} /></Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={13} />}
          onClick={() => setItems((current) => [...current, ''])}>Add checklist item</Button>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={!title.trim() || creating} className="flex-1">
          {creating ? 'Creating…' : 'Create Habit'}
        </Button>
      </div>
    </motion.form>
  );
}

function HabitRow({ habit }: { habit: Habit }) {
  const { updateToday, getLiveMinutes } = useHabitStore();
  const [expanded, setExpanded] = useState(false);
  const entry = getTodayHabitEntry(habit);
  const allDone = habit.checklist.length > 0 && entry.completedItems.length === habit.checklist.length;
  const percent = completionPercent(habit);
  const minutes = getLiveMinutes(habit._id);
  const streak = streakFor(habit);

  const toggleAll = () => {
    const completedItems = allDone ? [] : habit.checklist.map((item) => item._id);
    updateToday(habit._id, { completedItems });
  };

  const toggleItem = (itemId: string) => {
    const completedItems = entry.completedItems.includes(itemId)
      ? entry.completedItems.filter((id) => id !== itemId)
      : [...entry.completedItems, itemId];
    updateToday(habit._id, { completedItems });
  };

  return (
    <div className="rounded-xl border border-surface-800 bg-transparent">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button onClick={toggleAll}
          className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            allDone ? 'text-surface-50' : 'border-surface-600 text-transparent hover:text-surface-400')}
          style={allDone ? { background: habit.color, borderColor: habit.color } : undefined}
          aria-label={allDone ? 'Mark habit incomplete' : 'Mark habit complete'}>
          <Check size={12} strokeWidth={3} />
        </button>
        <button onClick={() => setExpanded((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: habit.color }} />
          <span className={cn('truncate text-sm font-medium', allDone ? 'text-surface-500 line-through' : 'text-surface-100')}>
            {habit.title}
          </span>
          {streak > 0 && (
            <span className="flex flex-shrink-0 items-center gap-0.5 text-[10px] font-bold text-orange-400">
              <Flame size={10} /> {streak}
            </span>
          )}
          <ChevronDown size={13} className={cn('ml-auto flex-shrink-0 text-surface-500 transition-transform', expanded && 'rotate-180')} />
        </button>
        <div className="flex flex-shrink-0 items-center gap-3 text-[11px] text-surface-400">
          <span className="font-semibold text-surface-200">{entry.completedItems.length}/{habit.checklist.length}</span>
          <span className="flex items-center gap-1"><Clock size={11} /> {minutes}/{habit.targetMinutes}m</span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="space-y-1 border-t border-surface-800 px-3 py-2">
              {habit.checklist.map((item) => {
                const checked = entry.completedItems.includes(item._id);
                return (
                  <button key={item._id} onClick={() => toggleItem(item._id)} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-surface-800/60">
                    <span className={cn('flex h-4 w-4 items-center justify-center rounded border-2', checked ? 'text-surface-50' : 'border-surface-600 text-transparent')}
                      style={checked ? { background: habit.color, borderColor: habit.color } : undefined}>
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className={cn('text-xs', checked ? 'text-surface-500 line-through' : 'text-surface-300')}>{item.text}</span>
                  </button>
                );
              })}
              <div className="h-1 overflow-hidden rounded-full bg-surface-800">
                <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: habit.color }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * DailyHabitsPanel — habits rendered as a compact to-do list on the Tasks page.
 */
export function DailyHabitsPanel() {
  const { habits, loading, loadHabits, getLiveMinutes } = useHabitStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const completed = habits.filter((habit) => completionPercent(habit) === 100 && habit.checklist.length > 0).length;
  const minutes = habits.reduce((sum, habit) => sum + getLiveMinutes(habit._id), 0);

  return (
    <section aria-labelledby="habits-list-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 id="habits-list-heading" className="flex items-center gap-2 text-base font-bold text-surface-100">
            <Target size={16} className="text-success-400" /> Today's Habits
          </h2>
          <p className="text-[11px] text-surface-500">
            {completed}/{habits.length} done · {minutes}m logged today
          </p>
        </div>
        <Button size="sm" leftIcon={<Plus size={13} />} onClick={() => setShowCreate(true)}>New Habit</Button>
      </div>

      <AnimatePresence>
        {showCreate && <NewHabitForm onClose={() => setShowCreate(false)} />}
      </AnimatePresence>

      {loading && habits.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-xl bg-surface-900/60" />)}
        </div>
      ) : habits.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No habits yet" description="Create a habit to track it every day here." />
        </Card>
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => <HabitRow key={habit._id} habit={habit} />)}
        </div>
      )}
    </section>
  );
}

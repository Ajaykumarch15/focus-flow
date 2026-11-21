import { useEffect, useMemo } from 'react';
import { Check, Clock, Flame, CalendarCheck } from 'lucide-react';
import { getTodayHabitEntry, useHabitStore } from '@worklog/services/useHabitStore';

function dayKey(value: string | number | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function dayLabel(key: string): string {
  const today = dayKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(yesterday)) return 'Yesterday';
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * HabitsSummaryCard — analytics-only habit snapshot for the Today dashboard.
 * Shows done/total checklist items, time spent today, the last day a habit was
 * completed, and the current streak across all habits.
 */
export function HabitsSummaryCard() {
  const { habits, loadHabits, getLiveMinutes } = useHabitStore();

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const stats = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const habit of habits) {
      total += habit.checklist.length;
      done += getTodayHabitEntry(habit).completedItems.length;
    }

    const minutes = habits.reduce((sum, habit) => sum + getLiveMinutes(habit._id), 0);

    const activeDays = new Set<string>();
    for (const habit of habits) {
      for (const entry of habit.entries) {
        if (entry.completedItems?.length > 0) activeDays.add(dayKey(entry.date));
      }
    }
    const sortedDays = [...activeDays].sort().reverse();
    const lastDone = sortedDays[0] ?? null;

    // Streak counts consecutive days ending today, or ending yesterday when
    // today has no completion yet (the day is still in progress).
    const cursor = new Date();
    if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (activeDays.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return { done, total, minutes, lastDone: lastDone ? dayLabel(lastDone) : '—', streak };
  }, [habits, getLiveMinutes]);

  const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <section aria-labelledby="habits-summary-heading" className="rounded-2xl border border-surface-800 bg-transparent p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="habits-summary-heading" className="flex items-center gap-2 text-sm font-bold text-surface-100">
          <Check size={15} className="text-success-400" /> Today's Habits
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
          {habits.length} tracked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-surface-800/70 bg-surface-900/40 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
            <Check size={11} /> Done / Total
          </div>
          <p className="mt-1 text-lg font-bold text-surface-50">
            {stats.done}<span className="text-surface-500 font-normal">/{stats.total}</span>
          </p>
        </div>
        <div className="rounded-xl border border-surface-800/70 bg-surface-900/40 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
            <Clock size={11} /> Time spent
          </div>
          <p className="mt-1 text-lg font-bold text-surface-50">{formatMinutes(stats.minutes)}</p>
        </div>
        <div className="rounded-xl border border-surface-800/70 bg-surface-900/40 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
            <CalendarCheck size={11} /> Last done
          </div>
          <p className="mt-1 text-sm font-bold text-surface-50">{stats.lastDone}</p>
        </div>
        <div className="rounded-xl border border-surface-800/70 bg-surface-900/40 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
            <Flame size={11} /> Streak
          </div>
          <p className="mt-1 text-sm font-bold text-surface-50">
            {stats.streak}<span className="text-surface-500 font-normal"> day{stats.streak === 1 ? '' : 's'}</span>
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-surface-500">
          <span>Today's checklist progress</span>
          <span>{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
          <div className="h-full rounded-full bg-success-400 transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </section>
  );
}

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ProfileHeatmapProps {
  dailyHours: Record<string, number>;
}

function getHeatmapLevel(value: number, max: number): number {
  if (max === 0 || value === 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const LEVEL_CLASSES = [
  'bg-surface-800/60',
  'bg-brand-500/20',
  'bg-brand-500/40',
  'bg-brand-500/60',
  'bg-brand-500/90',
];

export function ProfileHeatmap({ dailyHours }: ProfileHeatmapProps) {
    const { weeks, totalHours } = useMemo(() => {
    const values = Object.values(dailyHours);
    const max = Math.max(...values, 0);
    const total = values.reduce((sum, v) => sum + v, 0);

    // Build 52 weeks of data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeks: { date: string; value: number; level: number }[][] = [];

    // Start from 52 weeks ago, on the same day of week
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (52 * 7) + (7 - today.getDay()));
    startDate.setHours(0, 0, 0, 0);

    let currentWeek: { date: string; value: number; level: number }[] = [];
    const cursor = new Date(startDate);

    while (cursor <= today) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const value = dailyHours[key] || 0;
      currentWeek.push({
        date: key,
        value,
        level: getHeatmapLevel(value, max),
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return { weeks, totalHours: Math.round(total * 10) / 10 };
  }, [dailyHours]);

  const monthLabels = useMemo(() => {
    if (weeks.length === 0) return [];
    const labels: { label: string; index: number }[] = [];
    const seen = new Set<string>();

    weeks.forEach((week, weekIdx) => {
      if (week.length > 0) {
        const d = new Date(week[0].date);
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
        if (!seen.has(monthKey)) {
          seen.add(monthKey);
          labels.push({
            label: d.toLocaleDateString('en-US', { month: 'short' }),
            index: weekIdx,
          });
        }
      }
    });
    return labels;
  }, [weeks]);

  if (weeks.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
        <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-3">Focus Activity</p>
        <p className="text-sm text-surface-500">No focus data yet. Start a timer to see your activity here.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Focus Activity</p>
        <p className="text-xs text-surface-500">{totalHours}h total</p>
      </div>

      {/* Month labels */}
      <div className="flex gap-[3px] ml-6 mb-1 overflow-x-auto">
        {monthLabels.map((m, i) => (
          <span
            key={`${m.label}-${i}`}
            className="text-[9px] text-surface-500"
            style={{ marginLeft: i === 0 ? 0 : `${(m.index - (monthLabels[i - 1]?.index ?? 0)) * 13 - 10}px` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-0">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] mr-1.5">
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((day, i) => (
            <span key={i} className="text-[9px] text-surface-500 h-[10px] leading-[10px]">
              {day}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[3px] overflow-x-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={`${wi}-${di}`}
                  className={`w-[10px] h-[10px] rounded-[2px] ${LEVEL_CLASSES[day.level]} transition-colors`}
                  title={`${day.date}: ${day.value}h`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[9px] text-surface-500">Less</span>
        {LEVEL_CLASSES.map((cls, i) => (
          <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${cls}`} />
        ))}
        <span className="text-[9px] text-surface-500">More</span>
      </div>
    </motion.div>
  );
}

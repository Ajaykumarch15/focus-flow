import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface HeatmapDay {
  date: string;
  value: number;
  level: number;
}

interface ActivityHeatmapProps {
  recentActivity: Array<{ date: string; type: string }>;
}

const HEATMAP_COLORS = [
  'bg-surface-800/60',
  'bg-brand-500/20',
  'bg-brand-500/40',
  'bg-brand-500/60',
  'bg-brand-500/90',
];

function getHeatmapLevel(value: number, max: number): number {
  if (max === 0 || value === 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function ActivityHeatmap({ recentActivity }: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { heatmapData, activeDays } = useMemo(() => {
    const dayCounts: Record<string, number> = {};
    for (const item of recentActivity) {
      const d = item.date?.slice(0, 10);
      if (d) dayCounts[d] = (dayCounts[d] || 0) + 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = 90;
    const result: HeatmapDay[] = [];
    const values: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const val = dayCounts[key] || 0;
      values.push(val);
      result.push({ date: key, value: val, level: 0 });
    }

    const max = Math.max(...values, 0);
    for (const item of result) {
      item.level = getHeatmapLevel(item.value, max);
    }

    const active = result.filter(d => d.value > 0).length;
    return { heatmapData: result, activeDays: active };
  }, [recentActivity]);

  const weeks = useMemo(() => {
    const result: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];

    for (const day of heatmapData) {
      const d = new Date(day.date);
      if (currentWeek.length === 0 && d.getDay() !== 1) {
        for (let i = 0; i < d.getDay(); i++) {
          currentWeek.push({ date: '', value: 0, level: -1 });
        }
      }
      currentWeek.push(day);
      if (currentWeek.length >= 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) result.push(currentWeek);
    return result;
  }, [heatmapData]);

  const handleMouseEnter = (day: HeatmapDay, e: React.MouseEvent) => {
    setHoveredDay(day);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-surface-900 rounded-2xl border border-surface-800 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-surface-50">Activity Heatmap</h3>
          <p className="text-xs text-surface-400 mt-0.5">{activeDays} active days</p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] mt-[2px]">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((day, i) => (
            <span key={i} className="text-[9px] text-surface-500 h-[12px] leading-[12px]">{day}</span>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={`${wi}-${di}`}
                  className={`w-[12px] h-[12px] rounded-[3px] transition-all cursor-pointer ${
                    day.level === -1 ? 'bg-transparent' : HEATMAP_COLORS[day.level]
                  } ${hoveredDay?.date === day.date ? 'ring-2 ring-brand-400 ring-offset-1 ring-offset-surface-900' : ''}`}
                  onMouseEnter={(e) => handleMouseEnter(day, e)}
                  onMouseLeave={() => setHoveredDay(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[9px] text-surface-500">Less</span>
        {HEATMAP_COLORS.map((cls, i) => (
          <div key={i} className={`w-[12px] h-[12px] rounded-[3px] ${cls}`} />
        ))}
        <span className="text-[9px] text-surface-500">More</span>
      </div>

      {/* Tooltip */}
      {hoveredDay && hoveredDay.date && (
        <div
          className="fixed z-50 bg-surface-800 text-surface-50 text-xs rounded-xl px-3 py-2 shadow-xl pointer-events-none border border-surface-700"
          style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 40 }}
        >
          <p className="font-medium">{new Date(hoveredDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          <p className="text-surface-400">{hoveredDay.value} item{hoveredDay.value !== 1 ? 's' : ''} completed</p>
        </div>
      )}
    </motion.div>
  );
}
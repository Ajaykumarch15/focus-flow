import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendDataPoint {
  date: string;
  value: number;
}

interface ProductivityTrendProps {
  recentActivity: Array<{ date: string; type: string }>;
  focusedTimeMs: number;
}

type TrendMode = 'score' | 'focus' | 'tasks' | 'milestones';

export function ProductivityTrend({ recentActivity, focusedTimeMs }: ProductivityTrendProps) {
  const [mode, setMode] = useState<TrendMode>('score');

  const chartData = useMemo(() => {
    const dayCounts: Record<string, { tasks: number; milestones: number }> = {};
    for (const item of recentActivity) {
      const d = item.date?.slice(0, 10);
      if (d) {
        if (!dayCounts[d]) dayCounts[d] = { tasks: 0, milestones: 0 };
        if (item.type === 'milestone') dayCounts[d].milestones++;
        else dayCounts[d].tasks++;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = 30;
    const result: TrendDataPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const counts = dayCounts[key] || { tasks: 0, milestones: 0 };
      
      let value = 0;
      if (mode === 'tasks') value = counts.tasks;
      else if (mode === 'milestones') value = counts.milestones;
      else if (mode === 'focus') value = Math.round(focusedTimeMs / 30 / 60000); // avg daily mins
      else value = counts.tasks + counts.milestones * 2; // score

      result.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value,
      });
    }

    return result;
  }, [recentActivity, focusedTimeMs, mode]);

  const avg = useMemo(() => {
    if (chartData.length === 0) return 0;
    const sum = chartData.reduce((acc, d) => acc + d.value, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  const modes: { key: TrendMode; label: string }[] = [
    { key: 'score', label: 'Productivity Score' },
    { key: 'focus', label: 'Focus Time' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'milestones', label: 'Milestones' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-surface-900 rounded-2xl border border-surface-800 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-surface-50">Productivity Trend</h3>
          <p className="text-xs text-surface-400 mt-0.5">Avg. {avg} per day</p>
        </div>
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                mode === m.key
                  ? 'bg-surface-900 text-brand-400 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-brand-400)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-brand-400)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--color-surface-400)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-surface-400)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 shadow-xl text-xs">
                    <p className="text-surface-400 mb-0.5">{label}</p>
                    <p className="text-surface-50 font-semibold">{payload[0].value}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-brand-400)"
              strokeWidth={2}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
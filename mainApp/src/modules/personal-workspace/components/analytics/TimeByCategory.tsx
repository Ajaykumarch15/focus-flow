import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface CategoryItem {
  category: string;
  totalTasks: number;
  completedTasks: number;
  focusedTimeMs: number;
}

interface TimeByCategoryProps {
  categoryBreakdown: CategoryItem[];
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const formatTime = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export function TimeByCategory({ categoryBreakdown }: TimeByCategoryProps) {
  const totalMs = useMemo(() => 
    categoryBreakdown.reduce((acc, c) => acc + c.focusedTimeMs, 0),
    [categoryBreakdown]
  );

  if (categoryBreakdown.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-surface-900 rounded-2xl border border-surface-800 p-5"
    >
      <h3 className="text-sm font-semibold text-surface-50 mb-4">Time by Category</h3>

      <div className="flex items-start gap-4">
        {/* Donut chart */}
        <div className="w-[120px] h-[120px] flex-shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryBreakdown.map(c => ({ name: c.category, value: c.focusedTimeMs }))}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryBreakdown.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-surface-50">{formatTime(totalMs)}</span>
            <span className="text-[8px] text-surface-400">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {categoryBreakdown.slice(0, 5).map((c, i) => {
            const pct = totalMs > 0 ? Math.round((c.focusedTimeMs / totalMs) * 100) : 0;
            return (
              <div key={c.category} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-xs text-surface-300 flex-1 truncate">{c.category}</span>
                <span className="text-[11px] text-surface-400">{formatTime(c.focusedTimeMs)}</span>
                <span className="text-[10px] text-surface-500 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
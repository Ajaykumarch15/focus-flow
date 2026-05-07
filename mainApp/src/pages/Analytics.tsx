import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { formatHours, getWeekDays, isToday, isThisWeek } from '../utils/time';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';

const COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#eab308', '#06b6d4', '#ef4444'];

export function Analytics() {
  const { tasks } = useStore();

  const days = getWeekDays();
  const weekData = days.map((day, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    let productive = 0;
    let paused = 0;
    for (const task of tasks) {
      for (const session of task.sessions) {
        if (session.startTime >= d.getTime() && session.startTime <= end.getTime()) {
          productive += session.activeTime;
          paused += session.totalPauseDuration;
        }
      }
    }
    return {
      day,
      productive: Math.round(productive / 3600000 * 10) / 10,
      paused: Math.round(paused / 3600000 * 10) / 10,
    };
  });

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  for (const task of tasks) {
    const cat = task.category || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + task.totalTime;
  }
  const categoryData = Object.entries(categoryMap)
    .map(([name, ms]) => ({ name, hours: Math.round(ms / 3600000 * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours);

  // Most focused tasks
  const topTasks = [...tasks]
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 5);

  const totalToday = tasks.reduce((acc, t) => {
    return acc + t.sessions.filter(s => isToday(s.startTime)).reduce((a, s) => a + s.activeTime, 0);
  }, 0);

  const totalWeek = tasks.reduce((acc, t) => {
    return acc + t.sessions.filter(s => isThisWeek(s.startTime)).reduce((a, s) => a + s.activeTime, 0);
  }, 0);

  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-display font-bold text-white">Analytics</h1>
        <p className="text-surface-300 mt-1">Your productivity insights</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Today', value: formatHours(totalToday), color: '#0ea5e9' },
          { label: 'This Week', value: formatHours(totalWeek), color: '#8b5cf6' },
          { label: 'Total Tasks', value: String(tasks.length), color: '#22c55e' },
          { label: 'Completed', value: String(completedCount), color: '#f97316' },
        ].map(({ label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card p-5"
          >
            <div className="text-2xl font-display font-bold mb-1" style={{ color }}>{value}</div>
            <div className="text-sm text-surface-400">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Bar Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-white mb-4">Weekly Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekData} barGap={4}>
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
              <Bar dataKey="productive" name="Productive" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paused" name="Paused" fill="#374151" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category Pie */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-white mb-4">By Category</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-surface-400">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="hours"
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}h`]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Top Tasks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card p-6"
      >
        <h3 className="font-semibold text-white mb-4">Most Focused Tasks</h3>
        {topTasks.length === 0 ? (
          <p className="text-surface-400">No tasks with tracked time yet</p>
        ) : (
          <div className="space-y-3">
            {topTasks.map((task, i) => {
              const maxTime = topTasks[0].totalTime || 1;
              const pct = (task.totalTime / maxTime) * 100;
              return (
                <div key={task.id} className="flex items-center gap-4">
                  <span className="text-surface-400 text-sm w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-white font-medium">{task.title}</span>
                      <span className="text-sm text-brand-400 timer-display">{formatHours(task.totalTime)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: task.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

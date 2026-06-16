import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';
import { toast } from '../store/useToastStore';
import { formatHours, getWeekDays, isToday, isThisWeek } from '../utils/time';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { BarChart3, CheckCircle2, Clock, Loader2, Target, TrendingUp } from 'lucide-react';

const COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#eab308', '#06b6d4', '#ef4444'];

type ApiSession = {
  _id: string;
  taskId: string | { _id?: string };
  startTime: number;
  endTime?: number;
  totalPauseDuration?: number;
  activeTime?: number;
  isActive?: boolean;
};

type AnalyticsSession = {
  id: string;
  taskId: string;
  startTime: number;
  endTime?: number;
  activeTime: number;
  totalPauseDuration: number;
};

function docId(value: any): string {
  return String(value?._id ?? value ?? '');
}

function dayRange(offsetFromToday: number) {
  const start = new Date();
  start.setDate(start.getDate() - offsetFromToday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function toChartHours(ms: number): number {
  return Math.round(ms / 3600000 * 10) / 10;
}

export function Analytics() {
  const { tasks, activeTaskId } = useStore();
  const [apiSessions, setApiSessions] = useState<AnalyticsSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.sessions.list()
      .then((docs: ApiSession[]) => {
        if (cancelled) return;
        setApiSessions(docs.map(doc => ({
          id: doc._id,
          taskId: docId(doc.taskId),
          startTime: doc.startTime,
          endTime: doc.endTime,
          activeTime: doc.activeTime || 0,
          totalPauseDuration: doc.totalPauseDuration || 0,
        })));
      })
      .catch((err) => {
        if (!cancelled) {
          setApiSessions([]);
          toast.error('Could not load analytics sessions', err.message || 'Charts may be incomplete.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);

  const liveSessions = useMemo<AnalyticsSession[]>(() => {
    return tasks.flatMap(task => {
      const live = task.sessions.find(session => !session.endTime);
      if (!live || live.activeTime <= 0) return [];
      return [{
        id: `live_${task.id}_${live.id}`,
        taskId: task.id,
        startTime: live.startTime,
        endTime: live.endTime,
        activeTime: live.activeTime,
        totalPauseDuration: live.totalPauseDuration,
      }];
    });
  }, [tasks]);

  const sessions = useMemo(() => {
    const liveIds = new Set(liveSessions.map(session => session.id.replace(/^live_[^_]+_/, '')));
    const completed = apiSessions.filter(session => !liveIds.has(session.id));
    return [...completed, ...liveSessions].filter(session => session.taskId && session.activeTime > 0);
  }, [apiSessions, liveSessions]);

  const days = getWeekDays();
  const weekData = days.map((day, i) => {
    const { start, end } = dayRange(6 - i);
    let productive = 0;
    let paused = 0;
    for (const session of sessions) {
      if (session.startTime >= start && session.startTime <= end) {
        productive += session.activeTime;
        paused += session.totalPauseDuration;
      }
    }
    return {
      day,
      productive: toChartHours(productive),
      paused: toChartHours(paused),
      total: toChartHours(productive + paused),
    };
  });

  const categoryMap: Record<string, number> = {};
  for (const session of sessions) {
    const task = taskById.get(session.taskId);
    const category = task?.category || 'Other';
    categoryMap[category] = (categoryMap[category] || 0) + session.activeTime;
  }
  const categoryData = Object.entries(categoryMap)
    .map(([name, ms]) => ({ name, hours: toChartHours(ms) }))
    .filter(item => item.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const taskTimeMap = new Map<string, number>();
  for (const task of tasks) taskTimeMap.set(task.id, task.totalTime || 0);
  for (const live of liveSessions) {
    taskTimeMap.set(live.taskId, (taskTimeMap.get(live.taskId) || 0) + live.activeTime);
  }
  const topTasks = [...tasks]
    .map(task => ({ ...task, analyticsTime: taskTimeMap.get(task.id) || 0 }))
    .filter(task => task.analyticsTime > 0)
    .sort((a, b) => b.analyticsTime - a.analyticsTime)
    .slice(0, 5);

  const totalToday = sessions
    .filter(session => isToday(session.startTime))
    .reduce((acc, session) => acc + session.activeTime, 0);

  const totalWeek = sessions
    .filter(session => isThisWeek(session.startTime))
    .reduce((acc, session) => acc + session.activeTime, 0);

  const totalTracked = sessions.reduce((acc, session) => acc + session.activeTime, 0);
  const totalPaused = sessions.reduce((acc, session) => acc + session.totalPauseDuration, 0);
  const focusRatio = totalTracked + totalPaused > 0
    ? Math.round(totalTracked / (totalTracked + totalPaused) * 100)
    : 0;
  const completedCount = tasks.filter(task => task.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round(completedCount / tasks.length * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Analytics</h1>
          <p className="text-surface-300 mt-1">Your productivity insights</p>
        </div>
        {loading && (
          <span className="flex items-center gap-2 text-xs text-surface-400">
            <Loader2 size={13} className="animate-spin" /> Loading sessions
          </span>
        )}
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Clock, label: 'Today', value: formatHours(totalToday), color: '#0ea5e9' },
          { icon: TrendingUp, label: 'This Week', value: formatHours(totalWeek), color: '#8b5cf6' },
          { icon: Target, label: 'Focus Ratio', value: `${focusRatio}%`, color: '#22c55e' },
          { icon: CheckCircle2, label: 'Completion', value: `${completionRate}%`, color: '#f97316' },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card p-5"
          >
            <div className="flex items-center gap-2 text-surface-400 text-sm mb-2">
              <Icon size={14} style={{ color }} />
              {label}
            </div>
            <div className="text-2xl font-display font-bold" style={{ color }}>{value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-brand-400" /> Weekly Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekData} barGap={4}>
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value: number, name: string) => [`${value}h`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
              <Bar dataKey="productive" name="Focused" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paused" name="Paused" fill="#374151" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-white mb-4">Focus Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weekData}>
              <defs>
                <linearGradient id="focusTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value: number) => [`${value}h`, 'Focused']}
              />
              <Area type="monotone" dataKey="productive" stroke="#0ea5e9" fill="url(#focusTrend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-white mb-4">By Category</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-surface-400">
              No tracked sessions yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="hours"
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value}h`]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h3 className="font-semibold text-white mb-4">Task Health</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Tasks', value: String(tasks.length), color: 'text-brand-400' },
              { label: 'Completed', value: String(completedCount), color: 'text-emerald-400' },
              { label: 'Tracked Time', value: formatHours(totalTracked), color: 'text-purple-400' },
              { label: 'Paused Time', value: formatHours(totalPaused), color: 'text-yellow-400' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-surface-700 bg-surface-800/40 p-4">
                <p className={`text-xl font-display font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-surface-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="card p-6"
      >
        <h3 className="font-semibold text-white mb-4">Most Focused Tasks</h3>
        {topTasks.length === 0 ? (
          <p className="text-surface-400">No tasks with tracked time yet</p>
        ) : (
          <div className="space-y-3">
            {topTasks.map((task, i) => {
              const maxTime = topTasks[0].analyticsTime || 1;
              const pct = (task.analyticsTime / maxTime) * 100;
              return (
                <div key={task.id} className="flex items-center gap-4">
                  <span className="text-surface-400 text-sm w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1 gap-3">
                      <span className="text-sm text-white font-medium truncate">{task.title}</span>
                      <span className="text-sm text-brand-400 timer-display flex-shrink-0">{formatHours(task.analyticsTime)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: task.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.35 + i * 0.08 }}
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

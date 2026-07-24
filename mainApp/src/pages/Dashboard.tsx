import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, Flame, TrendingUp, Plus, Play, Target, Zap, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';
import { formatHours, formatHoursDecimal, getWeekDays, isToday, isOverdue } from '../utils/time';
import { TaskCard } from '../components/tasks/TaskCard';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Skeleton, SkeletonStatCard, SkeletonTaskCard, SkeletonChart } from '../components/ui/Skeleton';
import { AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

function StatCard({ icon: Icon, label, value, sub, color, lightBg = '', delay = 0 }: {
  icon: React.ElementType, label: string, value: string, sub?: string, color: string, lightBg?: string, delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`card p-5 relative overflow-hidden transition-all duration-200 hover:-translate-y-1 ${lightBg}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl lg:text-3xl font-display font-bold text-surface-50 mb-1">{value}</div>
      <div className="text-sm font-medium text-surface-300">{label}</div>
      {sub && <div className="text-xs text-surface-400 mt-1">{sub}</div>}
    </motion.div>
  );
}

export function Dashboard() {
  const { tasks, profile, theme, journals, activeTaskId, dataLoading } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    api.sessions.list().then(setSessions).catch(console.error);
  }, []);

  const { todayMs, weekMs } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const ws = weekStart.getTime();

    let tMs = 0;
    let wMs = 0;
    for (const s of sessions) {
      if (s.startTime >= ts) tMs += (s.activeTime || 0);
      if (s.startTime >= ws) wMs += (s.activeTime || 0);
    }

    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      const live = activeTask?.sessions.find(s => !s.endTime);
      if (live) {
        if (live.startTime >= ts) tMs += live.activeTime;
        if (live.startTime >= ws) wMs += live.activeTime;
      }
    }
    return { todayMs: tMs, weekMs: wMs };
  }, [sessions, tasks, activeTaskId]);

  if (dataLoading && tasks.length === 0) {
    return (
      <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-10 w-72 rounded-xl mb-2" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <Skeleton className="h-11 w-32 rounded-xl" />
        </div>

        {/* Goal banner skeleton */}
        <div className="card p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-32 rounded mb-2" />
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonTaskCard key={i} />
            ))}
          </div>
          <div className="space-y-6">
            <SkeletonChart height={160} />
            <div className="card p-5">
              <Skeleton className="h-5 w-32 rounded mb-4" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-3 bg-surface-850 rounded-xl mb-3">
                  <Skeleton className="h-3 w-24 rounded mb-2" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const completedToday = tasks.filter(t => t.status === 'completed' && isToday(t.updatedAt)).length;
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const dailyGoalProgress = Math.min(100, (todayMs / (profile.dailyGoal * 3600000)) * 100);
  const overdueCount = tasks.filter(t => t.status !== 'completed' && isOverdue(t.deadline)).length;

  // Build weekly chart data
  const days = getWeekDays();
  const weekData = days.map((day, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 86399999;

    let hours = 0;
    // Add completed sessions from API
    for (const s of sessions) {
      if (s.startTime >= start && s.startTime <= end) {
        hours += (s.activeTime || 0) / 3600000;
      }
    }
    // Add live session if it matches this day
    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      const live = activeTask?.sessions.find(s => !s.endTime);
      if (live && live.startTime >= start && live.startTime <= end) {
        hours += live.activeTime / 3600000;
      }
    }

    return { day, hours: Math.round(hours * 10) / 10 };
  });

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 tracking-tight">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {profile.name.split(' ')[0]} 👋
          </h1>
          <p className="text-surface-400 font-medium text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 shadow-md shadow-brand-500/20 px-5 py-2.5 rounded-xl"
        >
          <Plus size={18} />
          New Task
        </button>
      </motion.div>

      {/* Overdue Warning Banner */}
      {overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl"
        >
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-300">
            <span className="font-semibold">{overdueCount} task{overdueCount !== 1 ? 's' : ''}</span> {overdueCount === 1 ? 'is' : 'are'} overdue
          </p>
        </motion.div>
      )}

      {/* Daily Goal Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-6 bg-gradient-to-b from-[#F6FBFF] to-white dark:from-brand-500/10 dark:to-surface-900 border-brand-500/20 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Target size={16} className="text-brand-500 dark:text-brand-400" />
            </div>
            <span className="text-sm font-semibold text-surface-100">Daily Goal Progress</span>
          </div>
          <span className="text-sm text-brand-500 dark:text-brand-400 font-bold">{formatHours(todayMs)} / {profile.dailyGoal}h</span>
        </div>
        <div className="h-2.5 bg-[#E9EEF5] dark:bg-surface-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${dailyGoalProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
        <p className="text-xs text-surface-400 mt-2 font-medium">{Math.round(dailyGoalProgress)}% complete</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={Clock}
          label="Today"
          value={formatHours(todayMs)}
          sub={`Goal: ${profile.dailyGoal}h`}
          color={theme?.accentColor || "#0ea5e9"}
          lightBg="bg-[#F0F9FF] dark:bg-surface-900 border-sky-100 dark:border-surface-800"
          delay={0.1}
        />
        <StatCard 
          icon={Flame} 
          label="Current Streak" 
          value={`${profile.streak?.current || 0} Days`} 
          sub={`Best: ${profile.streak?.best || 0}`} 
          color="#f97316"
          lightBg="bg-[#FFF8F1] dark:bg-surface-900 border-amber-100 dark:border-surface-800"
          delay={0.15} 
        />
        <StatCard 
          icon={Zap} 
          label="Focus Points" 
          value={(profile.totalPoints || 0).toLocaleString()} 
          sub="Rank: Novice" 
          color="#8b5cf6"
          lightBg="bg-[#F7F5FF] dark:bg-surface-900 border-purple-100 dark:border-surface-800"
          delay={0.2} 
        />
        <StatCard
          icon={CheckCircle}
          label="Completed"
          value={String(completedToday)}
          sub="tasks today"
          color="#22c55e"
          lightBg="bg-[#F3FFF8] dark:bg-surface-900 border-emerald-100 dark:border-surface-800"
          delay={0.25}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-surface-50">Active Tasks</h2>
            <span className="badge bg-surface-800 text-surface-300">{activeTasks.length}</span>
          </div>

          {activeTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card p-8 text-center"
            >
              <Zap size={32} className="text-surface-600 mx-auto mb-3" />
              <p className="text-surface-300 font-medium">No tasks yet</p>
              <p className="text-surface-500 text-sm mt-1">Create your first task to start tracking</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 mx-auto flex items-center gap-2">
                <Plus size={15} />
                Create Task
              </button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activeTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Weekly Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-4"
          >
            <h3 className="font-medium text-surface-50 mb-4">Weekly Overview</h3>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme?.accentColor || "#0ea5e9"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={theme?.accentColor || "#0ea5e9"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, boxShadow: 'var(--card-shadow)', fontSize: 12, color: 'var(--color-surface-50)' }}
                  labelStyle={{ color: 'var(--color-surface-400)' }}
                  itemStyle={{ color: theme?.accentColor || '#0ea5e9' }}
                  formatter={(v: number) => [`${v}h`, 'Hours']}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke={theme?.accentColor || "#0ea5e9"}
                  strokeWidth={2}
                  fill="url(#colorHours)"
                  dot={{ fill: theme?.accentColor || "#0ea5e9", strokeWidth: 0, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Recent Journals */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="card p-4"
          >
            <h3 className="font-medium text-surface-50 mb-3">Recent Journal</h3>
            {journals.slice(0, 3).length === 0 ? (
              <p className="text-sm text-surface-400">No journal entries yet</p>
            ) : (
              <div className="space-y-3">
                {journals.slice(0, 3).map(j => {
                  const task = tasks.find(t => t.id === j.taskId);
                  return (
                    <div key={j.id} className="p-3 bg-surface-800/50 rounded-xl">
                      <div className="text-xs text-surface-400 mb-1">{task?.title}</div>
                      <p className="text-sm text-surface-200 line-clamp-2">{j.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, Flame, TrendingUp, Plus, Play, Target, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';
import { formatHours, formatHoursDecimal, getWeekDays, isToday } from '../utils/time';
import { TaskCard } from '../components/tasks/TaskCard';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }: {
  icon: React.ElementType, label: string, value: string, sub?: string, color: string, delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="card p-5 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 rounded-full -mr-8 -mt-8"
        style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-xl" style={{ background: `${color}20` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-display font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-surface-300">{label}</div>
      {sub && <div className="text-xs text-surface-400 mt-1">{sub}</div>}
    </motion.div>
  );
}

export function Dashboard() {
  const { tasks, profile, journals, activeTaskId } = useStore();
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

  const completedToday = tasks.filter(t => t.status === 'completed' && isToday(t.updatedAt)).length;
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const dailyGoalProgress = Math.min(100, (todayMs / (profile.dailyGoal * 3600000)) * 100);

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {profile.name.split(' ')[0]} 👋
          </h1>
          <p className="text-surface-300 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          New Task
        </button>
      </motion.div>

      {/* Daily Goal Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-4 mb-6 bg-gradient-to-r from-brand-500/10 to-cyan-500/5 border-brand-500/20"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-brand-400" />
            <span className="text-sm font-medium text-white">Daily Goal Progress</span>
          </div>
          <span className="text-sm text-brand-400 font-medium">{formatHours(todayMs)} / {profile.dailyGoal}h</span>
        </div>
        <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-brand-500 to-cyan-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${dailyGoalProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
        <p className="text-xs text-surface-400 mt-1">{Math.round(dailyGoalProgress)}% complete</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Clock} label="Today" value={formatHours(todayMs)} sub={`Goal: ${profile.dailyGoal}h`} color="#0ea5e9" delay={0.1} />
        <StatCard 
          icon={Flame} 
          label="Current Streak" 
          value={`${profile.streak?.current || 0} Days`} 
          sub={`Best: ${profile.streak?.best || 0}`} 
          color="#f97316" 
          delay={0.15} 
        />
        <StatCard 
          icon={Zap} 
          label="Focus Points" 
          value={(profile.totalPoints || 0).toLocaleString()} 
          sub="Rank: Novice" 
          color="#8b5cf6" 
          delay={0.2} 
        />
        <StatCard icon={CheckCircle} label="Completed" value={String(completedToday)} sub="tasks today" color="#22c55e" delay={0.25} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">Active Tasks</h2>
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
            <h3 className="font-medium text-white mb-4">Weekly Overview</h3>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  itemStyle={{ color: '#0ea5e9' }}
                  formatter={(v: number) => [`${v}h`, 'Hours']}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#colorHours)"
                  dot={{ fill: '#0ea5e9', strokeWidth: 0, r: 3 }}
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
            <h3 className="font-medium text-white mb-3">Recent Journal</h3>
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

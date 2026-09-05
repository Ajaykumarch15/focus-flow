import { useEffect, useMemo, useState } from 'react';
import {
  Brain, TrendingUp, Target, Clock, Flame,
  CheckCircle2, Activity, ArrowRight, Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { IntelligenceDashboard } from '@personal/components/schedule/IntelligenceDashboard';
import { Card, CardBody, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { SkeletonCard } from '@shared/components/ui/Skeleton';
import { formatHours, formatMs } from '@shared/utils/time';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import { calculateScheduleMetrics } from '@worklog/services/scheduleAnalytics';
import { useScheduleStore, getTodayDateString } from '@worklog/services/useScheduleStore';

export function PersonalPage() {
  const navigate = useNavigate();
  const { profile, loadAll } = useStore();
  const { tasks, fetchTasks } = usePersonalTaskStore();
  const { schedules, fetchSchedules } = useScheduleStore();
  const { activeTaskId: activeId } = useActiveTimer();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAll();
    void fetchTasks();
    void fetchSchedules({ date: getTodayDateString() });
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const todayMs = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return tasks.reduce((sum, t) => {
      const todaySessions = t.sessions.filter(s => {
        const d = new Date(s.startTime);
        return d >= start && d <= now;
      });
      return sum + todaySessions.reduce((s, sess) => s + (sess.activeTime || 0), 0);
    }, 0);
  }, [tasks]);

  const weekMs = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() + 1);
    start.setHours(0, 0, 0, 0);
    return tasks.reduce((sum, t) => {
      const weekSessions = t.sessions.filter(s => {
        const d = new Date(s.startTime);
        return d >= start && d <= now;
      });
      return sum + weekSessions.reduce((s, sess) => s + (sess.activeTime || 0), 0);
    }, 0);
  }, [tasks]);

  const dailyGoalMs = (profile.dailyGoal || 8) * 3600000;
  const goalPct = dailyGoalMs > 0 ? Math.min(100, Math.round((todayMs / dailyGoalMs) * 100)) : 0;

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const completedToday = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return tasks.filter(t => {
      if (t.status !== 'completed') return false;
      return new Date(t.updatedAt) >= start;
    }).length;
  }, [tasks]);

  const todaySchedules = schedules.filter(s => s.date === getTodayDateString() && s.status !== 'cancelled');
  const scheduleMetrics = calculateScheduleMetrics(todaySchedules);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
        <div className="h-10 w-48 bg-surface-800 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1320px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">Personal</h1>
          <p className="text-sm text-surface-400 mt-0.5">Your productivity intelligence & personal overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/worklog/insights')} className="gap-1.5 text-xs">
            <Lightbulb size={14} /> Insights
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/personal/analytics')} className="gap-1.5 text-xs">
            <TrendingUp size={14} /> Analytics
          </Button>
        </div>
      </div>

      {/* Active focus indicator */}
      {activeTask && (
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-brand-500/30 bg-brand-500/5">
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-sm text-brand-300">
            Focusing on <strong className="text-brand-200">{activeTask.title}</strong>
          </span>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/personal/tasks/${activeId}`)} className="ml-auto text-xs text-brand-400">
            Open Task <ArrowRight size={12} />
          </Button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Clock size={18} />} label="Today's Focus" value={formatHours(todayMs)} accent="text-sky-400" />
        <KpiCard icon={<Target size={18} />} label="Daily Goal" value={`${goalPct}%`} accent="text-brand-400"
          sub={goalPct >= 100 ? 'Goal reached!' : `${formatMs(Math.max(0, dailyGoalMs - todayMs))} remaining`} />
        <KpiCard icon={<CheckCircle2 size={18} />} label="Completed Today" value={String(completedToday)} accent="text-emerald-400"
          sub={`${completedTasks}/${totalTasks} total tasks`} />
        <KpiCard icon={<Flame size={18} />} label="This Week" value={formatHours(weekMs)} accent="text-orange-400" />
      </div>

      {/* ── Intelligence Dashboard ── */}
      <IntelligenceDashboard tasks={tasks} schedules={schedules} />

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={16} className="text-surface-400" />
              Today&apos;s Schedule
            </CardTitle>
          </CardHeader>
          <CardBody>
            {todaySchedules.length === 0 ? (
              <p className="text-sm text-surface-500">No tasks scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {todaySchedules.slice(0, 5).map(s => {
                  const taskObj = typeof s.taskId === 'object' ? s.taskId : tasks.find(t => t.id === s.taskId);
                  return (
                    <div key={s._id} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs text-surface-500 w-12">{s.startTime}</span>
                      <span className="text-surface-200 truncate">{taskObj?.title || 'Task'}</span>
                      <Badge tone={s.status === 'completed' ? 'success' : s.status === 'missed' ? 'danger' : 'neutral'} className="ml-auto text-[10px]">
                        {s.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain size={16} className="text-surface-400" />
              Productivity Summary
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400">Task Completion</span>
                <span className="font-semibold text-surface-200">{taskPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-800">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${taskPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400">Schedule Accuracy</span>
                <span className="font-semibold text-surface-200">{scheduleMetrics.progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-800">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${scheduleMetrics.progressPercent}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400">Focus Goal</span>
                <span className="font-semibold text-surface-200">{goalPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-800">
                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${goalPct}%` }} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, accent, sub }: {
  icon: React.ReactNode; label: string; value: string; accent: string; sub?: string;
}) {
  return (
    <div className="p-4 rounded-2xl border border-surface-800 bg-surface-900/60">
      <div className={`mb-2 ${accent}`}>{icon}</div>
      <p className="text-2xl font-bold text-surface-50">{value}</p>
      <p className="text-xs text-surface-400 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  );
}

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, BookMarked, Clock, Target, ArrowRight,
  AlertTriangle, TrendingUp,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { formatMs } from '@shared/utils/time';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

export function WorkLogDashboard() {
  const navigate = useNavigate();
  const { tasks } = useStore();
  const { activeLogs, loadActive } = useWorkLogStore();

  useEffect(() => { loadActive(); }, [loadActive]);

  const activeTasks = useMemo(() => tasks.filter(t => t.status === 'active' || t.status === 'paused'), [tasks]);
  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return tasks.filter(t => t.status === 'completed' && new Date(t.updatedAt).toDateString() === today).length;
  }, [tasks]);

  const totalTasksCount = tasks.length;
  const completedTasksCount = useMemo(() => tasks.filter(t => t.status === 'completed').length, [tasks]);
  const overdueCount = useMemo(
    () => tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date()).length,
    [tasks],
  );

  const completionRate = useMemo(() => {
    if (totalTasksCount === 0) return 0;
    return Math.round((completedTasksCount / totalTasksCount) * 100);
  }, [totalTasksCount, completedTasksCount]);

  const activeTasksCount = activeTasks.length;

  return (
    <div className="relative px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-6 max-w-[1600px] space-y-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-brand-400/[0.12] dark:bg-brand-400/[0.06] blur-3xl" />
        <div className="absolute top-[15%] -right-12 w-40 h-40 rounded-full bg-info-400/[0.10] dark:bg-info-300/[0.05] blur-3xl" />
        <div className="absolute top-[40%] left-[5%] w-36 h-36 rounded-[1.5rem] rotate-12 bg-success-400/[0.08] dark:bg-success-300/[0.04] blur-2xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10 relative">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">WorkLog Dashboard</h1>
          <p className="text-sm text-surface-400 mt-0.5">Professional work, projects & career tracking.</p>
        </div>
        <Button onClick={() => navigate('/worklog/logs')} leftIcon={<BookMarked size={16} />}>View Work Logs</Button>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3 z-10 relative">
        {[
          { label: 'Active Tasks', value: String(activeTasksCount), icon: CheckSquare, color: '#0ea5e9', borderClass: 'border-t-sky-500' },
          { label: 'Completed Today', value: String(completedToday), icon: Target, color: '#10b981', borderClass: 'border-t-emerald-500' },
          { label: 'Work Logs', value: String(activeLogs.length), icon: BookMarked, color: '#8b5cf6', borderClass: 'border-t-purple-500' },
          { label: 'Overdue', value: String(overdueCount), icon: AlertTriangle, color: '#ef4444', borderClass: 'border-t-red-500' },
        ].map(({ label, value, icon: Icon, color, borderClass }) => (
          <motion.div key={label} variants={fadeUp}>
            <Card className={`p-4 border-t-[3px] ${borderClass}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={13} style={{ color }} />
                <span className="text-[11px] text-surface-400 font-medium">{label}</span>
              </div>
              <p className="text-lg font-display font-bold text-surface-50">{value}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-3 z-10 relative">
        <motion.div variants={fadeUp}>
          <Card className="p-4 border-t-[3px] border-t-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-300">Completion Rate</span>
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-display font-extrabold text-surface-50">{completionRate}%</p>
            <Progress value={completionRate} tone="success" className="mt-2 h-1.5" />
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card className="p-4 border-t-[3px] border-t-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-300">In Progress</span>
              <Clock size={14} className="text-blue-400" />
            </div>
            <p className="text-2xl font-display font-extrabold text-surface-50">{activeTasksCount}</p>
            <p className="text-[11px] text-surface-500 mt-1">tasks actively being worked on</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card className="p-4 border-t-[3px] border-t-purple-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-300">Total Tasks</span>
              <CheckSquare size={14} className="text-purple-400" />
            </div>
            <p className="text-2xl font-display font-extrabold text-surface-50">{totalTasksCount}</p>
            <p className="text-[11px] text-surface-500 mt-1">{completedTasksCount} completed</p>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 z-10 relative">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full bg-[#0ea5e9]" />
                <h2 className="text-sm font-display font-bold text-surface-50">Active Work Tasks</h2>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigate('/worklog/tasks')} rightIcon={<ArrowRight size={13} />}>View All</Button>
            </div>
            {activeTasks.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-8">No active work tasks.</p>
            ) : (
              <div className="px-3 pb-3 space-y-0.5">
                {activeTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-800/50 transition-colors cursor-pointer group" onClick={() => navigate(`/worklog/tasks/${task.id}`)}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.color || '#0ea5e9', boxShadow: `0 0 0 3px ${task.color || '#0ea5e9'}33` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-200 truncate group-hover:text-surface-50 transition-colors">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={task.status} />
                        <span className="text-[10px] text-surface-500">{task.status === 'active' ? 'In progress' : 'Paused'}</span>
                      </div>
                    </div>
                    <Badge tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}>{task.priority}</Badge>
                    {task.totalTime > 0 && <span className="text-[10px] text-surface-500 tabular-nums">{formatMs(task.totalTime)}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full bg-[#8b5cf6]" />
                <h2 className="text-sm font-display font-bold text-surface-50">Recent Work Logs</h2>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigate('/worklog/logs')} rightIcon={<ArrowRight size={13} />}>View All</Button>
            </div>
            {activeLogs.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-8">No work logs yet.</p>
            ) : (
              <div className="px-3 pb-3 space-y-0.5">
                {activeLogs.slice(0, 5).map((log: any) => (
                  <div key={log._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-800/50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8b5cf6]/10 flex-shrink-0">
                      <BookMarked size={14} className="text-[#8b5cf6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-300 truncate group-hover:text-surface-200 transition-colors">{log.title || log.summary || 'Work Log'}</p>
                      {log.date && <p className="text-[10px] text-surface-500 mt-0.5">{new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}
                    </div>
                    <ArrowRight size={13} className="text-surface-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

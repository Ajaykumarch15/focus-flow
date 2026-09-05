import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, BookMarked, Clock, Target, ArrowRight,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { formatMs } from '@shared/utils/time';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

export function WorkLogDashboard() {
  const navigate = useNavigate();
  const { tasks } = useStore();
  const { activeLogs, loadActive } = useWorkLogStore();

  useEffect(() => { loadActive(); }, [loadActive]);

  const activeTasks = useMemo(() => tasks.filter(t => t.status === 'active' || t.status === 'paused'), [tasks]);
  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return tasks.filter(t => t.status === 'completed' && new Date(t.updatedAt).toDateString() === today);
  }, [tasks]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">WorkLog Dashboard</h1>
          <p className="text-sm text-surface-400 mt-0.5">Professional work, projects & career tracking.</p>
        </div>
        <Button onClick={() => navigate('/worklog/logs')} leftIcon={<BookMarked size={16} />}>View Work Logs</Button>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Tasks', value: String(activeTasks.length), icon: CheckSquare, color: '#0ea5e9' },
          { label: 'Completed Today', value: String(completedToday.length), icon: Target, color: '#10b981' },
          { label: 'Work Logs', value: String(activeLogs.length), icon: BookMarked, color: '#8b5cf6' },
          { label: 'Focus Time', value: formatMs(tasks.reduce((acc, t) => acc + (t.totalTime || 0), 0)), icon: Clock, color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} variants={fadeUp}>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={13} style={{ color }} />
                <span className="text-[11px] text-surface-400 font-medium">{label}</span>
              </div>
              <p className="text-lg font-display font-bold text-surface-50">{value}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display font-bold text-surface-50">Active Work Tasks</h2>
              <Button size="sm" variant="secondary" onClick={() => navigate('/worklog/tasks')} rightIcon={<ArrowRight size={13} />}>View All</Button>
            </div>
            {activeTasks.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-6">No active work tasks.</p>
            ) : (
              <div className="space-y-2">
                {activeTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-800/50 transition-colors cursor-pointer" onClick={() => navigate(`/worklog/tasks/${task.id}`)}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.color || '#0ea5e9' }} />
                    <span className="text-sm text-surface-200 truncate flex-1">{task.title}</span>
                    <Badge tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}>{task.priority}</Badge>
                    {task.totalTime > 0 && <span className="text-[10px] text-surface-500">{formatMs(task.totalTime)}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display font-bold text-surface-50">Recent Work Logs</h2>
              <Button size="sm" variant="secondary" onClick={() => navigate('/worklog/logs')} rightIcon={<ArrowRight size={13} />}>View All</Button>
            </div>
            {activeLogs.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-6">No work logs yet.</p>
            ) : (
              <div className="space-y-2">
                {activeLogs.slice(0, 5).map((log: any) => (
                  <div key={log._id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-800/50 transition-colors">
                    <BookMarked size={13} className="text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-surface-300 truncate flex-1">{log.title || log.summary || 'Work Log'}</span>
                    {log.date && <span className="text-[10px] text-surface-500">{new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
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

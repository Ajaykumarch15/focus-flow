import { useEffect, useMemo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, BookMarked, Clock, Target, ArrowRight, ArrowUpRight,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { KpiCounter } from '@shared/components/ui/KpiCounter';
import { formatMs } from '@shared/utils/time';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

function Stat({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  const numMatch = value.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const numPart = numMatch ? parseFloat(numMatch[1]) : null;
  const suffix = numMatch ? numMatch[2] : '';
  const gradientBorder = `${color}40`;

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] cursor-default"
      style={{
        background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
        border: `1px solid ${gradientBorder}`,
      }}>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none rounded-bl-full"
        style={{ background: `radial-gradient(circle at top right, ${color}40, transparent)` }} />
      <div className="flex items-center justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}25` }}>
          {icon}
        </div>
        <ArrowUpRight size={16} className="opacity-30" style={{ color }} />
      </div>
      <p className="text-[13px] font-semibold mb-1" style={{ color: `${color}cc` }}>{label}</p>
      <p className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 mb-0.5">
        {numPart !== null
          ? <KpiCounter value={numPart} suffix={suffix} duration={700} />
          : value}
      </p>
    </motion.div>
  );
}

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
          { label: 'Active Tasks', value: String(activeTasks.length), icon: <CheckSquare size={20} className="text-[#0ea5e9]" />, color: '#0ea5e9' },
          { label: 'Completed Today', value: String(completedToday.length), icon: <Target size={20} className="text-[#10b981]" />, color: '#10b981' },
          { label: 'Work Logs', value: String(activeLogs.length), icon: <BookMarked size={20} className="text-[#8b5cf6]" />, color: '#8b5cf6' },
          { label: 'Focus Time', value: formatMs(tasks.reduce((acc, t) => acc + (t.totalTime || 0), 0)), icon: <Clock size={20} className="text-[#f59e0b]" />, color: '#f59e0b' },
        ].map(({ label, value, icon, color }) => (
          <Stat key={label} icon={icon} label={label} value={value} color={color} />
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                    <span className="text-sm text-surface-200 truncate flex-1 group-hover:text-surface-50 transition-colors">{task.title}</span>
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

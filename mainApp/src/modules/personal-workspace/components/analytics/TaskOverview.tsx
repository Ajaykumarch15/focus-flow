import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ListTodo, Clock, CheckCircle, Flame } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { Card } from '@shared/components/ui/Card';

const DONUT_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444'];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl p-4 relative overflow-hidden transition-all hover:scale-[1.02] cursor-default"
      style={{
        background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`,
        border: `1px solid ${color}30`,
      }}>
      <div className="absolute top-0 right-0 w-20 h-20 opacity-15 pointer-events-none rounded-bl-full"
        style={{ background: `radial-gradient(circle at top right, ${color}40, transparent)` }} />
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-display font-extrabold text-surface-50 leading-none">{value}</p>
      <p className="text-[11px] font-semibold mt-1" style={{ color: `${color}cc` }}>{label}</p>
    </motion.div>
  );
}

export function TaskOverview() {
  const { tasks } = usePersonalTaskStore();

  const kpiCounts = useMemo(() => {
    const overdue = tasks.filter(t => t.status !== 'completed' && t.deadline && t.deadline < Date.now()).length;
    return {
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'active' || t.status === 'paused').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue,
    };
  }, [tasks]);

  const donutData = useMemo(() => [
    { name: 'Completed', value: kpiCounts.completed },
    { name: 'In Progress', value: kpiCounts.inProgress },
    { name: 'To Do', value: kpiCounts.todo },
    { name: 'Overdue', value: kpiCounts.overdue },
  ], [kpiCounts]);

  const completionPct = tasks.length > 0 ? Math.round((kpiCounts.completed / tasks.length) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="space-y-4">
      <h2 className="text-lg font-display font-bold text-surface-50">Task Overview</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<ListTodo size={18} />} label="To Do" value={kpiCounts.todo} color="#3b82f6" />
        <KpiCard icon={<Clock size={18} />} label="In Progress" value={kpiCounts.inProgress} color="#f59e0b" />
        <KpiCard icon={<CheckCircle size={18} />} label="Completed" value={kpiCounts.completed} color="#22c55e" />
        <KpiCard icon={<Flame size={18} />} label="Overdue" value={kpiCounts.overdue} color="#ef4444" />
      </div>

      {/* Donut Chart */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-surface-50 mb-4">Task Completion</h3>
        <div className="relative">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xl font-display font-extrabold text-surface-50">{completionPct}%</p>
              <p className="text-[9px] text-surface-400 uppercase tracking-wider">Done</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {donutData.map((item, i) => (
            <div key={item.name} className="flex items-center gap-2 text-xs text-surface-400">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i] }} />
              <span className="truncate">{item.name}</span>
              <span className="ml-auto font-bold text-surface-300">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

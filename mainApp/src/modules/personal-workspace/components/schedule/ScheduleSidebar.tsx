import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, ListTodo, CheckCircle, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card } from '@shared/components/ui/Card';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { getScheduledState } from '@personal/services/personalTaskSchedule';
import { useNavigate } from 'react-router-dom';

const DONUT_COLORS = ['#ef4444', '#22c55e', '#8b5cf6', '#94a3b8'];
const DAYS_IN_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface ScheduleSidebarProps {
  onScheduleTask?: () => void;
}

export function ScheduleSidebar({ onScheduleTask }: ScheduleSidebarProps) {
  const navigate = useNavigate();
  const { tasks } = usePersonalTaskStore();
  const today = useMemo(() => new Date(), []);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  // Task counts
  const counts = useMemo(() => {
    let overdue = 0, todayCount = 0, upcoming = 0, unscheduled = 0;
    for (const t of tasks) {
      if (t.status === 'completed') continue;
      const state = getScheduledState(t);
      if (state === 'missed') overdue++;
      else if (state === 'today') todayCount++;
      else if (state === 'upcoming') upcoming++;
      else unscheduled++;
    }
    return { overdue, today: todayCount, upcoming, unscheduled, total: overdue + todayCount + upcoming + unscheduled };
  }, [tasks]);

  const donutData = [
    { name: 'Overdue', value: counts.overdue },
    { name: 'Today', value: counts.today },
    { name: 'Upcoming', value: counts.upcoming },
    { name: 'Unscheduled', value: counts.unscheduled },
  ];

  // Days that have tasks (for calendar dots)
  const taskDays = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.scheduledDate) {
        const d = new Date(t.scheduledDate);
        set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
      if (t.deadline) {
        const d = new Date(t.deadline);
        set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
    return set;
  }, [tasks]);

  // Mini calendar
  const monthDays = getMonthDays(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const prevMonthDays = getMonthDays(calYear, calMonth - 1);

  const calendarCells: { day: number; currentMonth: boolean; key: string }[] = [];
  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    calendarCells.push({ day: d, currentMonth: false, key: `prev-${d}` });
  }
  // Current month
  for (let d = 1; d <= monthDays; d++) {
    calendarCells.push({ day: d, currentMonth: true, key: `cur-${d}` });
  }
  // Next month leading days
  const remaining = 42 - calendarCells.length;
  for (let d = 1; d <= remaining; d++) {
    calendarCells.push({ day: d, currentMonth: false, key: `next-${d}` });
  }

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-5 hidden lg:block">
      {/* Mini Calendar */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-surface-50">{MONTH_NAMES[calMonth]} {calYear}</h3>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button onClick={nextMonth} className="p-1 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {DAYS_IN_WEEK.map(d => (
              <div key={d} className="text-center text-[9px] font-bold text-surface-500 pb-1">{d}</div>
            ))}
            {calendarCells.map(cell => {
              const isToday = cell.currentMonth && cell.day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
              const dateKey = `${calYear}-${calMonth}-${cell.day}`;
              const hasTask = cell.currentMonth && taskDays.has(dateKey);
              return (
                <div key={cell.key} className="relative flex items-center justify-center h-7">
                  <span className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-brand-500 text-white font-bold' :
                    cell.currentMonth ? 'text-surface-300' : 'text-surface-700'
                  }`}>
                    {cell.day}
                  </span>
                  {hasTask && !isToday && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Schedule Overview Donut */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
        <Card className="p-5">
          <h3 className="text-sm font-bold text-surface-50 mb-4">Schedule Overview</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={58} paddingAngle={3} dataKey="value">
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-display font-extrabold text-surface-50">{counts.total}</p>
                <p className="text-[9px] text-surface-400 uppercase tracking-wider">Tasks</p>
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

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-5">
          <h3 className="text-sm font-bold text-surface-50 mb-3">Quick Actions</h3>
          <div className="space-y-1.5">
            {[
              { icon: <Calendar size={15} />, label: 'Schedule a Task', onClick: onScheduleTask },
              { icon: <FileText size={15} />, label: 'View Unscheduled Tasks', onClick: () => navigate('/personal/tasks') },
              { icon: <ListTodo size={15} />, label: 'Set a Focus Goal', onClick: () => navigate('/personal/analytics') },
              { icon: <CheckCircle size={15} />, label: 'View Productivity Stats', onClick: () => navigate('/personal/analytics') },
            ].map(action => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-800/50 transition-all"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-surface-500">{action.icon}</span>
                  {action.label}
                </span>
                <ChevronRight size={14} className="text-surface-600" />
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Motivational Quote */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
        <Card className="p-5 relative overflow-hidden min-h-[140px]">
          <div className="absolute inset-0 opacity-20">
            <img src="/SVG/roadmap-mountain.svg" alt="" aria-hidden="true" className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900/90 via-surface-900/60 to-transparent" />
          <div className="relative z-10">
            <div className="text-4xl text-brand-500/30 font-display select-none pointer-events-none leading-none">&ldquo;</div>
            <p className="text-sm font-semibold text-surface-100 leading-relaxed italic -mt-2">
              Plan today. Do tomorrow. Grow always.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

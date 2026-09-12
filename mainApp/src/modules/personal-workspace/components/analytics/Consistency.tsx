import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, CheckCircle2 } from 'lucide-react';

interface ConsistencyProps {
  activeDays: number;
  completedMilestones: number;
  completedTasks: number;
}

export function Consistency({ activeDays, completedMilestones, completedTasks }: ConsistencyProps) {
  const weekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isActive: i < activeDays, // simplified: recent days are active
      });
    }
    
    return days;
  }, [activeDays]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-surface-900 rounded-2xl border border-surface-800 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-50">Consistency</h3>
        <span className="text-xs text-surface-400">{activeDays} active days this month</span>
      </div>

      {/* Week day indicators */}
      <div className="flex items-center justify-between mb-5 px-1">
        {weekDays.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-surface-500 font-medium">{day.label}</span>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
              day.isActive 
                ? 'bg-success-500 text-surface-900' 
                : 'bg-surface-800 text-surface-500'
            }`}>
              {day.isActive ? '✓' : '·'}
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-warning-500/15 flex items-center justify-center mx-auto mb-2">
            <Flame size={18} className="text-warning-400" />
          </div>
          <p className="text-lg font-bold text-surface-50">{activeDays}</p>
          <p className="text-[10px] text-surface-400">Active Days</p>
          <p className="text-[10px] text-success-400 font-medium mt-0.5">↑ 2</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-info-500/15 flex items-center justify-center mx-auto mb-2">
            <Target size={18} className="text-info-400" />
          </div>
          <p className="text-lg font-bold text-surface-50">{completedMilestones}</p>
          <p className="text-[10px] text-surface-400">Milestones Done</p>
          <p className="text-[10px] text-success-400 font-medium mt-0.5">↑ 4</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-success-500/15 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={18} className="text-success-400" />
          </div>
          <p className="text-lg font-bold text-surface-50">{completedTasks}</p>
          <p className="text-[10px] text-surface-400">Tasks Done</p>
          <p className="text-[10px] text-success-400 font-medium mt-0.5">↑ 6</p>
        </div>
      </div>
    </motion.div>
  );
}
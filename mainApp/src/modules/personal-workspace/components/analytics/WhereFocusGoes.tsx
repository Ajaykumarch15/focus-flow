import { motion } from 'framer-motion';

interface TopTaskItem {
  _id: string;
  title: string;
  totalTime: number;
}

interface WhereFocusGoesProps {
  topTasks: TopTaskItem[];
}

const formatTime = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export function WhereFocusGoes({ topTasks }: WhereFocusGoesProps) {
  if (topTasks.length === 0) return null;

  const maxTime = topTasks[0]?.totalTime || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="bg-surface-900 rounded-2xl border border-surface-800 p-5"
    >
      <h3 className="text-sm font-semibold text-surface-50 mb-4">Where Your Focus Goes</h3>

      <div className="space-y-3">
        {topTasks.slice(0, 5).map((task, idx) => {
          const pct = Math.round((task.totalTime / maxTime) * 100);
          return (
            <motion.div
              key={task._id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.37 + idx * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="text-[11px] text-surface-500 font-mono w-4 text-right">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-200 truncate mb-1">{task.title}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-brand-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[11px] text-surface-400 flex-shrink-0">{formatTime(task.totalTime)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
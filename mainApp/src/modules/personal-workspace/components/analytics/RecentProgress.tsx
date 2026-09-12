import { motion } from 'framer-motion';
import { Target, CheckCircle2, ChevronRight } from 'lucide-react';

interface RecentItem {
  type: 'task' | 'milestone';
  title: string;
  date: string;
  roadmapId: string;
}

interface RecentProgressProps {
  recentActivity: RecentItem[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RecentProgress({ recentActivity }: RecentProgressProps) {
  if (recentActivity.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="bg-surface-900 rounded-2xl border border-surface-800 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-50">Recent Progress</h3>
        <button className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1">
          View All <ChevronRight size={14} />
        </button>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-surface-800" />

        <div className="space-y-3">
          {recentActivity.slice(0, 6).map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.47 + idx * 0.05 }}
              className="flex items-start gap-3 relative"
            >
              {/* Timeline dot */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                item.type === 'milestone' 
                  ? 'bg-info-500/15 text-info-400' 
                  : 'bg-success-500/15 text-success-400'
              }`}>
                {item.type === 'milestone' ? <Target size={12} /> : <CheckCircle2 size={12} />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-200">
                  <span className="text-surface-400">
                    {item.type === 'milestone' ? 'Completed milestone' : 'Completed task'}
                  </span>{' '}
                  "{item.title}"
                </p>
              </div>

              {/* Date */}
              <span className="text-[10px] text-surface-500 flex-shrink-0">{formatDate(item.date)}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
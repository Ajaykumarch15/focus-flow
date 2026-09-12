import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Calendar } from 'lucide-react';
import { Badge } from '@shared/components/ui/Badge';
import { safeProgress, getListHealth } from '@personal/services/roadmapProgress';

interface RoadmapStat {
  _id: string;
  title: string;
  description: string;
  status: string;
  color: string;
  icon: string;
  targetDate?: string;
  progress: number;
  phaseTotal: number;
  phaseCompleted: number;
  milestoneTotal: number;
  milestoneCompleted: number;
  taskTotal: number;
  taskCompleted: number;
  focusedTimeMs?: number;
}

interface RoadmapHealthProps {
  roadmaps: RoadmapStat[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RoadmapHealth({ roadmaps }: RoadmapHealthProps) {
  const navigate = useNavigate();

  if (roadmaps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-surface-900 rounded-2xl border border-surface-800 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-50">Roadmap Health</h3>
        <button
          onClick={() => navigate('/personal/roadmaps')}
          className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
        >
          View All <ChevronRight size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {roadmaps.slice(0, 4).map((roadmap, idx) => {
          const health = getListHealth(roadmap as any);
          const progress = safeProgress(roadmap.progress);

          return (
            <motion.button
              key={roadmap._id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.27 + idx * 0.05 }}
              onClick={() => navigate(`/personal/roadmaps/${roadmap._id}`)}
              className="w-full text-left p-3 rounded-xl hover:bg-surface-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${roadmap.color}15`, color: roadmap.color }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: roadmap.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-surface-50 truncate">{roadmap.title}</p>
                    <Badge tone={health.tone} className="text-[10px]">{health.label}</Badge>
                  </div>
                </div>
                <span className="text-sm font-bold text-surface-200">{progress}%</span>
                <ChevronRight size={14} className="text-surface-500 group-hover:text-surface-300 transition-colors" />
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: roadmap.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 text-[10px] text-surface-400">
                <span>{roadmap.phaseCompleted}/{roadmap.phaseTotal} Phases</span>
                <span>{roadmap.milestoneCompleted}/{roadmap.milestoneTotal} Milestones</span>
                <span>{roadmap.taskCompleted}/{roadmap.taskTotal} Tasks</span>
                {roadmap.targetDate && (
                  <span className="flex items-center gap-1 ml-auto">
                    <Calendar size={10} />
                    {formatDate(roadmap.targetDate)}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
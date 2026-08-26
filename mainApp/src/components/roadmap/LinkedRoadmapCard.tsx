import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Map, ExternalLink, Unlink } from 'lucide-react';
import { useRoadmapStore } from '../../store/useRoadmapStore';
import { Badge, type BadgeTone } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface LinkedRoadmapCardProps {
  taskId: string;
  roadmapId: string;
  phaseId?: string;
  milestoneId?: string;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  planning: 'info', active: 'brand', completed: 'success', paused: 'warning', archived: 'neutral',
  upcoming: 'info', 'in-progress': 'brand', todo: 'neutral',
};

export function LinkedRoadmapCard({ taskId, roadmapId, phaseId, milestoneId }: LinkedRoadmapCardProps) {
  const navigate = useNavigate();
  const { activeRoadmap, getRoadmap, detailLoading, unlinkTask } = useRoadmapStore();
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  useEffect(() => {
    if (roadmapId && (!activeRoadmap || activeRoadmap._id !== roadmapId)) {
      getRoadmap(roadmapId);
    }
  }, [roadmapId, activeRoadmap, getRoadmap]);

  const roadmap = activeRoadmap?._id === roadmapId ? activeRoadmap : null;
  const phase = roadmap?.phases.find(p => p._id === phaseId) ?? null;
  const milestone = roadmap?.milestones.find(m => m._id === milestoneId) ?? null;

  if (detailLoading && !roadmap) {
    return (
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
        <div className="h-4 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="h-2 w-32 bg-surface-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!roadmap) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-2xl border border-surface-800 bg-surface-900 p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: roadmap.color + '15' }}
          >
            <Map size={14} style={{ color: roadmap.color }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">
            Linked Roadmap
          </span>
        </div>
        <button
          type="button"
          onClick={() => setConfirmUnlink(true)}
          className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Unlink from roadmap"
        >
          <Unlink size={14} />
        </button>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => navigate(`/roadmaps/${roadmap._id}`)}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-850/50 border border-transparent hover:border-surface-800 transition-all group/row"
        >
          <Badge tone={STATUS_TONE[roadmap.status] ?? 'neutral'}>{roadmap.status}</Badge>
          <span className="text-sm font-medium text-surface-100 truncate">{roadmap.title}</span>
          <span className="text-xs text-surface-500 ml-auto shrink-0">{roadmap.progress}%</span>
          <ExternalLink size={12} className="text-surface-600 group-hover/row:text-surface-400 transition-colors shrink-0" />
        </button>

        {phase && (
          <button
            type="button"
            onClick={() => navigate(`/roadmaps/${roadmap._id}/phases/${phase._id}`)}
            className="w-full flex items-center gap-2 p-2 pl-8 rounded-lg hover:bg-surface-850/50 border border-transparent hover:border-surface-800 transition-all group/row"
          >
            <Badge tone={STATUS_TONE[phase.status] ?? 'neutral'}>{phase.status}</Badge>
            <span className="text-sm text-surface-200 truncate">{phase.title}</span>
            <span className="text-xs text-surface-500 ml-auto shrink-0">{phase.progress}%</span>
            <ExternalLink size={12} className="text-surface-600 group-hover/row:text-surface-400 transition-colors shrink-0" />
          </button>
        )}

        {milestone && (
          <button
            type="button"
            onClick={() => navigate(`/roadmaps/${roadmap._id}/phases/${phase?._id}/milestones/${milestone._id}`)}
            className="w-full flex items-center gap-2 p-2 pl-14 rounded-lg hover:bg-surface-850/50 border border-transparent hover:border-surface-800 transition-all group/row"
          >
            <Badge tone={STATUS_TONE[milestone.status] ?? 'neutral'}>{milestone.status}</Badge>
            <span className="text-sm text-surface-300 truncate">{milestone.title}</span>
            <span className="text-xs text-surface-500 ml-auto shrink-0">{milestone.progress}%</span>
            <ExternalLink size={12} className="text-surface-600 group-hover/row:text-surface-400 transition-colors shrink-0" />
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmUnlink}
        title="Unlink from Roadmap"
        message="This will remove the roadmap link from this task. The roadmap itself will not be affected."
        confirmLabel="Unlink"
        variant="danger"
        onConfirm={async () => {
          await unlinkTask(taskId);
          setConfirmUnlink(false);
        }}
        onCancel={() => setConfirmUnlink(false)}
      />
    </motion.div>
  );
}

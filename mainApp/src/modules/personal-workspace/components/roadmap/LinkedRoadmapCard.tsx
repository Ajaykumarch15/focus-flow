import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Map, ExternalLink, Unlink } from 'lucide-react';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';

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

export function LinkedRoadmapCard({ taskId, roadmapId, phaseId, milestoneId: _milestoneId }: LinkedRoadmapCardProps) {
  const navigate = useNavigate();
  const { activeRoadmap, getRoadmap, detailLoading, unlinkTask } = useRoadmapStore();
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  useEffect(() => {
    if (roadmapId && (!activeRoadmap || activeRoadmap._id !== roadmapId)) {
      getRoadmap(roadmapId);
    }
  }, [roadmapId, activeRoadmap, getRoadmap]);

  const roadmap = activeRoadmap?._id === roadmapId ? activeRoadmap : null;

  if (detailLoading && !roadmap) {
    return (
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
        <div className="h-4 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="h-8 bg-surface-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!roadmap) return null;

  const displayPhases = roadmap.phases.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-2xl border border-surface-800 bg-surface-900 p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/personal/roadmaps/${roadmap._id}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
          >
            View Roadmap
            <ExternalLink size={12} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmUnlink(true)}
            className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Unlink from roadmap"
          >
            <Unlink size={14} />
          </button>
        </div>
      </div>

      {/* Horizontal Phase Chain */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {displayPhases.map((p, index) => {
          const isCurrentPhase = phaseId === p._id;
          const status = p.status || 'todo';
          return (
            <div key={p._id} className="flex items-center flex-shrink-0">
              {/* Phase Card */}
              <button
                type="button"
                onClick={() => navigate(`/personal/roadmaps/${roadmap._id}/phases/${p._id}`)}
                className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all min-w-[140px] ${
                  isCurrentPhase
                    ? 'border-brand-500/30 bg-brand-500/5'
                    : 'border-surface-800 hover:border-surface-700 hover:bg-surface-850/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[status] ?? 'neutral'} className="text-[10px]">
                    {status}
                  </Badge>
                  <ExternalLink size={10} className="text-surface-600" />
                </div>
                <span className="text-xs font-medium text-surface-200 truncate text-left">
                  {p.title}
                </span>
                {/* Progress bar */}
                <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${p.progress || 0}%`,
                      backgroundColor: status.toString() === 'completed' ? '#10b981' : status.toString() === 'in-progress' ? '#3b82f6' : roadmap.color || '#6366f1',
                    }}
                  />
                </div>
                <span className="text-[10px] text-surface-500 text-right">{p.progress || 0}%</span>
              </button>

              {/* Connector line */}
              {index < displayPhases.length - 1 && (
                <div className="flex items-center px-1 flex-shrink-0">
                  <div className="w-6 border-t-2 border-dashed border-surface-700" />
                  <div className="w-2 h-2 rounded-full border-2 border-surface-600 bg-surface-900 flex-shrink-0" />
                  <div className="w-6 border-t-2 border-dashed border-surface-700" />
                </div>
              )}
            </div>
          );
        })}
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
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Flame, CheckCircle2, AlertOctagon, GitPullRequest, FileText, Activity } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';

export function ActivityFeedPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { activities, activeWorkspaceId } = useCollaborationStore();

  const wsActivities = useMemo(
    () => activities.filter((a) => a.workspaceId === (workspaceId || activeWorkspaceId)),
    [activities, workspaceId, activeWorkspaceId]
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'focus_session_start':
        return <Flame size={16} className="text-amber-400" />;
      case 'task_completed':
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'blocker_resolved':
        return <AlertOctagon size={16} className="text-red-400" />;
      case 'pr_merged':
        return <GitPullRequest size={16} className="text-purple-400" />;
      case 'doc_created':
        return <FileText size={16} className="text-cyan-400" />;
      default:
        return <Activity size={16} className="text-brand-400" />;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-extrabold text-surface-50 flex items-center gap-2.5">
          <Clock size={24} className="text-pink-400" /> Live Engineering Activity Telemetry
        </h1>
        <p className="text-xs text-surface-400 mt-1">
          Automatically generated timeline of developer activities, PR merges, focus sessions, and blocker resolutions. Zero manual updates required.
        </p>
      </div>

      <div className="rounded-3xl border border-surface-800 bg-surface-900 p-6 lg:p-8 space-y-6">
        <div className="relative border-l-2 border-surface-800 ml-4 space-y-6 pl-6">
          {wsActivities.map((act) => (
            <motion.div key={act.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="relative group">
              
              {/* Dot Icon */}
              <div className="absolute -left-[37px] top-0.5 w-8 h-8 rounded-full bg-surface-850 border border-surface-750 flex items-center justify-center shadow-md">
                {getActivityIcon(act.type)}
              </div>

              <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800 space-y-1 group-hover:border-surface-700 transition-all">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-surface-100">{act.actor.name}</span>
                    <span className="text-surface-400 font-semibold">{act.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-surface-500">
                    {new Date(act.timestamp).toLocaleString()}
                  </span>
                </div>
                {act.detail && <p className="text-xs text-surface-300">{act.detail}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

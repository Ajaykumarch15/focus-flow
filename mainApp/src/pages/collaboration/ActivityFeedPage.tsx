import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Activity, Users, FolderOpen } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { activityActionLabel, activityDetail } from '../../lib/collaborationActivity';
import { Card } from '../../components/ui/Card';

export function ActivityFeedPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const {
    activities, activeWorkspaceId, loadWorkspaceActivity,
    activityLoading, activityHasMore, activityNextCursor,
  } = useCollaborationStore();

  const wsId = workspaceId || activeWorkspaceId;

  // IES-P2-04: the deep-link page loads its own feed (independent of the
  // TeamWorkspace mount that previously populated the store).
  useEffect(() => {
    if (wsId) loadWorkspaceActivity(wsId);
  }, [wsId, loadWorkspaceActivity]);

  const wsActivities = useMemo(
    () => activities.filter((a) => a.workspaceId === wsId),
    [activities, wsId],
  );

  const getActivityIcon = (action: string) => {
    if (action.startsWith('workspace.member')) return <Users size={16} className="text-pink-400" />;
    switch (action) {
      case 'workspace.created':
      case 'workspace.updated':
      case 'workspace.deleted':
        return <FolderOpen size={16} className="text-cyan-400" />;
      case 'project.created':
      case 'project.updated':
        return <FolderOpen size={16} className="text-emerald-400" />;
      case 'team.created':
      case 'team.updated':
      case 'team.deleted':
      case 'team.member.added':
      case 'team.member.removed':
        return <Users size={16} className="text-brand-400" />;
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
          Real workspace events — member changes, workspace updates, and project creation — recorded automatically. Zero manual updates required.
        </p>
      </div>

      <Card className="p-6 lg:p-8 space-y-6">
        <div className="relative border-l-2 border-surface-800 ml-4 space-y-6 pl-6">
          {activityLoading && wsActivities.length === 0 && (
            <p className="text-xs text-surface-500 italic">Loading activity…</p>
          )}
          {!activityLoading && wsActivities.length === 0 && (
            <p className="text-xs text-surface-500 italic">No activity yet.</p>
          )}
          {wsActivities.map((act) => (
            <motion.div key={act.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="relative group">
              
              {/* Dot Icon */}
              <div className="absolute -left-[37px] top-0.5 w-8 h-8 rounded-full bg-surface-850 border border-surface-750 flex items-center justify-center shadow-md">
                {getActivityIcon(act.action)}
              </div>

              <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800 space-y-1 group-hover:border-surface-700 transition-all">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-surface-100">{act.actor.name}</span>
                    <span className="text-surface-400 font-semibold">{activityActionLabel(act.action)}</span>
                  </div>
                  <span className="font-mono text-[10px] text-surface-500">
                    {new Date(act.timestamp).toLocaleString()}
                  </span>
                </div>
                {activityDetail(act) && <p className="text-xs text-surface-300">{activityDetail(act)}</p>}
              </div>
            </motion.div>
          ))}
          {activityHasMore && (
            <div className="pl-1">
              <button
                type="button"
                onClick={() => loadWorkspaceActivity(wsId, { cursor: activityNextCursor ?? undefined, append: true })}
                disabled={activityLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-surface-800 bg-surface-900 px-4 py-2 text-xs font-bold text-brand-400 hover:border-surface-700 hover:text-brand-300 transition-colors disabled:opacity-50"
              >
                <Activity size={14} />
                {activityLoading ? 'Loading…' : 'Load more activity'}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

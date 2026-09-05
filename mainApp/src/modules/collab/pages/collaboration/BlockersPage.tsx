import { useState, useMemo } from 'react';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { CreateBlockerModal } from '@collab/components/CreateBlockerModal';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';

// ECIS B.8: the Blockers page answers "What is blocking us?" — the Blocker
// Resolution Board with Report/Resolve, split out of the TeamWorkspace mega-tab.
// Mission Control keeps the attention-zone snapshot; this is the resolution board.

export function BlockersPage() {
  const { blockers, activeWorkspaceId, resolveBlocker } = useCollaborationStore();
  const [showCreateBlocker, setShowCreateBlocker] = useState(false);

  const wsBlockers = useMemo(
    () => blockers.filter((b) => b.workspaceId === activeWorkspaceId),
    [blockers, activeWorkspaceId],
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
              <AlertOctagon size={20} className="text-red-400" /> Blocker Resolution Board
            </h1>
            <p className="text-xs text-surface-400 mt-0.5">What is blocking us? Report a blocker or resolve one here.</p>
          </div>
          <Button onClick={() => setShowCreateBlocker(true)}
            variant="danger" size="sm" leftIcon={<AlertOctagon size={14} />}>
            Report Blocker
          </Button>
        </div>

        <div className="space-y-3">
          {wsBlockers.map((blk) => (
            <div key={blk.id} className="p-4 rounded-xl border border-surface-800 bg-surface-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone={blk.severity === 'critical' ? 'danger' : 'warning'} className="text-[10px] font-extrabold uppercase">
                    {blk.severity}
                  </Badge>
                  <h4 className="text-sm font-bold text-surface-100">{blk.title}</h4>
                </div>
                <p className="text-xs text-surface-400">{blk.impactDescription}</p>
              </div>

              <div className="flex items-center gap-3">
                {blk.status === 'resolved' ? (
                  <Badge tone="success" icon={<CheckCircle2 size={13} />} className="text-xs font-bold px-3 py-1.5 border border-emerald-500/20">
                    Resolved
                  </Badge>
                ) : (
                  <Button onClick={() => resolveBlocker(blk.id)} size="sm">
                    Resolve Blocker
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {wsBlockers.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-400/70 mb-3" />
            <p className="text-xs font-bold text-surface-300 mb-1">No blockers reported</p>
            <p className="text-xs text-surface-500 italic mb-4">The pipeline is clear. Report one if something is in the way.</p>
            <Button onClick={() => setShowCreateBlocker(true)} variant="danger" size="xs" leftIcon={<AlertOctagon size={12} />}>
              Report Blocker
            </Button>
          </div>
        )}
      </div>

      <CreateBlockerModal isOpen={showCreateBlocker} onClose={() => setShowCreateBlocker(false)} />
    </div>
  );
}

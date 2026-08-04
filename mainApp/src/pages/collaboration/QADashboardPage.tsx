import { useMemo } from 'react';
import {
  ShieldCheck, AlertOctagon, Check, GitPullRequest
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

export function QADashboardPage() {
  const { tasks, blockers, updateTaskStatus } = useCollaborationStore();

  const qaReadyFeatures = useMemo(() => tasks.filter((t) => t.sprintStatus === 'review'), [tasks]);
  const inDevFeatures = useMemo(() => tasks.filter((t) => t.sprintStatus === 'in_progress'), [tasks]);
  const doneFeatures = useMemo(() => tasks.filter((t) => t.sprintStatus === 'done'), [tasks]);
  const openBlockers = useMemo(() => blockers.filter((b) => b.status !== 'resolved'), [blockers]);

  const sprintReadinessPct = useMemo(() => {
    // IES-P2-08: an empty task set is "no data", not a fabricated 100% readiness.
    if (tasks.length === 0) return null;
    return Math.round((doneFeatures.length / tasks.length) * 100);
  }, [tasks, doneFeatures]);

  const handleApproveFeature = (taskId: string) => {
    updateTaskStatus(taskId, 'done');
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      
      {/* Top Banner */}
      <Card className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="info" className="text-xs font-bold uppercase tracking-widest">
                QA & Release Gate
              </Badge>
            </div>
            <h1 className="text-2xl font-display font-extrabold text-surface-50 mt-2 flex items-center gap-2.5">
              <ShieldCheck size={26} className="text-indigo-400" /> Dedicated QA Readiness Dashboard
            </h1>
            <p className="text-xs text-surface-400 mt-1">
              Gain 100% visibility into sprint testing readiness, review queues, and open blockers without interrupting developers.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800 min-w-[240px] text-center space-y-1">
            <span className="text-xs text-surface-400 font-semibold">Overall Sprint Readiness</span>
            <p className="text-3xl font-display font-extrabold text-emerald-400">
              {sprintReadinessPct === null ? '—' : `${sprintReadinessPct}%`}
            </p>
            <p className="text-[10px] text-surface-500 font-medium">
              {tasks.length === 0 ? 'No features tracked' : `${doneFeatures.length} of ${tasks.length} Features Validated`}
            </p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-surface-800">
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-xs font-semibold text-surface-400">Ready for QA Review</span>
            <p className="text-2xl font-display font-extrabold text-indigo-400 mt-1">{qaReadyFeatures.length}</p>
            <p className="text-[11px] text-indigo-400/80 mt-1">Pending testing approval</p>
          </div>

          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
            <span className="text-xs font-semibold text-surface-400">In Active Development</span>
            <p className="text-2xl font-display font-extrabold text-sky-400 mt-1">{inDevFeatures.length}</p>
            <p className="text-[11px] text-sky-400/80 mt-1">Ongoing developer work</p>
          </div>

          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <span className="text-xs font-semibold text-surface-400">Active Blockers</span>
            <p className="text-2xl font-display font-extrabold text-red-400 mt-1">{openBlockers.length}</p>
            <p className="text-[11px] text-red-400/80 mt-1">Requires infrastructure/QA fix</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-xs font-semibold text-surface-400">Passed & Deployed</span>
            <p className="text-2xl font-display font-extrabold text-emerald-400 mt-1">{doneFeatures.length}</p>
            <p className="text-[11px] text-emerald-400/80 mt-1">Production ready</p>
          </div>
        </div>
      </Card>

      {/* Main Content Grid: QA Review Queue vs Blocker Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        
        {/* QA Review Queue */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
            <GitPullRequest size={18} className="text-indigo-400" /> Features Ready for Testing & Verification ({qaReadyFeatures.length})
          </h2>

          <div className="space-y-3">
            {qaReadyFeatures.length > 0 ? (
              qaReadyFeatures.map((feat) => (
                <div key={feat.id} className="p-5 rounded-2xl bg-surface-850 border border-surface-800 space-y-3 hover:border-surface-700 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      {feat.gitContext?.prNumber ? (
                        <Badge tone="info" className="text-[10px] font-extrabold uppercase">
                          PR #{feat.gitContext.prNumber}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className="text-[10px] font-extrabold uppercase">
                          No PR linked
                        </Badge>
                      )}
                      <h3 className="text-sm font-bold text-surface-100 mt-1">{feat.title}</h3>
                      <p className="text-xs text-surface-400 mt-0.5">{feat.description}</p>
                    </div>

                    <Button onClick={() => handleApproveFeature(feat.id)} size="sm"
                      className="shadow-lg shadow-brand-500/20" leftIcon={<Check size={14} />}>
                      Approve & Mark Done
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-surface-800 flex items-center justify-between text-[11px] text-surface-400">
                    <span>Branch: {feat.gitContext?.branch ? <code className="text-emerald-400">{feat.gitContext.branch}</code> : '—'}</span>
                    <span>Reviewer: {feat.gitContext?.reviewerName || '—'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 rounded-2xl bg-surface-850 border border-surface-800 text-center text-xs text-surface-400 italic">
                No features currently awaiting QA approval. All pending items are either in development or merged!
              </div>
            )}
          </div>
        </Card>

        {/* QA Blocker Matrix */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
            <AlertOctagon size={18} className="text-red-400" /> Critical QA & Test Blockers
          </h2>

          <div className="space-y-3">
            {openBlockers.map((blk) => (
              <div key={blk.id} className="p-4 rounded-xl bg-surface-850 border border-surface-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge tone={blk.severity === 'critical' ? 'danger' : 'warning'} className="text-[10px] font-bold uppercase">
                    {blk.severity}
                  </Badge>
                  <p className="text-xs font-bold text-surface-100">{blk.title}</p>
                </div>
                <p className="text-xs text-surface-400">{blk.impactDescription}</p>
              </div>
            ))}
            {openBlockers.length === 0 && (
              <div className="p-6 rounded-2xl bg-surface-850 border border-surface-800 text-center text-xs text-surface-400 italic">
                No open blockers right now.
              </div>
            )}
          </div>
        </Card>

      </div>

    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, ListChecks, Trash2 } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { selectModuleCompletion, selectFeaturesByModule } from '../../lib/moduleSelectors';
import { RoadmapStatusBadge } from '../../components/roadmap/RoadmapStatusBadge';
import { ConfirmDialog } from '../../components/roadmap/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { WorkItemTypeBadge } from '../../components/collaboration/WorkItemTypeBadge';

export function ModuleDetailPage() {
  const { workspaceId, projectId, moduleId } = useParams<{ workspaceId: string; projectId: string; moduleId: string }>();
  const navigate = useNavigate();
  const { modules, phases, milestones, features, members, activeWorkspaceId, deleteModule } = useCollaborationStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mod = useMemo(
    () => modules.find((m) => m.id === moduleId && m.projectId === projectId),
    [modules, moduleId, projectId],
  );

  const parentPhase = useMemo(
    () => (mod?.phaseId ? phases.find((p) => p.id === mod.phaseId) : undefined),
    [mod, phases],
  );
  const parentMilestone = useMemo(
    () => (parentPhase?.milestoneId ? milestones.find((m) => m.id === parentPhase.milestoneId) : undefined),
    [parentPhase, milestones],
  );

  const ownedFeatures = useMemo(
    () => (mod ? selectFeaturesByModule(features, mod.id) : []),
    [features, mod],
  );

  const completion = useMemo(
    () => (mod ? selectModuleCompletion(mod, features) : null),
    [mod, features],
  );

  const owner = useMemo(
    () => (mod?.ownerId ? members.find((m) => m.id === mod.ownerId) : undefined),
    [mod, members],
  );

  const wsKey = workspaceId ?? activeWorkspaceId;
  const projectUrl = `/w/${wsKey}/projects/${projectId}`;

  if (!mod) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <Card>
          <EmptyState
            icon={<Boxes size={26} />}
            title="Module not found"
            description="This Module does not exist, or it may have been removed."
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate(`${projectUrl}/roadmap`)} leftIcon={<ArrowLeft size={14} />}>
                Back to Roadmap
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title={mod.name}
        description={mod.description || 'A capability area inside a Phase.'}
        eyebrow={parentMilestone && parentPhase ? `${parentMilestone.name} › ${parentPhase.name}` : 'Module'}
        icon={<Boxes size={18} className="text-cyan-400" />}
        actions={
          <div className="flex items-center gap-2">
            <RoadmapStatusBadge status={mod.status} />
            <Button variant="ghost" size="sm" onClick={() => navigate(`${projectUrl}/roadmap`)} leftIcon={<ArrowLeft size={14} />}>
              Roadmap
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} leftIcon={<Trash2 size={14} />}>
              Delete
            </Button>
          </div>
        }
      />

      {completion && (
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-surface-400 mb-2">
            <span>Module completion</span>
            <span>{completion.total === 0 ? 'No features yet' : `${completion.done}/${completion.total} features done`} · {completion.pct}%</span>
          </div>
          <Progress value={completion.pct} tone={completion.pct === 100 ? 'success' : 'brand'} ariaLabel={`${mod.name} completion`} />
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-xs">
          <p className="text-surface-500 font-semibold uppercase tracking-wider mb-1">Phase</p>
          <p className="text-surface-50 font-bold truncate">{parentPhase?.name ?? 'Orphaned'}</p>
        </Card>
        <Card className="p-4 text-xs">
          <p className="text-surface-500 font-semibold uppercase tracking-wider mb-1">Milestone</p>
          <p className="text-surface-50 font-bold truncate">{parentMilestone?.name ?? '—'}</p>
        </Card>
        <Card className="p-4 text-xs">
          <p className="text-surface-500 font-semibold uppercase tracking-wider mb-1">Owner</p>
          <p className="text-surface-50 font-bold truncate">{owner?.name ?? 'Unassigned'}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-display font-extrabold text-surface-50 flex items-center gap-2">
          <ListChecks size={16} className="text-emerald-400" />
          Features
        </h2>
        <span className="text-[11px] text-surface-500">{ownedFeatures.length} feature{ownedFeatures.length === 1 ? '' : 's'}</span>
      </div>

      {ownedFeatures.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks size={26} />}
            title="No features in this module"
            description="Features attach to Modules from the Features page. Assign one here to start rolling up completion."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate(`/w/${wsKey}/features`)}>
                Go to Features
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {ownedFeatures.map((feature) => (
            <Card key={feature.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold text-surface-50 text-sm truncate">{feature.name}</p>
                  {feature.description && <p className="text-xs text-surface-400 mt-1 line-clamp-1">{feature.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <WorkItemTypeBadge type={feature.type} />
                    {feature.ownerId && (
                      <span className="text-[11px] text-surface-500">
                        {members.find((m) => m.id === feature.ownerId)?.name ?? 'Unassigned'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <StatusBadge status={feature.status} />
                  <span className="text-[11px] text-surface-500">
                    {feature.estimatedHours > 0 ? `${feature.estimatedHours}h` : '—'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Module?"
        description={`"${mod.name}" will be deleted. Its Features become project-level (moduleRef null, DDS §6.3). This cannot be undone.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteModule(mod.id);
          navigate(`${projectUrl}/roadmap`);
        }}
      />
    </div>
  );
}

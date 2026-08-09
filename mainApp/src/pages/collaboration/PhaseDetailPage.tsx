import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, Layers, Plus, Trash2 } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { selectPhaseProgress } from '../../lib/roadmapSelectors';
import { RoadmapStatusBadge, ROADMAP_STATUS_OPTIONS } from '../../components/roadmap/RoadmapStatusBadge';
import { ConfirmDialog } from '../../components/roadmap/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { formatDateShort } from '../../utils/time';
import type { RoadmapModule, RoadmapStatus } from '../../types/collaboration';

interface ModuleDraft {
  name: string;
  description: string;
  status: RoadmapStatus;
  order: number;
  ownerId: string;
}

function ModuleFormDialog({ open, phaseId, projectId, onClose }: {
  open: boolean;
  phaseId: string;
  projectId: string;
  onClose: () => void;
}) {
  const { createModule, members } = useCollaborationStore();
  const [draft, setDraft] = useState<ModuleDraft>({ name: '', description: '', status: 'planned', order: 0, ownerId: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    const created = await createModule({
      phaseId,
      projectId,
      name: draft.name,
      description: draft.description,
      status: draft.status,
      order: draft.order,
      ownerId: draft.ownerId || null,
    });
    setSaving(false);
    if (created) {
      setDraft({ name: '', description: '', status: 'planned', order: 0, ownerId: '' });
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Module"
      description="A capability area inside this Phase (DDS §4.7)."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!draft.name.trim()} loading={saving}>
            Create Module
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="md-name" required>
          <Input
            id="md-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Auth module"
            maxLength={150}
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="md-desc">
          <Textarea
            id="md-desc"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What capability does this module provide?"
            maxLength={5000}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Status" htmlFor="md-status">
            <Select id="md-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RoadmapStatus })}>
              {ROADMAP_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Order" htmlFor="md-order" hint="Ascending">
            <Input id="md-order" type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Owner" htmlFor="md-owner" hint="Workspace member">
            <Select id="md-owner" value={draft.ownerId} onChange={(e) => setDraft({ ...draft, ownerId: e.target.value })}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

export function PhaseDetailPage() {
  const { workspaceId, projectId, phaseId } = useParams<{ workspaceId: string; projectId: string; phaseId: string }>();
  const navigate = useNavigate();
  const { phases, milestones, modules, members, activeWorkspaceId, deletePhase } = useCollaborationStore();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const phase = useMemo(
    () => phases.find((p) => p.id === phaseId && p.projectId === projectId),
    [phases, phaseId, projectId],
  );

  const parentMilestone = useMemo(
    () => (phase?.milestoneId ? milestones.find((m) => m.id === phase.milestoneId) : undefined),
    [phase, milestones],
  );

  const ownedModules = useMemo(
    () => (phase
      ? modules
          .filter((m) => m.phaseId === phase.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt))
      : []),
    [modules, phase],
  );

  const progress = useMemo(
    () => (phase ? selectPhaseProgress(phase, modules) : null),
    [phase, modules],
  );

  const wsKey = workspaceId ?? activeWorkspaceId;
  const projectUrl = `/w/${wsKey}/projects/${projectId}`;

  if (!phase) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <Card>
          <EmptyState
            icon={<Layers size={26} />}
            title="Phase not found"
            description="This Phase does not exist, or it may have been removed."
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
        title={phase.name}
        description={phase.description || 'A delivery stage inside a Milestone.'}
        eyebrow={parentMilestone ? `in ${parentMilestone.name}` : 'Phase'}
        icon={<Layers size={18} className="text-purple-400" />}
        actions={
          <div className="flex items-center gap-2">
            <RoadmapStatusBadge status={phase.status} />
            <Button variant="ghost" size="sm" onClick={() => navigate(`${projectUrl}/roadmap`)} leftIcon={<ArrowLeft size={14} />}>
              Roadmap
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />}>
              New Module
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} leftIcon={<Trash2 size={14} />}>
              Delete
            </Button>
          </div>
        }
      />

      {phase.startDate && phase.endDate && (
        <p className="text-xs text-surface-400 -mt-2">
          {formatDateShort(new Date(`${phase.startDate}T00:00:00`))} → {formatDateShort(new Date(`${phase.endDate}T00:00:00`))}
        </p>
      )}

      {progress && (
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-surface-400 mb-2">
            <span>Phase progress</span>
            <span>{progress.total === 0 ? 'No modules yet' : `${progress.done}/${progress.total} modules complete`} · {progress.pct}%</span>
          </div>
          <Progress value={progress.pct} tone={progress.pct === 100 ? 'success' : 'brand'} ariaLabel={`${phase.name} progress`} />
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-display font-extrabold text-surface-50 flex items-center gap-2">
          <Boxes size={16} className="text-cyan-400" />
          Modules
        </h2>
      </div>

      {ownedModules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes size={26} />}
            title="No modules yet"
            description="Modules are the capability areas inside this Phase. Break the stage into capabilities, then Features attach to them."
            action={
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />}>
                New Module
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ownedModules.map((mod: RoadmapModule) => {
            const owner = members.find((m) => m.id === mod.ownerId);
            return (
              <Card
                key={mod.id}
                className="p-4 hover:border-surface-700 transition-colors cursor-pointer"
                onClick={() => navigate(`${projectUrl}/modules/${mod.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-surface-50 text-sm truncate">{mod.name}</p>
                    {mod.description && <p className="text-xs text-surface-400 mt-1 line-clamp-2">{mod.description}</p>}
                  </div>
                  <RoadmapStatusBadge status={mod.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-surface-500">
                  <span>Order {mod.order ?? 0}</span>
                  <span className="truncate ml-2">{owner ? `Owner: ${owner.name}` : 'No owner'}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ModuleFormDialog open={showCreate} phaseId={phase.id} projectId={projectId ?? ''} onClose={() => setShowCreate(false)} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Phase?"
        description={`"${phase.name}" will be deleted. Its Modules stay but detach from this Phase (DDS §6.3). This cannot be undone.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deletePhase(phase.id);
          navigate(`${projectUrl}/roadmap`);
        }}
      />
    </div>
  );
}

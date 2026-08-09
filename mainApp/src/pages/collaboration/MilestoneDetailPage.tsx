import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, Layers, Plus, Trash2 } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { selectMilestoneProgress } from '../../lib/roadmapSelectors';
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
import type { RoadmapPhase, RoadmapStatus } from '../../types/collaboration';

interface PhaseDraft {
  name: string;
  description: string;
  status: RoadmapStatus;
  order: number;
  startDate: string;
  endDate: string;
}

function PhaseFormDialog({ open, milestoneId, projectId, onClose }: {
  open: boolean;
  milestoneId: string;
  projectId: string;
  onClose: () => void;
}) {
  const { createPhase } = useCollaborationStore();
  const [draft, setDraft] = useState<PhaseDraft>({ name: '', description: '', status: 'planned', order: 0, startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    const created = await createPhase({
      milestoneId,
      projectId,
      name: draft.name,
      description: draft.description,
      status: draft.status,
      order: draft.order,
      startDate: draft.startDate ? draft.startDate : null,
      endDate: draft.endDate ? draft.endDate : null,
    });
    setSaving(false);
    if (created) {
      setDraft({ name: '', description: '', status: 'planned', order: 0, startDate: '', endDate: '' });
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Phase"
      description="A delivery stage inside this Milestone (DDS §4.6)."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!draft.name.trim()} loading={saving}>
            Create Phase
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="ph-name" required>
          <Input
            id="ph-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Phase 1: Core platform"
            maxLength={150}
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="ph-desc">
          <Textarea
            id="ph-desc"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What does this stage deliver?"
            maxLength={5000}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Start Date" htmlFor="ph-start" hint="Optional">
            <Input id="ph-start" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
          </Field>
          <Field label="End Date" htmlFor="ph-end" hint="Optional">
            <Input id="ph-end" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          </Field>
          <Field label="Status" htmlFor="ph-status">
            <Select id="ph-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RoadmapStatus })}>
              {ROADMAP_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

export function MilestoneDetailPage() {
  const { workspaceId, projectId, milestoneId } = useParams<{ workspaceId: string; projectId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const { milestones, phases, activeWorkspaceId, deleteMilestone } = useCollaborationStore();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const milestone = useMemo(
    () => milestones.find((m) => m.id === milestoneId && m.projectId === projectId),
    [milestones, milestoneId, projectId],
  );

  const ownedPhases = useMemo(
    () => (milestone
      ? phases
          .filter((p) => p.milestoneId === milestone.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt))
      : []),
    [phases, milestone],
  );

  const progress = useMemo(
    () => (milestone ? selectMilestoneProgress(milestone, phases) : null),
    [milestone, phases],
  );

  const wsKey = workspaceId ?? activeWorkspaceId;
  const projectUrl = `/w/${wsKey}/projects/${projectId}`;

  if (!milestone) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <Card>
          <EmptyState
            icon={<Flag size={26} />}
            title="Milestone not found"
            description="This Milestone does not exist, or it may have been removed."
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
        title={milestone.name}
        description={milestone.description || 'A dated, outcome-level commitment on the Roadmap.'}
        eyebrow={`${progress?.total ?? 0} ${(progress?.total ?? 0) === 1 ? 'phase' : 'phases'} · ${milestone.targetDate ? `target ${formatDateShort(new Date(`${milestone.targetDate}T00:00:00`))}` : 'no target date'}`}
        icon={<Flag size={18} className="text-cyan-400" />}
        actions={
          <div className="flex items-center gap-2">
            <RoadmapStatusBadge status={milestone.status} />
            <Button variant="ghost" size="sm" onClick={() => navigate(`${projectUrl}/roadmap`)} leftIcon={<ArrowLeft size={14} />}>
              Roadmap
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />}>
              New Phase
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} leftIcon={<Trash2 size={14} />}>
              Delete
            </Button>
          </div>
        }
      />

      {progress && (
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-surface-400 mb-2">
            <span>Milestone progress</span>
            <span>{progress.total === 0 ? 'No phases yet' : `${progress.done}/${progress.total} phases complete`} · {progress.pct}%</span>
          </div>
          <Progress value={progress.pct} tone={progress.pct === 100 ? 'success' : 'brand'} ariaLabel={`${milestone.name} progress`} />
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-display font-extrabold text-surface-50 flex items-center gap-2">
          <Layers size={16} className="text-purple-400" />
          Phases
        </h2>
      </div>

      {ownedPhases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers size={26} />}
            title="No phases yet"
            description="Phases are the delivery stages inside this Milestone. Break the milestone into stages to give the Roadmap its second ordering level."
            action={
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />}>
                New Phase
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {ownedPhases.map((phase: RoadmapPhase, idx) => (
            <Card
              key={phase.id}
              className="p-4 hover:border-surface-700 transition-colors cursor-pointer"
              onClick={() => navigate(`${projectUrl}/phases/${phase.id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-surface-800 text-surface-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-surface-50 text-sm truncate">{phase.name}</p>
                    <p className="text-[11px] text-surface-500 mt-0.5">
                      {phase.startDate && phase.endDate
                        ? `${formatDateShort(new Date(`${phase.startDate}T00:00:00`))} → ${formatDateShort(new Date(`${phase.endDate}T00:00:00`))}`
                        : phase.endDate
                          ? `Due ${formatDateShort(new Date(`${phase.endDate}T00:00:00`))}`
                          : 'No dates set'}
                    </p>
                  </div>
                </div>
                <RoadmapStatusBadge status={phase.status} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <PhaseFormDialog open={showCreate} milestoneId={milestone.id} projectId={projectId ?? ''} onClose={() => setShowCreate(false)} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Milestone?"
        description={`"${milestone.name}" will be deleted. Its Phases stay but detach from this Milestone (DDS §6.3). This cannot be undone.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteMilestone(milestone.id);
          navigate(`${projectUrl}/roadmap`);
        }}
      />
    </div>
  );
}

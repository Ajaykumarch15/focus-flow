import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Flag, Layers, Map, Plus, Trash2 } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import {
  selectMilestoneProgress,
  selectMilestonesByDate,
  selectRoadmapOrdered,
} from '../../lib/roadmapSelectors';
import { RoadmapStatusBadge, ROADMAP_STATUS_OPTIONS } from '../../components/roadmap/RoadmapStatusBadge';
import { RoadmapTimeline } from '../../components/roadmap/RoadmapTimeline';
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
import type { RoadmapMilestone, RoadmapStatus } from '../../types/collaboration';

interface MilestoneDraft {
  name: string;
  description: string;
  targetDate: string;
  status: RoadmapStatus;
  order: number;
}

function MilestoneFormDialog({ open, projectId, onClose }: { open: boolean; projectId: string; onClose: () => void }) {
  const { createMilestone } = useCollaborationStore();
  const [draft, setDraft] = useState<MilestoneDraft>({ name: '', description: '', targetDate: '', status: 'planned', order: 0 });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    const created = await createMilestone({
      projectId,
      name: draft.name,
      description: draft.description,
      targetDate: draft.targetDate ? draft.targetDate : null,
      status: draft.status,
      order: draft.order,
    });
    setSaving(false);
    if (created) {
      setDraft({ name: '', description: '', targetDate: '', status: 'planned', order: 0 });
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Milestone"
      description="A dated, outcome-level commitment on the Roadmap (DDS §4.5)."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!draft.name.trim()} loading={saving}>
            Create Milestone
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="ms-name" required>
          <Input
            id="ms-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. GA Launch"
            maxLength={150}
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="ms-desc">
          <Textarea
            id="ms-desc"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What does shipping this milestone mean for the project?"
            maxLength={5000}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Target Date" htmlFor="ms-date" hint="Optional">
            <Input
              id="ms-date"
              type="date"
              value={draft.targetDate}
              onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })}
            />
          </Field>
          <Field label="Status" htmlFor="ms-status">
            <Select
              id="ms-status"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as RoadmapStatus })}
            >
              {ROADMAP_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Order" htmlFor="ms-order" hint="Ascending">
            <Input
              id="ms-order"
              type="number"
              value={draft.order}
              onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

export function RoadmapPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const navigate = useNavigate();
  const { milestones, phases, activeWorkspaceId, deleteMilestone } = useCollaborationStore();
  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<RoadmapMilestone | null>(null);
  const [view, setView] = useState<'cards' | 'timeline'>('cards');

  const projectMilestones = useMemo(
    () => milestones.filter((m) => m.projectId === projectId),
    [milestones, projectId],
  );
  const projectPhases = useMemo(
    () => phases.filter((p) => p.projectId === projectId),
    [phases, projectId],
  );

  const roadmap = useMemo(() => selectRoadmapOrdered(projectMilestones), [projectMilestones]);
  const buckets = useMemo(() => selectMilestonesByDate(roadmap), [roadmap]);

  const wsKey = workspaceId ?? activeWorkspaceId;

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteMilestone(toDelete.id);
    setToDelete(null);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title="Roadmap"
        description="The ordered set of Milestones that define the project's outcomes (DDS §9)."
        eyebrow="Product Structure"
        icon={<Map size={18} className="text-cyan-400" />}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />}>
            New Milestone
          </Button>
        }
      />

      {/* View toggle: ordered cards vs. time-scaled timeline (EEP2-P3.4.5) */}
      <div className="flex items-center gap-1 w-fit p-1 rounded-xl border border-surface-800 bg-surface-900">
        {(['cards', 'timeline'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
              view === v
                ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                : 'text-surface-400 border border-transparent hover:text-surface-200'
            }`}
          >
            {v === 'cards' ? 'Cards' : 'Timeline'}
          </button>
        ))}
      </div>

      {view === 'timeline' ? (
        <RoadmapTimeline
          milestones={roadmap}
          phases={projectPhases}
          onOpen={(m) => navigate(`/w/${wsKey}/projects/${projectId}/roadmap/${m.id}`)}
          onDelete={setToDelete}
        />
      ) : roadmap.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Flag size={26} />}
            title="No milestones yet"
            description="Milestones are the dated, outcome-level commitments that make up the Roadmap. Create one to start structuring the project."
            action={
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />}>
                New Milestone
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {buckets.map((bucket) => (
            <section key={bucket.targetDate ?? 'undated'}>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-3">
                {bucket.targetDate ? `Due ${formatDateShort(new Date(`${bucket.targetDate}T00:00:00`))}` : 'Undated'}
                {bucket.items.length > 1 ? ` · ${bucket.items.length} milestones` : ''}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bucket.items.map((milestone) => {
                  const progress = selectMilestoneProgress(milestone, projectPhases);
                  return (
                    <Card
                      key={milestone.id}
                      className="p-5 hover:border-surface-700 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/w/${wsKey}/projects/${projectId}/roadmap/${milestone.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            milestone.status === 'completed' ? 'bg-success-500'
                              : milestone.status === 'active' ? 'bg-brand-500' : 'bg-info-500'
                          }`} />
                          <h3 className="font-display font-bold text-surface-50 text-sm truncate group-hover:text-brand-300 transition-colors">
                            {milestone.name}
                          </h3>
                        </div>
                        <RoadmapStatusBadge status={milestone.status} />
                      </div>

                      {milestone.description && (
                        <p className="mt-2 text-sm text-surface-400 line-clamp-2">{milestone.description}</p>
                      )}

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-surface-400">
                          <span className="flex items-center gap-1.5">
                            <Layers size={12} />
                            {progress.total === 0 ? 'No phases yet' : `${progress.done}/${progress.total} phases complete`}
                          </span>
                          <span>{progress.pct}%</span>
                        </div>
                        <Progress value={progress.pct} tone={progress.pct === 100 ? 'success' : 'brand'} ariaLabel={`${milestone.name} progress`} />
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[11px] text-surface-500">
                          {milestone.targetDate ? `Target: ${formatDateShort(new Date(`${milestone.targetDate}T00:00:00`))}` : 'No target date set'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setToDelete(milestone);
                          }}
                          aria-label={`Delete ${milestone.name}`}
                          className="p-1.5 rounded-lg text-surface-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <MilestoneFormDialog open={showCreate} projectId={projectId ?? ''} onClose={() => setShowCreate(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete Milestone?"
        description={`"${toDelete?.name ?? ''}" will be deleted. Its Phases stay but detach from this Milestone (DDS §6.3). This cannot be undone.`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';
import {
  Layers, Gauge, Target, Clock, CheckCircle2, Lock, Plus, ArrowRight,
  ArrowLeft, Rocket, Flag, Play,
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { Feature, SprintLifecycleStatus } from '../../types/collaboration';
import {
  selectSprintFeatures,
  selectSprintCapacity,
  selectSprintVelocity,
  selectSprintRemaining,
} from '../../lib/sprintSelectors';
import { CreateSprintModal } from '../../components/collaboration/CreateSprintModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { WorkItemTypeBadge } from '../../components/collaboration/WorkItemTypeBadge';

// EEP2-P4.3.2 (DDS §10): the Sprint Planning page — "What are we committing to
// this iteration?". A sprint picker across all four lifecycle states (draft →
// planned → active → completed), a goal/capacity form, the backlog builder
// (Project Backlog ⇄ sprint scope via moveFeature), a live capacity/velocity
// summary, and the one-way commit flow. Every surface is honest when empty —
// nothing is fabricated for a workspace/project with no data.

const LIFECYCLE: SprintLifecycleStatus[] = ['draft', 'planned', 'active', 'completed'];

const STATE_HINT: Record<SprintLifecycleStatus, string> = {
  draft: 'Scope is being planned. Commit when the backlog is ready.',
  planned: 'Committed — scope is frozen. Start when the time-box begins.',
  active: 'Executing against the committed plan. Capacity is guarded.',
  completed: 'Done. Velocity reflects completed items only.',
};

const STATUS_TONE: Record<SprintLifecycleStatus, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  planned: 'warning',
  active: 'brand',
  completed: 'success',
};

function nextState(status: SprintLifecycleStatus): SprintLifecycleStatus | null {
  if (status === 'planned') return 'active';
  if (status === 'active') return 'completed';
  return null;
}

export function SprintPlanningPage() {
  const {
    sprints, features, tasks, projects, activeWorkspaceId,
    updateSprint, advanceSprintState, commitSprint, moveFeature,
  } = useCollaborationStore();

  const [selectedId, setSelectedId] = useState('');
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Draft form state (initialized from the selected sprint).
  const [goal, setGoal] = useState('');
  const [capacityHours, setCapacityHours] = useState(0);
  const [targetVelocity, setTargetVelocity] = useState(0);

  const wsSprints = useMemo(
    () => sprints.filter((s) => s.workspaceId === activeWorkspaceId),
    [sprints, activeWorkspaceId],
  );
  const wsFeatures = useMemo(
    () => features.filter((f) => f.workspaceId === activeWorkspaceId),
    [features, activeWorkspaceId],
  );
  const wsTasks = useMemo(
    () => tasks.filter((t) => t.workspaceId === activeWorkspaceId),
    [tasks, activeWorkspaceId],
  );
  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === activeWorkspaceId),
    [projects, activeWorkspaceId],
  );

  // Default selection: active → planned → draft → completed, then newest first.
  const orderedSprints = useMemo(() => {
    const rank: Record<SprintLifecycleStatus, number> = { active: 0, planned: 1, draft: 2, completed: 3 };
    return [...wsSprints].sort(
      (a, b) => rank[a.status] - rank[b.status] || b.startDate.localeCompare(a.startDate),
    );
  }, [wsSprints]);

  useEffect(() => {
    if (!selectedId && orderedSprints.length) setSelectedId(orderedSprints[0].id);
  }, [selectedId, orderedSprints]);

  const selected = wsSprints.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setGoal(selected.goal);
    setCapacityHours(selected.capacityHours);
    setTargetVelocity(selected.targetVelocity);
  }, [selectedId, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sprintFeatures = useMemo(
    () => selectSprintFeatures(selected?.id, wsFeatures),
    [selected?.id, wsFeatures],
  );
  const sprintTasks = useMemo(
    () => wsTasks.filter((t) => t.sprintId === selected?.id),
    [selected?.id, wsTasks],
  );
  const projectBacklog = useMemo(
    () =>
      selectSprintFeatures(undefined, wsFeatures).filter(
        (f) => f.projectId === selected?.projectId,
      ),
    [selected?.projectId, wsFeatures],
  );
  const capacity = useMemo(
    () => selectSprintCapacity(selected, sprintFeatures, sprintTasks),
    [selected, sprintFeatures, sprintTasks],
  );
  const velocity = useMemo(
    () => selectSprintVelocity(sprintFeatures, sprintTasks),
    [sprintFeatures, sprintTasks],
  );
  const remaining = useMemo(
    () => selectSprintRemaining(selected, sprintFeatures, sprintTasks),
    [selected, sprintFeatures, sprintTasks],
  );

  const committed = Boolean(selected?.committed);
  const projectName =
    wsProjects.find((p) => p.id === selected?.projectId)?.name ?? 'Project';

  const formDirty =
    selected != null &&
    (goal !== selected.goal ||
      capacityHours !== selected.capacityHours ||
      targetVelocity !== selected.targetVelocity);

  const handleSaveForm = () => {
    if (!selected || !formDirty) return;
    updateSprint(selected.id, {
      ...(goal !== selected.goal ? { goal } : {}),
      ...(capacityHours !== selected.capacityHours ? { capacityHours } : {}),
      ...(targetVelocity !== selected.targetVelocity ? { targetVelocity } : {}),
    });
  };

  const handlePlanDrop = (e: React.DragEvent, sprintId: string | null) => {
    e.preventDefault();
    const featureId = e.dataTransfer.getData('text/plain') || draggedId;
    if (featureId) moveFeature(featureId, sprintId);
    setDraggedId(null);
  };

  const next = selected ? nextState(selected.status) : null;

  if (wsSprints.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
              <Layers size={20} className="text-brand-400" /> Sprint Planning
            </h1>
            <p className="text-xs text-surface-400 mt-0.5">
              What are we committing to this iteration?
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center space-y-4">
          <Layers size={28} className="text-surface-500 mx-auto" />
          <p className="text-sm text-surface-300 font-semibold">
            No sprints in this workspace yet
          </p>
          <p className="text-xs text-surface-500">
            Create a sprint to start planning goals, capacity, and the backlog.
          </p>
          <Button onClick={() => setShowCreateSprint(true)} size="sm" leftIcon={<Plus size={14} />}>
            New Sprint
          </Button>
        </div>
        <CreateSprintModal isOpen={showCreateSprint} onClose={() => setShowCreateSprint(false)} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      {/* Header + sprint picker */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
            <Layers size={20} className="text-brand-400" /> Sprint Planning
          </h1>
          <p className="text-xs text-surface-400 mt-0.5">
            What are we committing to this iteration?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-surface-400" htmlFor="sprint-picker">
            Sprint
          </label>
          <select id="sprint-picker" aria-label="Pick sprint" value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-surface-850 border border-surface-700 text-xs text-surface-50 rounded-xl px-3 py-2 outline-none min-w-[220px]">
            {orderedSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.status}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => setShowCreateSprint(true)}
            leftIcon={<Plus size={14} />}>
            New Sprint
          </Button>
        </div>
      </div>

      {/* Lifecycle stepper — all four states, honest per-state hint */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {LIFECYCLE.map((state, i) => {
            const isCurrent = selected?.status === state;
            const done = (selected ? LIFECYCLE.indexOf(selected.status) : -1) > i;
            return (
              <div key={state} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold border ${
                    isCurrent
                      ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                      : done
                        ? 'bg-success-500/10 border-success-500/40 text-success-400'
                        : 'bg-surface-850 border-surface-700 text-surface-500'
                  }`}>
                    {done ? <CheckCircle2 size={13} /> : i + 1}
                  </span>
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${
                    isCurrent ? 'text-surface-50' : done ? 'text-success-400' : 'text-surface-500'
                  }`}>
                    {state}
                  </span>
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div className={`h-px flex-1 mx-2 ${done ? 'bg-success-500/40' : 'bg-surface-800'}`} />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-surface-400">
          {selected ? STATE_HINT[selected.status] : 'Select a sprint to see its plan.'}
        </p>
      </div>

      {/* Goal / capacity form + commit */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Layers size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-display font-extrabold text-surface-50 truncate">
                {selected?.name}
              </h2>
              <p className="text-[11px] text-surface-500">{projectName} · {selected?.startDate} → {selected?.endDate}</p>
            </div>
            <Badge tone={selected ? STATUS_TONE[selected.status] : 'neutral'} className="text-[10px] font-extrabold uppercase">
              {selected?.status}
            </Badge>
            {committed && (
              <Badge tone="brand" icon={<Lock size={10} />} className="text-[10px] font-extrabold uppercase">
                Committed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!committed && selected && next && (
              <Button variant="secondary" size="sm"
                onClick={() => advanceSprintState(selected.id, next)}
                leftIcon={next === 'active' ? <Play size={13} /> : <Flag size={13} />}>
                {next === 'active' ? 'Start sprint' : 'Complete sprint'}
              </Button>
            )}
            {!committed && selected && selected.status !== 'completed' && (
              <Button size="sm" onClick={() => commitSprint(selected.id)}
                leftIcon={<Lock size={13} />}>
                Commit
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-surface-300 mb-1.5" htmlFor="plan-goal">
              Sprint Goal
            </label>
            <Textarea id="plan-goal" rows={2} disabled={committed}
              className="rounded-xl text-sm w-full resize-none disabled:opacity-60"
              placeholder="What is this sprint committing to deliver?"
              value={goal} onChange={(e) => setGoal(e.target.value)} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-semibold text-surface-300 mb-1.5" htmlFor="plan-capacity">
                  Capacity (hours)
                </label>
                <Input id="plan-capacity" type="number" min={0} disabled={committed}
                  className="rounded-xl text-sm w-full disabled:opacity-60"
                  value={capacityHours} onChange={(e) => setCapacityHours(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-300 mb-1.5" htmlFor="plan-velocity">
                  Target Velocity (pts)
                </label>
                <Input id="plan-velocity" type="number" min={0} disabled={committed}
                  className="rounded-xl text-sm w-full disabled:opacity-60"
                  value={targetVelocity} onChange={(e) => setTargetVelocity(Number(e.target.value))} />
              </div>
            </div>
            <div className="mt-3">
              <Button size="sm" disabled={committed || !formDirty} onClick={handleSaveForm}>
                Save plan
              </Button>
            </div>
          </div>

          {/* Capacity / velocity summary */}
          <div className="rounded-xl border border-surface-800 bg-surface-850 p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
                <span className="text-surface-400 flex items-center gap-1.5">
                  <Gauge size={12} className="text-brand-400" /> Capacity
                </span>
                <span className={capacity.overCapacity ? 'text-danger-400' : 'text-surface-200'}>
                  {capacity.load}h / {capacity.capacityHours || '∞'}h
                </span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-surface-800 overflow-hidden">
                <div
                  data-testid="capacity-bar"
                  className={`h-full rounded-full transition-all ${
                    capacity.overCapacity ? 'bg-danger-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${Math.min(capacity.loadPct, 100)}%` }}
                />
              </div>
              <p className={`text-[11px] mt-1.5 font-semibold ${capacity.overCapacity ? 'text-danger-400' : 'text-surface-500'}`}>
                {capacity.overCapacity
                  ? `Over capacity by ${capacity.load - capacity.capacityHours}h`
                  : `${capacity.remainingHours}h remaining (${capacity.loadPct}% used)`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-surface-900 border border-surface-800">
                <p className="text-brand-400 font-bold text-sm">{remaining}h</p>
                <p className="text-[10px] text-surface-500 font-bold uppercase">Remaining</p>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-900 border border-surface-800">
                <p className="text-emerald-400 font-bold text-sm">{velocity.velocity}h</p>
                <p className="text-[10px] text-surface-500 font-bold uppercase">Velocity</p>
              </div>
            </div>
            <p className="text-[10px] text-surface-500 leading-relaxed">
              <Target size={10} className="inline mr-1 text-surface-600" />
              Target {selected?.targetVelocity ?? 0} pts · velocity counts completed items only.
            </p>
          </div>
        </div>
      </div>

      {/* Backlog builder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handlePlanDrop(e, selected?.id ?? null)}
          className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-display font-extrabold text-surface-50 flex items-center gap-2">
              <Rocket size={14} className="text-brand-400" /> Sprint Backlog
            </h3>
            <Badge tone="brand" className="text-[10px] font-extrabold">{sprintFeatures.length}</Badge>
          </div>
          {sprintFeatures.length === 0 ? (
            <p className="text-[11px] text-surface-500 italic py-8 text-center">
              Nothing planned yet — drag features from the Project Backlog or use the arrow.
            </p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {sprintFeatures.map((f: Feature) => (
                <div key={f.id} draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'move'; setDraggedId(f.id); }}
                  onDragEnd={() => setDraggedId(null)}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-surface-800 bg-surface-850 cursor-grab">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <WorkItemTypeBadge type={f.type} />
                      <Badge tone="neutral" className="text-[10px] font-extrabold uppercase">{f.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs font-bold text-surface-100 mt-1 truncate">{f.name}</p>
                    <p className="text-[10px] text-surface-500 font-mono">{f.estimatedHours}h planned</p>
                  </div>
                  <Button variant="ghost" size="xs" aria-label={`Unassign ${f.name}`} disabled={committed}
                    onClick={() => moveFeature(f.id, null)}>
                    <ArrowLeft size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handlePlanDrop(e, selected?.id ?? null)}
          className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-display font-extrabold text-surface-50 flex items-center gap-2">
              <Clock size={14} className="text-amber-400" /> Project Backlog
            </h3>
            <Badge tone="neutral" className="text-[10px] font-extrabold">{projectBacklog.length}</Badge>
          </div>
          {projectBacklog.length === 0 ? (
            <p className="text-[11px] text-surface-500 italic py-8 text-center">
              Every feature is planned or this project has no backlog yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {projectBacklog.map((f: Feature) => (
                <div key={f.id} draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'move'; setDraggedId(f.id); }}
                  onDragEnd={() => setDraggedId(null)}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-surface-800 bg-surface-850 cursor-grab">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <WorkItemTypeBadge type={f.type} />
                      <Badge tone="neutral" className="text-[10px] font-extrabold uppercase">{f.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs font-bold text-surface-100 mt-1 truncate">{f.name}</p>
                    <p className="text-[10px] text-surface-500 font-mono">{f.estimatedHours}h estimated</p>
                  </div>
                  <Button variant="ghost" size="xs" aria-label={`Plan ${f.name}`} disabled={committed}
                    onClick={() => moveFeature(f.id, selected?.id ?? null)}>
                    <ArrowRight size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateSprintModal isOpen={showCreateSprint} onClose={() => setShowCreateSprint(false)} />
    </div>
  );
}

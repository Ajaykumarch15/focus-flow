import { useState, useMemo } from 'react';
import {
  ClipboardList, Search, CalendarRange, GripVertical, Tag, ArrowLeft, Plus
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { Feature } from '../../types/collaboration';
import { WorkItemTypeBadge } from './WorkItemTypeBadge';
import { ModulePicker } from '../roadmap/ModulePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// IES-R1 (P6-T3): the Project Backlog is the set of sprint-less features
// (`sprintRef == null`), ordered by `order`. Pure helpers are exported so the
// backlog query / filter / drag-drop handler stay unit-testable.

export interface BacklogFilters {
  search: string;
  status: string;
  type: string;
  owner: string;
  label: string;
}

// §9.1: a feature is in the Backlog when sprintId is null/absent.
export function orderBacklog(features: Feature[]): Feature[] {
  return features
    .filter((f) => !f.sprintId)
    .sort((a, b) => a.order - b.order);
}

export function filterBacklog(features: Feature[], filters: BacklogFilters): Feature[] {
  const q = filters.search.trim().toLowerCase();
  return features.filter((f) => {
    const matchSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q);
    const matchStatus = filters.status === 'all' || f.status === filters.status;
    const matchType = filters.type === 'all' || f.type === filters.type;
    const matchOwner = filters.owner === 'all' || f.ownerId === filters.owner;
    const matchLabel = filters.label === 'all' || f.labels.includes(filters.label);
    return matchSearch && matchStatus && matchType && matchOwner && matchLabel;
  });
}

// Drag-drop handler core: moving a feature into a Sprint sets sprintId; moving
// it back onto the Backlog clears it (explicit `null` un-tether).
export function assignFeatureToSprint(
  features: Feature[],
  featureId: string,
  sprintId: string | null,
): Feature[] {
  return features.map((f) =>
    f.id === featureId ? { ...f, sprintId: sprintId ?? undefined } : f
  );
}

export function ProjectBacklog({ onCreateFeature }: { onCreateFeature?: () => void }) {
  const {
    features, sprints, projects, members, modules, activeWorkspaceId, moveFeature,
  } = useCollaborationStore();

  const [filters, setFilters] = useState<BacklogFilters>({
    search: '', status: 'all', type: 'all', owner: 'all', label: 'all',
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const wsFeatures = useMemo(
    () => features.filter((f) => f.workspaceId === activeWorkspaceId),
    [features, activeWorkspaceId],
  );
  // Only future/active sprints accept backlog features.
  const wsSprints = useMemo(
    () => sprints.filter(
      (s) => s.workspaceId === activeWorkspaceId && s.status !== 'completed',
    ),
    [sprints, activeWorkspaceId],
  );
  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === activeWorkspaceId),
    [projects, activeWorkspaceId],
  );

  const backlog = useMemo(
    () => filterBacklog(orderBacklog(wsFeatures), filters),
    [wsFeatures, filters],
  );

  // Distinct owner/label options derived from the actual backlog (no seeds).
  const owners = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of orderBacklog(wsFeatures)) {
      if (f.ownerId) {
        const name = members.find((m) => m.id === f.ownerId)?.name ?? 'Unknown';
        if (!seen.has(f.ownerId)) seen.set(f.ownerId, name);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [wsFeatures, members]);

  const labels = useMemo(() => {
    const set = new Set<string>();
    for (const f of orderBacklog(wsFeatures)) f.labels.forEach((l) => set.add(l));
    return [...set].sort();
  }, [wsFeatures]);

  const featureCountForSprint = (sprintId: string) =>
    wsFeatures.filter((f) => f.sprintId === sprintId).length;

  const handleDrop = (e: React.DragEvent, sprintId: string | null) => {
    e.preventDefault();
    const featureId = e.dataTransfer.getData('text/plain') || draggedId;
    if (featureId) moveFeature(featureId, sprintId);
    setDraggedId(null);
  };

  const projectName = (projectId: string) =>
    wsProjects.find((p) => p.id === projectId)?.name ?? 'Project';

  // EEP2-P3.4.4: module ownership label for the backlog card trail.
  const moduleName = (moduleId?: string) =>
    modules.find((m) => m.id === moduleId)?.name;

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-brand-400" />
          <h3 className="text-sm font-display font-extrabold text-surface-50">
            Project Backlog
          </h3>
          <Badge tone="neutral" className="text-[10px] font-extrabold">{backlog.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-surface-500 hidden sm:block">
            Sprint-less features — drag a card onto a sprint to commit it.
          </p>
          {onCreateFeature && (
            <Button onClick={onCreateFeature} type="button" size="xs"
              className="text-[11px] font-bold" leftIcon={<Plus size={12} />}>
              New Feature
            </Button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <Input type="text" placeholder="Search backlog..." aria-label="Search backlog"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="bg-surface-850 border border-surface-750 text-xs text-surface-50 rounded-xl pl-9 pr-3 py-2 outline-none w-full" />
        </div>

        <div className="w-40">
          <Select aria-label="Filter by status" value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-surface-850 border border-surface-750 text-xs text-surface-300 rounded-xl px-3 py-2 outline-none w-full">
            <option value="all">All Statuses</option>
            <option value="backlog">Backlog</option>
            <option value="ready">Ready</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </Select>
        </div>

        <div className="w-40">
          <Select aria-label="Filter by type" value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="bg-surface-850 border border-surface-750 text-xs text-surface-300 rounded-xl px-3 py-2 outline-none w-full">
            <option value="all">All Types</option>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="spike">Spike</option>
            <option value="chore">Chore</option>
            <option value="research">Research</option>
            <option value="debt">Tech Debt</option>
            <option value="improvement">Improvement</option>
          </Select>
        </div>

        <div className="w-44">
          <Select aria-label="Filter by owner" value={filters.owner}
            onChange={(e) => setFilters({ ...filters, owner: e.target.value })}
            className="bg-surface-850 border border-surface-750 text-xs text-surface-300 rounded-xl px-3 py-2 outline-none w-full">
            <option value="all">All Owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Label filter chips */}
      {labels.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag size={12} className="text-surface-500" />
          <button type="button" onClick={() => setFilters({ ...filters, label: 'all' })}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
              filters.label === 'all'
                ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                : 'bg-surface-850 text-surface-400 border-surface-700 hover:text-surface-200'
            }`}>
            All
          </button>
          {labels.map((l) => (
            <button key={l} type="button" onClick={() => setFilters({ ...filters, label: l })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                filters.label === l
                  ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                  : 'bg-surface-850 text-surface-400 border-surface-700 hover:text-surface-200'
              }`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Sprint drop zones (future/active only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {wsSprints.map((sprint) => (
          <div key={sprint.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, sprint.id)}
            className={`rounded-xl border transition-all p-3 ${
              draggedId ? 'border-brand-500/50 bg-brand-500/5' : 'border-surface-700 bg-surface-850'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarRange size={13} className="text-brand-400 shrink-0" />
                <span className="text-xs font-bold text-surface-100 truncate">{sprint.name}</span>
              </div>
              <Badge tone={sprint.status === 'active' ? 'brand' : 'neutral'}
                className="text-[10px] font-bold uppercase">
                {sprint.status}
              </Badge>
            </div>
            <p className="text-[11px] text-surface-500 mt-1">
              {projectName(sprint.projectId)} · {featureCountForSprint(sprint.id)} features
            </p>
            <p className="text-[10px] text-surface-500 font-mono">
              {sprint.startDate} → {sprint.endDate}
            </p>
          </div>
        ))}

        {/* Un-tether drop zone */}
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, null)}
          className={`rounded-xl border border-dashed transition-all p-3 flex items-center justify-center gap-2 ${
            draggedId ? 'border-amber-500/50 bg-amber-500/5' : 'border-surface-700'
          }`}>
          <ArrowLeft size={13} className="text-amber-400" />
          <span className="text-xs font-semibold text-surface-400">Drop to unassign (back to backlog)</span>
        </div>
      </div>

      {/* Backlog feature cards */}
      {backlog.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-700 bg-surface-850/40 p-8 text-center text-xs text-surface-400 italic">
          No features in the backlog — every feature is committed to a sprint, or
          nothing matches the current filters.
        </div>
      ) : (
        <div className="space-y-2">
          {backlog.map((feature) => {
            const owner = members.find((m) => m.id === feature.ownerId);
            return (
              <div key={feature.id} draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', feature.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedId(feature.id);
                }}
                onDragEnd={() => setDraggedId(null)}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl border border-surface-800 bg-surface-850 hover:border-surface-700 transition-all cursor-grab">
                <div className="flex items-center gap-3 min-w-0">
                  <GripVertical size={15} className="text-surface-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <WorkItemTypeBadge type={feature.type} />
                      <Badge tone="neutral" className="text-[10px] font-extrabold uppercase">
                        {feature.status.replace('_', ' ')}
                      </Badge>
                      {feature.labels.slice(0, 3).map((l) => (
                        <Badge key={l} tone="info" className="text-[10px] font-bold">{l}</Badge>
                      ))}
                      {feature.moduleId && moduleName(feature.moduleId) && (
                        <Badge tone="brand" className="text-[10px] font-extrabold">
                          {moduleName(feature.moduleId)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-bold text-surface-100 mt-1 truncate">{feature.name}</p>
                    <p className="text-[11px] text-surface-400 truncate">{feature.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-surface-400 font-semibold">
                    Owner: {owner?.name ?? 'Unassigned'}
                  </span>
                  <Badge tone="neutral" className="text-[10px] font-bold">{feature.estimatedHours}h</Badge>
                  {/* Module ownership picker (EEP2-P3.4.4) — PATCHes moduleId only; sprintId untouched */}
                  <ModulePicker feature={feature}
                    className="bg-surface-800 text-surface-300 text-[10px] rounded border border-surface-700 px-1.5 py-1 outline-none" />
                  <Select aria-label={`Move feature ${feature.name}`} value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        moveFeature(feature.id, e.target.value === '__backlog__' ? null : e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="bg-surface-800 text-surface-300 text-[10px] rounded border border-surface-700 px-1.5 py-1 outline-none">
                    <option value="">Move to…</option>
                    {wsSprints.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="__backlog__">Backlog (unassign)</option>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

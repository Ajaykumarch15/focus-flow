import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Map, ChevronRight, CheckCircle2, Plus, Pencil, Trash2, AlertTriangle, Calendar, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { api } from '@shared/utils/api';
import { Dialog } from '@shared/components/ui/Dialog';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { toast } from '@shared/services/useToastStore';
import type { RoadmapMilestoneDoc, RoadmapMilestoneStatus } from '../types/roadmap';
import { safeProgress, formatProgress } from '@personal/services/roadmapProgress';
import { nextMilestoneStatuses } from '@personal/services/roadmapLifecycle';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_COLORS: Record<string, BadgeTone> = {
  todo: 'neutral',
  'in-progress': 'brand',
  completed: 'success',
};

type MilestoneItem = RoadmapMilestoneDoc & { totalTasks: number; completedTasks: number };

function SortableMilestoneItem({
  milestone, idx, id, phaseId, navigate, openEditModal, setDeleteTarget,
}: {
  milestone: MilestoneItem;
  idx: number;
  id: string;
  phaseId: string;
  navigate: any;
  openEditModal: (m: MilestoneItem) => void;
  setDeleteTarget: (m: MilestoneItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: milestone._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const mProgress = safeProgress(milestone.progress);
  const isCompleted = milestone.status === 'completed';
  const isActive = milestone.status === 'in-progress';

  return (
    <motion.div ref={setNodeRef} style={style} initial={{ opacity: 0, y: 12 }} animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
      <div className={`relative rounded-2xl border bg-surface-900/90 p-4 transition-all duration-200 group ${isActive ? 'border-brand-500/30 ring-1 ring-brand-500/10' : 'border-surface-800 hover:border-surface-700 hover:bg-surface-800/50'}`}>
        <div className="flex items-center gap-3">
          <button className="flex-shrink-0 cursor-grab active:cursor-grabbing text-surface-600 hover:text-surface-300 touch-none" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} aria-label={`Drag ${milestone.title}`}>
            <GripVertical size={14} />
          </button>
          <button onClick={() => navigate(`/personal/roadmaps/${id}/phases/${phaseId}/milestones/${milestone._id}`)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : isActive ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-800 text-surface-400'}`}>
              {isCompleted ? <CheckCircle2 size={18} /> : String(idx + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-50 truncate">{milestone.title}</p>
              {milestone.targetDate && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Calendar size={9} className="text-surface-500" />
                  <span className="text-[10px] text-surface-500">{new Date(milestone.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden max-w-[140px]">
                  <div className="h-full rounded-full bg-brand-500/70 transition-all duration-300" style={{ width: `${mProgress}%` }} />
                </div>
                <span className="text-[11px] font-medium text-surface-300">{mProgress}%</span>
                <span className="text-[11px] text-surface-500">{milestone.completedTasks}/{milestone.totalTasks} tasks</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge tone={STATUS_COLORS[milestone.status] || 'neutral'} className="text-[10px]">{milestone.status}</Badge>
              <ChevronRight size={16} className="text-surface-600 group-hover:text-surface-300 transition-colors" />
            </div>
          </button>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={(e) => { e.stopPropagation(); openEditModal(milestone); }} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all" title="Edit milestone">
              <Pencil size={13} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(milestone); }} className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete milestone">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function PhaseDetailPage() {
  const { id, phaseId } = useParams<{ id: string; phaseId: string }>();
  const navigate = useNavigate();
  const { activeRoadmap, detailLoading, getRoadmap, clearActiveRoadmap, reorderMilestones } = useRoadmapStore();
  const [milestones, setMilestones] = useState<(RoadmapMilestoneDoc & { totalTasks: number; completedTasks: number })[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<(RoadmapMilestoneDoc & { totalTasks?: number; completedTasks?: number }) | null>(null);
  const [form, setForm] = useState({ title: '', description: '', targetDate: '', status: 'todo' });
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<(RoadmapMilestoneDoc & { totalTasks?: number }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Menu state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) getRoadmap(id);
    return () => clearActiveRoadmap();
  }, [id, getRoadmap, clearActiveRoadmap]);

  const phase = activeRoadmap?.phases.find(p => p._id === phaseId);

  const fetchMilestones = () => {
    if (!phaseId) return;
    setLoadingMilestones(true);
    setLoadError(null);
    api.personalRoadmaps.listMilestones(phaseId)
      .then(data => { setMilestones(data); setLoadingMilestones(false); })
      .catch((e: any) => {
        setLoadError(e?.message || 'Failed to load milestones');
        setLoadingMilestones(false);
      });
  };

  useEffect(() => { fetchMilestones(); }, [phaseId]);

  // Re-fetch when the user navigates back (e.g. after completing tasks in
  // MilestoneDetailPage) so milestone progress bars are always up-to-date.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMilestones();
        if (id) getRoadmap(id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId, id]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // DnD — hooks must be declared before any conditional returns (Rules of Hooks).
  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !phaseId) return;
    const oldIndex = sortedMilestones.findIndex(m => m._id === active.id);
    const newIndex = sortedMilestones.findIndex(m => m._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sortedMilestones.map(m => m._id), oldIndex, newIndex);
    try {
      await reorderMilestones(phaseId, reordered);
    } catch {
      // Failure toast is surfaced by the store.
    }
    fetchMilestones();
  }, [sortedMilestones, phaseId, reorderMilestones]);

  const openCreateModal = () => {
    setEditingMilestone(null);
    setForm({ title: '', description: '', targetDate: '', status: 'todo' });
    setModalOpen(true);
  };

  const openEditModal = (m: RoadmapMilestoneDoc) => {
    setEditingMilestone(m);
    setForm({
      title: m.title,
      description: m.description || '',
      targetDate: m.targetDate ? new Date(m.targetDate).toISOString().split('T')[0] : '',
      status: m.status,
    });
    setModalOpen(true);
    setMenuOpen(null);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !phaseId) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
      };
      if (form.targetDate) body.targetDate = form.targetDate;

      if (editingMilestone) {
        await api.personalRoadmaps.updateMilestone(editingMilestone._id, body);
        toast.success('Milestone updated', `"${form.title}" has been updated.`);
      } else {
        // Order is assigned server-side (deterministic append after the
        // current last milestone in this phase).
        await api.personalRoadmaps.createMilestone(phaseId, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          targetDate: form.targetDate || undefined,
          status: form.status as RoadmapMilestoneStatus,
        });
        toast.success('Milestone created', `"${form.title}" has been added.`);
      }
      setModalOpen(false);
      fetchMilestones();
      if (id) getRoadmap(id);
    } catch (err: any) {
      toast.error('Failed', err?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.personalRoadmaps.removeMilestone(deleteTarget._id);
      toast.success('Milestone deleted', `"${deleteTarget.title}" has been removed.`);
      setDeleteTarget(null);
      fetchMilestones();
      if (id) getRoadmap(id);
    } catch (err: any) {
      toast.error('Failed to delete', err?.message || 'Something went wrong.');
    } finally {
      setDeleting(false);
    }
  };

  if (detailLoading || !phase) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-4">
        <div className="h-4 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="h-6 w-64 bg-surface-800 rounded animate-pulse" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-surface-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-4">
      {/* Phase header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
        <h1 className="text-lg sm:text-xl font-display font-extrabold text-surface-50">{phase.title}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone={phase.status === 'completed' ? 'success' : phase.status === 'active' ? 'brand' : 'neutral'} className="text-[10px]">{phase.status}</Badge>
          <span className="text-xs text-surface-400">{formatProgress(phase.progress, phase.milestoneTotal)} · {phase.milestoneCompleted}/{phase.milestoneTotal} milestones</span>
          {(phase.startDate || phase.targetDate) && (
            <span className="text-xs text-surface-400 flex items-center gap-1">
              <Calendar size={11} />
              {phase.startDate && phase.targetDate
                ? `${new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(phase.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : phase.startDate
                  ? `Start: ${new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : `Target: ${new Date(phase.targetDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </span>
          )}
        </div>
      </motion.div>

      {/* Milestones */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-surface-400">Milestones</h2>
            {sortedMilestones.length > 0 && (
              <span className="text-xs text-surface-500">{sortedMilestones.length} milestone{sortedMilestones.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <button onClick={openCreateModal}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors">
            <Plus size={14} /> Add Milestone
          </button>
        </div>

        {loadingMilestones ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-surface-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : loadError ? (
          <div className="text-center py-8">
            <AlertTriangle className="mx-auto mb-2 text-red-400" size={24} />
            <p className="text-sm text-surface-300 font-medium mb-1">Failed to load milestones</p>
            <p className="text-xs text-surface-500 mb-3">{loadError}</p>
            <button onClick={fetchMilestones}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors">
              Retry
            </button>
          </div>
        ) : sortedMilestones.length === 0 ? (
          <div className="text-center py-8">
            <Map className="mx-auto mb-2 text-surface-600" size={24} />
            <p className="text-sm text-surface-400 font-medium">No milestones yet</p>
            <p className="text-xs text-surface-500 mt-1 mb-3">Break this phase into smaller goals by creating your first milestone.</p>
            <button onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors">
              <Plus size={14} /> Add Milestone
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedMilestones.map(m => m._id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sortedMilestones.map((milestone, idx) => (
                  <SortableMilestoneItem
                    key={milestone._id}
                    milestone={milestone}
                    idx={idx}
                    id={id!}
                    phaseId={phaseId!}
                    navigate={navigate}
                    openEditModal={openEditModal}
                    setDeleteTarget={setDeleteTarget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </motion.div>

      {/* Create/Edit Milestone Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title={editingMilestone ? 'Edit Milestone' : 'Add Milestone'} size="sm"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={!form.title.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : editingMilestone ? 'Save Changes' : 'Create Milestone'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Introduction to System Design" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Description</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Target Date</label>
              <Input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
                {(editingMilestone
                  ? nextMilestoneStatuses(editingMilestone.status as RoadmapMilestoneStatus)
                  : STATUS_OPTIONS.map(o => o.value)
                ).map(val => {
                  const o = STATUS_OPTIONS.find(x => x.value === val) ?? { value: val, label: val };
                  return <option key={o.value} value={o.value}>{o.label}</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Milestone" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={deleting}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
              {deleting ? 'Deleting...' : 'Delete Milestone'}
            </button>
          </>
        }>
        <p className="text-sm text-surface-300">
          Are you sure you want to delete <span className="font-semibold text-surface-100">"{deleteTarget?.title}"</span>?
        </p>
        <p className="text-xs text-surface-500 mt-2">This action cannot be undone. Linked tasks will be unlinked.</p>
      </Dialog>
    </div>
  );
}

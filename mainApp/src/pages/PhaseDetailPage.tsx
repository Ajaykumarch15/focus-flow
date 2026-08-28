import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Map, ChevronRight, ChevronUp, ChevronDown, CheckCircle2, Plus, MoreVertical, Pencil, Trash2, AlertTriangle, Calendar } from 'lucide-react';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { api } from '../utils/api';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { toast } from '../store/useToastStore';
import type { RoadmapMilestoneDoc, RoadmapMilestoneStatus } from '../types/roadmap';
import { safeProgress, formatProgress } from '../utils/roadmapProgress';
import { nextMilestoneStatuses } from '../utils/roadmapLifecycle';

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

export function PhaseDetailPage() {
  const { id, phaseId } = useParams<{ id: string; phaseId: string }>();
  const navigate = useNavigate();
  const { activeRoadmap, detailLoading, getRoadmap, reorderMilestones } = useRoadmapStore();
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
    if (id && (!activeRoadmap || activeRoadmap._id !== id)) {
      getRoadmap(id);
    }
  }, [id, activeRoadmap, getRoadmap]);

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

  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);

  const moveMilestone = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (!phaseId || target < 0 || target >= sortedMilestones.length) return;
    const ids = sortedMilestones.map(m => m._id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setMenuOpen(null);
    try {
      await reorderMilestones(phaseId, ids);
    } catch {
      // Failure toast is surfaced by the store.
    }
    fetchMilestones();
  };

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
          <div className="space-y-2">
            {sortedMilestones.map((milestone, idx) => {
              const mProgress = safeProgress(milestone.progress);
              const isCompleted = milestone.status === 'completed';
              const isActive = milestone.status === 'in-progress';

              return (
                <motion.div key={milestone._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <div className={`relative rounded-2xl border bg-surface-900/90 p-4 transition-all duration-200 group ${
                    isActive ? 'border-brand-500/30 ring-1 ring-brand-500/10' : 'border-surface-800 hover:border-surface-700 hover:bg-surface-800/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      {/* Clickable main area */}
                      <button onClick={() => navigate(`/personal/roadmaps/${id}/phases/${phaseId}/milestones/${milestone._id}`)}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                          isCompleted ? 'bg-emerald-500/20 text-emerald-400' :
                          isActive ? 'bg-brand-500/20 text-brand-400' :
                          'bg-surface-800 text-surface-400'
                        }`}>
                          {isCompleted ? <CheckCircle2 size={18} /> : String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-surface-50 truncate">{milestone.title}</p>
                          {milestone.targetDate && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Calendar size={9} className="text-surface-500" />
                              <span className="text-[10px] text-surface-500">
                                {new Date(milestone.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
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

                      {/* Menu button */}
                      <div className="relative flex-shrink-0" ref={menuOpen === milestone._id ? menuRef : undefined}>
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === milestone._id ? null : milestone._id); }}
                          className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-all">
                          <MoreVertical size={14} />
                        </button>
                        {menuOpen === milestone._id && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-surface-800 border border-surface-700 rounded-xl shadow-xl py-1">
                            <button onClick={(e) => { e.stopPropagation(); moveMilestone(idx, -1); }}
                              disabled={idx === 0}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                              <ChevronUp size={13} /> Move Up
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); moveMilestone(idx, 1); }}
                              disabled={idx === sortedMilestones.length - 1}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                              <ChevronDown size={13} /> Move Down
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openEditModal(milestone); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-colors">
                              <Pencil size={13} /> Edit
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(milestone); setMenuOpen(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
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

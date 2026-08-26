import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Circle, Play, Clock, Plus,
  Pencil, Trash2, MoreVertical, Link2, Unlink, ExternalLink, ArrowRightLeft,
} from 'lucide-react';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { toast } from '../store/useToastStore';
import type { RoadmapTaskSummary, RoadmapMilestoneStatus } from '../types/roadmap';
import { safeProgress } from '../utils/roadmapProgress';
import { nextMilestoneStatuses } from '../utils/roadmapLifecycle';
import { getScheduledState, formatScheduledDate, scheduledStateColor } from '../utils/personalTaskSchedule';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-emerald-400',
};

const STATUS_COLORS: Record<string, BadgeTone> = {
  todo: 'neutral',
  'in-progress': 'brand',
  completed: 'success',
  blocked: 'danger',
};

const MILESTONE_STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export function MilestoneDetailPage() {
  const { id, phaseId, milestoneId } = useParams<{ id: string; phaseId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const { activeRoadmap, detailLoading, getRoadmap, linkTask, unlinkTask } = useRoadmapStore();
  const { completeTask, deleteTask } = useStore();

  // Milestone edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: 'todo', targetDate: '' });
  const [saving, setSaving] = useState(false);

  // Delete milestone state
  const [delMilestone, setDelMilestone] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add task state
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium' });
  const [creatingTask, setCreatingTask] = useState(false);

  // Link existing task state
  const [linkOpen, setLinkOpen] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  // Move task state
  const [moveTarget, setMoveTarget] = useState<RoadmapTaskSummary | null>(null);
  const [movePhaseId, setMovePhaseId] = useState('');
  const [moveMilestoneId, setMoveMilestoneId] = useState('');
  const [moving, setMoving] = useState(false);

  // Task menu state
  const [taskMenu, setTaskMenu] = useState<string | null>(null);
  const taskMenuRef = useRef<HTMLDivElement>(null);

  // Task delete confirm state
  const [taskDeleteTarget, setTaskDeleteTarget] = useState<RoadmapTaskSummary | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  useEffect(() => {
    if (id && (!activeRoadmap || activeRoadmap._id !== id)) getRoadmap(id);
  }, [id, activeRoadmap, getRoadmap]);

  const milestone = activeRoadmap?.milestones.find(m => m._id === milestoneId);

  const tasks = useMemo(() => {
    if (!activeRoadmap || !milestoneId) return [];
    return activeRoadmap.tasks
      .filter(t => String(t.milestoneRef) === milestoneId)
      .sort((a, b) => {
        const o: Record<string, number> = { 'in-progress': 0, todo: 1, blocked: 2, completed: 3 };
        return (o[a.status] ?? 1) - (o[b.status] ?? 1);
      });
  }, [activeRoadmap?.tasks, milestoneId]);

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progress = safeProgress(milestone?.progress);

  // Close task menu on outside click
  useEffect(() => {
    if (!taskMenu) return;
    const h = (e: MouseEvent) => {
      if (taskMenuRef.current && !taskMenuRef.current.contains(e.target as Node)) setTaskMenu(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [taskMenu]);

  // ── Milestone Edit ──
  const openEdit = () => {
    if (!milestone) return;
    setEditForm({
      title: milestone.title,
      description: milestone.description || '',
      status: milestone.status,
      targetDate: milestone.targetDate ? new Date(milestone.targetDate).toISOString().split('T')[0] : '',
    });
    setEditOpen(true);
  };

  const saveMilestone = async () => {
    if (!editForm.title.trim() || !milestoneId) return;
    setSaving(true);
    try {
      await api.personalRoadmaps.updateMilestone(milestoneId, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        status: editForm.status,
        targetDate: editForm.targetDate || undefined,
      });
      toast.success('Milestone updated');
      setEditOpen(false);
      if (id) getRoadmap(id);
    } catch (e: any) { toast.error('Failed', e?.message); }
    finally { setSaving(false); }
  };

  // ── Milestone Delete ──
  const deleteMilestone = async () => {
    if (!milestoneId) return;
    setDeleting(true);
    try {
      await api.personalRoadmaps.removeMilestone(milestoneId);
      toast.success('Milestone deleted');
      setDelMilestone(false);
      navigate(`/roadmaps/${id}/phases/${phaseId}`);
    } catch (e: any) { toast.error('Failed', e?.message); }
    finally { setDeleting(false); }
  };

  // ── Add Task ──
  const createTask = async () => {
    if (!taskForm.title.trim() || !milestoneId || !id || !phaseId) return;
    setCreatingTask(true);
    try {
      await api.tasks.create({
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority,
        status: 'todo',
        category: 'Work',
        tags: [],
        subtasks: [],
        roadmapRef: id,
        phaseRef: phaseId,
        milestoneRef: milestoneId,
      });
      toast.success('Task created');
      setAddTaskOpen(false);
      setTaskForm({ title: '', description: '', priority: 'medium' });
      getRoadmap(id);
    } catch (e: any) { toast.error('Failed', e?.message); }
    finally { setCreatingTask(false); }
  };

  // ── Task Actions ──
  const handleCompleteTask = async (task: RoadmapTaskSummary) => {
    if (task.status === 'completed') return;
    await completeTask(task.id);
    if (id) getRoadmap(id);
  };

  const handleDeleteTask = async () => {
    if (!taskDeleteTarget || deletingTask) return;
    setDeletingTask(true);
    setTaskMenu(null);
    try {
      await deleteTask(taskDeleteTarget.id);
      toast.success('Task deleted');
      setTaskDeleteTarget(null);
      if (id) getRoadmap(id);
    } catch (e: any) {
      toast.error('Failed to delete task', e?.message);
    } finally {
      setDeletingTask(false);
    }
  };

  const handleStartTask = (task: RoadmapTaskSummary) => {
    navigate('/focus', { state: { taskId: task.id, taskTitle: task.title } });
  };

  // ── Link / Unlink / Move ──
  const openLinkModal = async () => {
    setLinkOpen(true);
    setLoadingAvailable(true);
    try {
      setAvailableTasks(await api.personalRoadmaps.availableTasks());
    } catch (e: any) { toast.error('Failed', e?.message); }
    finally { setLoadingAvailable(false); }
  };

  const handleLinkTask = async (taskId: string) => {
    if (!id || !phaseId || !milestoneId) return;
    setLinkingId(taskId);
    try {
      await linkTask({ taskId, roadmapId: id, phaseId, milestoneId });
      setAvailableTasks(prev => prev.filter(t => t._id !== taskId));
    } catch {
      // Failure toast is surfaced by the store.
    } finally {
      setLinkingId(null);
    }
  };

  const handleUnlinkTask = async (task: RoadmapTaskSummary) => {
    setTaskMenu(null);
    try {
      await unlinkTask(task.id);
    } catch {
      // Failure toast is surfaced by the store.
    }
  };

  const handleMoveTask = async () => {
    if (!moveTarget || !movePhaseId || !moveMilestoneId || !id) return;
    setMoving(true);
    try {
      await linkTask({
        taskId: moveTarget.id,
        roadmapId: id,
        phaseId: movePhaseId,
        milestoneId: moveMilestoneId,
      });
      setMoveTarget(null);
    } catch {
      // Failure toast is surfaced by the store.
    } finally {
      setMoving(false);
    }
  };

  // ── Loading / Error ──
  if (detailLoading || !milestone) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-4">
        <div className="h-4 w-64 bg-surface-800 rounded animate-pulse" />
        <div className="h-6 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-surface-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-4">
      {/* Milestone header + actions */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-display font-extrabold text-surface-50 truncate">{milestone.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone={STATUS_COLORS[milestone.status] || 'neutral'} className="text-[10px]">{milestone.status}</Badge>
            <span className="text-xs text-surface-400">{completedCount}/{tasks.length} tasks</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={openEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={() => setDelMilestone(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </motion.div>

      {/* Progress */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400">Progress</span>
          <span className="text-sm font-bold text-surface-50">{progress}%</span>
        </div>
        <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-brand-500/70 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-surface-500">
          <span>{completedCount} of {tasks.length} tasks completed</span>
          <span>{tasks.length - completedCount} remaining</span>
        </div>
      </motion.div>

      {/* Tasks */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-surface-400">Tasks</h2>
          <div className="flex items-center gap-3">
            <button onClick={openLinkModal}
              className="flex items-center gap-1.5 text-xs font-medium text-surface-400 hover:text-surface-200 transition-colors">
              <Link2 size={14} /> Link Task
            </button>
            <button onClick={() => setAddTaskOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors">
              <Plus size={14} /> Add Task
            </button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="mx-auto mb-2 text-surface-600" size={24} />
            <p className="text-sm text-surface-400 font-medium">No tasks yet</p>
            <p className="text-xs text-surface-500 mt-1 mb-3">Break this milestone into actionable tasks.</p>
            <button onClick={() => setAddTaskOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors">
              <Plus size={14} /> Add Task
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task, idx) => {
              const isCompleted = task.status === 'completed';
              return (
                <motion.div key={task.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <div className={`rounded-2xl border bg-surface-900/90 p-4 transition-all duration-200 group ${
                    isCompleted ? 'border-emerald-500/20 opacity-70' : 'border-surface-800 hover:border-surface-700'
                  }`}>
                    <div className="flex items-center gap-3">
                      {/* Toggle complete */}
                      <button onClick={() => handleCompleteTask(task)} className="flex-shrink-0">
                        {isCompleted
                          ? <CheckCircle2 size={18} className="text-emerald-400" />
                          : <Circle size={18} className={`text-surface-500 hover:text-brand-400 transition-colors ${PRIORITY_COLORS[task.priority] || ''}`}
                            />}
                      </button>

                      {/* Task body (clickable) */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-surface-500' : 'text-surface-50'}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge tone={STATUS_COLORS[task.status] || 'neutral'} className="text-[10px]">{task.status}</Badge>
                          {task.deadline && (
                            <span className="text-[11px] text-surface-500 flex items-center gap-1">
                              <Clock size={10} />{new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {'scheduledDate' in task && (task as any).scheduledDate && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${scheduledStateColor(getScheduledState(task as any))}`}>
                              {formatScheduledDate((task as any).scheduledDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!isCompleted && (
                          <button onClick={() => handleStartTask(task)}
                            className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors" title="Start focus">
                            <Play size={14} />
                          </button>
                        )}
                        {/* Task menu */}
                        <div className="relative" ref={taskMenu === task.id ? taskMenuRef : undefined}>
                          <button onClick={(e) => { e.stopPropagation(); setTaskMenu(taskMenu === task.id ? null : task.id); }}
                            className="p-1.5 rounded-lg text-surface-600 hover:text-surface-300 hover:bg-surface-800 transition-all">
                            <MoreVertical size={13} />
                          </button>
                          {taskMenu === task.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-surface-800 border border-surface-700 rounded-xl shadow-xl py-1">
                              <button onClick={() => { setTaskMenu(null); navigate('/tasks'); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-colors">
                                <ExternalLink size={13} /> Open in Tasks
                              </button>
                              <button onClick={() => { setTaskMenu(null); setMoveTarget(task); setMovePhaseId(''); setMoveMilestoneId(''); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-colors">
                                <ArrowRightLeft size={13} /> Move to Milestone
                              </button>
                              <button onClick={() => handleUnlinkTask(task)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-colors">
                                <Unlink size={13} /> Unlink
                              </button>
                              <button onClick={() => { setTaskMenu(null); setTaskDeleteTarget(task); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Edit Milestone Modal */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit Milestone" size="sm"
        footer={<>
          <button onClick={() => setEditOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
          <button onClick={saveMilestone} disabled={!editForm.title.trim() || saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Description</label>
            <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Target Date</label>
              <Input type="date" value={editForm.targetDate} onChange={e => setEditForm(f => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Status</label>
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
                {(milestone
                  ? nextMilestoneStatuses(milestone.status as RoadmapMilestoneStatus)
                  : MILESTONE_STATUS_OPTIONS.map(o => o.value)
                ).map(val => {
                  const o = MILESTONE_STATUS_OPTIONS.find(x => x.value === val) ?? { value: val, label: val };
                  return <option key={o.value} value={o.value}>{o.label}</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete Milestone Confirm */}
      <Dialog open={delMilestone} onClose={() => setDelMilestone(false)} title="Delete Milestone" size="sm"
        footer={<>
          <button onClick={() => setDelMilestone(false)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
          <button onClick={deleteMilestone} disabled={deleting}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete Milestone'}
          </button>
        </>}>
        <p className="text-sm text-surface-300">This will permanently remove <span className="font-semibold text-surface-100">"{milestone.title}"</span> and unlink associated tasks.</p>
        <p className="text-xs text-surface-500 mt-2">This action cannot be undone.</p>
      </Dialog>

      {/* Add Task Modal */}
      <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} title="Add Task" size="sm"
        footer={<>
          <button onClick={() => setAddTaskOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
          <button onClick={createTask} disabled={!taskForm.title.trim() || creatingTask}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
            {creatingTask ? 'Creating...' : 'Create Task'}
          </button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. What is System Design?" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Description</label>
            <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description" rows={2} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Priority</label>
            <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </Dialog>
      {/* Link Existing Task Modal */}
      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} title="Link Existing Task" size="sm"
        footer={
          <button onClick={() => setLinkOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Close</button>
        }>
        {loadingAvailable ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-surface-800 rounded-xl animate-pulse" />)}
          </div>
        ) : availableTasks.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-4">
            No unlinked tasks available. Tasks already linked to a milestone won't appear here.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {availableTasks.map(t => (
              <div key={t._id} className="flex items-center gap-2 p-2.5 rounded-xl border border-surface-800">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-100 truncate">{t.title}</p>
                  <p className="text-[11px] text-surface-500">{t.priority} · {t.status}</p>
                </div>
                <button onClick={() => handleLinkTask(t._id)} disabled={linkingId === t._id}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors disabled:opacity-50">
                  {linkingId === t._id ? 'Linking…' : 'Link'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {/* Move Task Modal */}
      <Dialog open={!!moveTarget} onClose={() => setMoveTarget(null)} title={`Move "${moveTarget?.title ?? ''}"`} size="sm"
        footer={
          <>
            <button onClick={() => setMoveTarget(null)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
            <button onClick={handleMoveTask} disabled={!movePhaseId || !moveMilestoneId || moving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {moving ? 'Moving...' : 'Move Task'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-xs text-surface-500">The task keeps all of its data — only its roadmap placement changes.</p>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Phase</label>
            <select value={movePhaseId}
              onChange={e => { setMovePhaseId(e.target.value); setMoveMilestoneId(''); }}
              className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              <option value="">Select phase…</option>
              {(activeRoadmap?.phases || []).map(p => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Milestone</label>
            <select value={moveMilestoneId} onChange={e => setMoveMilestoneId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              <option value="">Select milestone…</option>
              {(activeRoadmap?.milestones || [])
                .filter(m => m.phaseId === movePhaseId && m._id !== milestoneId)
                .map(m => (
                  <option key={m._id} value={m._id}>{m.title}</option>
                ))}
            </select>
          </div>
        </div>
      </Dialog>
      {/* Delete Task Confirm */}
      <Dialog open={!!taskDeleteTarget} onClose={() => { if (!deletingTask) setTaskDeleteTarget(null); }} title="Delete Task" size="sm"
        footer={<>
          <button onClick={() => setTaskDeleteTarget(null)} disabled={deletingTask}
            className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleDeleteTask} disabled={deletingTask}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
            {deletingTask ? 'Deleting...' : 'Delete Task'}
          </button>
        </>}>
        <p className="text-sm text-surface-300">
          Delete <span className="font-semibold text-surface-100">"{taskDeleteTarget?.title}"</span> permanently?
          Its focus sessions and work logs will also be removed.
        </p>
        <p className="text-xs text-surface-500 mt-2">This action cannot be undone. Milestone progress will update.</p>
      </Dialog>

    </div>
  );
}

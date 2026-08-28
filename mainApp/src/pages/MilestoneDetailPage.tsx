import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Circle, Plus, Calendar,
  Trash2, MoreVertical, Link2, Unlink, ExternalLink, ArrowRightLeft,
} from 'lucide-react';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { usePersonalTaskStore } from '../store/usePersonalTaskStore';
import { api } from '../utils/api';
import { Dialog } from '../components/ui/Dialog';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { toast } from '../store/useToastStore';
import type { RoadmapTaskSummary } from '../types/roadmap';
import { safeProgress } from '../utils/roadmapProgress';
import { getScheduledState, scheduledStateLabel } from '../utils/personalTaskSchedule';

const SCHEDULE_BADGE_TONE: Record<string, BadgeTone> = {
  today: 'brand',
  missed: 'danger',
  upcoming: 'info',
  completed: 'success',
  unscheduled: 'neutral',
};

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

export function MilestoneDetailPage() {
  const { id, phaseId, milestoneId } = useParams<{ id: string; phaseId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const { activeRoadmap, detailLoading, getRoadmap, linkTask, unlinkTask } = useRoadmapStore();
  const { tasks: personalTasks, completeTask, deleteTask } = usePersonalTaskStore();

  // Add task state
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', deadline: '', scheduledDate: '' });
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

  // Schedule task state
  const [scheduleTarget, setScheduleTarget] = useState<RoadmapTaskSummary | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
  });

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

  const personalTaskMap = useMemo(() => {
    const map = new Map<string, typeof personalTasks[0]>();
    for (const t of personalTasks) map.set(t.id, t);
    return map;
  }, [personalTasks]);

  // Close task menu on outside click
  useEffect(() => {
    if (!taskMenu) return;
    const h = (e: MouseEvent) => {
      if (taskMenuRef.current && !taskMenuRef.current.contains(e.target as Node)) setTaskMenu(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [taskMenu]);

  // ── Add Task ──
  const createTask = async () => {
    if (!taskForm.title.trim() || !milestoneId || !id || !phaseId) return;
    setCreatingTask(true);
    try {
      await api.personalTasks.create({
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority,
        status: 'todo',
        category: 'Work',
        tags: [],
        subtasks: [],
        deadline: taskForm.deadline ? new Date(taskForm.deadline).getTime() : undefined,
        scheduledDate: taskForm.scheduledDate ? new Date(taskForm.scheduledDate).getTime() : undefined,
        personalRoadmapRef: id,
        personalPhaseRef: phaseId,
        personalMilestoneRef: milestoneId,
      });
      toast.success('Task created');
      setAddTaskOpen(false);
      setTaskForm({ title: '', description: '', priority: 'medium', deadline: '', scheduledDate: '' });
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
    navigate(`/personal/tasks/${task.id}`);
  };

  const handleScheduleTask = async () => {
    if (!scheduleTarget) return;
    try {
      await api.personalTasks.update(scheduleTarget.id, { scheduledDate: scheduleDate });
      toast.success(`Scheduled for ${scheduleDate}`);
      setScheduleTarget(null);
      if (id) getRoadmap(id);
    } catch (e: any) {
      toast.error('Failed to schedule', e?.message);
    }
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-3">
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
      </motion.div>

      {/* Task list */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-6">No tasks yet. Add or link a task to get started.</p>
        ) : tasks.map(task => {
          const fullTask = personalTaskMap.get(task.id);
          const scheduleDate = fullTask?.scheduledDate ?? (task.scheduledDate ? new Date(task.scheduledDate).getTime() : undefined);
          const state = fullTask ? getScheduledState(fullTask) : (scheduleDate ? getScheduledState({ status: task.status, scheduledDate: scheduleDate }) : 'unscheduled');
          const done = task.status === 'completed';
          return (
            <div key={task.id}
              className={`group flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                done
                  ? 'border-surface-800 bg-surface-900/40 opacity-60'
                  : 'border-surface-800 bg-surface-900 hover:border-surface-700'
              }`}>
              <button onClick={() => handleCompleteTask(task)} className="flex-shrink-0" aria-label={done ? 'Completed' : 'Mark complete'}>
                {done ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Circle size={18} className="text-surface-600 hover:text-surface-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${done ? 'text-surface-500 line-through' : 'text-surface-100'}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.priority && <span className={`text-[10px] ${PRIORITY_COLORS[task.priority] || 'text-surface-500'}`}>{task.priority}</span>}
                  {task.status === 'in-progress' && <span className="text-[10px] text-brand-400">In progress</span>}
                  {state !== 'unscheduled' && scheduleDate && (
                    <Badge tone={SCHEDULE_BADGE_TONE[state] || 'neutral'} className="text-[10px]">{scheduledStateLabel(state)}</Badge>
                  )}
                </div>
              </div>
              {!done && (
                <button onClick={() => { setScheduleTarget(task); setScheduleDate(scheduleDate ? new Date(scheduleDate).toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0]); }}
                  className="flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
                  aria-label={`Schedule ${task.title}`}>
                  <Calendar size={14} />
                </button>
              )}
              <div className="relative flex-shrink-0" ref={taskMenu === task.id ? taskMenuRef : undefined}>
                <button onClick={() => setTaskMenu(taskMenu === task.id ? null : task.id)}
                  className="p-1 rounded-lg text-surface-600 hover:text-surface-300 hover:bg-surface-800 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Task menu">
                  <MoreVertical size={14} />
                </button>
                {taskMenu === task.id && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-30 py-1">
                    <button onClick={() => handleStartTask(task)} className="w-full text-left px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 flex items-center gap-2">
                      <ExternalLink size={12} /> Open task
                    </button>
                    <button onClick={() => { setMoveTarget(task); setTaskMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 flex items-center gap-2">
                      <ArrowRightLeft size={12} /> Move
                    </button>
                    <button onClick={() => handleUnlinkTask(task)} className="w-full text-left px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 flex items-center gap-2">
                      <Unlink size={12} /> Unlink
                    </button>
                    <div className="h-px bg-surface-700 my-1" />
                    <button onClick={() => { setTaskDeleteTarget(task); setTaskMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} title="Add Task" size="sm"
        footer={<>
          <button onClick={() => setAddTaskOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
          <button onClick={createTask} disabled={creatingTask || !taskForm.title.trim()}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {creatingTask ? 'Creating...' : 'Create Task'}
          </button>
        </>}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Title</label>
            <input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Task title"
              className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Description</label>
            <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none" />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Deadline</label>
              <input type="date" value={taskForm.deadline} onChange={e => setTaskForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Scheduled Date</label>
              <input type="date" value={taskForm.scheduledDate} onChange={e => setTaskForm(f => ({ ...f, scheduledDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Schedule Task Dialog */}
      <Dialog open={!!scheduleTarget} onClose={() => setScheduleTarget(null)} title={`Schedule "${scheduleTarget?.title ?? ''}"`} size="sm"
        footer={<>
          <button onClick={() => setScheduleTarget(null)} className="px-3 py-1.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">Cancel</button>
          <button onClick={handleScheduleTask} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors">Schedule</button>
        </>}>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-surface-400">Date</label>
          <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        </div>
      </Dialog>

      {/* Link Task Modal */}
      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} title="Link Existing Task">
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

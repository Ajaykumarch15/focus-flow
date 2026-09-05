import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, X, UserPlus } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultSprintId?: string;
  defaultFeatureId?: string;
}

// IES-R1 (P6-T4): Create-Task uses real workspace `members` for assignee/reviewer
// (never the removed 'm1' mock) and lets the user link the task to a real
// feature (`featureRef`) so it shows up under that feature's implementation.
export function CreateTaskModal({
  isOpen, onClose, defaultProjectId, defaultSprintId, defaultFeatureId,
}: CreateTaskModalProps) {
  const { projects, sprints, features, members, activeWorkspaceId, createTask } = useCollaborationStore();
  const me = useAuthStore.getState().user?._id ?? '';

  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [sprintId, setSprintId] = useState(defaultSprintId ?? '');
  const [featureId, setFeatureId] = useState(defaultFeatureId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(me);
  const [reviewerId, setReviewerId] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [sprintStatus, setSprintStatus] = useState<'backlog' | 'ready' | 'in_progress' | 'review' | 'done'>('backlog');
  const [estimatedHours, setEstimatedHours] = useState(8);

  // Reset whenever the modal opens — prefilled defaults win over stale state.
  useEffect(() => {
    if (!isOpen) return;
    setProjectId(defaultProjectId ?? projects.find((p) => p.workspaceId === activeWorkspaceId)?.id ?? '');
    setSprintId(defaultSprintId ?? '');
    setFeatureId(defaultFeatureId ?? '');
    setTitle('');
    setDescription('');
    setAssigneeId(useAuthStore.getState().user?._id ?? '');
    setReviewerId('');
    setPriority('medium');
    setSprintStatus('backlog');
    setEstimatedHours(8);
  }, [isOpen, projects, activeWorkspaceId, defaultProjectId, defaultSprintId, defaultFeatureId]);

  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === activeWorkspaceId),
    [projects, activeWorkspaceId],
  );
  const projectSprints = useMemo(
    () => sprints.filter((s) => s.workspaceId === activeWorkspaceId && s.projectId === projectId),
    [sprints, activeWorkspaceId, projectId],
  );
  const projectFeatures = useMemo(
    () => features.filter((f) => f.workspaceId === activeWorkspaceId && f.projectId === projectId),
    [features, activeWorkspaceId, projectId],
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    createTask({
      title: title.trim(),
      description: description.trim(),
      projectId,
      sprintId: sprintId || undefined,
      featureId: featureId || undefined,
      assigneeId: assigneeId || undefined,
      reviewerId: reviewerId || undefined,
      priority,
      sprintStatus,
      estimatedHours,
    });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <CheckSquare size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Create Task</h2>
              <p className="text-xs text-surface-400">Assign a real member and link it to a feature</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Task Title <span className="text-red-400">*</span>
            </label>
            <Input name="title" className="rounded-xl text-sm w-full"
              placeholder="e.g. Implement OAuth refresh flow"
              value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Description</label>
            <Textarea rows={2} className="rounded-xl text-sm w-full resize-none"
              placeholder="Acceptance criteria, notes, links…"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">
                Project <span className="text-red-400">*</span>
              </label>
              <Select name="projectId" aria-label="Task project" required
                value={projectId} onChange={(e) => { setProjectId(e.target.value); setSprintId(''); setFeatureId(''); }}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="">Select project…</option>
                {wsProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Sprint</label>
              <Select name="sprintId" aria-label="Task sprint"
                value={sprintId} onChange={(e) => setSprintId(e.target.value)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="">No sprint</option>
                {projectSprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Linked Feature</label>
            <Select name="featureId" aria-label="Linked feature"
              value={featureId} onChange={(e) => setFeatureId(e.target.value)}
              className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
              <option value="">No feature</option>
              {projectFeatures.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5 flex items-center gap-1">
                <UserPlus size={12} className="text-brand-400" /> Assignee
              </label>
              <Select name="assigneeId" aria-label="Assignee"
                value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Reviewer</label>
              <Select name="reviewerId" aria-label="Reviewer"
                value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="">None</option>
                {members.filter((m) => m.id !== assigneeId).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Priority</label>
              <Select name="priority" aria-label="Priority"
                value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Status</label>
              <Select name="sprintStatus" aria-label="Task status"
                value={sprintStatus} onChange={(e) => setSprintStatus(e.target.value as typeof sprintStatus)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="backlog">Backlog</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Est. Hours</label>
              <Input name="estimatedHours" type="number" min={0}
                className="rounded-xl text-sm w-full"
                value={estimatedHours} onChange={(e) => setEstimatedHours(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={!title.trim() || !projectId} className="flex-1 rounded-xl">
              Create Task
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

import { useState } from 'react';
import { Plus, Trash2, Link2 } from 'lucide-react';
import { Dialog } from '@shared/components/ui/Dialog';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import { Field } from '@shared/components/ui/Field';
import { Button } from '@shared/components/ui/Button';
import { useKanbanStore } from './kanbanStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { KANBAN_COLUMNS, LABEL_PRESETS } from './types';
import type { KanbanStatus, KanbanPriority, KanbanSubtask } from './types';

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: KanbanPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const KANBAN_TO_SPRINT: Record<KanbanStatus, string> = {
  todo: 'backlog',
  doing: 'in_progress',
  review: 'review',
  done: 'done',
};

export function AddTaskModal({ open, onClose }: AddTaskModalProps) {
  const { addModalDefaultStatus, tasks, workspaceId, projectId, membersMap } = useKanbanStore();
  const createTask = useCollaborationStore((s) => s.createTask);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<KanbanStatus>(addModalDefaultStatus);
  const [priority, setPriority] = useState<KanbanPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<KanbanSubtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const memberEntries = Object.entries(membersMap);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(addModalDefaultStatus);
    setPriority('medium');
    setDueDate('');
    setAssigneeId('');
    setSelectedLabels([]);
    setSubtasks([]);
    setNewSubtask('');
    setSelectedDeps([]);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Task name is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        sprintStatus: KANBAN_TO_SPRINT[status] as any,
        workspaceId: workspaceId || undefined,
        projectId: projectId || undefined,
        assigneeId: assigneeId || undefined,
        labels: selectedLabels.length > 0 ? selectedLabels : ['General'],
        dependencies: selectedDeps.length > 0 ? selectedDeps : [],
        estimatedHours: 8,
        actualHours: 0,
        subtasks: subtasks.map((s) => ({ id: s.id, title: s.title, completed: s.completed })),
        deadline: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      resetForm();
      onClose();
    } catch {
      setErrors({ title: 'Failed to create task. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([
      ...subtasks,
      { id: `st-${Date.now()}`, title: newSubtask.trim(), completed: false },
    ]);
    setNewSubtask('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter((s) => s.id !== id));
  };

  const toggleLabel = (name: string) => {
    setSelectedLabels((prev) =>
      prev.includes(name) ? prev.filter((l) => l !== name) : [...prev, name],
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add New Task"
      description="Create a new task and add it to your board."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || submitting} className="rounded-xl">
            {submitting ? 'Creating...' : 'Create Task'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Task Name" required error={errors.title} htmlFor="task-title">
          <Input
            id="task-title"
            placeholder="e.g. Testing Menu Dashboard..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={!!errors.title}
            autoFocus
          />
        </Field>

        <Field label="Description" htmlFor="task-desc">
          <Textarea
            id="task-desc"
            rows={3}
            placeholder="Brief description of the task..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Status" htmlFor="task-status">
            <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as KanbanStatus)}>
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>{col.title}</option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" htmlFor="task-priority">
            <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as KanbanPriority)}>
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Assignee */}
        {memberEntries.length > 0 && (
          <Field label="Assign to" htmlFor="task-assignee">
            <Select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {memberEntries.map(([id, m]) => (
                <option key={id} value={id}>{m.name}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Due Date" htmlFor="task-due">
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>

        {/* Labels */}
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-2">Labels</label>
          <div className="flex flex-wrap gap-2">
            {LABEL_PRESETS.map((label) => {
              const selected = selectedLabels.includes(label.name);
              return (
                <button
                  key={label.name}
                  type="button"
                  onClick={() => toggleLabel(label.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    selected
                      ? 'border-brand-500/30 bg-brand-500/10 text-brand-400'
                      : 'border-surface-800 bg-surface-850 text-surface-400 hover:border-surface-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-2">Subtasks</label>
          <div className="space-y-2">
            {subtasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-surface-300 bg-surface-850 border border-surface-800 rounded-lg px-3 py-2">
                  {st.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSubtask(st.id)}
                  className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label={`Remove subtask ${st.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Add a subtask..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className="rounded-lg flex-shrink-0"
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Dependencies */}
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-2 flex items-center gap-1.5">
            <Link2 size={14} className="text-brand-400" />
            Blocked by (optional)
          </label>
          <p className="text-[11px] text-surface-500 mb-2">Select tasks that must finish before this one can start.</p>
          <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-surface-800 bg-surface-850 p-2">
            {tasks
              .filter((t) => t.id !== undefined && !selectedDeps.includes(t.id))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedDeps([...selectedDeps, t.id])}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs text-surface-300 hover:bg-surface-800 hover:text-surface-100 transition-colors"
                >
                  <Link2 size={12} className="text-surface-500 flex-shrink-0" />
                  <span className="truncate">{t.title}</span>
                  <span className="ml-auto text-[10px] text-surface-500 capitalize">{t.status}</span>
                </button>
              ))}
            {tasks.filter((t) => !selectedDeps.includes(t.id)).length === 0 && (
              <p className="text-[11px] text-surface-500 italic px-2 py-1">No other tasks available to link.</p>
            )}
          </div>
          {selectedDeps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedDeps.map((depId) => {
                const dep = tasks.find((t) => t.id === depId);
                if (!dep) return null;
                return (
                  <span
                    key={depId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-brand-500/30 bg-brand-500/10 text-brand-400"
                  >
                    <Link2 size={10} />
                    {dep.title}
                    <button
                      type="button"
                      onClick={() => setSelectedDeps(selectedDeps.filter((id) => id !== depId))}
                      className="ml-0.5 hover:text-brand-200"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

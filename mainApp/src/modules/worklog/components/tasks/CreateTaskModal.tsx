import { useEffect, useRef, useState } from 'react';
import { Calendar, Flag, Tag, ChevronDown, Plus, Trash2, Bell, Check, X } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { LABEL_PRESETS } from '@worklog/components/kanban/types';
import { Priority } from '@shared/types';
import { TASK_COLORS, CATEGORIES } from '@shared/utils/colors';
import { Dialog } from '@shared/components/ui/Dialog';
import { Field } from '@shared/components/ui/Field';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { ProEditor } from '@shared/components/ui/proEditor';

interface CreateTaskModalProps {
  onClose: () => void;
  onAddTask?: (data: any) => Promise<string>;
  contextLabel?: string;
}

type ModalPriority = 'none' | 'high' | 'medium' | 'normal' | 'low';

const PRIORITY_OPTIONS: { value: ModalPriority; label: string; color: string; stored: Priority }[] = [
  { value: 'none', label: 'No priority', color: 'text-surface-400', stored: 'medium' },
  { value: 'high', label: 'High', color: 'text-red-400', stored: 'high' },
  { value: 'medium', label: 'Medium', color: 'text-amber-400', stored: 'medium' },
  { value: 'normal', label: 'Normal', color: 'text-blue-400', stored: 'medium' },
  { value: 'low', label: 'Low', color: 'text-teal-400', stored: 'low' },
];

const pillClass =
  'inline-flex h-9 items-center gap-2 rounded-xl border border-surface-800 bg-surface-850 px-3 text-sm text-surface-300 transition-colors hover:border-surface-700 hover:text-surface-100';

export function CreateTaskModal({ onClose, onAddTask, contextLabel = 'in To Do column' }: CreateTaskModalProps) {
  const storeAddTask = useStore((s) => s.addTask);
  const addTask = onAddTask ?? storeAddTask;
  const activeLogs = useWorkLogStore((s) => s.activeLogs);
  const linkTask = useWorkLogStore((s) => s.linkTask);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'none' as ModalPriority,
    category: 'Work',
    deadline: '',
    scheduledDate: '',
    reminderMinutesBefore: 0,
    color: TASK_COLORS[0],
    tags: '',
    worklogId: '',
  });
  const [labels, setLabels] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const priorityRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!priorityOpen && !labelsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false);
      if (labelsRef.current && !labelsRef.current.contains(e.target as Node)) setLabelsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [priorityOpen, labelsOpen]);

  const selectedPriority = PRIORITY_OPTIONS.find(o => o.value === form.priority) ?? PRIORITY_OPTIONS[0];

  const toggleLabel = (name: string) => {
    setLabels(prev => (prev.includes(name) ? prev.filter(l => l !== name) : [...prev, name]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.title.trim()) {
      setErrors({ title: 'Task name is required.' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const newTaskId = await addTask({
        title: form.title.trim(),
        description: form.description,
        priority: selectedPriority.stored,
        category: form.category,
        status: 'todo',
        deadline: form.deadline || undefined,
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).getTime() : undefined,
        reminderMinutesBefore: form.deadline ? form.reminderMinutesBefore : undefined,
        color: form.color,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        labels,
        subtasks: [],
        skipWorkLogCreation: !!form.worklogId,
      } as any);
      if (form.worklogId && newTaskId) {
        await linkTask(form.worklogId, newTaskId);
      }
      onClose();
    } catch {
      setErrors({ title: 'Failed to create task. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create new task"
      description={contextLabel}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-task-form"
            onClick={handleSubmit}
            disabled={!form.title.trim() || submitting}
            className="rounded-xl"
            leftIcon={<Plus size={16} />}
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </Button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Task title" required error={errors.title} htmlFor="create-task-title">
          <Input
            id="create-task-title"
            className="h-12 rounded-[14px] text-lg"
            placeholder="What are you working on?"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            invalid={!!errors.title}
            autoFocus
          />
        </Field>

        {/* Toolbar: due date · priority · labels */}
        <div className="flex flex-wrap items-center gap-2">
          <div className={`${pillClass} pl-3 pr-1.5 focus-within:border-brand-500/40`}>
            <Calendar size={14} className="text-surface-400" />
            <input
              type="date"
              aria-label="Due date"
              value={form.deadline}
              onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
              className="w-[7.5rem] bg-transparent text-sm text-surface-200 outline-none"
            />
            {form.deadline && (
              <button
                type="button"
                aria-label="Clear due date"
                onClick={() => setForm(p => ({ ...p, deadline: '' }))}
                className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          <div className="relative" ref={priorityRef}>
            <button
              type="button"
              onClick={() => setPriorityOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={priorityOpen}
              className={pillClass}
            >
              <Flag size={14} className={selectedPriority.color} />
              <span className={selectedPriority.color}>{selectedPriority.label}</span>
              <ChevronDown size={14} className="text-surface-500" />
            </button>
            {priorityOpen && (
              <div
                role="listbox"
                aria-label="Priority"
                className="absolute left-0 top-full z-20 mt-1 w-52 rounded-xl border border-surface-800 bg-surface-900 p-2 shadow-xl shadow-black/40"
              >
                <p className="border-b border-surface-800 px-2 pb-2 pt-1 text-xs font-semibold text-surface-300">
                  Priority
                </p>
                <div className="mt-1 space-y-0.5">
                  {PRIORITY_OPTIONS.map(opt => {
                    const selected = opt.value === form.priority;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setForm(p => ({ ...p, priority: opt.value }));
                          setPriorityOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-surface-800"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            selected ? 'border-brand-500' : 'border-surface-600'
                          }`}
                        >
                          {selected && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                        </span>
                        <Flag size={14} className={opt.color} />
                        <span className={opt.color}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={labelsRef}>
            <button
              type="button"
              onClick={() => setLabelsOpen(o => !o)}
              aria-haspopup="dialog"
              aria-expanded={labelsOpen}
              className={pillClass}
            >
              <Tag size={14} />
              Labels
              {labels.length > 0 && <span className="font-semibold text-brand-400">({labels.length})</span>}
              <ChevronDown size={14} className="text-surface-500" />
            </button>
            {labelsOpen && (
              <div
                aria-label="Labels"
                className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-surface-800 bg-surface-900 p-3 shadow-xl shadow-black/40"
              >
                <p className="mb-2 text-xs font-semibold text-surface-300">Labels</p>
                <div className="flex flex-wrap gap-2">
                  {LABEL_PRESETS.map(label => {
                    const selected = labels.includes(label.name);
                    return (
                      <button
                        key={label.name}
                        type="button"
                        onClick={() => toggleLabel(label.name)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                          selected
                            ? 'border-brand-500/30 bg-brand-500/10 text-brand-400'
                            : 'border-surface-800 bg-surface-850 text-surface-400 hover:border-surface-700'
                        }`}
                      >
                        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
                        {label.name}
                        {selected && <Check size={11} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map(name => {
              const preset = LABEL_PRESETS.find(l => l.name === name);
              return (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: preset?.color }} />
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove label ${name}`}
                    onClick={() => toggleLabel(name)}
                    className="ml-0.5 rounded-full p-0.5 hover:text-brand-200"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <ProEditor
          value={form.description}
          onChange={v => setForm(p => ({ ...p, description: v }))}
          placeholder="Enter description here..."
          label="Description"
          labelColor="text-surface-300"
          minRows={4}
        />

        {/* More options */}
        <div className="border-t border-surface-800/70 pt-3">
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            aria-expanded={showMore}
            className="flex items-center gap-2 text-sm font-medium text-surface-300 transition-colors hover:text-surface-100"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
            />
            More options
          </button>

          {showMore && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="create-task-category">
                  <Select
                    id="create-task-category"
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Scheduled date" htmlFor="create-task-scheduled" hint="Shows on Today's page.">
                  <Input
                    id="create-task-scheduled"
                    type="date"
                    value={form.scheduledDate}
                    onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))}
                  />
                </Field>
              </div>

              {form.deadline && (
                <Field label="Remind me" htmlFor="create-task-reminder">
                  <Select
                    id="create-task-reminder"
                    value={form.reminderMinutesBefore}
                    onChange={e => setForm(p => ({ ...p, reminderMinutesBefore: Number(e.target.value) }))}
                  >
                    <option value={0}>No reminder</option>
                    <option value={15}>15 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                  </Select>
                </Field>
              )}

              <div>
                <span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-surface-200">
                  <Bell size={13} className="text-surface-400" />
                  Color accent
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {TASK_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Color ${color}`}
                      onClick={() => setForm(p => ({ ...p, color }))}
                      className={`h-7 w-7 rounded-full transition-all ${
                        form.color === color
                          ? 'scale-110 shadow-md ring-2 ring-white ring-offset-2 ring-offset-surface-900'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <Field label="Tags" hint="Comma separated." htmlFor="create-task-tags">
                <Input
                  id="create-task-tags"
                  placeholder="frontend, bug, v2"
                  value={form.tags}
                  onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                />
              </Field>

              {activeLogs.length > 0 && (
                <Field
                  label="Link to work log"
                  hint="Optionally link this task to an existing work log."
                  htmlFor="create-task-worklog"
                >
                  <Select
                    id="create-task-worklog"
                    value={form.worklogId}
                    onChange={e => setForm(p => ({ ...p, worklogId: e.target.value }))}
                  >
                    <option value="">None (auto-create new)</option>
                    {activeLogs.map(log => (
                      <option key={log._id} value={log._id}>{log.title}</option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

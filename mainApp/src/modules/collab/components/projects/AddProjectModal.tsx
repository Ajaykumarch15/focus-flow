import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { Dialog } from '@shared/components/ui/Dialog';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import { Field } from '@shared/components/ui/Field';
import { Button } from '@shared/components/ui/Button';
import type { ProjectData, ProjectType, ProjectStatus, CardTint } from './types';

interface AddProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (project: ProjectData) => void;
}

const PROJECT_TYPES: ProjectType[] = ['Web App', 'Mobile', 'UI/UX', 'Internal', 'Client', 'Research', 'Website', 'Dashboard', 'Tools'];

const TINT_OPTIONS: CardTint[] = ['purple', 'green', 'pink', 'blue', 'orange', 'gray'];

export function AddProjectModal({ open, onClose, onCreate }: AddProjectModalProps) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ProjectType>('Web App');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [tags, setTags] = useState('');
  const [tint, setTint] = useState<CardTint>('blue');
  const [errors, setErrors] = useState<{ name?: string }>({});

  const resetForm = () => {
    setName('');
    setClient('');
    setDescription('');
    setType('Web App');
    setStatus('active');
    setStartDate('');
    setEndDate('');
    setPriority('Medium');
    setTags('');
    setTint('blue');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Project name is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);

    const project: ProjectData = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      client: client.trim() || 'Untitled',
      description: description.trim(),
      type: [type],
      status,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || '',
      tags: [type, ...(tagList.length > 0 ? tagList : [STATUS_LABEL[status]])],
      completedTasks: 0,
      totalTasks: 0,
      progress: 0,
      bookmarked: false,
      tint,
      iconEmoji: name.trim().charAt(0).toUpperCase(),
    };

    onCreate(project);
    resetForm();
    onClose();
  };

  const STATUS_LABEL: Record<ProjectStatus, string> = {
    active: 'Active',
    in_progress: 'In Progress',
    completed: 'Completed',
    on_hold: 'On Hold',
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add New Project"
      description="Create a new project to organize your work."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()} className="rounded-xl">
            Create Project
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header icon */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <FolderPlus size={18} />
          </div>
          <p className="text-xs text-surface-400">Fill in the details for your new project.</p>
        </div>

        <Field label="Project Name" required error={errors.name} htmlFor="project-name">
          <Input
            id="project-name"
            placeholder="e.g. AI Search Engine, Mobile Gateway..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!errors.name}
            autoFocus
          />
        </Field>

        <Field label="Client / Organization" htmlFor="project-client">
          <Input
            id="project-client"
            placeholder="e.g. Google, Airbnb, Internal..."
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
        </Field>

        <Field label="Project Description" htmlFor="project-desc">
          <Textarea
            id="project-desc"
            rows={3}
            placeholder="What are the goals, target users, and key deliverables?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Project Type" htmlFor="project-type">
            <Select id="project-type" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="project-status">
            <Select id="project-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {Object.entries(STATUS_LABEL).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date" htmlFor="project-start">
            <Input
              id="project-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>

          <Field label="End Date" htmlFor="project-end">
            <Input
              id="project-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Priority" htmlFor="project-priority">
            <Select id="project-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </Select>
          </Field>

          <Field label="Card Color" htmlFor="project-tint">
            <Select id="project-tint" value={tint} onChange={(e) => setTint(e.target.value as CardTint)}>
              {TINT_OPTIONS.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tags" htmlFor="project-tags" hint="Comma-separated, e.g. frontend, design, urgent">
          <Input
            id="project-tags"
            placeholder="frontend, design, urgent..."
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}

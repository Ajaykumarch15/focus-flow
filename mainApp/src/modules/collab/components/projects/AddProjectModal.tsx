import { useState, useMemo, useEffect } from 'react';
import { FolderPlus, Crown, Check, ShieldCheck } from 'lucide-react';
import { Dialog } from '@shared/components/ui/Dialog';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import { Field } from '@shared/components/ui/Field';
import { Button } from '@shared/components/ui/Button';
import { Avatar } from '@shared/components/ui/Avatar';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { MemberRole } from '@collab/types/collaboration';
import type { ProjectType, ProjectStatus, CardTint } from './types';

interface AddProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: () => void;
}

const PROJECT_TYPES: ProjectType[] = ['Web App', 'Mobile', 'UI/UX', 'Internal', 'Client', 'Research', 'Website', 'Dashboard', 'Tools'];

const TINT_OPTIONS: CardTint[] = ['purple', 'green', 'pink', 'blue', 'orange', 'gray'];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
};

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
  const [selectedPM, setSelectedPM] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<{ name?: string; pm?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProject = useCollaborationStore((s) => s.createProject);
  const members = useCollaborationStore((s) => s.members);

  const workspaceMembers = useMemo(() => {
    return members.filter(m => m.status !== 'offline');
  }, [members]);

  const isAdminMember = (m: { role?: string }) => m.role === 'admin' || m.role === 'superadmin';

  useEffect(() => {
    if (workspaceMembers.length > 0) {
      setSelectedMembers(new Set(
        workspaceMembers.filter(isAdminMember).map(m => m.id)
      ));
    }
  }, [workspaceMembers]);

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
    setSelectedPM('');
    setSelectedMembers(new Set(workspaceMembers.filter(isAdminMember).map(m => m.id)));
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleMember = (userId: string) => {
    const member = workspaceMembers.find(m => m.id === userId);
    if (member && isAdminMember(member)) return; // admins can't be toggled
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Project name is required.';
    if (!selectedPM) next.pm = 'Please select a Project Manager.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      // Build members array — PM is always included with isProjectManager: true
      const membersList: Array<{ userId: string; role: MemberRole; isProjectManager: boolean }> = Array.from(selectedMembers).map(userId => {
        const member = workspaceMembers.find(m => m.id === userId);
        return {
          userId,
          role: (member?.role === 'superadmin' || member?.role === 'admin' ? 'admin' : 'nonadmin') as 'admin' | 'nonadmin',
          isProjectManager: userId === selectedPM,
        };
      });

      // Ensure PM is in the list
      if (!selectedMembers.has(selectedPM)) {
        membersList.unshift({ userId: selectedPM, role: 'admin', isProjectManager: true });
      } else {
        // If PM was in selected members, update their role to admin
        const pmIdx = membersList.findIndex(m => m.userId === selectedPM);
        if (pmIdx >= 0) membersList[pmIdx].role = 'admin';
      }

      await createProject({
        name: name.trim(),
        description: description.trim(),
        members: membersList,
      });
      onCreate?.();
      resetForm();
      onClose();
    } catch {
      // Error is handled by runMutation in the store
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add New Project"
      description="Create a new project and assign a Project Manager."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !selectedPM || isSubmitting} className="rounded-xl">
            {isSubmitting ? 'Creating...' : 'Create Project'}
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

        {/* Project Manager Selection */}
        <Field label="Project Manager" required error={errors.pm} htmlFor="project-pm">
          <Select id="project-pm" value={selectedPM} onChange={(e) => setSelectedPM(e.target.value)}>
            <option value="">Select a Project Manager...</option>
            {workspaceMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </Select>
        </Field>

        {/* Member Selection */}
        <div>
          <label className="text-xs font-semibold text-surface-300 mb-2 block">
            Add Members
          </label>
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-surface-800 bg-surface-900/50 p-2">
            {workspaceMembers.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-3">No workspace members available</p>
            ) : (
              workspaceMembers.map((m) => {
                const isSelected = selectedMembers.has(m.id);
                const isPM = m.id === selectedPM;
                const locked = isAdminMember(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    disabled={locked}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all text-left ${
                      locked
                        ? 'opacity-70 cursor-not-allowed bg-brand-500/5 border border-brand-500/20'
                        : isSelected || isPM
                          ? 'bg-brand-500/10 border border-brand-500/30'
                          : 'hover:bg-surface-850 border border-transparent'
                    }`}
                  >
                    <Avatar name={m.name || m.email} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-200 truncate">{m.name || m.email}</p>
                      <p className="text-[10px] text-surface-500 truncate">{m.email}</p>
                    </div>
                    {isPM && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                        <Crown size={10} /> PM
                      </span>
                    )}
                    {locked ? (
                      <ShieldCheck size={12} className="text-brand-400 shrink-0" />
                    ) : (isSelected || isPM) ? (
                      <Check size={12} className="text-brand-400" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

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

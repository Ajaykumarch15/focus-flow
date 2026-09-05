import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { ProjectPatch } from '@collab/types/collaboration';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '@shared/components/ui/Card';
import { Field } from '@shared/components/ui/Field';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';

// EEP2-P2.2.3: editable DDS §4.4 Project Information (description/key/status).
// Saves via `updateProjectMeta` (optimistic + rollback). `canEdit` disables the
// form for Viewers; the server re-enforces the editor gate regardless.
const STATUS_OPTIONS: { value: ProjectPatch['status']; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

export function ProjectInfoForm({ projectId, canEdit = true }: { projectId: string; canEdit?: boolean }) {
  const project = useCollaborationStore((s) => s.projects.find((p) => p.id === projectId));
  const updateProjectMeta = useCollaborationStore((s) => s.updateProjectMeta);

  const [description, setDescription] = useState(project?.description ?? '');
  const [key, setKey] = useState(project?.key ?? '');
  const [status, setStatus] = useState<ProjectPatch['status']>(project?.status ?? 'active');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!project) return;
    setDescription(project.description ?? '');
    setKey(project.key ?? '');
    setStatus(project.status ?? 'active');
  }, [project]);

  if (!project) return null;

  const patch: ProjectPatch = {};
  if (description !== (project.description ?? '')) patch.description = description;
  if (key !== (project.key ?? '')) patch.key = key;
  if (status !== (project.status ?? 'active')) patch.status = status;
  const dirty = Object.keys(patch).length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    updateProjectMeta(project.id, patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Information</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Key" htmlFor="project-key" hint="Short identifier (max 10 chars) shown across the board.">
            <Input
              id="project-key"
              maxLength={10}
              disabled={!canEdit}
              placeholder="e.g. FF"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>

          <Field label="Description" htmlFor="project-description">
            <Textarea
              id="project-description"
              rows={3}
              disabled={!canEdit}
              placeholder="Goals, target users, and key engineering deliverables."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label="Status" htmlFor="project-status">
            <Select
              id="project-status"
              disabled={!canEdit}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectPatch['status'])}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-center justify-end gap-3 pt-1">
            {saved && (
              <span role="status" aria-live="polite" className="text-xs text-emerald-400 font-semibold">
                Project info saved
              </span>
            )}
            <Button type="submit" size="sm" disabled={!canEdit || !dirty} leftIcon={<Save size={14} />}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

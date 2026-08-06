import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { ProjectPatch, ProjectSettings } from '../../types/collaboration';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../ui/Card';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';

// EEP2-P2.2.3: DDS §4.4 project settings — the same keys as the workspace
// settings schema; they override workspace defaults for this project only.
// Saving is Owner/Admin-gated on the server (this panel expects canManage).
const DEFAULT_SETTINGS: ProjectSettings = {
  allowMemberInvites: true,
  requireReviewForDone: false,
  autoSyncTimerWorkLogs: true,
  defaultVisibility: 'Workspace',
};

const VISIBILITY_OPTIONS: ProjectSettings['defaultVisibility'][] = ['Private', 'Team', 'Project', 'Workspace'];

export function ProjectSettingsPanel({ projectId, canManage = true }: { projectId: string; canManage?: boolean }) {
  const project = useCollaborationStore((s) => s.projects.find((p) => p.id === projectId));
  const updateProjectMeta = useCollaborationStore((s) => s.updateProjectMeta);

  const current = { ...DEFAULT_SETTINGS, ...(project?.settings ?? {}) };

  const [allowMemberInvites, setAllowMemberInvites] = useState(current.allowMemberInvites);
  const [requireReviewForDone, setRequireReviewForDone] = useState(current.requireReviewForDone);
  const [autoSyncTimerWorkLogs, setAutoSyncTimerWorkLogs] = useState(current.autoSyncTimerWorkLogs);
  const [defaultVisibility, setDefaultVisibility] = useState<ProjectSettings['defaultVisibility']>(current.defaultVisibility);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!project) return;
    const merged = { ...DEFAULT_SETTINGS, ...(project.settings ?? {}) };
    setAllowMemberInvites(merged.allowMemberInvites);
    setRequireReviewForDone(merged.requireReviewForDone);
    setAutoSyncTimerWorkLogs(merged.autoSyncTimerWorkLogs);
    setDefaultVisibility(merged.defaultVisibility);
  }, [project]);

  if (!project) return null;

  const settings: ProjectSettings = {
    allowMemberInvites,
    requireReviewForDone,
    autoSyncTimerWorkLogs,
    defaultVisibility,
  };
  const dirty = JSON.stringify(settings) !== JSON.stringify(current);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const patch: ProjectPatch = { settings };
    updateProjectMeta(project.id, patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-3 divide-y divide-surface-800">
            <label className="pt-1 flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-surface-100">Allow Member Invitations</p>
                <p className="text-[11px] text-surface-400">Permit members to invite others to this project.</p>
              </div>
              <input
                type="checkbox"
                disabled={!canManage}
                checked={allowMemberInvites}
                onChange={(e) => setAllowMemberInvites(e.target.checked)}
                className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
              />
            </label>

            <label className="pt-3 flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-surface-100">Mandatory QA Review for 'Done'</p>
                <p className="text-[11px] text-surface-400">Features must pass QA before being marked Done.</p>
              </div>
              <input
                type="checkbox"
                disabled={!canManage}
                checked={requireReviewForDone}
                onChange={(e) => setRequireReviewForDone(e.target.checked)}
                className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
              />
            </label>

            <label className="pt-3 flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-surface-100">Auto-Sync Timer Work Logs</p>
                <p className="text-[11px] text-surface-400">Publish focus session logs to this project's activity feed.</p>
              </div>
              <input
                type="checkbox"
                disabled={!canManage}
                checked={autoSyncTimerWorkLogs}
                onChange={(e) => setAutoSyncTimerWorkLogs(e.target.checked)}
                className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
              />
            </label>
          </div>

          <Field label="Default Visibility" htmlFor="project-visibility">
            <Select
              id="project-visibility"
              disabled={!canManage}
              value={defaultVisibility}
              onChange={(e) => setDefaultVisibility(e.target.value as ProjectSettings['defaultVisibility'])}
            >
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-center justify-end gap-3 pt-1">
            {saved && (
              <span role="status" aria-live="polite" className="text-xs text-emerald-400 font-semibold">
                Settings saved
              </span>
            )}
            <Button type="submit" size="sm" disabled={!canManage || !dirty} leftIcon={<Save size={14} />}>
              Save Settings
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

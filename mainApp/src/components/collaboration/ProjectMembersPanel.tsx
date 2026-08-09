import { useEffect, useState } from 'react';
import { Save, UserPlus } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { ProjectPatch } from '../../types/collaboration';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';

// EEP2-P2.2.3: manage Project.members[] (User refs) + Project.teamIds[] (Team
// refs). Saves via `updateProjectMeta`; the server re-validates that every ref
// belongs to the workspace and enforces the Owner/Admin gate.
export function ProjectMembersPanel({ projectId, canManage = true }: { projectId: string; canManage?: boolean }) {
  const project = useCollaborationStore((s) => s.projects.find((p) => p.id === projectId));
  const members = useCollaborationStore((s) => s.members);
  const teams = useCollaborationStore((s) => s.teams);
  const updateProjectMeta = useCollaborationStore((s) => s.updateProjectMeta);

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!project) return;
    setSelectedMembers(project.members ?? []);
    setSelectedTeams(project.teamIds ?? []);
  }, [project]);

  if (!project) return null;

  const sortedEqual = (a: string[], b: string[]) =>
    JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const dirty =
    !sortedEqual(selectedMembers, project.members ?? []) ||
    !sortedEqual(selectedTeams, project.teamIds ?? []);

  const toggle = (list: string[], id: string, setList: (next: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSave = () => {
    if (!dirty) return;
    const patch: ProjectPatch = {};
    if (!sortedEqual(selectedMembers, project.members ?? [])) patch.members = selectedMembers;
    if (!sortedEqual(selectedTeams, project.teamIds ?? [])) patch.teamIds = selectedTeams;
    updateProjectMeta(project.id, patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Members & Teams</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <p className="text-xs font-bold text-surface-100 flex items-center gap-1.5">
            <UserPlus size={13} className="text-brand-400" /> Members
          </p>
          <p className="text-[11px] text-surface-400 mb-2">Only workspace members can be added.</p>
          {members.length === 0 ? (
            <p className="text-xs text-surface-500 italic">No workspace members loaded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = selectedMembers.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!canManage}
                    onClick={() => toggle(selectedMembers, m.id, setSelectedMembers)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selected
                        ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                        : 'bg-surface-800 text-surface-400 border-surface-700'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-surface-100 flex items-center gap-1.5">
            <Badge tone="info" className="text-[10px] font-extrabold uppercase px-1.5 py-0">T</Badge> Teams
          </p>
          <p className="text-[11px] text-surface-400 mb-2">Only teams in this workspace can be added.</p>
          {teams.length === 0 ? (
            <p className="text-xs text-surface-500 italic">No teams loaded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const selected = selectedTeams.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!canManage}
                    onClick={() => toggle(selectedTeams, t.id, setSelectedTeams)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selected
                        ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                        : 'bg-surface-800 text-surface-400 border-surface-700'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && (
            <span role="status" aria-live="polite" className="text-xs text-emerald-400 font-semibold">
              Members saved
            </span>
          )}
          <Button type="button" size="sm" disabled={!canManage || !dirty} onClick={handleSave} leftIcon={<Save size={14} />}>
            Save Members
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

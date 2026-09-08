import { useEffect, useState } from 'react';
import { Save, UserPlus, Trash2, Mail } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { ProjectPatch, ProjectMemberRole, ProjectMember } from '@collab/types/collaboration';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '@shared/components/ui/Card';
import { Badge } from '@shared/components/ui/Badge';
import { api } from '@shared/utils/api';

const ROLE_OPTIONS: ProjectMemberRole[] = ['admin', 'nonadmin'];

export function ProjectMembersPanel({ projectId, canManage = true }: { projectId: string; canManage?: boolean }) {
  const project = useCollaborationStore((s) => s.projects.find((p) => p.id === projectId));
  const members = useCollaborationStore((s) => s.members);
  const teams = useCollaborationStore((s) => s.teams);
  const updateProjectMeta = useCollaborationStore((s) => s.updateProjectMeta);

  const [localMembers, setLocalMembers] = useState<ProjectMember[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectMemberRole>('nonadmin');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLocalMembers(project.members ?? []);
    setSelectedTeams(project.teamIds ?? []);
  }, [project]);

  if (!project) return null;

  const isDirty =
    JSON.stringify(localMembers.map(m => m.userId).sort()) !== JSON.stringify((project.members ?? []).map((m) => m.userId).sort()) ||
    JSON.stringify(localMembers.map(m => m.role).sort()) !== JSON.stringify((project.members ?? []).map((m) => m.role).sort()) ||
    JSON.stringify([...selectedTeams].sort()) !== JSON.stringify([...(project.teamIds ?? [])].sort());

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setLoading(true);
    try {
      const res = await api.projects.addMember(projectId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      // Reload project from response
      const updatedMembers = res.members;
      setLocalMembers(updatedMembers);
      setInviteEmail('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      alert(err?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: ProjectMemberRole) => {
    setLoading(true);
    try {
      await api.projects.updateMemberRole(projectId, userId, { role: newRole });
      setLocalMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    } catch (err: any) {
      alert(err?.message || 'Failed to change role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the project?')) return;
    setLoading(true);
    try {
      await api.projects.removeMember(projectId, userId);
      setLocalMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (err: any) {
      alert(err?.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!isDirty) return;
    const patch: ProjectPatch = {};
    patch.members = localMembers.map(m => ({ userId: m.userId, role: m.role, isProjectManager: m.isProjectManager }));
    patch.teamIds = selectedTeams;
    updateProjectMeta(project.id, patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggle = (list: string[], id: string, setList: (next: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Members & Teams</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Current Members */}
        <div>
          <p className="text-xs font-bold text-surface-100 flex items-center gap-1.5">
            <UserPlus size={13} className="text-brand-400" /> Members
          </p>
          <p className="text-[11px] text-surface-400 mb-2">Only workspace members can be added.</p>
          {localMembers.length === 0 ? (
            <p className="text-xs text-surface-500 italic">No project members yet.</p>
          ) : (
            <div className="space-y-2">
              {localMembers.map((pm) => {
                const wsMember = members.find(m => m.id === pm.userId);
                return (
                  <div key={pm.userId} className="flex items-center gap-2 p-2 rounded-lg bg-surface-800/50 border border-surface-700/50">
                    <span className="text-xs text-surface-200 flex-1">{wsMember?.name || pm.userId}</span>
                    <select
                      value={pm.role}
                      disabled={!canManage}
                      onChange={(e) => handleChangeRole(pm.userId, e.target.value as ProjectMemberRole)}
                      className="text-[11px] bg-surface-700 text-surface-200 rounded px-2 py-1 border border-surface-600"
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {canManage && !pm.isProjectManager && (
                      <button
                        onClick={() => handleRemoveMember(pm.userId)}
                        className="text-surface-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invite by Email */}
        {canManage && (
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-surface-400" />
            <input
              type="email"
              placeholder="Invite by email..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 text-xs bg-surface-800 text-surface-200 rounded px-3 py-1.5 border border-surface-700 focus:border-brand-500 focus:outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ProjectMemberRole)}
              className="text-[11px] bg-surface-700 text-surface-200 rounded px-2 py-1 border border-surface-600"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabled={loading || !inviteEmail.trim()}
              onClick={handleInvite}
            >
              Add
            </Button>
          </div>
        )}

        {/* Teams */}
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
          <Button type="button" size="sm" disabled={!canManage || !isDirty} onClick={handleSave} leftIcon={<Save size={14} />}>
            Save Members
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

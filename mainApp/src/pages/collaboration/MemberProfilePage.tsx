import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, Flame, CheckCircle2, GitBranch,
  Activity, ArrowLeft, Edit3, Save
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { MemberRole, MemberStatus } from '../../types/collaboration';
import { activityActionLabel, activityDetail } from '../../lib/collaborationActivity';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';

export function MemberProfilePage() {
  const { workspaceId, memberId } = useParams<{ workspaceId: string; memberId: string }>();
  const navigate = useNavigate();
  const { members, tasks, activities, sprints, activeWorkspaceId, updateMemberRole } = useCollaborationStore();

  // IES-P2-08: no fabricated fallback member — a missing id is a real not-found state.
  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId),
    [members, memberId]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MemberRole>(selectedMember?.role ?? 'Developer');

  // Computed telemetry
  const assignedTasks = useMemo(() => (selectedMember ? tasks.filter((t) => t.assigneeId === selectedMember.id) : []), [tasks, selectedMember]);
  const completedTasks = useMemo(() => assignedTasks.filter((t) => t.sprintStatus === 'done'), [assignedTasks]);
  const memberActivities = useMemo(() => (selectedMember ? activities.filter((a) => a.actor.id === selectedMember.id) : []), [activities, selectedMember]);

  const activeSprint = sprints.find((s) => s.status === 'active');
  const focusLabel = typeof selectedMember?.currentFocusTimeMs === 'number' && selectedMember.currentFocusTimeMs > 0
    ? `${Math.floor(selectedMember.currentFocusTimeMs / 3600000)}h ${Math.floor((selectedMember.currentFocusTimeMs % 3600000) / 60000)}m`
    : '—';

  const statusToneMap: Record<MemberStatus, BadgeTone> = {
    in_focus: 'warning',
    available: 'success',
    in_meeting: 'brand',
    away: 'warning',
    offline: 'neutral',
  };

  const handleSaveRole = () => {
    if (!selectedMember) return;
    updateMemberRole(selectedMember.id, selectedRole);
    setIsEditing(false);
  };

  if (!selectedMember) {
    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${workspaceId || activeWorkspaceId}/members`)}
          className="text-surface-400 hover:text-surface-100" leftIcon={<ArrowLeft size={14} />}>
          Back to Member Roster
        </Button>
        <Card className="p-12 text-center space-y-3">
          <h1 className="font-display font-extrabold text-surface-100 text-lg">Member not found</h1>
          <p className="text-xs text-surface-400">This member does not exist in the active workspace.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      
      {/* Back link */}
      <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${workspaceId || activeWorkspaceId}/members`)}
        className="text-surface-400 hover:text-surface-100" leftIcon={<ArrowLeft size={14} />}>
        Back to Member Roster
      </Button>

      {/* Header Profile Card */}
      <Card className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-xl">
                {selectedMember.name.charAt(0)}
              </div>
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-900 ${
                selectedMember.status === 'in_focus' ? 'bg-amber-400 animate-pulse' : selectedMember.status === 'available' ? 'bg-emerald-400' : 'bg-surface-600'
              }`} />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-extrabold text-surface-50">{selectedMember.name}</h1>
                <Badge tone={statusToneMap[selectedMember.status]} className="text-[10px] font-extrabold uppercase tracking-wider">
                  {selectedMember.status.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-xs text-surface-400 mt-1">{selectedMember.email} · Joined {selectedMember.joinedAt}</p>
              
              {/* Teams Pills */}
              <div className="flex items-center gap-1.5 mt-2">
                {selectedMember.teams.map((t) => (
                  <Badge key={t} tone="brand" className="text-[10px] font-bold">
                    Team: {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Role & Edit Controls */}
          <div className="flex items-center gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <Select aria-label="Role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as MemberRole)}
                    className="bg-surface-850 border-surface-700 text-xs text-surface-50 rounded-xl px-3 py-2">
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Developer">Developer</option>
                    <option value="Viewer">Viewer</option>
                  </Select>
                </div>
                <Button onClick={handleSaveRole} size="sm" leftIcon={<Save size={13} />}>Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 rounded-xl bg-surface-850 border border-surface-750 text-xs font-bold text-surface-200 flex items-center gap-1.5">
                  <Shield size={14} className="text-brand-400" /> Role: {selectedMember.role}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setIsEditing(true)} aria-label="Edit role"
                  className="bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white">
                  <Edit3 size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Telemetry Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-surface-800">
          <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800">
            <span className="text-xs text-surface-400 font-semibold">Today's Focus Time</span>
            <p className="text-xl font-display font-extrabold text-amber-400 mt-1 flex items-center gap-1.5">
              <Flame size={18} /> {focusLabel}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800">
            <span className="text-xs text-surface-400 font-semibold">Assigned Features</span>
            <p className="text-xl font-display font-extrabold text-cyan-400 mt-1">{assignedTasks.length} Features</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800">
            <span className="text-xs text-surface-400 font-semibold">Completed Features</span>
            <p className="text-xl font-display font-extrabold text-emerald-400 mt-1">{completedTasks.length} Done</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800">
            <span className="text-xs text-surface-400 font-semibold">Current Sprint</span>
            <p className="text-xl font-display font-extrabold text-purple-400 mt-1">{activeSprint?.name || '—'}</p>
          </div>
        </div>
      </Card>

      {/* Grid Details: Assigned Features vs Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Assigned Features */}
        <Card className="p-6 space-y-4">
          <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
            <CheckCircle2 size={18} className="text-brand-400" /> Assigned Features & Tasks
          </h3>
          <div className="space-y-3">
            {assignedTasks.map((t) => (
              <div key={t.id} className="p-4 rounded-2xl bg-surface-850 border border-surface-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-surface-100">{t.title}</span>
                  <Badge tone="brand" className="text-[10px] uppercase font-bold">
                    {t.sprintStatus.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-surface-400">{t.description}</p>
                {t.gitContext?.branch && (
                  <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <GitBranch size={10} /> {t.gitContext.branch}
                  </p>
                )}
              </div>
            ))}
            {assignedTasks.length === 0 && (
              <div className="p-4 rounded-xl bg-surface-850 text-xs text-surface-400 italic text-center">
                No assigned features yet.
              </div>
            )}
          </div>
        </Card>

        {/* Member Activity Timeline */}
        <Card className="p-6 space-y-4">
          <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
            <Activity size={18} className="text-pink-400" /> Activity Timeline
          </h3>
          <div className="space-y-3">
            {memberActivities.length > 0 ? (
              memberActivities.map((act) => (
                <div key={act.id} className="p-3 rounded-xl bg-surface-850 border border-surface-800 text-xs space-y-1">
                  <p className="font-semibold text-surface-200">{activityActionLabel(act.action)}</p>
                  <p className="text-surface-400">{activityDetail(act)}</p>
                  <p className="text-[10px] text-surface-500 font-mono">{new Date(act.timestamp).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-surface-850 text-xs text-surface-400 italic text-center">
                No recent public activity recorded today.
              </div>
            )}
          </div>
        </Card>

      </div>

    </div>
  );
}

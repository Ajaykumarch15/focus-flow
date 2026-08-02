import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, Flame, CheckCircle2, GitBranch,
  Activity, ArrowLeft, Edit3, Save
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { MemberRole } from '../../types/collaboration';

export function MemberProfilePage() {
  const { workspaceId, memberId } = useParams<{ workspaceId: string; memberId: string }>();
  const navigate = useNavigate();
  const { members, tasks, activities, updateMemberRole } = useCollaborationStore();

  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) || members[0],
    [members, memberId]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MemberRole>(selectedMember.role);

  // Computed telemetry
  const assignedTasks = useMemo(() => tasks.filter((t) => t.assigneeId === selectedMember.id), [tasks, selectedMember.id]);
  const completedTasks = useMemo(() => assignedTasks.filter((t) => t.sprintStatus === 'done'), [assignedTasks]);
  const memberActivities = useMemo(() => activities.filter((a) => a.actor.id === selectedMember.id), [activities, selectedMember.id]);

  const statusColorMap = {
    in_focus: 'bg-amber-400 text-amber-950',
    available: 'bg-emerald-400 text-emerald-950',
    in_meeting: 'bg-purple-400 text-purple-950',
    away: 'bg-yellow-400 text-yellow-950',
    offline: 'bg-surface-500 text-surface-950',
  };

  const handleSaveRole = () => {
    updateMemberRole(selectedMember.id, selectedRole);
    setIsEditing(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      
      {/* Back link */}
      <button onClick={() => navigate(`/w/${workspaceId || 'ws-acme-dev'}/members`)}
        className="flex items-center gap-2 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors">
        <ArrowLeft size={14} /> Back to Member Roster
      </button>

      {/* Header Profile Card */}
      <div className="rounded-3xl border border-surface-800 bg-surface-900 p-6 lg:p-8 space-y-6">
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
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${statusColorMap[selectedMember.status]}`}>
                  {selectedMember.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-surface-400 mt-1">{selectedMember.email} · Joined {selectedMember.joinedAt}</p>
              
              {/* Teams Pills */}
              <div className="flex items-center gap-1.5 mt-2">
                {selectedMember.teams.map((t) => (
                  <span key={t} className="text-[10px] font-bold bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded-md border border-brand-500/20">
                    Team: {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Role & Edit Controls */}
          <div className="flex items-center gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <select aria-label="Role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as MemberRole)}
                  className="bg-surface-850 border border-surface-700 text-xs text-surface-50 rounded-xl px-3 py-2 outline-none">
                  <option value="Owner">Owner</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Developer">Developer</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button onClick={handleSaveRole} className="btn-primary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
                  <Save size={13} /> Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 rounded-xl bg-surface-850 border border-surface-750 text-xs font-bold text-surface-200 flex items-center gap-1.5">
                  <Shield size={14} className="text-brand-400" /> Role: {selectedMember.role}
                </div>
                <button onClick={() => setIsEditing(true)} aria-label="Edit role" className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors">
                  <Edit3 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Telemetry Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-surface-800">
          <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800">
            <span className="text-xs text-surface-400 font-semibold">Today's Focus Time</span>
            <p className="text-xl font-display font-extrabold text-amber-400 mt-1 flex items-center gap-1.5">
              <Flame size={18} /> 4h 12m
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
            <p className="text-xl font-display font-extrabold text-purple-400 mt-1">Sprint 24</p>
          </div>
        </div>
      </div>

      {/* Grid Details: Assigned Features vs Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Assigned Features */}
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-6 space-y-4">
          <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
            <CheckCircle2 size={18} className="text-brand-400" /> Assigned Features & Tasks
          </h3>
          <div className="space-y-3">
            {assignedTasks.map((t) => (
              <div key={t.id} className="p-4 rounded-2xl bg-surface-850 border border-surface-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-surface-100">{t.title}</span>
                  <span className="text-[10px] uppercase font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                    {t.sprintStatus.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-surface-400">{t.description}</p>
                {t.gitContext?.branch && (
                  <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <GitBranch size={10} /> {t.gitContext.branch}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Member Activity Timeline */}
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-6 space-y-4">
          <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
            <Activity size={18} className="text-pink-400" /> Activity Timeline
          </h3>
          <div className="space-y-3">
            {memberActivities.length > 0 ? (
              memberActivities.map((act) => (
                <div key={act.id} className="p-3 rounded-xl bg-surface-850 border border-surface-800 text-xs space-y-1">
                  <p className="font-semibold text-surface-200">{act.title}</p>
                  <p className="text-surface-400">{act.detail}</p>
                  <p className="text-[10px] text-surface-500 font-mono">{new Date(act.timestamp).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-surface-850 text-xs text-surface-400 italic text-center">
                No recent public activity recorded today.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

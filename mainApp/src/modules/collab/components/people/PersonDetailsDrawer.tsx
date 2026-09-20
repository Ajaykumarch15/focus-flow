import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Shield, CheckCircle2, Zap, FolderOpen,
  Mail, Calendar, ExternalLink, UsersRound, ChevronDown,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { api } from '@shared/utils/api';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import { toast } from '@shared/services/useToastStore';
import type { PersonStats } from './types';
import type { MemberStatus, MemberRole } from '@collab/types/collaboration';
import { getRoleDisplayName } from '@collab/utils/roleDisplay';

const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  available: 'success',
  in_focus: 'warning',
  in_meeting: 'brand',
  away: 'warning',
  offline: 'neutral',
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  available: 'Active',
  in_focus: 'In Focus',
  in_meeting: 'In Meeting',
  away: 'Away',
  offline: 'Offline',
};

interface PersonDetailsDrawerProps {
  stats: PersonStats | null;
  open: boolean;
  onClose: () => void;
}

export function PersonDetailsDrawer({ stats, open, onClose }: PersonDetailsDrawerProps) {
  const { tasks, teams, activeWorkspaceId, loadTeams, updateMemberRole } = useCollaborationStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [addingToTeam, setAddingToTeam] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  const isSuperAdmin = (user?.roleId?.level ?? 0) === 100;
  const isAdmin = (user?.roleId?.level ?? 0) >= 60;
  const isTargetSuperAdmin = stats?.member.role === 'superadmin';
  const isTargetSelf = stats?.member.id === user?._id;

  const canChangeRole = (isSuperAdmin || isAdmin) && !isTargetSelf && stats?.member.id;

  const recentTasks = useMemo(() => {
    if (!stats) return [];
    return tasks
      .filter((t) => t.assigneeIds?.includes(stats.member.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [stats, tasks]);

  const availableTeams = useMemo(() => {
    if (!stats) return [];
    return teams.filter((t) => !t.memberIds.includes(stats.member.id));
  }, [stats, teams]);

  const handleAddToTeam = async (teamId: string) => {
    if (!stats) return;
    setAddingToTeam(true);
    try {
      await api.teams.addMember(teamId, stats.member.id);
      toast.success('Added to team', `${stats.member.name} has been added to the team`);
      if (activeWorkspaceId) loadTeams();
      setShowTeamDropdown(false);
    } catch {
      toast.error('Error', 'Failed to add to team');
    } finally {
      setAddingToTeam(false);
    }
  };

  const handleRoleChange = async (newRole: MemberRole) => {
    if (!stats) return;
    setUpdatingRole(true);
    try {
      await updateMemberRole(stats.member.id, newRole);
      toast.success('Role updated', `${stats.member.name} is now ${newRole}`);
      setEditingRole(false);
    } catch {
      toast.error('Error', 'Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const availableRoles: MemberRole[] = isSuperAdmin
    ? ['nonadmin', 'admin', 'superadmin']
    : ['nonadmin', 'admin'];

  return (
    <AnimatePresence>
      {open && stats && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-surface-900 border-l border-surface-800 shadow-xl overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close profile"
              className="absolute top-4 right-4 z-10 rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-50"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="p-6 pb-0 space-y-4">
              <div className="flex items-start gap-4">
                <Avatar src={stats.member.avatar} name={stats.member.name} size="xl" />
                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="text-lg font-display font-extrabold text-surface-50 truncate">
                    {stats.member.name}
                  </h2>
                  <p className="text-xs text-surface-400 mt-0.5">{getRoleDisplayName(stats.member.role)}</p>
                  {stats.member.teams.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {stats.member.teams.map((t) => (
                        <Badge key={t} tone="brand" className="text-[10px] font-bold">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[stats.member.status]} className="text-[10px] font-extrabold uppercase tracking-wider">
                  {STATUS_LABEL[stats.member.status]}
                </Badge>
                {canChangeRole && !isTargetSuperAdmin ? (
                  <div className="relative">
                    <button
                      onClick={() => setEditingRole(!editingRole)}
                      disabled={updatingRole}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-800 border border-surface-700 text-[10px] font-bold uppercase tracking-wider text-surface-300 hover:border-brand-500/50 hover:text-brand-400 transition-colors disabled:opacity-50"
                    >
                      <Shield size={10} />
                      {updatingRole ? '...' : getRoleDisplayName(stats.member.role)}
                      <ChevronDown size={10} />
                    </button>
                    {editingRole && (
                      <div className="absolute top-full left-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-lg overflow-hidden z-20 min-w-[120px]">
                        {availableRoles.map((role) => (
                          <button
                            key={role}
                            onClick={() => handleRoleChange(role)}
                            disabled={role === stats.member.role}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors text-left ${
                              role === stats.member.role
                                ? 'text-brand-400 bg-brand-500/10 cursor-default'
                                : 'text-surface-300 hover:bg-surface-700 hover:text-surface-100'
                            }`}
                          >
                            <Shield size={10} />
                            {getRoleDisplayName(role)}
                            {role === stats.member.role && <span className="ml-auto text-[9px]">current</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Badge tone="neutral" className="text-[10px] font-bold uppercase tracking-wider">
                    <Shield size={10} className="mr-0.5" />
                    {getRoleDisplayName(stats.member.role)}
                  </Badge>
                )}
              </div>

              {/* Contact */}
              <div className="flex items-center gap-4 text-xs text-surface-400">
                <span className="flex items-center gap-1.5">
                  <Mail size={12} />
                  {stats.member.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  Joined {stats.member.joinedAt}
                </span>
              </div>
            </div>

            {/* Statistics */}
            <div className="p-6 space-y-4">
              <h3 className="font-display font-bold text-surface-50 text-sm">Statistics</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-850 border border-surface-800">
                  <FolderOpen size={14} className="text-info-400" />
                  <span className="text-lg font-display font-extrabold text-surface-50">
                    {stats.projectCount}
                  </span>
                  <span className="text-[9px] font-semibold text-surface-400 uppercase tracking-wider">
                    Projects
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-850 border border-surface-800">
                  <CheckCircle2 size={14} className="text-success-400" />
                  <span className="text-lg font-display font-extrabold text-surface-50">
                    {stats.completedTasks}
                  </span>
                  <span className="text-[9px] font-semibold text-surface-400 uppercase tracking-wider">
                    Done
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-850 border border-surface-800">
                  <Zap size={14} className="text-brand-400" />
                  <span className="text-lg font-display font-extrabold text-surface-50">
                    {stats.activeTasks}
                  </span>
                  <span className="text-[9px] font-semibold text-surface-400 uppercase tracking-wider">
                    Active
                  </span>
                </div>
              </div>

              {/* Productivity bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                    Productivity
                  </span>
                  <span className="text-xs font-bold text-surface-200">{stats.productivity}%</span>
                </div>
                <Progress value={stats.productivity} tone="brand" className="h-1.5" />
              </div>
            </div>

            {/* Current Projects */}
            <div className="px-6 pb-4 space-y-3">
              <h3 className="font-display font-bold text-surface-50 text-sm">Projects</h3>
              <div className="space-y-2">
                {stats.projects.length === 0 ? (
                  <p className="text-xs text-surface-400 italic">No projects assigned</p>
                ) : (
                  stats.projects.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-850 border border-surface-800"
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                        <FolderOpen size={14} className="text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-surface-100 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Progress value={p.progress} tone="brand" className="h-1 flex-1" />
                          <span className="text-[10px] font-mono text-surface-400">{p.progress}%</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Tasks */}
            <div className="px-6 pb-6 space-y-3">
              <h3 className="font-display font-bold text-surface-50 text-sm">Recent Tasks</h3>
              <div className="space-y-2">
                {recentTasks.length === 0 ? (
                  <p className="text-xs text-surface-400 italic">No tasks assigned</p>
                ) : (
                  recentTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-850 border border-surface-800"
                    >
                      <span className="text-xs font-semibold text-surface-200 truncate flex-1 mr-2">
                        {t.title}
                      </span>
                      <Badge
                        tone={
                          t.sprintStatus === 'done'
                            ? 'success'
                            : t.sprintStatus === 'in_progress'
                              ? 'brand'
                              : t.sprintStatus === 'review'
                                ? 'info'
                                : 'neutral'
                        }
                        className="text-[9px] font-bold uppercase shrink-0"
                      >
                        {t.sprintStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 space-y-2">
              {/* Add to Team */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                  disabled={availableTeams.length === 0 || addingToTeam}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-purple-500/10 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UsersRound size={13} />
                  {addingToTeam ? 'Adding...' : 'Add to Team'}
                  {availableTeams.length > 0 && <ChevronDown size={12} className={`transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />}
                </button>
                {showTeamDropdown && availableTeams.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-800 border border-surface-700 rounded-xl shadow-lg overflow-hidden z-10">
                    {availableTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleAddToTeam(t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-200 hover:bg-surface-700 transition-colors text-left"
                      >
                        <UsersRound size={12} className="text-purple-400" />
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (stats?.member.id && activeWorkspaceId) {
                      navigate(`/collab/${activeWorkspaceId}/chat`);
                      onClose();
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-brand-500/10 text-brand-400 text-xs font-semibold hover:bg-brand-500/20 transition-colors"
                >
                  <Mail size={13} />
                  Message
                </button>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-surface-850 border border-surface-800 text-surface-300 text-xs font-semibold hover:bg-surface-800 hover:text-surface-100 transition-colors"
                >
                  <ExternalLink size={13} />
                  View Profile
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

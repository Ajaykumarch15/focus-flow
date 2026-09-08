import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Crown, Mail } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { getRoleDisplayName } from '@collab/utils/roleDisplay';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

export function TeamDetailPage() {
  const { workspaceId, teamId } = useParams<{ workspaceId: string; teamId: string }>();
  const navigate = useNavigate();
  const { teams, members, projects, tasks } = useCollaborationStore();

  const team = useMemo(() => teams.find((t) => t.id === teamId), [teams, teamId]);

  const teamMembers = useMemo(() => {
    if (!team) return [];
    return members.filter((m) => team.memberIds.includes(m.id));
  }, [team, members]);

  const leader = useMemo(() => {
    if (!team?.leaderId) return null;
    return teamMembers.find((m) => m.id === team.leaderId) || null;
  }, [team, teamMembers]);

  const teamProjects = useMemo(() => {
    if (!team) return [];
    return projects.filter((p) => p.teamIds.includes(team.id));
  }, [team, projects]);

  const teamStats = useMemo(() => {
    const memberIds = new Set(teamMembers.map((m) => m.id));
    const teamTasks = tasks.filter((t) => t.assigneeIds?.some((id) => memberIds.has(id)));
    const doneTasks = teamTasks.filter((t) => t.sprintStatus === 'done').length;
    const activeTasks = teamTasks.filter(
      (t) => t.sprintStatus === 'in_progress' || t.sprintStatus === 'review',
    ).length;
    return { totalTasks: teamTasks.length, doneTasks, activeTasks, projectCount: teamProjects.length };
  }, [teamMembers, tasks, teamProjects]);

  if (!team) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Users size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Team not found</h1>
          <p className="text-sm text-surface-400">This team does not exist.</p>
          <Button onClick={() => navigate(`/collab/${workspaceId}/people`)} leftIcon={<ArrowLeft size={14} />}>
            Back to People
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(`/collab/${workspaceId}/people`)}
            className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800"
          >
            <ArrowLeft size={14} /> People
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Users size={16} className="text-purple-400" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">{team.name}</h1>
              {team.description && (
                <p className="text-[10px] text-surface-400 font-medium mt-0.5">{team.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Team Info Card */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <Users size={28} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-display font-extrabold text-surface-50 tracking-tight">{team.name}</h2>
                {team.description && <p className="text-sm text-surface-400 mt-0.5">{team.description}</p>}
                {leader && (
                  <p className="text-xs text-yellow-400/80 flex items-center gap-1 mt-1">
                    <Crown size={12} /> Team Lead: {leader.name}
                  </p>
                )}
              </div>
            </div>
            <Badge tone="info" className="text-[10px] font-extrabold uppercase tracking-wider">
              {teamMembers.length} members
            </Badge>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div variants={fadeUp} className="card p-5 text-center">
            <p className="text-2xl font-display font-extrabold text-surface-50">{teamStats.projectCount}</p>
            <p className="text-xs text-surface-400 mt-1">Projects</p>
          </motion.div>
          <motion.div variants={fadeUp} className="card p-5 text-center">
            <p className="text-2xl font-display font-extrabold text-surface-50">{teamStats.totalTasks}</p>
            <p className="text-xs text-surface-400 mt-1">Total Tasks</p>
          </motion.div>
          <motion.div variants={fadeUp} className="card p-5 text-center">
            <p className="text-2xl font-display font-extrabold text-success-400">{teamStats.doneTasks}</p>
            <p className="text-xs text-surface-400 mt-1">Done</p>
          </motion.div>
          <motion.div variants={fadeUp} className="card p-5 text-center">
            <p className="text-2xl font-display font-extrabold text-brand-400">{teamStats.activeTasks}</p>
            <p className="text-xs text-surface-400 mt-1">Active</p>
          </motion.div>
        </motion.div>

        {/* Members List */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="card p-6">
          <h3 className="font-display font-bold text-surface-50 text-base mb-4">Team Members</h3>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-surface-400 italic">No members in this team yet.</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-850 hover:bg-surface-800 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center text-sm font-bold text-surface-300">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-surface-100">{m.name}</p>
                      {leader?.id === m.id && (
                        <Badge tone="warning" className="text-[9px] font-extrabold uppercase px-1.5 py-0">
                          <Crown size={9} className="mr-0.5" /> Lead
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-surface-500 flex items-center gap-1">
                      <Mail size={10} /> {m.email}
                    </p>
                  </div>
                  <Badge tone="neutral" className="text-[10px]">{getRoleDisplayName(m.role)}</Badge>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Projects */}
        {teamProjects.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="card p-6">
            <h3 className="font-display font-bold text-surface-50 text-base mb-4">Assigned Projects</h3>
            <div className="space-y-2">
              {teamProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/collab/${workspaceId}/team/${p.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-850 hover:bg-surface-800 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-sm font-bold text-brand-400">
                    {p.key}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-100 truncate">{p.name}</p>
                    <p className="text-[11px] text-surface-500 capitalize">{p.status.replace('_', ' ')}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

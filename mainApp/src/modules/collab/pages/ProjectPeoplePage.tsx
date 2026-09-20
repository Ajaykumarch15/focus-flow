import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Users, ChevronDown, UserPlus, UsersRound, Crown, ChevronRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useWorkspacePath } from '@collab/hooks/useWorkspacePath';
import { cn } from '@shared/utils/cn';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NoWorkspaceMembers, NoSearchResults, NoUsersFound } from '@shared/components/illustrations';
import { PersonCard } from '@collab/components/people/PersonCard';
import { PersonDetailsDrawer } from '@collab/components/people/PersonDetailsDrawer';
import { InvitePeopleModal } from '@collab/components/people/InvitePeopleModal';
import { AddProjectMembersModal } from '@collab/components/projects/AddProjectMembersModal';
import type { PersonStats } from '@collab/components/people/types';

const fadeUp = { hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'admin', label: 'Admin' },
  { value: 'nonadmin', label: 'Nonadmin' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'productivity', label: 'Most Active' },
  { value: 'projects', label: 'Projects' },
];

type ViewMode = 'teams' | 'all';

export function ProjectPeoplePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const workspaceId = useWorkspaceId();
  const wsPath = useWorkspacePath();
  const navigate = useNavigate();
  const { members, projects, tasks, teams } = useCollaborationStore();
  const { user } = useAuthStore();
  const isAdmin = (user?.roleId?.level ?? 0) >= 60;
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<ViewMode>('teams');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedStats, setSelectedStats] = useState<PersonStats | null>(null);

  useEffect(() => {
    if (!workspaceId || !projectId) return;
    useCollaborationStore.getState().loadWorkspaces().then(() => {
      const { workspaces, activeWorkspaceId } = useCollaborationStore.getState();
      const ws = workspaces.find((w) => w.id === activeWorkspaceId || w.slug === activeWorkspaceId);
      const resolvedId = ws?.id ?? workspaceId;
      const store = useCollaborationStore.getState();
      store.loadMembers(resolvedId);
      store.loadProjects(resolvedId);
      store.loadTasks(resolvedId, projectId);
      store.loadTeams();
    });
  }, [workspaceId, projectId]);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const projectMemberIds = useMemo(
    () => new Set(project?.members.map((m) => m.userId) ?? []),
    [project],
  );

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === projectId),
    [tasks, projectId],
  );

  const allStats = useMemo<PersonStats[]>(() => {
    return members
      .filter((m) => projectMemberIds.has(m.id))
      .map((member) => {
        const memberProjects = projects.filter((p) => p.members.some((m) => m.userId === member.id));
        const assignedTasks = projectTasks.filter((t) => t.assigneeIds?.includes(member.id));
        const completedTasks = assignedTasks.filter((t) => t.sprintStatus === 'done').length;
        const activeTasks = assignedTasks.filter(
          (t) => t.sprintStatus === 'in_progress' || t.sprintStatus === 'review',
        ).length;
        const total = completedTasks + activeTasks;
        const productivity = total > 0 ? Math.round((completedTasks / total) * 100) : 0;

        return {
          member,
          projectCount: memberProjects.length,
          completedTasks,
          activeTasks,
          productivity,
          projects: memberProjects.map((p) => ({
            id: p.id,
            name: p.name,
            progress: p.members.length > 0
              ? Math.round(
                  (tasks.filter((t) => t.projectId === p.id && t.sprintStatus === 'done').length /
                    Math.max(1, tasks.filter((t) => t.projectId === p.id).length)) *
                    100,
                )
              : 0,
          })),
        };
      });
  }, [members, projects, tasks, projectTasks, projectMemberIds]);

  // Teams that have members in this project
  const projectTeams = useMemo(() => {
    return teams.filter((team) =>
      team.memberIds.some((id) => projectMemberIds.has(id)),
    );
  }, [teams, projectMemberIds]);

  // Members who don't belong to any team
  const nonTeamStats = useMemo(() => {
    const teamMemberIds = new Set(
      projectTeams.flatMap((t) => t.memberIds),
    );
    return allStats.filter((s) => !teamMemberIds.has(s.member.id));
  }, [allStats, projectTeams]);

  const filteredStats = useMemo(() => {
    let result = allStats;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.member.name.toLowerCase().includes(q) ||
          s.member.email.toLowerCase().includes(q) ||
          s.member.role.toLowerCase().includes(q),
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter((s) => s.member.role === roleFilter);
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.member.name.localeCompare(b.member.name);
      if (sortBy === 'productivity') return b.productivity - a.productivity;
      if (sortBy === 'projects') return b.projectCount - a.projectCount;
      return 0;
    });

    return result;
  }, [allStats, searchQuery, roleFilter, sortBy]);

  const filteredTeams = useMemo(() => {
    if (!searchQuery) return projectTeams;
    const q = searchQuery.toLowerCase();
    return projectTeams.filter((t) => t.name.toLowerCase().includes(q));
  }, [projectTeams, searchQuery]);

  const filteredNonTeamStats = useMemo(() => {
    if (!searchQuery) return nonTeamStats;
    const q = searchQuery.toLowerCase();
    return nonTeamStats.filter(
      (s) =>
        s.member.name.toLowerCase().includes(q) ||
        s.member.email.toLowerCase().includes(q),
    );
  }, [nonTeamStats, searchQuery]);

  const handleCardClick = useCallback((stats: PersonStats) => {
    setSelectedStats(stats);
  }, []);

  const isFiltering = searchQuery || roleFilter !== 'all';

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-brand-500/10">
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover dark:hidden" />
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover hidden dark:block" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">
                {project?.name || 'Project'} — People
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-xs">
              <Users size={12} className="text-sky-400" />
              <span className="text-surface-300 font-medium">{allStats.length} members</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div className="space-y-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <h2 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">
                People
              </h2>
              <p className="text-sm text-surface-400 mt-0.5">
                Team members assigned to this project.
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setShowAddMembersModal(true)} leftIcon={<UserPlus size={16} />}>
                  Add Members
                </Button>
                <Button onClick={() => setShowInviteModal(true)} leftIcon={<Plus size={16} />}>
                  Invite People
                </Button>
              </div>
            )}
          </motion.div>

          {/* Filter Bar with View Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
          >
            {/* View Toggle */}
            <div className="flex gap-1 rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
              {(['teams', 'all'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewMode === mode
                      ? 'bg-white text-surface-800 shadow dark:bg-surface-700 dark:text-surface-100'
                      : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300',
                  )}
                >
                  {mode === 'teams' ? (
                    <UsersRound size={13} />
                  ) : (
                    <Users size={13} />
                  )}
                  {mode === 'teams' ? 'Teams' : 'All Members'}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-sm w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
              <input
                type="text"
                placeholder={viewMode === 'teams' ? 'Search teams...' : 'Search people...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-50 outline-none transition-colors placeholder:text-surface-500"
              />
            </div>

            {viewMode === 'all' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        Sort: {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                </div>
              </div>
            )}
          </motion.div>

          {isFiltering && (
            <p className="text-xs text-surface-400">
              {viewMode === 'teams'
                ? `Showing ${filteredTeams.length} of ${projectTeams.length} teams`
                : `Showing ${filteredStats.length} of ${allStats.length} members`}
            </p>
          )}

          {/* Teams View */}
          {viewMode === 'teams' && (
            <>
              {projectTeams.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
                >
                  <EmptyState
                    illustration={<NoWorkspaceMembers />}
                    title="No teams yet"
                    description="Create teams to organize project members into groups."
                  />
                </motion.div>
              ) : (
                <>
                  {/* Teams Grid */}
                  {filteredTeams.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-display font-bold text-surface-200">
                          Teams
                        </h3>
                        <span className="text-[11px] text-surface-500">
                          {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
                      >
                        {filteredTeams.map((team) => {
                          const teamMemberCount = team.memberIds.filter((id) => projectMemberIds.has(id)).length;
                          return (
                            <motion.button
                              key={team.id}
                              variants={fadeUp}
                              type="button"
                              onClick={() => navigate(wsPath('teams', team.id))}
                              className="card card-hover accent-border p-4 text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
                            >
                              <div className="flex items-center gap-2.5 mb-2">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: `${team.color}15` }}
                                >
                                  <UsersRound size={14} style={{ color: team.color }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-surface-100 truncate">
                                    {team.name}
                                  </p>
                                  <p className="text-[10px] text-surface-500">
                                    {teamMemberCount} member{teamMemberCount !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                {team.leaderId && (
                                  <Crown size={12} className="text-yellow-400 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 group-hover:text-purple-300 transition-colors">
                                View Team <ChevronRight size={10} />
                              </div>
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    </motion.div>
                  )}

                  {/* Non-Team Members */}
                  {filteredNonTeamStats.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.15 }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-display font-bold text-surface-200">
                          Other Members
                        </h3>
                        <span className="text-[11px] text-surface-500">
                          {filteredNonTeamStats.length} member{filteredNonTeamStats.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
                      >
                        {filteredNonTeamStats.map((stat) => (
                          <PersonCard
                            key={stat.member.id}
                            stats={stat}
                            onClick={() => handleCardClick(stat)}
                          />
                        ))}
                      </motion.div>
                    </motion.div>
                  )}

                  {filteredTeams.length === 0 && filteredNonTeamStats.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
                    >
                      <EmptyState
                        illustration={<NoSearchResults />}
                        title="No results found"
                        description="Try adjusting your search."
                      />
                    </motion.div>
                  )}
                </>
              )}
            </>
          )}

          {/* All Members View */}
          {viewMode === 'all' && (
            <>
              {allStats.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
                >
                  <EmptyState
                    illustration={<NoWorkspaceMembers />}
                    title="No team members yet"
                    description="No members are assigned to this project."
                  />
                </motion.div>
              ) : filteredStats.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
                >
                  <EmptyState
                    illustration={<NoUsersFound />}
                    title="No people found"
                    description="Try adjusting your search or filters."
                  />
                </motion.div>
              ) : (
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
                >
                  {filteredStats.map((stat) => (
                    <PersonCard
                      key={stat.member.id}
                      stats={stat}
                      onClick={() => handleCardClick(stat)}
                    />
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>

      <PersonDetailsDrawer
        stats={selectedStats}
        open={selectedStats !== null}
        onClose={() => setSelectedStats(null)}
      />

      <InvitePeopleModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      <AddProjectMembersModal
        open={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        projectId={projectId!}
      />
    </div>
  );
}

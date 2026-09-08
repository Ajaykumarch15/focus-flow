import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, Users, ChevronDown, ArrowLeft, UsersRound, ChevronRight, UserPlus,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { PersonCard } from '@collab/components/people/PersonCard';
import { PersonDetailsDrawer } from '@collab/components/people/PersonDetailsDrawer';
import { InvitePeopleModal } from '@collab/components/people/InvitePeopleModal';
import { AddSystemUsersModal } from '@collab/components/people/AddSystemUsersModal';
import { PeopleStatsSidebar } from '@collab/components/people/PeopleStatsSidebar';
import { CreateTeamModal } from '@collab/components/CreateTeamModal';
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

export function PeoplePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { members, teams, projects, tasks } = useCollaborationStore();
  const { user } = useAuthStore();
  const isAdmin = (user?.roleId?.level ?? 0) >= 60;
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddSystemUsersModal, setShowAddSystemUsersModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [selectedStats, setSelectedStats] = useState<PersonStats | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const store = useCollaborationStore.getState();
    store.loadMembers(workspaceId);
    store.loadProjects(workspaceId);
    store.loadTasks(workspaceId);
    store.loadTeams();
  }, [workspaceId]);

  // Compute per-member statistics
  const allStats = useMemo<PersonStats[]>(() => {
    return members.map((member) => {
      const memberProjects = projects.filter((p) => p.members.some(m => m.userId === member.id));
      const assignedTasks = tasks.filter((t) => t.assigneeIds?.includes(member.id));
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
  }, [members, projects, tasks]);

  // Filter and sort
  const filteredStats = useMemo(() => {
    let result = allStats;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.member.name.toLowerCase().includes(q) ||
          s.member.email.toLowerCase().includes(q) ||
          s.member.role.toLowerCase().includes(q),
      );
    }

    // Team filter
    if (teamFilter !== 'all') {
      result = result.filter((s) => s.member.teams.includes(teamFilter));
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((s) => s.member.role === roleFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.member.name.localeCompare(b.member.name);
      if (sortBy === 'productivity') return b.productivity - a.productivity;
      if (sortBy === 'projects') return b.projectCount - a.projectCount;
      return 0;
    });

    return result;
  }, [allStats, searchQuery, teamFilter, roleFilter, sortBy]);

  const handleCardClick = useCallback((stats: PersonStats) => {
    setSelectedStats(stats);
  }, []);

  const isFiltering = searchQuery || teamFilter !== 'all' || roleFilter !== 'all';

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky header bar */}
      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/collab/${workspaceId}`)}
              className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800"
            >
              <ArrowLeft size={14} /> Workspace
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-brand-500/10">
                <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover dark:hidden" />
                <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover hidden dark:block" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] text-surface-400 font-medium">
                  <span>People</span>
                </div>
                <h1 className="font-display font-bold text-sm leading-none text-surface-50">People</h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-xs">
              <Users size={12} className="text-sky-400" />
              <span className="text-surface-300 font-medium">{members.length} members</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left: Main content area */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Page header */}
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
                  Manage your team and see who's working on what.
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setShowCreateTeamModal(true)} leftIcon={<UsersRound size={16} />}>
                    Create Team
                  </Button>
                  <Button variant="secondary" onClick={() => setShowAddSystemUsersModal(true)} leftIcon={<UserPlus size={16} />}>
                    Add from System
                  </Button>
                  <Button onClick={() => setShowInviteModal(true)} leftIcon={<Plus size={16} />}>
                    Invite People
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Toolbar */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
            >
              {/* Search */}
              <div className="relative flex-1 max-w-sm w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  type="text"
                  placeholder="Search people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-50 outline-none transition-colors placeholder:text-surface-500"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Team filter */}
                <div className="relative">
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
                  >
                    <option value="all">All Teams</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                </div>

                {/* Role filter */}
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

                {/* Sort */}
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
            </motion.div>

            {/* Teams Section */}
            {teams.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-display font-bold text-surface-200">Teams</h3>
                  <span className="text-[11px] text-surface-500">{teams.length} teams</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/collab/${workspaceId}/teams/${t.id}`)}
                      className="card card-hover p-4 text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <UsersRound size={14} className="text-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-surface-100 truncate">{t.name}</p>
                          <p className="text-[10px] text-surface-500">{t.memberIds.length} members</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 group-hover:text-purple-300 transition-colors">
                        View Team <ChevronRight size={10} />
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Results count */}
            {isFiltering && (
              <p className="text-xs text-surface-400">
                Showing {filteredStats.length} of {members.length} members
              </p>
            )}

            {/* Content */}
            {members.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
              >
                <EmptyState
                  icon={<Users size={40} className="text-surface-500" />}
                  title="No team members yet"
                  description="Invite your team to start collaborating."
                  action={
                    <Button onClick={() => setShowInviteModal(true)} leftIcon={<Plus size={14} />}>
                      Invite People
                    </Button>
                  }
                />
              </motion.div>
            ) : filteredStats.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
              >
                <EmptyState
                  icon={<Search size={40} className="text-surface-500" />}
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
          </div>

          {/* Right: Stats sidebar (desktop only) */}
          <div className="hidden xl:block">
            <div className="sticky top-20">
              <PeopleStatsSidebar />
            </div>
          </div>
        </div>
      </main>

      {/* Person Details Drawer */}
      <PersonDetailsDrawer
        stats={selectedStats}
        open={selectedStats !== null}
        onClose={() => setSelectedStats(null)}
      />

      {/* Invite Modal */}
      <InvitePeopleModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Create Team Modal */}
      <CreateTeamModal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
      />

      {/* Add System Users Modal */}
      <AddSystemUsersModal
        open={showAddSystemUsersModal}
        onClose={() => setShowAddSystemUsersModal(false)}
      />
    </div>
  );
}

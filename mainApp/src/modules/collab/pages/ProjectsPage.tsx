import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, LayoutGrid, List, FolderOpen,
  ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ProjectCard } from '@collab/components/projects/ProjectCard';
import { AddProjectModal } from '@collab/components/projects/AddProjectModal';
import { SAMPLE_PROJECTS, type ProjectData, mapProjectToCardData } from '@collab/components/projects/types';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useWorkspacePath } from '@collab/hooks/useWorkspacePath';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const TIMELINE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
];

function isWithinTimeline(dateStr: string, timeline: string): boolean {
  if (timeline === 'all') return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (timeline === 'this_week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  if (timeline === 'this_month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);
    return d >= monthAgo;
  }
  if (timeline === 'this_quarter') {
    const quarterAgo = new Date(now);
    quarterAgo.setMonth(now.getMonth() - 3);
    return d >= quarterAgo;
  }
  return true;
}
export function ProjectsPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const wsPath = useWorkspacePath();
  const { projects: storeProjects, activeWorkspaceId, tasks, workspaces, setActiveWorkspace } = useCollaborationStore();
  const { user } = useAuthStore();
  const isAdmin = (user?.roleId?.level ?? 0) >= 60;
  const [localProjects, setLocalProjects] = useState<ProjectData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);
  const hasAttemptedLoad = useRef(false);

  useEffect(() => {
    hasAttemptedLoad.current = false;
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId && workspaceId !== activeWorkspaceId) {
      setActiveWorkspace(workspaceId);
    }
  }, [workspaceId, activeWorkspaceId, setActiveWorkspace]);

  useEffect(() => {
    if (!workspaceId || hasAttemptedLoad.current) return;
    hasAttemptedLoad.current = true;
    // Load workspaces first so the slug resolves to a real MongoDB ID,
    // then load projects/tasks/members with the resolved ID.
    useCollaborationStore.getState().loadWorkspaces().then(() => {
      const { workspaces, activeWorkspaceId } = useCollaborationStore.getState();
      const ws = workspaces.find((w) => w.id === activeWorkspaceId || w.slug === activeWorkspaceId);
      const resolvedId = ws?.id ?? workspaceId;
      useCollaborationStore.getState().loadProjects(resolvedId);
      useCollaborationStore.getState().loadTasks(resolvedId);
      useCollaborationStore.getState().loadMembers(resolvedId);
    });
  }, [workspaceId]);

  const projects = useMemo(() => {
    const filteredByWorkspace = storeProjects.filter((p) => p.workspaceId === workspaceId);
    if (filteredByWorkspace.length > 0) {
      return filteredByWorkspace.map((p) => mapProjectToCardData(p, tasks));
    }
    return SAMPLE_PROJECTS;
  }, [storeProjects, workspaceId, tasks]);

  const displayProjects = useMemo(() => {
    return [...projects, ...localProjects];
  }, [projects, localProjects]);

  const uniqueClients = useMemo(() => {
    const clients = new Set(displayProjects.map((p) => p.client));
    return ['all', ...Array.from(clients)];
  }, [displayProjects]);

  const filteredProjects = useMemo(() => {
    return displayProjects.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesClient = clientFilter === 'all' || p.client === clientFilter;
      const matchesTimeline = isWithinTimeline(p.startDate, timelineFilter);

      return matchesSearch && matchesStatus && matchesClient && matchesTimeline;
    });
  }, [displayProjects, searchQuery, statusFilter, clientFilter, timelineFilter]);

  const handleToggleBookmark = useCallback((id: string) => {
    setLocalProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, bookmarked: !p.bookmarked } : p)),
    );
  }, []);

  const handleViewDetails = useCallback((project: ProjectData) => {
    navigate(wsPath('projects', project.id));
  }, [navigate]);

  const handleCreateProject = useCallback(() => {
    // Store handles the API call; projects will refresh from store
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky header bar */}
      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-brand-500/10">
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover dark:hidden" />
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover hidden dark:block" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">Projects</h1>
              <p className="text-[10px] text-surface-400 font-medium mt-0.5">Manage all your projects</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-surface-300 font-medium">{displayProjects.length} Projects</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
            <div>
                <h2 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">
                  {activeWorkspace ? activeWorkspace.name : 'Projects'}
                </h2>
                <p className="text-sm text-surface-400 mt-0.5">
                  {activeWorkspace ? `Manage projects in ${activeWorkspace.name}` : 'Manage all your projects in one place.'}
                </p>
              </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus size={16} />}>
                Add Project
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
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-50 outline-none transition-colors placeholder:text-surface-500"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Status: {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                aria-label="Filter by client"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
              >
                {uniqueClients.map((c) => (
                  <option key={c} value={c}>
                    Client: {c === 'all' ? 'All' : c}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                aria-label="Filter by timeline"
                value={timelineFilter}
                onChange={(e) => setTimelineFilter(e.target.value)}
                className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
              >
                {TIMELINE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Timeline: {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-surface-900 border border-surface-800 rounded-xl overflow-hidden">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300'}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300'}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Results count */}
        {(searchQuery || statusFilter !== 'all' || clientFilter !== 'all' || timelineFilter !== 'all') && (
          <p className="text-xs text-surface-400">
            Showing {filteredProjects.length} of {displayProjects.length} projects
          </p>
        )}

        {/* Content */}
        {filteredProjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60"
          >
            <EmptyState
              illustration={
                searchQuery || statusFilter !== 'all' || clientFilter !== 'all' || timelineFilter !== 'all'
                  ? undefined
                  : '/SVG/empty-projects.png'
              }
              icon={
                searchQuery || statusFilter !== 'all' || clientFilter !== 'all' || timelineFilter !== 'all'
                  ? <FolderOpen size={40} className="text-surface-500" />
                  : undefined
              }
              title={searchQuery || statusFilter !== 'all' || clientFilter !== 'all' || timelineFilter !== 'all'
                ? 'No matching projects'
                : 'No projects yet'}
              description={searchQuery || statusFilter !== 'all' || clientFilter !== 'all' || timelineFilter !== 'all'
                ? 'Try a different search term or adjust your filters.'
                : isAdmin ? 'Create your first project and start organizing your work.' : 'No projects have been created yet. Ask an admin to create one.'}
              action={
                isAdmin ? (
                  <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus size={14} />}>
                    Create Project
                  </Button>
                ) : undefined
              }
            />
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </motion.div>
        ) : (
          /* List view */
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                variants={fadeUp}
                className="group flex items-center gap-4 rounded-2xl border border-surface-800 bg-surface-900 p-4 hover:border-surface-700 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => handleViewDetails(project)}
              >
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0 font-display font-bold text-sm text-brand-400">
                  {project.iconEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display font-bold text-surface-50 text-sm group-hover:text-brand-300 transition-colors truncate">
                    {project.name}
                  </h4>
                  <p className="text-xs text-surface-400 truncate">{project.client}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  {project.type.slice(0, 2).map((t) => (
                    <Badge key={t} tone="neutral" className="text-[10px]">{t}</Badge>
                  ))}
                  <Badge tone={project.status === 'active' ? 'success' : project.status === 'in_progress' ? 'info' : project.status === 'completed' ? 'brand' : 'warning'} className="text-[10px]">
                    {project.status === 'in_progress' ? 'In Progress' : project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </Badge>
                </div>
                <div className="hidden md:flex items-center gap-2 flex-shrink-0 w-32">
                  <div className="flex-1 bg-surface-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-brand-500 h-full rounded-full" style={{ width: `${project.progress}%` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-surface-300">{project.progress}%</span>
                </div>
                <span className="text-xs text-surface-400 flex-shrink-0 hidden lg:inline">
                  {project.completedTasks}/{project.totalTasks} tasks
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Add Project Modal */}
      <AddProjectModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}

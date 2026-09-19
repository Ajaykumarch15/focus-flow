import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, LayoutGrid, List, FolderOpen,
  ArrowRight,
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

const STATUS_TABS = [
  { value: 'all', label: 'All', icon: '✦' },
  { value: 'active', label: 'Active', icon: '●' },
  { value: 'in_progress', label: 'In Progress', icon: '◐' },
  { value: 'completed', label: 'Completed', icon: '✓' },
  { value: 'on_hold', label: 'On Hold', icon: '⏸' },
];

const TIMELINE_TABS = [
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

const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  total: { bg: 'bg-brand-500/10', text: 'text-brand-400', ring: 'stroke-[var(--color-brand-400)]' },
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'stroke-[var(--color-success-400)]' },
  in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'stroke-[var(--color-warning-400)]' },
  completed: { bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'stroke-[var(--color-info-400)]' },
};

function HeroStatCard({ label, value, max, colorKey, delay }: {
  label: string; value: number; max: number; colorKey: string; delay: number;
}) {
  const c = STATUS_COLORS[colorKey];
  const pct = max > 0 ? (value / max) * 100 : 0;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative flex items-center gap-4 rounded-2xl bg-surface-900/80 dark:bg-surface-850/80 border border-surface-800/60 p-5 backdrop-blur-sm"
    >
      <div className="relative flex-shrink-0 w-14 h-14">
        <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-surface-800)" strokeWidth="4" />
          <circle
            cx="24" cy="24" r={r} fill="none" strokeWidth="4"
            className={c.ring}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-lg font-display font-bold ${c.text}`}>
          {value}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-surface-50">{label}</p>
        <p className="text-xs text-surface-400 mt-0.5">{max > 0 ? `${Math.round(pct)}% of total` : 'No data'}</p>
      </div>
    </motion.div>
  );
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

  const stats = useMemo(() => {
    const total = displayProjects.length;
    const active = displayProjects.filter((p) => p.status === 'active').length;
    const inProgress = displayProjects.filter((p) => p.status === 'in_progress').length;
    const completed = displayProjects.filter((p) => p.status === 'completed').length;
    return { total, active, inProgress, completed };
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

  const handleCreateProject = useCallback(() => {}, []);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || clientFilter !== 'all' || timelineFilter !== 'all';

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-80 h-80 bg-violet-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* ── Hero Section ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-3xl border border-surface-800/50 bg-gradient-to-br from-surface-900 via-surface-900 to-brand-500/5 p-6 sm:p-8"
        >
          {/* Hero background decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-violet-500/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left: Text */}
            <div className="flex-1 space-y-3">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Organize &amp; Deliver
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="text-2xl sm:text-3xl font-display font-extrabold text-surface-50 tracking-tight"
              >
                {activeWorkspace ? activeWorkspace.name : 'All Projects'}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-surface-400 max-w-md"
              >
                {activeWorkspace
                  ? `Manage and track all projects in ${activeWorkspace.name}. Stay organized, deliver on time.`
                  : 'Manage and track all your projects in one place. Stay organized, deliver on time.'}
              </motion.p>
            </div>

            {/* Right: SVG Illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="hidden sm:flex flex-shrink-0 w-48 h-36 items-center justify-center"
            >
              <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                {/* Browser frame */}
                <rect x="20" y="15" width="160" height="110" rx="8" fill="var(--hero-bg)" stroke="var(--hero-frame-stroke)" strokeWidth="1.5" />
                {/* Title bar */}
                <rect x="20" y="15" width="160" height="22" rx="8" fill="var(--hero-title-bar)" />
                <rect x="20" y="29" width="160" height="8" fill="var(--hero-title-bar)" />
                {/* Dots */}
                <circle cx="34" cy="26" r="3" fill="var(--hero-text-1)" opacity="0.6" />
                <circle cx="44" cy="26" r="3" fill="var(--hero-plant-1)" opacity="0.5" />
                <circle cx="54" cy="26" r="3" fill="var(--hero-book-3)" opacity="0.5" />
                {/* Content lines */}
                <rect x="32" y="50" width="60" height="4" rx="2" fill="var(--hero-text-1)" opacity="0.4" />
                <rect x="32" y="60" width="80" height="3" rx="1.5" fill="var(--hero-text-2)" opacity="0.3" />
                <rect x="32" y="68" width="50" height="3" rx="1.5" fill="var(--hero-text-2)" opacity="0.25" />
                {/* Task cards */}
                <rect x="32" y="82" width="36" height="28" rx="4" fill="var(--hero-book-1)" opacity="0.15" />
                <rect x="36" y="88" width="20" height="3" rx="1.5" fill="var(--hero-book-1)" opacity="0.4" />
                <rect x="36" y="95" width="28" height="2" rx="1" fill="var(--hero-text-2)" opacity="0.2" />
                <rect x="36" y="101" width="14" height="2" rx="1" fill="var(--hero-text-2)" opacity="0.15" />
                <rect x="74" y="82" width="36" height="28" rx="4" fill="var(--hero-plant-1)" opacity="0.15" />
                <rect x="78" y="88" width="22" height="3" rx="1.5" fill="var(--hero-plant-1)" opacity="0.4" />
                <rect x="78" y="95" width="26" height="2" rx="1" fill="var(--hero-text-2)" opacity="0.2" />
                <rect x="78" y="101" width="16" height="2" rx="1" fill="var(--hero-text-2)" opacity="0.15" />
                {/* Chart */}
                <rect x="116" y="82" width="52" height="28" rx="4" fill="var(--hero-book-3)" opacity="0.12" />
                <rect x="122" y="100" width="6" height="6" rx="1" fill="var(--hero-book-3)" opacity="0.5" />
                <rect x="131" y="94" width="6" height="12" rx="1" fill="var(--hero-book-3)" opacity="0.6" />
                <rect x="140" y="90" width="6" height="16" rx="1" fill="var(--hero-book-3)" opacity="0.7" />
                <rect x="149" y="96" width="6" height="10" rx="1" fill="var(--hero-book-3)" opacity="0.5" />
                {/* Decorative dots */}
                <circle cx="150" cy="45" r="2" fill="var(--hero-text-1)" opacity="0.2" />
                <circle cx="160" cy="55" r="1.5" fill="var(--hero-plant-1)" opacity="0.2" />
                <circle cx="145" cy="65" r="1" fill="var(--hero-book-3)" opacity="0.15" />
              </svg>
            </motion.div>
          </div>

          {/* Stats row */}
          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <HeroStatCard label="Total Projects" value={stats.total} max={stats.total} colorKey="total" delay={0.1} />
            <HeroStatCard label="Active" value={stats.active} max={stats.total} colorKey="active" delay={0.15} />
            <HeroStatCard label="In Progress" value={stats.inProgress} max={stats.total} colorKey="in_progress" delay={0.2} />
            <HeroStatCard label="Completed" value={stats.completed} max={stats.total} colorKey="completed" delay={0.25} />
          </div>
        </motion.div>

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="space-y-3"
        >
          {/* Search + View toggle */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-50 outline-none transition-colors placeholder:text-surface-500"
              />
            </div>

            {/* Client filter dropdown */}
            <div className="relative">
              <select
                aria-label="Filter by client"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
              >
                {uniqueClients.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All Clients' : c}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
            </div>

            <div className="flex-1" />

            {/* View toggle */}
            <div className="flex items-center bg-surface-900 border border-surface-800 rounded-xl overflow-hidden">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode('grid')}
                className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300'}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode('list')}
                className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300'}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`
                    flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/25 shadow-sm shadow-brand-500/10'
                      : 'bg-surface-900 text-surface-400 border border-surface-800 hover:border-surface-700 hover:text-surface-300'
                    }
                  `}
                >
                  <span className={`text-[10px] ${isActive ? 'text-brand-400' : 'text-surface-500'}`}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}

            <span className="w-px h-5 bg-surface-800 mx-1 flex-shrink-0" />

            {/* Timeline tabs */}
            {TIMELINE_TABS.map((tab) => {
              const isActive = timelineFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setTimelineFilter(tab.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? 'bg-surface-800 text-surface-50'
                      : 'text-surface-500 hover:text-surface-300 hover:bg-surface-900'
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Results count */}
        {hasActiveFilters && (
          <p className="text-xs text-surface-400">
            Showing <span className="font-semibold text-surface-300">{filteredProjects.length}</span> of{' '}
            <span className="font-semibold text-surface-300">{displayProjects.length}</span> projects
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
                hasActiveFilters ? undefined : '/SVG/empty-projects.png'
              }
              icon={
                hasActiveFilters
                  ? <FolderOpen size={40} className="text-surface-500" />
                  : undefined
              }
              title={hasActiveFilters ? 'No matching projects' : 'No projects yet'}
              description={
                hasActiveFilters
                  ? 'Try a different search term or adjust your filters.'
                  : isAdmin
                    ? 'Create your first project and start organizing your work.'
                    : 'No projects have been created yet. Ask an admin to create one.'
              }
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
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--project-shape-${project.tint}) 12%, transparent)`,
                    color: `var(--project-content-${project.tint})`,
                  }}
                >
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
                <ArrowRight size={14} className="text-surface-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
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

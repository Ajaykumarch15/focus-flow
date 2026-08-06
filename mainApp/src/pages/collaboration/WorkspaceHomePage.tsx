import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderPlus, Search, Clock, Users, ChevronLeft, ChevronRight,
  ArrowUpRight, Plus,
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { CreateProjectModal } from '../../components/collaboration/CreateProjectModal';
import { Button } from '../../components/ui/Button';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Progress } from '../../components/ui/Progress';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { Skeleton, SkeletonText, SkeletonCard } from '../../components/ui/Skeleton';
import { formatRelativeTime } from '../../utils/time';
import type { Project, CollaborativeTask } from '../../types/collaboration';

// Persisted project status → badge tone/label (mirrors WorkspaceProjectsPage).
const STATUS_TONE: Record<string, BadgeTone> = {
  planning: 'info',
  active: 'success',
  completed: 'success',
  on_hold: 'warning',
};

const STATUS_LABEL: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
};

type SortKey = 'updated' | 'name' | 'created';
type StatusFilter = 'all' | Project['status'] | 'archived';

const PAGE_SIZE = 6;

// Workspace Home / Project Launcher: the landing page right after a user clicks
// a Workspace in the Workspace Hub. ONE large card split into two sections —
// a dominant "Create New Project" CTA on the left and the project list on the
// right. Project cards deep-link to the existing Project route; internal project
// pages themselves are out of scope here.
export function WorkspaceHomePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { projects, projectsLoading, tasks, activeWorkspaceId } = useCollaborationStore();

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const wsId = workspaceId || activeWorkspaceId;
  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === wsId),
    [projects, wsId],
  );

  // Derived signals (Project has no updatedAt/progress/membersCount): last
  // updated = newest task touch (fallback to createdAt), progress = done/total
  // tasks, members = saved member refs.
  const enriched = useMemo(() => {
    const taskByProject = (projId: string) =>
      tasks.filter((t: CollaborativeTask) => t.projectId === projId);
    return wsProjects.map((proj) => {
      const pTasks = taskByProject(proj.id);
      const done = pTasks.filter((t) => t.sprintStatus === 'done').length;
      const progress = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
      const lastUpdated = pTasks.reduce(
        (acc, t) => (t.updatedAt && t.updatedAt > acc ? t.updatedAt : acc),
        proj.createdAt,
      );
      return { proj, progress, lastUpdated };
    });
  }, [wsProjects, tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ proj }) => {
      if (statusFilter !== 'all' && proj.status !== statusFilter) return false;
      if (!q) return true;
      return (
        proj.name.toLowerCase().includes(q) ||
        proj.key.toLowerCase().includes(q) ||
        (proj.description || '').toLowerCase().includes(q)
      );
    });
  }, [enriched, search, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === 'name') arr.sort((a, b) => a.proj.name.localeCompare(b.proj.name));
    else if (sort === 'created') arr.sort((a, b) => b.proj.createdAt.localeCompare(a.proj.createdAt));
    else arr.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showPagination = sorted.length > PAGE_SIZE;

  const loading = projectsLoading;

  return (
    <ErrorBoundary>
      <div className="p-5 lg:p-8 max-w-[1500px] mx-auto min-h-full">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="space-y-6"
        >
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="rounded-3xl border border-surface-800 bg-surface-900/50 overflow-hidden lg:flex"
            >
              {/* LEFT — Create New Project (primary action) */}
              <button
                type="button"
                onClick={() => setShowCreateProject(true)}
                aria-label="Create new project"
                className="group relative text-left lg:w-80 lg:flex-shrink-0 p-8 border-b lg:border-b-0 lg:border-r border-surface-800 bg-gradient-to-br from-brand-500/10 via-surface-900/40 to-cyan-500/10 hover:from-brand-500/15 hover:to-cyan-500/15 transition-colors duration-200 overflow-hidden cursor-pointer"
              >
                <div
                  className="absolute -top-16 -right-16 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"
                  aria-hidden="true"
                />
                <div className="relative flex flex-col items-start justify-between h-full gap-8">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 shadow-lg shadow-brand-500/30 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
                      <FolderPlus size={26} className="text-white" aria-hidden="true" />
                    </div>
                    <h2 className="text-xl font-display font-extrabold text-surface-50">
                      Create New Project
                    </h2>
                    <p className="mt-2 text-sm text-surface-400 leading-relaxed">
                      Kick off a new engineering initiative with milestones, team assignment, and a
                      repository link.
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25 w-full transition-all duration-200 group-hover:shadow-lg group-hover:shadow-brand-500/35 group-hover:-translate-y-px">
                    <Plus size={16} aria-hidden="true" /> Create Project
                  </span>
                </div>
              </button>

              {/* RIGHT — project list */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="p-5 border-b border-surface-800 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-sm font-display font-bold text-surface-50">Projects</h3>
                    <span className="text-xs text-surface-500">
                      {filtered.length} of {wsProjects.length}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 min-w-0">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
                        aria-hidden="true"
                      />
                      <Input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search by name, key, or description…"
                        className="pl-9 rounded-xl"
                        aria-label="Search projects"
                      />
                    </div>
                    <Select
                      value={sort}
                      onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
                      className="sm:w-48 rounded-xl"
                      aria-label="Sort projects"
                    >
                      <option value="updated">Recently Updated</option>
                      <option value="name">Name</option>
                      <option value="created">Created Date</option>
                    </Select>
                    <Select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                      className="sm:w-44 rounded-xl"
                      aria-label="Filter by status"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="planning">Planning</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </Select>
                  </div>
                </div>

                <div className="p-5 flex-1">
                  {wsProjects.length === 0 ? (
                    <EmptyState
                      icon={<FolderPlus size={28} />}
                      title="No projects yet"
                      description="Kick off the first engineering initiative for this workspace."
                      action={
                        <Button onClick={() => setShowCreateProject(true)} leftIcon={<Plus size={14} />}>
                          Create Project
                        </Button>
                      }
                      hint="Projects group sprints, tasks, features, and milestones together."
                    />
                  ) : sorted.length === 0 ? (
                    <EmptyState
                      icon={<Search size={28} />}
                      title="No matching projects"
                      description="Try adjusting your search or status filter."
                      hint="Search matches project name, key, and description."
                    />
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {paged.map(({ proj, progress, lastUpdated }) => (
                        <ProjectCard
                          key={proj.id}
                          proj={proj}
                          progress={progress}
                          lastUpdated={lastUpdated}
                          href={`/w/${wsId}/projects/${proj.id}`}
                        />
                      ))}
                    </div>
                  )}

                  {showPagination && (
                    <div className="pt-5 flex items-center justify-end gap-3">
                      <span className="text-xs font-semibold text-surface-500">
                        {safePage} of {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        leftIcon={<ChevronLeft size={14} />}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        rightIcon={<ChevronRight size={14} />}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        <CreateProjectModal
          isOpen={showCreateProject}
          onClose={() => setShowCreateProject(false)}
        />
      </div>
    </ErrorBoundary>
  );
}

interface ProjectCardProps {
  proj: Project;
  progress: number;
  lastUpdated: string;
  href: string;
}

function ProjectCard({ proj, progress, lastUpdated, href }: ProjectCardProps) {
  return (
    <Link
      to={href}
      aria-label={`Open ${proj.name}`}
      className="group relative rounded-2xl border border-surface-800 bg-surface-900/80 p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/10 hover:bg-surface-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
            {proj.key}
          </Badge>
          <Badge tone={STATUS_TONE[proj.status] ?? 'neutral'} className="text-[10px] font-bold uppercase tracking-wider">
            {STATUS_LABEL[proj.status] ?? proj.status}
          </Badge>
        </div>
        <ArrowUpRight
          size={16}
          className="text-surface-600 group-hover:text-brand-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200"
          aria-hidden="true"
        />
      </div>

      <div>
        <h3 className="text-base font-display font-bold text-surface-50 group-hover:text-brand-300 transition-colors duration-200 line-clamp-1">
          {proj.name}
        </h3>
        <p className="mt-1 text-xs text-surface-400 leading-relaxed line-clamp-2">
          {proj.description || 'No description yet.'}
        </p>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-surface-500">
        <span className="flex items-center gap-1.5">
          <Clock size={12} aria-hidden="true" /> Updated {formatRelativeTime(lastUpdated)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={12} aria-hidden="true" /> {proj.members.length} members
        </span>
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-surface-500 font-semibold">Progress</span>
          <span className="font-bold text-surface-300">{progress}%</span>
        </div>
        <Progress
          value={progress}
          tone={progress === 100 ? 'success' : 'brand'}
          ariaLabel={`${proj.name} progress`}
        />
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-3xl border border-surface-800 bg-surface-900/50 overflow-hidden lg:flex min-h-[420px]">
      <div className="lg:w-80 lg:flex-shrink-0 p-8 border-b lg:border-b-0 lg:border-r border-surface-800 space-y-5">
        <Skeleton className="w-14 h-14 rounded-2xl" />
        <Skeleton className="h-6 w-44 rounded" />
        <SkeletonText lines={3} />
      </div>
      <div className="flex-1 min-w-0 p-5 space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    </div>
  );
}

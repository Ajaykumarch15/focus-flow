import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderPlus, Search, ChevronLeft, ChevronRight, ArrowUpRight, Plus,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { CreateProjectModal } from '@collab/components/CreateProjectModal';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { Input } from '@shared/components/ui/Input';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorBoundary } from '@shared/components/ui/ErrorBoundary';
import { Skeleton, SkeletonText, SkeletonCard } from '@shared/components/ui/Skeleton';
import type { Project, CollaborativeTask } from '@collab/types/collaboration';

const PAGE_SIZE = 6;

// Workspace Home / Project Launcher: the landing page right after a user clicks
// a Workspace in the Workspace Hub. ONE large card split into two sections —
// a dominant "Create New Project" CTA on the left and a compact searchable
// project list on the right. Rows deep-link to the existing Project route;
// internal project pages themselves are out of scope here.
export function WorkspaceHomePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { projects, projectsLoading, tasks, activeWorkspaceId } = useCollaborationStore();

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const wsId = workspaceId || activeWorkspaceId;
  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === wsId),
    [projects, wsId],
  );

  // Derived signal: last updated = newest task touch (fallback to createdAt),
  // used for the default "recently updated" ordering of compact rows.
  const enriched = useMemo(() => {
    const taskByProject = (projId: string) =>
      tasks.filter((t: CollaborativeTask) => t.projectId === projId);
    return wsProjects.map((proj) => {
      const pTasks = taskByProject(proj.id);
      const lastUpdated = pTasks.reduce(
        (acc, t) => (t.updatedAt && t.updatedAt > acc ? t.updatedAt : acc),
        proj.createdAt,
      );
      return { proj, lastUpdated };
    });
  }, [wsProjects, tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(({ proj }) => (
      proj.name.toLowerCase().includes(q) ||
      proj.key.toLowerCase().includes(q) ||
      (proj.description || '').toLowerCase().includes(q)
    ));
  }, [enriched, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated)),
    [filtered],
  );

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
                className="group relative text-left lg:w-[380px] lg:flex-shrink-0 p-8 border-b lg:border-b-0 lg:border-r border-surface-800 bg-gradient-to-br from-brand-500/10 via-surface-900/40 to-cyan-500/10 hover:from-brand-500/15 hover:to-cyan-500/15 transition-colors duration-200 overflow-hidden cursor-pointer"
              >
                <div
                  className="absolute -top-16 -right-16 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"
                  aria-hidden="true"
                />
                <div className="relative flex flex-col justify-center h-full gap-8">
                  <div>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 shadow-lg shadow-brand-500/30 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
                      <FolderPlus size={38} className="text-white" aria-hidden="true" />
                    </div>
                    <h2 className="text-3xl font-display font-extrabold text-surface-50">
                      Create New Project
                    </h2>
                    <p className="mt-2 text-sm text-surface-400 leading-relaxed">
                      Kick off a new engineering initiative with milestones, team assignment, and a
                      repository link.
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center gap-2 h-14 px-5 rounded-xl text-base font-semibold bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25 w-full transition-all duration-200 group-hover:shadow-lg group-hover:shadow-brand-500/35 group-hover:-translate-y-px">
                    <Plus size={18} aria-hidden="true" /> Create Project
                  </span>
                </div>
              </button>

              {/* RIGHT — project list */}
              <div className="flex-1 flex flex-col p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-surface-50 mb-4">Search Project</h3>

                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500"
                      aria-hidden="true"
                    />
                    <Input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search Project..."
                      className="pl-11 h-12 rounded-2xl"
                      aria-label="Search projects"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-3">
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
                      description="Try adjusting your search."
                      hint="Search matches project name, key, and description."
                    />
                  ) : (
                    paged.map(({ proj }) => (
                      <CompactProjectCard
                        key={proj.id}
                        proj={proj}
                        href={`/w/${wsId}/projects/${proj.id}`}
                      />
                    ))
                  )}
                </div>

                {showPagination && (
                  <div className="flex justify-end mt-6">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={18} />
                      </Button>
                      <span className="text-sm text-surface-400 font-semibold">
                        {safePage} of {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        aria-label="Next page"
                      >
                        <ChevronRight size={18} />
                      </Button>
                    </div>
                  </div>
                )}
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

function CompactProjectCard({ proj, href }: { proj: Project; href: string }) {
  return (
    <Link
      to={href}
      aria-label={`Open ${proj.name}`}
      className="group flex items-center justify-between rounded-2xl border border-surface-800 bg-surface-900/80 px-6 py-5 hover:border-brand-500 hover:bg-surface-900 transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Badge tone="brand" className="shrink-0">
          {proj.key}
        </Badge>
        <span className="font-semibold text-surface-100 line-clamp-1">{proj.name}</span>
      </div>
      <ArrowUpRight
        size={18}
        className="shrink-0 text-surface-500 group-hover:text-brand-400 transition"
        aria-hidden="true"
      />
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-3xl border border-surface-800 bg-surface-900/50 overflow-hidden lg:flex min-h-[420px]">
      <div className="lg:w-[380px] lg:flex-shrink-0 p-8 border-b lg:border-b-0 lg:border-r border-surface-800 space-y-5">
        <Skeleton className="w-20 h-20 rounded-2xl" />
        <Skeleton className="h-8 w-52 rounded" />
        <SkeletonText lines={3} />
      </div>
      <div className="flex-1 min-w-0 p-8 space-y-3">
        <Skeleton className="h-5 w-36 rounded" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="pt-2 space-y-3">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
        </div>
      </div>
    </div>
  );
}

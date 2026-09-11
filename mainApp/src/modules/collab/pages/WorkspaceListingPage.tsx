import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { CreateWorkspaceModal } from '@collab/components/CreateWorkspaceModal';
import { Button } from '@shared/components/ui/Button';
import { SkeletonCard } from '@shared/components/ui/Skeleton';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorBoundary } from '@shared/components/ui/ErrorBoundary';
import { WorkspaceCardNew } from '@shared/components/WorkspaceCardNew';
import { cn } from '@shared/utils/cn';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const WS_TYPES = ['Startup', 'Personal', 'College Project', 'Open Source', 'Internship', 'Enterprise'] as const;

export function WorkspaceListingPage() {
  const navigate = useNavigate();
  const { workspaces, workspacesLoading, loadCollabData, setActiveWorkspace } = useCollaborationStore();
  const { user } = useAuthStore();
  const isAdmin = (user?.roleId?.level ?? 0) >= 60;
  const [showCreate, setShowCreate] = React.useState(false);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleType = (type: string) => {
    setTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const clearFilters = () => setTypeFilters([]);

  React.useEffect(() => {
    if (workspaces.length === 0 && !workspacesLoading) {
      loadCollabData();
    }
  }, [workspaces.length, workspacesLoading, loadCollabData]);

  const filtered = useMemo(() => {
    let result = workspaces;
    if (typeFilters.length > 0) {
      result = result.filter((ws) => typeFilters.includes(ws.type));
    }
    return result;
  }, [workspaces, typeFilters]);

  const handleOpen = (ws: typeof workspaces[0]) => {
    setActiveWorkspace(ws.id);
    navigate(`/collab/${ws.slug}`);
  };

  return (
    <ErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto min-h-full space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">Workspaces</h1>
            <p className="text-sm text-surface-400 mt-0.5">Select a workspace to view projects, teams, and members.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={16} />}>
              New Workspace
            </Button>
          )}
        </motion.div>

        {/* Filters */}
        {workspaces.length > 0 && (
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                typeFilters.length > 0
                  ? 'border-brand-500/40 text-brand-400 bg-brand-500/10 hover:bg-brand-500/15'
                  : 'border-surface-800 text-surface-400 bg-surface-900 hover:border-surface-700 hover:text-surface-300',
              )}
            >
              <SlidersHorizontal size={12} />
              Filter
              {typeFilters.length > 0 && (
                <span className="ml-0.5 bg-brand-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {typeFilters.length}
                </span>
              )}
              <ChevronDown size={10} className={cn('transition-transform', filterOpen && 'rotate-180')} />
            </button>

            {filterOpen && (
              <div className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-surface-900 border border-surface-800 rounded-xl p-1.5 z-50 shadow-xl shadow-black/40">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                  Workspace type
                </div>
                {WS_TYPES.map((type) => {
                  const checked = typeFilters.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-800 transition-colors cursor-pointer text-left"
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                          checked
                            ? 'bg-brand-500 border-brand-500'
                            : 'border-surface-600',
                        )}
                      >
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className="text-xs text-surface-300 font-medium">{type}</span>
                    </button>
                  );
                })}
                {typeFilters.length > 0 && (
                  <>
                    <div className="border-t border-surface-800 my-1" />
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-800 transition-colors cursor-pointer text-left"
                    >
                      <X size={12} className="text-surface-500" />
                      <span className="text-xs text-surface-400 font-medium">Clear all</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {workspacesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} lines={1} className="h-[140px]" />
            ))}
          </div>
        ) : filtered.length === 0 && workspaces.length > 0 ? (
          <EmptyState
            icon={<Search size={28} />}
            title="No workspaces found"
            description={typeFilters.length > 0 ? 'Try a different filter.' : 'No workspaces match your criteria.'}
            action={
              typeFilters.length > 0 ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : workspaces.length === 0 ? (
          <EmptyState
            icon={<Plus size={28} />}
            title="No workspaces yet"
            description={isAdmin ? "Create your first engineering workspace to start collaborating with your team." : "No workspaces have been created yet. Ask an admin to create one."}
            action={
              isAdmin ? (
                <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />}>
                  Create Workspace
                </Button>
              ) : undefined
            }
            hint="Workspaces group projects, teams, and members together."
          />
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.map((ws) => (
              <WorkspaceCardNew
                key={ws.id}
                variants={fadeUp}
                name={ws.name}
                category={ws.type}
                description={ws.description || ''}
                activeTasks={0}
                completionPercent={0}
                membersCount={ws.membersCount ?? 0}
                projectsCount={ws.projectsCount ?? 0}
                onOpen={() => handleOpen(ws)}
              />
            ))}
          </motion.div>
        )}

        <CreateWorkspaceModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      </div>
    </ErrorBoundary>
  );
}

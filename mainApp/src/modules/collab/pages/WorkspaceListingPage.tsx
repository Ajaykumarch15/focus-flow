import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, X, SlidersHorizontal, ChevronDown,
  Folder, Users, LayoutGrid, BarChart3,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { CreateWorkspaceModal } from '@collab/components/CreateWorkspaceModal';
import { Button } from '@shared/components/ui/Button';
import { SkeletonCard } from '@shared/components/ui/Skeleton';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NoSearchResults, NoWorkspaces } from '@shared/components/illustrations';
import { ErrorBoundary } from '@shared/components/ui/ErrorBoundary';
import { WorkspaceCardNew } from '@shared/components/WorkspaceCardNew';
import { cn } from '@shared/utils/cn';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const WS_TYPES = ['Startup', 'Personal', 'College Project', 'Open Source', 'Internship', 'Enterprise'] as const;

function ListHeroIllustration() {
  return (
    <svg viewBox="0 0 400 200" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Window frame */}
      <rect x="120" y="28" width="160" height="112" rx="8" fill="var(--hero-frame)" stroke="var(--hero-frame-stroke)" strokeWidth="1.2" />
      <rect x="120" y="28" width="160" height="22" rx="8" fill="var(--hero-title-bar)" />
      <circle cx="136" cy="39" r="3.5" fill="#fca5a5" />
      <circle cx="149" cy="39" r="3.5" fill="#fcd34d" />
      <circle cx="162" cy="39" r="3.5" fill="#86efac" />
      {/* Content lines */}
      <rect x="132" y="58" width="52" height="4.5" rx="2.25" fill="var(--hero-text-1)" fillOpacity="0.6" />
      <rect x="132" y="67" width="82" height="3.5" rx="1.75" fill="var(--hero-text-2)" fillOpacity="0.45" />
      <rect x="132" y="75" width="68" height="3.5" rx="1.75" fill="var(--hero-text-2)" fillOpacity="0.35" />
      <rect x="132" y="83" width="74" height="3.5" rx="1.75" fill="var(--hero-text-2)" fillOpacity="0.28" />

      {/* Plant */}
      <rect x="302" y="98" width="9" height="55" rx="4.5" fill="var(--hero-plant-4)" fillOpacity="0.5" />
      <circle cx="306" cy="88" r="20" fill="var(--hero-plant-1)" fillOpacity="0.35" />
      <circle cx="296" cy="76" r="14" fill="var(--hero-plant-2)" fillOpacity="0.3" />
      <circle cx="318" cy="82" r="11" fill="var(--hero-plant-3)" fillOpacity="0.35" />

      {/* Books */}
      <rect x="48" y="118" width="14" height="42" rx="3" fill="var(--hero-book-1)" fillOpacity="0.5" />
      <rect x="66" y="112" width="12" height="48" rx="3" fill="var(--hero-book-2)" fillOpacity="0.45" />
      <rect x="82" y="122" width="13" height="38" rx="3" fill="var(--hero-book-3)" fillOpacity="0.5" />

      {/* Mug */}
      <rect x="28" y="102" width="18" height="22" rx="4" fill="var(--hero-mug)" stroke="var(--hero-mug-stroke)" strokeWidth="0.8" />
      <path d="M46 107 Q53 107 53 113 Q53 119 46 119" fill="none" stroke="var(--hero-mug-stroke)" strokeWidth="0.8" />

      {/* Floating accents */}
      <circle cx="355" cy="45" r="6" fill="var(--hero-text-1)" fillOpacity="0.18" />
      <circle cx="375" cy="68" r="4" fill="var(--hero-book-1)" fillOpacity="0.15" />
      <circle cx="28" cy="55" r="5" fill="var(--hero-book-3)" fillOpacity="0.15" />
    </svg>
  );
}

function CreateWorkspaceCardInline({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl',
        'border border-dashed border-surface-300 dark:border-surface-700',
        'bg-blue-50/50 dark:bg-surface-900/50',
        'transition-all duration-300 ease-snappy',
        'hover:border-brand-400 dark:hover:border-brand-500/50 hover:shadow-md',
        'cursor-pointer',
      )}
      onClick={onClick}
    >
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 group-hover:bg-brand-500/15 transition-colors">
          <Plus size={24} className="text-brand-500" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-surface-50">Create a New Workspace</h3>
          <p className="text-[11px] text-surface-400 mt-1 max-w-[200px] mx-auto">
            Start a new space for your team, projects, and ideas.
          </p>
        </div>
        <Button size="sm" leftIcon={<Plus size={14} />}>
          Create Workspace
        </Button>
      </div>
      <div className="h-16 overflow-hidden">
        <svg viewBox="0 0 300 60" fill="none" className="w-full h-full" aria-hidden="true">
          <path d="M0 60 L50 30 L100 45 L150 20 L200 35 L250 15 L300 40 L300 60 Z" fill="#38bdf8" fillOpacity="0.06" />
          <path d="M0 60 L80 40 L160 50 L240 25 L300 45 L300 60 Z" fill="#0ea5e9" fillOpacity="0.04" />
          <circle cx="260" cy="20" r="8" fill="#38bdf8" fillOpacity="0.08" />
          <circle cx="280" cy="30" r="5" fill="#0ea5e9" fillOpacity="0.06" />
        </svg>
      </div>
    </motion.div>
  );
}

export function WorkspaceListingPage() {
  const navigate = useNavigate();
  const { workspaces, workspacesLoading, loadCollabData, setActiveWorkspace } = useCollaborationStore();
  const { user } = useAuthStore();
  const isAdmin = (user?.roleId?.level ?? 0) >= 60;
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');
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
    if (activeTab === 'archived') {
      result = [];
    }
    return result;
  }, [workspaces, typeFilters, activeTab]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [filtered]);

  const stats = useMemo(() => ({
    totalWorkspaces: workspaces.length,
    totalMembers: workspaces.reduce((s, w) => s + (w.membersCount ?? 0), 0),
    totalProjects: workspaces.reduce((s, w) => s + (w.projectsCount ?? 0), 0),
    avgProgress: 0,
  }), [workspaces]);

  const handleOpen = (ws: typeof workspaces[0]) => {
    setActiveWorkspace(ws.id);
    navigate(`/collab/${ws.slug}`);
  };

  const STAT_CARDS = [
    { label: 'Total Workspaces', value: stats.totalWorkspaces, icon: Folder, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Total Members', value: stats.totalMembers, icon: Users, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Total Projects', value: stats.totalProjects, icon: LayoutGrid, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Average Progress', value: `${stats.avgProgress}%`, icon: BarChart3, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  ];

  const TABS = [
    { id: 'all' as const, label: 'All', count: workspaces.length },
    { id: 'active' as const, label: 'Active', count: workspaces.length },
    { id: 'archived' as const, label: 'Archived', count: 0 },
  ];

  return (
    <ErrorBoundary>
      <div className="relative min-h-full overflow-x-hidden overflow-y-auto">
        <div className="absolute -top-40 -left-40 w-96 h-96 dark:bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 dark:bg-cyan-500/4 rounded-full blur-3xl pointer-events-none" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 relative z-10 space-y-6 lg:space-y-8">
          {/* Hero Section */}
          <motion.section
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row items-start lg:items-center gap-6"
          >
            <div className="flex-1 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-surface-400">
                Collaborate &nbsp;&bull;&nbsp; Build &nbsp;&bull;&nbsp; Grow
              </p>
              <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-surface-50 tracking-tight">
                Workspaces
              </h1>
              <p className="text-sm text-surface-400 max-w-md">
                Select a workspace to view projects, teams, and members.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                      'border border-surface-200 dark:border-surface-800',
                      'bg-white dark:bg-surface-900/60',
                    )}
                  >
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
                      <Icon size={16} className={color} />
                    </div>
                    <div>
                      <p className="font-display text-lg font-bold text-surface-50 leading-tight">{value}</p>
                      <p className="text-[10px] text-surface-400">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block w-[340px] flex-shrink-0">
              <ListHeroIllustration />
            </div>
          </motion.section>

          {/* Filter Bar */}
          {workspaces.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1 p-1 bg-surface-100 dark:bg-surface-800/50 rounded-xl">
                {TABS.map(({ id, label, count }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                      activeTab === id
                        ? 'bg-white dark:bg-surface-700 text-surface-50 shadow-sm'
                        : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300',
                    )}
                  >
                    {label}
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      activeTab === id
                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                        : 'bg-surface-200 dark:bg-surface-700 text-surface-500',
                    )}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-400 hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900/60">
                  <SlidersHorizontal size={12} />
                  Sort by: Last accessed
                  <ChevronDown size={10} />
                </span>

                <div ref={filterRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen(!filterOpen)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                      typeFilters.length > 0
                        ? 'border-brand-500/40 text-brand-400 bg-brand-500/10 hover:bg-brand-500/15'
                        : 'border-surface-200 dark:border-surface-800 text-surface-400 bg-white dark:bg-surface-900/60 hover:border-surface-300 dark:hover:border-surface-700 hover:text-surface-300',
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
                    <div className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-1.5 z-50 shadow-xl">
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
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer text-left"
                          >
                            <span
                              className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                                checked
                                  ? 'bg-brand-500 border-brand-500'
                                  : 'border-surface-400 dark:border-surface-600',
                              )}
                            >
                              {checked && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                            <span className="text-xs text-surface-600 dark:text-surface-300 font-medium">{type}</span>
                          </button>
                        );
                      })}
                      {typeFilters.length > 0 && (
                        <>
                          <div className="border-t border-surface-200 dark:border-surface-800 my-1" />
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer text-left"
                          >
                            <X size={12} className="text-surface-500" />
                            <span className="text-xs text-surface-500 font-medium">Clear all</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cards Grid */}
          {workspacesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} lines={1} className="h-[140px]" />
              ))}
            </div>
          ) : filtered.length === 0 && workspaces.length > 0 ? (
            <EmptyState
              illustration={<NoSearchResults />}
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
              illustration={<NoWorkspaces />}
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
              {sorted.map((ws) => (
                <WorkspaceCardNew
                  key={ws.id}
                  variants={fadeUp}
                  name={ws.name}
                  category={ws.type}
                  description={ws.description || ''}
                  completionPercent={0}
                  membersCount={ws.membersCount ?? 0}
                  projectsCount={ws.projectsCount ?? 0}
                  lastAccessedAt={ws.createdAt}
                  onOpen={() => handleOpen(ws)}
                />
              ))}
              {isAdmin && <CreateWorkspaceCardInline onClick={() => setShowCreate(true)} />}
            </motion.div>
          )}

          {/* Bottom Quote */}
          <div className="flex items-center gap-4 py-4">
            <div className="flex-1 h-px bg-surface-200 dark:bg-surface-800" />
            <p className="text-xs text-surface-400 italic whitespace-nowrap">
              &ldquo;A focused team can build extraordinary things.&rdquo;
            </p>
            <div className="flex-1 h-px bg-surface-200 dark:bg-surface-800" />
          </div>
        </main>
      </div>

      <CreateWorkspaceModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </ErrorBoundary>
  );
}

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Building2, Users, FolderOpen, Search, X } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { CreateWorkspaceModal } from '@collab/components/CreateWorkspaceModal';
import { Button } from '@shared/components/ui/Button';
import { SkeletonCard } from '@shared/components/ui/Skeleton';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorBoundary } from '@shared/components/ui/ErrorBoundary';
import { Badge } from '@shared/components/ui/Badge';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const WS_ICONS: Record<string, string> = {
  Startup: '⚡',
  Personal: '🚀',
  'College Project': '🎓',
  'Open Source': '🌐',
  Internship: '💼',
  Enterprise: '🏢',
};

const WS_TYPES = ['All', 'Startup', 'Personal', 'College Project', 'Open Source', 'Internship', 'Enterprise'] as const;

export function WorkspaceListingPage() {
  const navigate = useNavigate();
  const { workspaces, workspacesLoading, loadCollabData, setActiveWorkspace } = useCollaborationStore();
  const { user } = useAuthStore();
  const isAdmin = (user?.roleId?.level ?? 0) >= 60;
  const [showCreate, setShowCreate] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('All');

  React.useEffect(() => {
    if (workspaces.length === 0 && !workspacesLoading) {
      loadCollabData();
    }
  }, [workspaces.length, workspacesLoading, loadCollabData]);

  const filtered = useMemo(() => {
    let result = workspaces;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (ws) =>
          ws.name.toLowerCase().includes(q) ||
          ws.type.toLowerCase().includes(q) ||
          ws.description?.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'All') {
      result = result.filter((ws) => ws.type === typeFilter);
    }
    return result;
  }, [workspaces, search, typeFilter]);

  const handleOpen = (ws: typeof workspaces[0]) => {
    setActiveWorkspace(ws.id);
    navigate(`/collab/${ws.id}`);
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

        {/* Search & Filters */}
        {workspaces.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
              <input
                type="text"
                placeholder="Search workspaces..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-surface-900 border border-surface-800 text-sm text-surface-200 placeholder:text-surface-500 outline-none focus:border-brand-500/50 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {WS_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                      : 'bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-200 hover:border-surface-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {workspacesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} lines={1} className="h-[180px]" />
            ))}
          </div>
        ) : filtered.length === 0 && workspaces.length > 0 ? (
          <EmptyState
            icon={<Search size={28} />}
            title="No workspaces found"
            description={search || typeFilter !== 'All' ? 'Try a different search or filter.' : 'No workspaces match your criteria.'}
            action={
              (search || typeFilter !== 'All') ? (
                <Button variant="secondary" onClick={() => { setSearch(''); setTypeFilter('All'); }}>
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : workspaces.length === 0 ? (
          <EmptyState
            icon={<Building2 size={28} />}
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
              <motion.div key={ws.id} variants={fadeUp}>
                <button
                  type="button"
                  onClick={() => handleOpen(ws)}
                  className="w-full text-left group"
                >
                  <div className="rounded-2xl border border-surface-800 bg-surface-900/50 p-6 hover:border-brand-500/50 hover:bg-surface-900 transition-all duration-200">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-xl flex-shrink-0">
                        {WS_ICONS[ws.type] || '📁'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-surface-50 truncate group-hover:text-brand-400 transition-colors">
                          {ws.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-surface-500">{ws.type}</p>
                          {ws.role && (
                            <Badge tone={ws.role === 'superadmin' ? 'brand' : ws.role === 'admin' ? 'info' : 'neutral'} className="text-[9px]">
                              {ws.role === 'superadmin' ? 'Superadmin' : ws.role === 'admin' ? 'Admin' : 'Nonadmin'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {ws.description && (
                      <p className="text-sm text-surface-400 mt-3 line-clamp-2">{ws.description}</p>
                    )}

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-800">
                      <span className="flex items-center gap-1.5 text-xs text-surface-400">
                        <Users size={13} className="text-surface-500" />
                        {ws.membersCount ?? 0} member{(ws.membersCount ?? 0) !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-surface-400">
                        <FolderOpen size={13} className="text-surface-500" />
                        {ws.projectsCount ?? 0} project{(ws.projectsCount ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        <CreateWorkspaceModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      </div>
    </ErrorBoundary>
  );
}

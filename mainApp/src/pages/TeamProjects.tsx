import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Users, Layers, ChevronRight, ArrowLeft,
  GitBranch, Search, LayoutGrid, List
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCollaborationStore } from '../store/useCollaborationStore';
import { useStore } from '../store/useStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function TeamProjects() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { workspaces, workspacesLoading, setActiveWorkspace, loadWorkspaces, createWorkspace, tasks } = useCollaborationStore();
  const { theme } = useStore();

  // IES-P2-07: real workspace list replaces the removed seed data.
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<'Startup' | 'Personal' | 'Open Source' | 'College Project' | 'Internship' | 'Enterprise'>('Startup');
  const [newWsDesc, setNewWsDesc] = useState('');

  const filteredWorkspaces = workspaces.filter(ws =>
    ws.name.toLowerCase().includes(search.toLowerCase()) ||
    ws.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = workspaces.reduce((sum, ws) => sum + (ws.membersCount || 0), 0);

  const handleSelectCollaborative = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    navigate(`/w/${workspaceId}/overview`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    const ws = await createWorkspace(newWsName.trim(), newWsType, newWsDesc.trim() || 'Engineering Workspace');
    setShowCreateModal(false);
    setNewWsName('');
    setNewWsDesc('');
    if (ws) handleSelectCollaborative(ws.id);
  };

  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 relative overflow-x-hidden overflow-y-auto">

      {/* Background Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/hub')}
              className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800">
              <ArrowLeft size={14} /> Hub
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-cyan-500/10">
                <img src={theme.mode === 'dark' ? '/darkicon.png' : '/lighticon.png'} alt="FocusFlow" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="font-display font-bold text-base leading-none text-surface-50">Team Collaboration</h1>
                <p className="text-[10px] text-surface-400 font-medium mt-0.5">Engineering Workspaces & Projects</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-surface-300 font-medium">{user?.name || 'Developer'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 sm:px-10 py-8 space-y-8 relative z-10">

        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {[
            { icon: <Building2 size={14} className="text-cyan-400" />, label: `${workspaces.length} Workspace${workspaces.length !== 1 ? 's' : ''}` },
            { icon: <Users size={14} className="text-violet-400" />, label: `${totalMembers} Total Members` },
            { icon: <GitBranch size={14} className="text-amber-400" />, label: 'Active Sprints' },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-surface-900 px-3.5 py-2 rounded-xl border border-surface-800 text-xs font-semibold text-surface-300">
              {stat.icon} {stat.label}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-900 border border-surface-800 focus:border-cyan-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-50 outline-none transition-colors placeholder:text-surface-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-surface-900 border border-surface-800 rounded-xl overflow-hidden">
              <button onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-cyan-500/15 text-cyan-400' : 'text-surface-500 hover:text-surface-300'}`}>
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-cyan-500/15 text-cyan-400' : 'text-surface-500 hover:text-surface-300'}`}>
                <List size={15} />
              </button>
            </div>

            <Button onClick={() => setShowCreateModal(true)}
              className="text-xs font-bold" leftIcon={<Plus size={14} />}>
              New Workspace
            </Button>
          </div>
        </div>

        {/* Workspaces */}
        {filteredWorkspaces.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-dashed border-surface-700 bg-surface-900/60">
            <EmptyState
              icon={<Building2 size={40} className="text-surface-500" />}
              title={workspacesLoading
                ? 'Loading workspaces…'
                : search
                  ? 'No matching workspaces'
                  : 'No workspaces yet'}
              description={workspacesLoading
                ? 'Fetching your engineering workspaces.'
                : search
                  ? 'Try a different search term or create a new workspace.'
                  : 'Create your first engineering workspace to start collaborating with your team.'}
              action={!search && !workspacesLoading ? (
                <Button size="lg" className="text-xs font-bold" onClick={() => setShowCreateModal(true)} leftIcon={<Plus size={14} />}>
                  Create Workspace
                </Button>
              ) : undefined}
            />
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show"
            className={viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
              : 'space-y-3'
            }>
            {filteredWorkspaces.map((ws) => {
              const wsTasks = tasks.filter((t) => t.workspaceId === ws.id);
              const completedTasks = wsTasks.filter((t) => t.sprintStatus === 'done').length;
              const progressPct = wsTasks.length > 0 ? Math.round((completedTasks / wsTasks.length) * 100) : 0;

              if (viewMode === 'list') {
                return (
                  <motion.div key={ws.id} variants={itemVariants}
                    onClick={() => handleSelectCollaborative(ws.id)}
                    className="group rounded-2xl border border-surface-800 bg-surface-900/90 hover:border-cyan-500/40 p-5 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/5 cursor-pointer flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-2xl flex-shrink-0">{ws.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-display font-bold text-surface-50 text-sm group-hover:text-cyan-300 transition-colors truncate">
                            {ws.name}
                          </h4>
                          <Badge tone="info" className="text-[9px] uppercase tracking-wider border border-cyan-500/20 flex-shrink-0">
                            {ws.type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-surface-400 mt-0.5 truncate">{ws.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 flex-shrink-0">
                      <div className="flex items-center gap-3 text-[11px] text-surface-400">
                        <span className="flex items-center gap-1 font-medium">
                          <Users size={12} className="text-brand-400" /> {ws.membersCount}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {wsTasks.length > 0 ? (
                            <>
                              <div className="w-14 bg-surface-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-brand-500 h-full rounded-full" style={{ width: `${progressPct}%` }} />
                              </div>
                              <span className="text-[10px] font-mono font-bold text-surface-200">{progressPct}%</span>
                            </>
                          ) : (
                            <span className="text-[10px] font-mono font-semibold text-surface-500">—</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-cyan-400 group-hover:text-white bg-cyan-500/10 group-hover:bg-cyan-500 px-3 py-1.5 rounded-xl transition-all">
                        Open <ChevronRight size={13} />
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // Grid card
              return (
                <motion.div key={ws.id} variants={itemVariants}
                  onClick={() => handleSelectCollaborative(ws.id)}
                  className="group rounded-2xl border border-surface-800 bg-surface-900/90 hover:border-cyan-500/40 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/5 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden">

                  {/* BG glow */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="space-y-3 relative z-10">
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{ws.icon}</span>
                      <Badge tone="info" className="text-[9px] uppercase tracking-wider border border-cyan-500/20">
                        {ws.type}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-surface-50 text-base group-hover:text-cyan-300 transition-colors">
                        {ws.name}
                      </h4>
                      <p className="text-[11px] text-surface-400 mt-1 leading-relaxed line-clamp-2">{ws.description}</p>
                    </div>
                  </div>

                  {/* Stats + Progress */}
                  <div className="space-y-3 relative z-10">
                    <div className="flex items-center justify-between text-[11px] text-surface-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-medium">
                          <Users size={12} className="text-brand-400" /> {ws.membersCount} members
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Layers size={12} className="text-amber-400" /> Sprint
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {wsTasks.length > 0 ? (
                        <>
                          <div className="flex-1 bg-surface-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-cyan-500 to-brand-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-surface-200">{progressPct}%</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono font-semibold text-surface-500">No sprint data</span>
                      )}
                    </div>

                    <button className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-surface-800 group-hover:bg-cyan-500 text-surface-200 group-hover:text-white font-bold text-xs rounded-xl transition-all duration-200">
                      Open Workspace <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* Create Workspace Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-900 border border-surface-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">

              <div className="flex items-center justify-between border-b border-surface-800 pb-4">
                <h3 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
                  <Building2 size={20} className="text-brand-400" /> Create Workspace
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-surface-500 hover:text-surface-200 font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5">
                    Workspace Name *
                  </label>
                  <input type="text" required placeholder="e.g. Acme AI Engineering"
                    value={newWsName} onChange={(e) => setNewWsName(e.target.value)}
                    className="w-full bg-surface-850 border border-surface-700 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-surface-50 outline-none transition-colors" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5">
                    Workspace Type
                  </label>
                  <select value={newWsType} onChange={(e) => setNewWsType(e.target.value as typeof newWsType)}
                    className="w-full bg-surface-850 border border-surface-700 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-surface-50 outline-none transition-colors">
                    <option value="Startup">Startup</option>
                    <option value="Personal">Personal Sandbox</option>
                    <option value="Open Source">Open Source</option>
                    <option value="College Project">College Project</option>
                    <option value="Internship">Internship</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea rows={3} placeholder="Briefly describe the workspace purpose & engineering goals..."
                    value={newWsDesc} onChange={(e) => setNewWsDesc(e.target.value)}
                    className="w-full bg-surface-850 border border-surface-700 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-surface-50 outline-none transition-colors" />
                </div>

                <div className="pt-2 flex items-end justify-end gap-3">
                  <button type="button" onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors">
                    Cancel
                  </button>
                  <Button type="submit" size="lg" className="text-xs font-bold">
                    Create & Enter →
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

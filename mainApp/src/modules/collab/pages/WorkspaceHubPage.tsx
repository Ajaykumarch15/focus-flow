import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, FolderOpen, LayoutGrid, Settings, Activity, ChevronRight, Folder,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useWorkspacePath } from '@collab/hooks/useWorkspacePath';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { cn } from '@shared/utils/cn';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

const SECTION_CARDS = [
  { id: 'overview', title: 'Overview', description: 'Dashboard with stats, recent projects, and quick links', icon: LayoutGrid, sub: 'dashboard' },
  { id: 'projects', title: 'Projects', description: 'Manage projects, kanban boards, and task tracking', icon: FolderOpen, sub: 'projects' },
  { id: 'people', title: 'People', description: 'Team members, roles, and member management', icon: Users, sub: 'people' },
  { id: 'activity', title: 'Activity', description: 'Live feed of workspace events and updates', icon: Activity, sub: 'activity' },
  { id: 'settings', title: 'Settings', description: 'Workspace configuration, edit details, and danger zone', icon: Settings, sub: 'settings' },
];

export function WorkspaceHubPage() {
  const workspaceId = useWorkspaceId();
  const wsPath = useWorkspacePath();
  const navigate = useNavigate();
  const { workspaces, loadProjects, loadMembers } = useCollaborationStore();

  const workspace = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (!workspaceId) return;
    useCollaborationStore.getState().loadWorkspaces().then(() => {
      const { workspaces, activeWorkspaceId } = useCollaborationStore.getState();
      const ws = workspaces.find((w) => w.id === activeWorkspaceId || w.slug === activeWorkspaceId);
      const resolvedId = ws?.id ?? workspaceId;
      loadProjects(resolvedId);
      loadMembers(resolvedId);
    });
  }, [workspaceId, loadProjects, loadMembers]);

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <FolderOpen size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Workspace not found</h1>
          <p className="text-sm text-surface-400">This workspace does not exist or you don't have access.</p>
          <Button onClick={() => navigate('/collab/workspaces')} leftIcon={<ArrowLeft size={14} />}>
            Back to Workspaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10">
              <Folder size={16} className="text-brand-500" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">{workspace.name}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-surface-400">{workspace.type}</p>
                {workspace.role && (
                  <Badge tone={workspace.role === 'superadmin' ? 'brand' : workspace.role === 'admin' ? 'info' : 'neutral'} className="text-[9px]">
                    {workspace.role === 'superadmin' ? 'Superadmin' : workspace.role === 'admin' ? 'Admin' : 'Nonadmin'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTION_CARDS.map(({ id, title, description, icon: Icon, sub }) => (
            <motion.button
              key={id}
              variants={fadeUp}
              onClick={() => navigate(wsPath(sub))}
              className={cn(
                'group/card flex flex-col rounded-[1.375rem] p-5 text-left',
                'border border-surface-800 accent-border bg-surface-900',
                'shadow-sm transition-all duration-250 ease-snappy',
                'hover:shadow-md hover:border-surface-700 cursor-pointer',
              )}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 mb-3">
                <Icon size={20} className="text-brand-500" />
              </div>
              <h3 className="font-display text-base font-bold text-surface-50 mb-1">{title}</h3>
              <p className="text-xs text-surface-400 leading-relaxed mb-4 flex-1">{description}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                Open <ChevronRight size={13} className="transition-transform duration-200 group-hover/card:translate-x-0.5" />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </main>
    </div>
  );
}

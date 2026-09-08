import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, FolderOpen, LayoutGrid, Settings, Activity, ChevronRight,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { cn } from '@shared/utils/cn';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

const WS_ICONS: Record<string, string> = {
  Startup: '⚡', Personal: '🚀', 'College Project': '🎓',
  'Open Source': '🌐', Internship: '💼', Enterprise: '🏢',
};

const SECTION_CARDS = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'Dashboard with stats, recent projects, and quick links',
    icon: LayoutGrid,
    gradient: 'linear-gradient(135deg, #D4E8FD, #B0D4F9)',
    iconBg: '#9AC4F5',
    darkBg: '#1D3045',
    darkBorder: '#294765',
    getRoute: (wsId: string) => `/collab/${wsId}/dashboard`,
  },
  {
    id: 'projects',
    title: 'Projects',
    description: 'Manage projects, kanban boards, and task tracking',
    icon: FolderOpen,
    gradient: 'linear-gradient(135deg, #FDE8D0, #F9D4B0)',
    iconBg: '#F5C89A',
    darkBg: '#3A2B1C',
    darkBorder: '#5A4025',
    getRoute: (wsId: string) => `/collab/${wsId}/team`,
  },
  {
    id: 'people',
    title: 'People',
    description: 'Team members, roles, and member management',
    icon: Users,
    gradient: 'linear-gradient(135deg, #E8D4FD, #D4B0F9)',
    iconBg: '#C49AF5',
    darkBg: '#30213D',
    darkBorder: '#49305D',
    getRoute: (wsId: string) => `/collab/${wsId}/people`,
  },
  {
    id: 'activity',
    title: 'Activity',
    description: 'Live feed of workspace events and updates',
    icon: Activity,
    gradient: 'linear-gradient(135deg, #D4F8E8, #B0F9D4)',
    iconBg: '#4AE89A',
    darkBg: '#1D3045',
    darkBorder: '#296545',
    getRoute: (wsId: string) => `/collab/${wsId}/activity`,
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Workspace configuration, edit details, and danger zone',
    icon: Settings,
    gradient: 'linear-gradient(135deg, #F8D4D4, #F9B0B0)',
    iconBg: '#E85A5A',
    darkBg: '#3A1D1D',
    darkBorder: '#5A2525',
    getRoute: (wsId: string) => `/collab/${wsId}/settings`,
  },
];

export function WorkspaceHubPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { workspaces, loadProjects, loadMembers } = useCollaborationStore();

  const workspace = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (!workspaceId) return;
    loadProjects(workspaceId);
    loadMembers(workspaceId);
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
          <button
            onClick={() => navigate('/collab/workspaces')}
            className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800"
          >
            <ArrowLeft size={14} /> Workspaces
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-base">
              {WS_ICONS[workspace.type] || '📁'}
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
          {SECTION_CARDS.map(({ id, title, description, icon: Icon, gradient, iconBg, darkBg, darkBorder, getRoute }) => (
            <motion.button
              key={id}
              variants={fadeUp}
              onClick={() => navigate(getRoute(workspaceId!))}
              className={cn(
                'rounded-[20px] border border-transparent p-6 text-left relative overflow-hidden cursor-pointer',
                'hover:scale-[1.02] active:scale-[0.98] transition-transform',
                `dark:bg-[${darkBg}] dark:border-[${darkBorder}]`,
              )}
              style={{ background: gradient }}
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${iconBg}30` }}>
                <Icon size={20} style={{ color: iconBg }} />
              </div>
              <h3 className="text-base font-display font-bold text-black/80 dark:text-white mb-1">{title}</h3>
              <p className="text-xs text-black/40 dark:text-white/50 leading-relaxed mb-4">{description}</p>
              <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: iconBg }}>
                Open <ChevronRight size={13} />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </main>
    </div>
  );
}

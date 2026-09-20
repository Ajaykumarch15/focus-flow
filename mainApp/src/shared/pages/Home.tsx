import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, CheckCircle2,
  Flame, GitBranch, BookMarked, ShieldCheck, Activity
} from 'lucide-react';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useStore } from '@worklog/services/useStore';
import { Badge } from '@shared/components/ui/Badge';
import { ThemeToggle } from '@shared/components/ui/ThemeToggle';
import { WorkspaceCard } from '@shared/components/WorkspaceCard';

// Build a responsive srcSet from the resized WebP variants generated for each
// card image (see gen_card_images.cjs). Browsers pick the best width for the
// rendered size, avoiding upscaling on the large 2-column Team card.
const cardSrcSet = (file: string) => {
  const base = file.slice(0, file.lastIndexOf('.'));
  return `${base}-640w.webp 640w, ${base}-1280w.webp 1280w`;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { workspaces, loadWorkspaces } = useCollaborationStore();
  const { theme } = useStore();

  // IES-P2-07: real workspace counts replace the removed seed data.
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Workspace context is owned by the route (see <WorkspaceSync/> in App.tsx), so
  // navigating is enough — no need to set it manually here.
  const handleSelectPersonal = () => {
    navigate('/personal/today');
  };

  const handleSelectWorkLog = () => {
    navigate('/worklog/dashboard');
  };

  const totalMembers = workspaces.reduce((sum, ws) => sum + (ws.membersCount || 0), 0);

  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 p-4 sm:p-5 relative overflow-x-hidden overflow-y-auto flex flex-col">
      
      {/* Background Decorative Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[20%] left-[10%] w-48 h-48 rounded-full bg-brand-400/[0.06] blur-3xl pointer-events-none" />
      <div className="absolute top-[60%] left-[55%] w-40 h-40 rounded-[2rem] rotate-12 bg-info-400/[0.05] blur-2xl pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-52 h-28 rounded-full bg-brand-400/[0.04] blur-3xl pointer-events-none" />
      
      {/* Header Bar */}
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full z-10 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-brand-500/20">
            <img src={theme.mode === 'dark' ? '/darkicon.png' : '/lighticon.png'} alt="FocusFlow" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm leading-none text-surface-50">FocusFlow</h1>
            <p className="text-[10px] text-surface-400 font-medium mt-0.5">Developer Operating System</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Badge tone="neutral" icon={<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />} className="px-3 py-1 border border-surface-800 text-[11px]">
            {user?.name || 'Developer'}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full z-10 relative mt-5 flex-1">
        
        {/* Welcome Section */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-center space-y-1.5 mb-11">
          <Badge tone="brand" className="px-2.5 py-0.5 uppercase tracking-widest border border-brand-500/20 text-[10px]">
            Homepage
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-surface-50">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-cyan-400">{user?.name || 'Ajay'}</span>
          </h2>
        </motion.div>

        {/* Workspaces Grid */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          <WorkspaceCard
            variants={itemVariants}
            accent="green"
            badges={['Private', 'Personal']}
            title="Personal Workspace"
            // description="Your private productivity intelligence — overview, roadmaps, analytics, and ML-powered insights."
            image={{
              light: '/personal_workspace_hub_light.jpg',
              dark: '/personal_workspace_hub_light.jpg',
              lightSrcSet: cardSrcSet('/personal_workspace_hub_light.jpg'),
              darkSrcSet: cardSrcSet('/personal_workspace_hub_light.jpg'),
            }}
            chips={[
              { icon: <Flame size={14} className="text-emerald-400" />, label: 'Intelligence' },
              { icon: <CheckCircle2 size={14} className="text-cyan-400" />, label: 'Roadmaps & Analytics' },
            ]}
            actionLabel="Continue to Personal Workspace"
            onAction={handleSelectPersonal}
          />

          <WorkspaceCard
            variants={itemVariants}
            accent="cyan"
            badges={['Work', 'Logging']}
            title="WorkLog"
            // description="Work logs, tasks, schedule, focus timer, journal, habits, reports, and daily insights."
            image={{
              light: '/girl_with_laptop.png',
              dark: '/girl_with_laptop.png',
              lightSrcSet: cardSrcSet('/girl_with_laptop.png'),
              darkSrcSet: cardSrcSet('/girl_with_laptop.png'),
            }}
            chips={[
              { icon: <BookMarked size={14} className="text-cyan-400" />, label: 'Work Logs' },
              { icon: <CheckCircle2 size={14} className="text-sky-400" />, label: 'Tasks & Focus' },
            ]}
            actionLabel="Continue to WorkLog"
            onAction={handleSelectWorkLog}
          />

          <WorkspaceCard
            variants={itemVariants}
            accent="violet"
            className="md:col-span-2 lg:col-span-1"
            badges={['Team', 'Engineering']}
            title="Team Collaboration"
            // description="Shared engineering workspaces — projects, sprints, members, QA dashboards, and real-time collaboration."
            image={{
              light: '/team_photo.png',
              dark: '/team_photo.png',
              lightSrcSet: cardSrcSet('/team_photo.png'),
              darkSrcSet: cardSrcSet('/team_photo.png'),
            }}
            chips={[
              { icon: <GitBranch size={14} className="text-blue-400" />, label: `${workspaces.length} Workspace${workspaces.length !== 1 ? 's' : ''}` },
              { icon: <Users size={14} className="text-violet-400" />, label: `${totalMembers} Members` },
            ]}
            actionLabel="View Projects & Workspaces"
            onAction={() => navigate('/collab/workspaces')}
          />

          {(user?.roleId?.level ?? 0) >= 60 && (
            <WorkspaceCard
              variants={itemVariants}
              accent="purple"
              badges={['Admin', 'Management']}
              title="Admin Console"
              image={{
                light: '/team_photo.png',
                dark: '/team_photo.png',
                lightSrcSet: cardSrcSet('/team_photo.png'),
                darkSrcSet: cardSrcSet('/team_photo.png'),
              }}
              chips={[
                { icon: <ShieldCheck size={14} className="text-purple-400" />, label: 'User & Team Management' },
                { icon: <Activity size={14} className="text-pink-400" />, label: 'Audit & Analytics' },
              ]}
              actionLabel="Open Admin Console"
              onAction={() => navigate('/admin/audit')}
            />
          )}

        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-surface-400 z-10 relative pt-3 pb-0 border-t border-surface-800/60 max-w-6xl mx-auto w-full">
        FocusFlow Developer Workspace Platform · Personal & Team Collaboration Engine
      </footer>

    </div>
  );
}

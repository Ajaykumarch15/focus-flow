import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Building2, ArrowRight, Users, CheckCircle2,
  Flame, GitBranch, Shield
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCollaborationStore } from '../store/useCollaborationStore';
import { useStore } from '../store/useStore';
import { Badge } from '../components/ui/Badge';

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

export function WorkspaceHub() {
  const navigate = useNavigate();
  const { user, setWorkspace } = useAuthStore();
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

  const handleSelectPersonal = () => {
    setWorkspace('personal');
    navigate('/dashboard');
  };

  const totalMembers = workspaces.reduce((sum, ws) => sum + (ws.membersCount || 0), 0);

  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 p-4 sm:p-6 relative overflow-x-hidden overflow-y-auto flex flex-col">
      
      {/* Background Decorative Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header Bar */}
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-brand-500/20">
            <img src={theme.mode === 'dark' ? '/darkicon.png' : '/lighticon.png'} alt="FocusFlow" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none text-surface-50">FocusFlow</h1>
            <p className="text-[11px] text-surface-400 font-medium mt-0.5">Developer Operating System</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge tone="neutral" icon={<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />} className="px-3.5 py-1.5 border border-surface-800">
            {user?.name || 'Developer'}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full z-10 relative mt-8 flex-1">
        
        {/* Welcome Section */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center space-y-2 mb-6">
          <Badge tone="brand" className="px-3 py-1 uppercase tracking-widest border border-brand-500/20">
            Workspace Hub
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-surface-50">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-cyan-400">{user?.name || 'Ajay'}</span>
          </h2>
          <p className="text-sm text-surface-400 max-w-md mx-auto">
            Choose where you want to work today. Switch between your personal productivity system and engineering workspaces anytime.
          </p>
        </motion.div>

        {/* Workspaces Grid */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ───────── 1. PERSONAL WORKSPACE CARD ───────── */}
          <motion.div variants={itemVariants} className="group relative rounded-3xl border border-surface-800 bg-surface-900/90 hover:border-brand-500/50 transition-all duration-300 p-6 shadow-xl hover:shadow-2xl hover:shadow-brand-500/10 flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <User size={140} className="text-brand-400" />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xl font-bold">
                  👤
                </div>
                <Badge tone="brand" className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border border-brand-500/20">
                  Private & Personal
                </Badge>
              </div>

              <div>
                <h3 className="text-xl font-display font-extrabold text-surface-50 group-hover:text-brand-300 transition-colors">
                  Personal Workspace
                </h3>
                <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                  Your private productivity system. Today landing, personal tasks, focus timer, work logs, reflection journal, and personal reports.
                </p>
              </div>

              {/* Stats pill */}
              <div className="pt-3 flex items-center gap-4 text-xs font-semibold text-surface-300">
                <Badge tone="neutral" icon={<Flame size={14} className="text-amber-400" />} className="px-3 py-1.5 rounded-xl border border-surface-800">
                  Deep Focus
                </Badge>
                <Badge tone="neutral" icon={<CheckCircle2 size={14} className="text-emerald-400" />} className="px-3 py-1.5 rounded-xl border border-surface-800">
                  Private Tasks
                </Badge>
              </div>
            </div>

            <div className="pt-6 relative z-10">
              <button onClick={handleSelectPersonal}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-surface-800 hover:bg-brand-500 text-surface-100 hover:text-white font-bold text-xs rounded-2xl transition-all duration-200 group-hover:shadow-lg group-hover:shadow-brand-500/25">
                Continue to Personal Workspace <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>

          {/* ───────── 2. TEAM COLLABORATION CARD ───────── */}
          <motion.div variants={itemVariants}
            className="group relative rounded-3xl border border-surface-800 bg-surface-900/90 hover:border-cyan-500/50 transition-all duration-300 p-6 shadow-xl hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col justify-between overflow-hidden">

            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Building2 size={140} className="text-cyan-400" />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xl font-bold">
                  🏢
                </div>
                <Badge tone="info" className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border border-cyan-500/20">
                  Team & Engineering
                </Badge>
              </div>

              <div>
                <h3 className="text-xl font-display font-extrabold text-surface-50 group-hover:text-cyan-300 transition-colors">
                  Team Collaboration
                </h3>
                <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                  Shared engineering workspaces. Projects, sprints, features, team members, QA dashboards, reports, and real-time collaboration.
                </p>
              </div>

              {/* Summary stats */}
              <div className="pt-3 flex items-center gap-4 text-xs font-semibold text-surface-300 flex-wrap">
                <Badge tone="neutral" icon={<GitBranch size={14} className="text-cyan-400" />} className="px-3 py-1.5 rounded-xl border border-surface-800">
                  {workspaces.length} Workspace{workspaces.length !== 1 ? 's' : ''}
                </Badge>
                <Badge tone="neutral" icon={<Users size={14} className="text-violet-400" />} className="px-3 py-1.5 rounded-xl border border-surface-800">
                  {totalMembers} Members
                </Badge>
                <Badge tone="neutral" icon={<Shield size={14} className="text-emerald-400" />} className="px-3 py-1.5 rounded-xl border border-surface-800">
                  RBAC
                </Badge>
              </div>
            </div>

            <div className="pt-6 relative z-10">
              <button onClick={() => navigate('/team')}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-surface-800 hover:bg-cyan-500 text-surface-100 hover:text-white font-bold text-xs rounded-2xl transition-all duration-200 group-hover:shadow-lg group-hover:shadow-cyan-500/25">
                View Projects & Workspaces <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>

        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-surface-500 z-10 relative pt-4 pb-0 border-t border-surface-800/60 max-w-6xl mx-auto w-full">
        FocusFlow Developer Workspace Platform · Personal & Team Collaboration Engine
      </footer>

    </div>
  );
}

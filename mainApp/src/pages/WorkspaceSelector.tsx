import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { WORKSPACE_LIST, type WorkspaceType } from '../types/workspace';

const stagger = { show: { transition: { staggerChildren: 0.12 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export function WorkspaceSelector() {
  const { user, setWorkspace: setAuthWorkspace } = useAuthStore();
  const { setWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const handleSelect = (ws: WorkspaceType) => {
    setWorkspace(ws);
    setAuthWorkspace(ws === 'collab' ? 'collab' : ws);
    navigate(ws === 'personal' ? '/dashboard' : ws === 'work' ? '/worklog/dashboard' : '/collab/dashboard');
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 20%, #8b5cf610, transparent 60%)' }} />

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl relative z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-surface-50 mb-2">
            Where do you want to focus?
          </h1>
          <p className="text-surface-400 text-sm">
            Choose a workspace to continue{user?.name ? `, ${user.name}` : ''}.
          </p>
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {WORKSPACE_LIST.map((ws) => {
            const Icon = ws.icon;
            return (
              <motion.div key={ws.id} variants={fadeUp}>
                <button
                  onClick={() => handleSelect(ws.id)}
                  className="w-full text-left group bg-surface-900 border border-surface-800 hover:border-surface-700 rounded-[22px] p-6 sm:p-7 transition-all duration-200 hover:shadow-lg hover:shadow-black/10 cursor-pointer"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: `${ws.color}15`, color: ws.color }}
                  >
                    <Icon size={22} />
                  </div>
                  <h2 className="text-lg font-display font-bold text-surface-50 mb-1">{ws.title}</h2>
                  <p className="text-xs text-surface-400 leading-relaxed mb-5">{ws.subtitle}</p>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-surface-400 group-hover:text-surface-200 transition-colors">
                    <span>Enter {ws.title}</span>
                    <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}

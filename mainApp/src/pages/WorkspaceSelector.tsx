import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, LayoutDashboard, Users, BarChart3, Activity,
  Target, ArrowRight, Zap, Clock, CheckSquare,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { useEffect, useState } from 'react';
import { api } from '../utils/api';

const stagger = { show: { transition: { staggerChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function WorkspaceSelector() {
  const { user, setWorkspace } = useAuthStore();
  const { tasks } = useStore();
  const navigate = useNavigate();
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminStatsError, setAdminStatsError] = useState(false);

  useEffect(() => {
    api.admin.getStats()
      .then(setAdminStats)
      .catch(() => setAdminStatsError(true));
  }, []);

  const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'paused');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const todoTasks = tasks.filter(t => t.status === 'todo');

  const handleSelect = (workspace: 'personal' | 'admin') => {
    setWorkspace(workspace);
    if (workspace === 'personal') navigate('/dashboard');
    else navigate('/admin/overview');
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 20%, #8b5cf610, transparent 50%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 80%, #0ea5e910, transparent 50%)' }} />

      <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 w-full max-w-3xl">
        <motion.div variants={fadeUp} className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-brand-500/20">
            <Target size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-extrabold text-surface-50 mb-2">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-surface-400 text-sm">Choose your workspace to get started</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.button variants={fadeUp} whileHover={{ y: -4, scale: 1.01 }} whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect('personal')}
            className="group relative text-left rounded-2xl border border-surface-800 bg-surface-900 p-7 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-5">
              <LayoutDashboard size={22} className="text-brand-400" />
            </div>
            <h2 className="text-lg font-display font-bold text-surface-50 mb-1.5">Personal Workspace</h2>
            <p className="text-sm text-surface-400 mb-5 leading-relaxed">
              Manage your tasks, work logs, reports, and personal productivity.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl bg-surface-850 p-3 text-center">
                <Clock size={14} className="text-brand-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-surface-100">{activeTasks.length}</p>
                <p className="text-[10px] text-surface-500">Active Tasks</p>
              </div>
              <div className="rounded-xl bg-surface-850 p-3 text-center">
                <CheckSquare size={14} className="text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-surface-100">{completedTasks.length}</p>
                <p className="text-[10px] text-surface-500">Completed</p>
              </div>
              <div className="rounded-xl bg-surface-850 p-3 text-center">
                <Zap size={14} className="text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-surface-100">{todoTasks.length}</p>
                <p className="text-[10px] text-surface-500">To Do</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-brand-400 font-semibold text-sm group-hover:gap-3 transition-all">
              Continue Working <ArrowRight size={16} />
            </div>
          </motion.button>

          <motion.button variants={fadeUp} whileHover={{ y: -4, scale: 1.01 }} whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect('admin')}
            className="group relative text-left rounded-2xl border border-surface-800 bg-surface-900 p-7 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-5">
              <ShieldCheck size={22} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-display font-bold text-surface-50 mb-1.5">Administration Console</h2>
            <p className="text-sm text-surface-400 mb-5 leading-relaxed">
              Manage users, teams, organization analytics, and system activity.
            </p>
            {adminStatsError ? (
              <div className="rounded-xl bg-surface-850 p-4 mb-6 text-center">
                <p className="text-xs text-red-400 font-semibold">Admin stats unavailable</p>
                <p className="text-[10px] text-surface-500 mt-1">Could not load organization analytics.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-xl bg-surface-850 p-3 text-center">
                  <Users size={14} className="text-purple-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-surface-100">{adminStats?.totalUsers || 0}</p>
                  <p className="text-[10px] text-surface-500">Total Users</p>
                </div>
                <div className="rounded-xl bg-surface-850 p-3 text-center">
                  <Activity size={14} className="text-emerald-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-surface-100">{adminStats?.activeUsers || 0}</p>
                  <p className="text-[10px] text-surface-500">Active Now</p>
                </div>
                <div className="rounded-xl bg-surface-850 p-3 text-center">
                  <BarChart3 size={14} className="text-amber-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-surface-100">{adminStats?.todaySessionCount || 0}</p>
                  <p className="text-[10px] text-surface-500">Sessions</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm group-hover:gap-3 transition-all">
              Open Admin Console <ArrowRight size={16} />
            </div>
          </motion.button>
        </div>

        <motion.p variants={fadeUp} className="text-center text-xs text-surface-600 mt-8">
          Switch between workspaces at any time from the sidebar
        </motion.p>
      </motion.div>
    </div>
  );
}

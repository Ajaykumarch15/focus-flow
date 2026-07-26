import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, LayoutDashboard, Users, BarChart3, Activity,
  Settings, ChevronLeft, ChevronRight, LogOut, Target,
  Globe, ArrowLeft, Zap, TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

const ADMIN_NAV = [
  { to: '/admin/overview', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/people',  icon: Users,            label: 'People' },
  { to: '/admin/teams',   icon: Globe,            label: 'Teams' },
  { to: '/admin/analytics', icon: BarChart3,      label: 'Analytics' },
  { to: '/admin/activity', icon: Activity,        label: 'Activity' },
  { to: '/admin/settings', icon: Settings,        label: 'Settings' },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, setWorkspace } = useAuthStore();
  const navigate = useNavigate();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="relative flex flex-col h-screen bg-surface-900 border-r border-surface-800 z-20 flex-shrink-0 shadow-sm"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-800">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <ShieldCheck size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="min-w-0">
              <p className="font-display font-bold text-surface-50 text-sm leading-tight whitespace-nowrap">FocusFlow</p>
              <p className="text-[10px] text-purple-400 font-medium whitespace-nowrap">Administration</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {ADMIN_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'bg-purple-500/10 text-purple-400 font-semibold border border-purple-500/15'
                  : 'text-surface-400 hover:text-surface-50 hover:bg-surface-850'
              }`
            }>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div layoutId="adminActiveNav" className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-purple-500" />
                )}
                <Icon size={18} className="flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                      className="text-sm font-medium whitespace-nowrap">{label}</motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Back to workspace */}
      <div className="px-2.5 pb-2">
        <button onClick={() => { setWorkspace('personal'); navigate('/dashboard'); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-surface-400 hover:text-brand-400 hover:bg-brand-500/5 transition-all">
          <ArrowLeft size={18} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-sm font-medium whitespace-nowrap">Back to Personal</motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* User */}
      <div className="p-3 border-t border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-50 truncate">{user?.name}</p>
                <p className="text-[10px] text-purple-400 font-medium uppercase">Administrator</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { logout(); navigate('/login'); }}
                className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                title="Sign out">
                <LogOut size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-all z-10">
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}

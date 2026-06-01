import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, BarChart3, BookOpen,
  Settings, Zap, ChevronLeft, ChevronRight,
  Target, LogOut, BookMarked, LineChart, Activity,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/worklog',   icon: BookMarked,      label: 'Work Logs'  },
  { to: '/reports',   icon: LineChart,       label: 'Reports'    },  // ← NEW
  { to: '/tasks',     icon: CheckSquare,     label: 'Tasks'      },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics'  },
  { to: '/journal',   icon: BookOpen,        label: 'Journal'    },
  { to: '/habits',    icon: Activity,        label: 'Habits'     },
  { to: '/focus',     icon: Zap,             label: 'Focus Mode' },
  { to: '/settings',  icon: Settings,        label: 'Settings'   },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout }          = useAuthStore();
  const { activeTask, activeTimerState, display } = useActiveTimer();
  const navigate = useNavigate();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="relative flex flex-col h-screen bg-surface-950 border-r border-surface-800 z-20 flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-800">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
          <Target size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="font-display font-bold text-white text-lg whitespace-nowrap"
            >
              FocusFlow
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Active Timer */}
      <AnimatePresence>
        {activeTask && !collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-3 mt-3"
          >
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${activeTimerState === 'running' ? 'bg-brand-400 animate-pulse' : 'bg-yellow-400'}`} />
                <span className="text-xs text-surface-300 truncate">{activeTask.title}</span>
              </div>
              <div className="timer-display text-brand-400 font-bold text-xl">{display}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative
              ${isActive ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20' : 'text-surface-300 hover:text-white hover:bg-surface-800'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className="flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >{label}</motion.span>
                  )}
                </AnimatePresence>
                {isActive && <motion.div layoutId="activeNav" className="absolute inset-0 rounded-xl bg-brand-500/10 -z-10" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-400 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-surface-400 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { logout(); navigate('/login'); }}
                className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                title="Sign out"
              >
                <LogOut size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-300 hover:text-white hover:bg-surface-700 transition-all z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}

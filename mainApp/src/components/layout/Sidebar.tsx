import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, BookOpen,
  Settings, Zap, ChevronLeft, ChevronRight,
  LogOut, BookMarked, LineChart, Activity, Trophy, ShieldCheck, Building2, History, Library, Lightbulb, Map, BarChart3, Calendar, Clock, Brain,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { useStore } from '../../store/useStore';


const PERSONAL_ROADMAPS_NAV = [
  { to: '/personal', icon: Brain, label: 'Personal' },
  { to: '/roadmaps', icon: Map, label: 'Roadmaps' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

const WORKLOG_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Today'  },
  { to: '/tasks',     icon: CheckSquare,     label: 'Tasks'      },
  { to: '/schedule',  icon: Calendar,        label: 'Schedule'   },
  { to: '/worklog',   icon: BookMarked,      label: 'Work Logs'  },
  { to: '/journal',   icon: BookOpen,        label: 'Journal'    },
  { to: '/habits',    icon: Activity,        label: 'Habits'     },
  { to: '/focus',     icon: Zap,             label: 'Focus Mode' },
  { to: '/reports',   icon: LineChart,       label: 'Reports'    },
  { to: '/insights',  icon: Lightbulb,       label: 'Insights'   },
  { to: '/knowledge', icon: Library,         label: 'Knowledge'  },
];


const COLLAB_NAV = [
  { to: '/hub',         icon: Building2,  label: 'Workspace Hub' },
  { to: '/leaderboard', icon: Trophy,     label: 'Leaderboard'   },
  { to: '/activity',    icon: History,    label: 'Activity'      },
];

const SETTINGS_NAV = [
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function NavItem({ to, icon: Icon, label, collapsed }: { to: string; icon: any; label: string; collapsed: boolean }) {
  return (
    <NavLink key={to} to={to}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
        ${isActive ? 'text-brand-500 dark:text-brand-400 font-semibold' : 'text-surface-300 hover:text-surface-50 hover:bg-surface-850'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <>
              <motion.div layoutId="activeNavBg" className="absolute inset-0 rounded-xl bg-brand-500/10 border border-brand-500/15" />
              <motion.div layoutId="activeNavLeft" className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-500" />
            </>
          )}
          <Icon size={18} className={`flex-shrink-0 transition-colors ${isActive ? '' : 'group-hover:text-surface-50'}`} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                className="text-sm font-medium whitespace-nowrap">{label}</motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {!collapsed && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, setWorkspace } = useAuthStore();
  const navigate = useNavigate();
  const workspace = useAuthStore((s) => s.workspace);
  const { activeTaskId, activeTimerState, display: activeDisplay } = useActiveTimer();
  const { tasks, theme } = useStore();

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const isReducedMotion = theme?.reducedMotion;


  return (
    <motion.aside
      initial={{ width: 240 }}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen bg-surface-900 border-r border-surface-800 flex flex-col overflow-hidden flex-shrink-0"
    >
      {/* Logo / Header */}
      <div className="p-3 flex items-center justify-between border-b border-surface-800">
        <button
          onClick={() => navigate('/hub')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
            <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="font-display font-extrabold text-surface-50 text-sm">FocusFlow</motion.span>
          )}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-all"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {workspace === 'personal' ? (
          <>
            <SectionLabel collapsed={collapsed}>Personal</SectionLabel>
            {PERSONAL_ROADMAPS_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
            <div className={`my-3 border-t border-surface-800 ${collapsed ? 'mx-2' : 'mx-4'}`} />
            <SectionLabel collapsed={collapsed}>WorkLog</SectionLabel>
            {WORKLOG_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </>
        ) : workspace === 'collab' ? (
          <>
            <SectionLabel collapsed={collapsed}>Workspace</SectionLabel>
            {WORKLOG_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
            <div className={`my-3 border-t border-surface-800 ${collapsed ? 'mx-2' : 'mx-4'}`} />
            <SectionLabel collapsed={collapsed}>Collaboration</SectionLabel>
            {COLLAB_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </>
        ) : (
          <>
            <SectionLabel collapsed={collapsed}>WorkLog</SectionLabel>
            {WORKLOG_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
            <div className={`my-3 border-t border-surface-800 ${collapsed ? 'mx-2' : 'mx-4'}`} />
            <SectionLabel collapsed={collapsed}>Collaboration</SectionLabel>
            {COLLAB_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </>
        )}

        {user?.role === 'admin' && (
          <>
            <div className={`my-3 border-t border-surface-800 ${collapsed ? 'mx-2' : 'mx-4'}`} />
            <button onClick={() => { setWorkspace('admin'); navigate('/admin/audit'); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative text-surface-400 hover:text-purple-400 hover:bg-purple-500/5 w-full`}>
              <ShieldCheck size={18} className="flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                    className="text-sm font-medium whitespace-nowrap">Admin Console</motion.span>
                )}
              </AnimatePresence>
            </button>
          </>
        )}

        <div className={`my-3 border-t border-surface-800 ${collapsed ? 'mx-2' : 'mx-4'}`} />
        {SETTINGS_NAV.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Sidebar Active Timer Indicator */}
      {activeTaskId && (
        <div className="px-2 py-2 border-t border-surface-800 bg-surface-950/80">
          <button
            type="button"
            onClick={() => navigate(`/focus`)}
            title={activeTask ? `Active Task: ${activeTask.title}` : 'Active Timer'}
            aria-label={`Active timer for ${activeTask?.title || 'task'}: ${activeDisplay}, status ${activeTimerState}`}
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              activeTimerState === 'running'
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="relative flex items-center justify-center flex-shrink-0">
              <Clock size={16} className={activeTimerState === 'running' ? 'text-brand-400' : 'text-amber-400'} aria-hidden="true" />
              {activeTimerState === 'running' && !isReducedMotion && (
                <span className="absolute inset-0 rounded-full bg-brand-400/30 animate-ping" />
              )}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-bold truncate">{activeDisplay}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    activeTimerState === 'running' ? 'bg-brand-500/20 text-brand-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {activeTimerState}
                  </span>
                </div>
                {activeTask && (
                  <p className="text-[11px] text-surface-300 truncate mt-0.5">
                    {activeTask.title}
                  </p>
                )}
              </div>
            )}
          </button>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-400 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-50 truncate">{user?.name}</p>
                <p className="text-xs text-surface-400 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button onClick={logout} className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Logout">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, BookOpen,
  Settings, Zap, ChevronLeft, ChevronRight,
  LogOut, BookMarked, LineChart,
  Map,
  User, Users, ChevronDown, FolderOpen, Library,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { WORKSPACES, WORKSPACE_LIST, type WorkspaceType } from '../../types/workspace';

type NavItem = {
  to: string;
  icon: any;
  label: string;
};

const PERSONAL_NAV: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/roadmaps', icon: Map, label: 'Roadmaps' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/focus', icon: Zap, label: 'Focus' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/reports', icon: LineChart, label: 'Analytics' },
];

const WORK_NAV: NavItem[] = [
  { to: '/worklog/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/worklog', icon: BookMarked, label: 'Work Logs' },
  { to: '/roadmaps', icon: Map, label: 'Roadmaps' },
  { to: '/reports', icon: LineChart, label: 'Reports' },
  { to: '/knowledge', icon: Library, label: 'Knowledge' },
];

const COLLAB_NAV: NavItem[] = [
  { to: '/collab/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/hub', icon: FolderOpen, label: 'Projects' },
  { to: '/tasks', icon: CheckSquare, label: 'My Tasks' },
  { to: '/roadmaps', icon: Map, label: 'Roadmaps' },
  { to: '/team', icon: Users, label: 'Team' },
];

function getNavForWorkspace(ws: WorkspaceType): NavItem[] {
  switch (ws) {
    case 'work': return WORK_NAV;
    case 'collab': return COLLAB_NAV;
    default: return PERSONAL_NAV;
  }
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { activeWorkspace, setWorkspace } = useWorkspaceStore();
  const { activeTask, activeTimerState, display } = useActiveTimer();
  const navigate = useNavigate();

  const wsConfig = WORKSPACES[activeWorkspace];
  const NavIcon = wsConfig.icon;
  const navItems = getNavForWorkspace(activeWorkspace);

  const handleWorkspaceSwitch = (ws: WorkspaceType) => {
    setWorkspace(ws);
    setWsMenuOpen(false);
    navigate(ws === 'personal' ? '/dashboard' : ws === 'work' ? '/worklog/dashboard' : '/collab/dashboard');
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-screen bg-surface-900 border-r border-surface-800/60 flex flex-col relative z-30 select-none"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-surface-800/60 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
          <Zap size={16} className="text-brand-400" />
        </div>
        {!collapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-display font-extrabold text-surface-50 tracking-tight whitespace-nowrap">
            FocusFlow
          </motion.span>
        )}
      </div>

      {/* Workspace Switcher */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1 relative">
          <button
            onClick={() => setWsMenuOpen(!wsMenuOpen)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-surface-800/60 hover:bg-surface-800 transition-colors text-left"
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${wsConfig.color}20`, color: wsConfig.color }}>
              <NavIcon size={13} />
            </div>
            <span className="text-xs font-semibold text-surface-200 truncate flex-1">{wsConfig.title}</span>
            <ChevronDown size={13} className={`text-surface-400 transition-transform duration-150 ${wsMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {wsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWsMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-3 right-3 top-full mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 p-1.5"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                    Switch Workspace
                  </div>
                  {WORKSPACE_LIST.map((ws) => {
                    const WIcon = ws.icon;
                    const isActive = ws.id === activeWorkspace;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => handleWorkspaceSwitch(ws.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                          isActive ? 'bg-surface-700 text-surface-50' : 'text-surface-300 hover:bg-surface-700/50 hover:text-surface-100'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ws.color}15`, color: ws.color }}>
                          <WIcon size={12} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{ws.title}</p>
                          <p className="text-[10px] text-surface-500 truncate">{ws.subtitle}</p>
                        </div>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400'
                  : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-200'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}

        {/* Settings always at bottom area of nav */}
        <div className="pt-3 mt-3 border-t border-surface-800/60">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400'
                  : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-200'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">Settings</span>}
          </NavLink>
        </div>
      </nav>

      {/* Active Timer mini-player */}
      {!collapsed && activeTask && activeTimerState === 'running' && (
        <div className="mx-3 mb-2 px-3 py-2 bg-brand-500/10 border border-brand-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-xs">
            <Zap size={12} className="text-brand-400 animate-pulse" />
            <span className="text-brand-300 font-medium truncate">{activeTask.title}</span>
          </div>
          <p className="text-[11px] text-brand-400/70 mt-0.5 ml-5">{display}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-3 border-t border-surface-800/60 flex-shrink-0">
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-surface-300" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-surface-200 truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-surface-500 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-800 transition-colors"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-surface-800 border border-surface-700 rounded-full flex items-center justify-center text-surface-400 hover:text-surface-200 transition-colors z-40"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}

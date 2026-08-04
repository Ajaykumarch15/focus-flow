import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, FolderOpen, Layers, Users, UserCheck, Sparkles, AlertOctagon,
  Clock, LineChart, BarChart3, BookOpen, Calendar, Settings, ShieldCheck,
  ChevronDown, ChevronLeft, PanelLeftOpen, Search, ArrowLeft, Bell, Menu
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { GlobalCommandPalette } from '../collaboration/GlobalCommandPalette';
import { ToastContainer } from '../ui/ToastContainer';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getWorkspaceMaturityLevel, isFeatureVisibleForMaturity } from '../../utils/workspaceMaturity';

export function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user, setWorkspace: setAuthWorkspace } = useAuthStore();
  const {
    workspaces, workspacesLoading, activeWorkspaceId, setActiveWorkspace, loadCollabData,
    tasks, blockers, docs, projects, members, sprints, notifications, markAllNotificationsRead
  } = useCollaborationStore();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();
  const location = useLocation();

  const activeWs = workspaces.find((w) => w.id === (workspaceId || activeWorkspaceId)) || workspaces[0];

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  useEffect(() => {
    if (workspaceId && workspaceId !== activeWorkspaceId) setActiveWorkspace(workspaceId);
    loadCollabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const [wsSidebarCollapsed, setWsSidebarCollapsed] = useState(false);
  const [showWsDropdown, setShowWsDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  if (!activeWs) {
    return (
      <div className="flex h-screen bg-surface-950 text-surface-50 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-surface-400">
          <div className="w-8 h-8 border-2 border-surface-700 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold">
            {workspacesLoading ? 'Loading workspace…' : 'No workspaces yet'}
          </p>
        </div>
      </div>
    );
  }

  const wsTasks = tasks.filter((t) => t.workspaceId === activeWs.id);
  const openBlockers = blockers.filter((b) => b.workspaceId === activeWs.id && b.status !== 'resolved');
  const wsDocs = docs.filter((d) => d.workspaceId === activeWs.id);
  const wsProjects = projects.filter((p) => p.workspaceId === activeWs.id);
  const wsMembers = members;
  const wsSprints = sprints.filter((s) => s.workspaceId === activeWs.id);
  const activeSprintCount = wsSprints.filter((s) => s.status === 'active').length;
  const unreadNotifications = notifications.filter((n) => !n.read);

  const maturityLevel = getWorkspaceMaturityLevel({
    membersCount: wsMembers.length,
    projectsCount: wsProjects.length,
    sprintsCount: wsSprints.length,
    featuresCount: 0,
    blockersCount: openBlockers.length,
    qaTasksCount: wsTasks.filter(t => t.sprintStatus === 'review').length,
    reportsCount: 0,
  });

  interface NavItem {
    to: string;
    label: string;
    icon: typeof Zap;
    color: string;
    badge?: number;
    key?: 'teams' | 'projects' | 'sprints' | 'qa' | 'analytics' | 'reports' | 'blockers' | 'admin';
  }
  const rawNavGroups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Planning',
      items: [
        { to: `/w/${activeWs.id}/overview`, label: 'Mission Control', icon: Zap, color: 'text-amber-400' },
        { to: `/w/${activeWs.id}/projects`, key: 'projects', label: 'Projects', icon: FolderOpen, color: 'text-cyan-400', badge: wsProjects.length },
        { to: `/w/${activeWs.id}/sprints`, key: 'sprints', label: 'Sprint Board', icon: Layers, color: 'text-brand-400', badge: wsTasks.length },
        { to: `/w/${activeWs.id}/features`, label: 'Features', icon: Sparkles, color: 'text-purple-400' },
      ],
    },
    {
      label: 'Collaboration',
      items: [
        { to: `/w/${activeWs.id}/teams`, key: 'teams', label: 'Teams', icon: Users, color: 'text-emerald-400' },
        { to: `/w/${activeWs.id}/members`, label: 'Members', icon: UserCheck, color: 'text-sky-400' },
        { to: `/w/${activeWs.id}/qa`, key: 'qa', label: 'QA Dashboard', icon: ShieldCheck, color: 'text-indigo-400' },
        { to: `/w/${activeWs.id}/activity`, label: 'Activity', icon: Clock, color: 'text-pink-400' },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: `/w/${activeWs.id}/reports`, key: 'reports', label: 'Reports', icon: LineChart, color: 'text-blue-400' },
        { to: `/w/${activeWs.id}/analytics`, key: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-teal-400' },
      ],
    },
    {
      label: 'Knowledge',
      items: [
        { to: `/w/${activeWs.id}/knowledge`, label: 'Knowledge Base', icon: BookOpen, color: 'text-violet-400', badge: wsDocs.length },
        { to: `/w/${activeWs.id}/calendar`, label: 'Calendar', icon: Calendar, color: 'text-amber-300' },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: `/w/${activeWs.id}/settings`, key: 'admin', label: 'Settings', icon: Settings, color: 'text-surface-400' },
      ],
    },
  ];

  const navGroups = rawNavGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.key || isFeatureVisibleForMaturity(item.key, maturityLevel)),
    }))
    .filter((g) => g.items.length > 0);

  const renderWorkspaceSidebar = () => (
    <aside className="w-64 bg-surface-900 border-r border-surface-800 flex flex-col flex-shrink-0 z-20 h-full">
      <div className="p-4 border-b border-surface-800 flex items-center justify-between">
        <Button variant="ghost" size="xs" onClick={() => navigate('/hub')}
          className="flex items-center gap-2 text-xs font-bold text-surface-400 hover:text-surface-50 transition-colors" leftIcon={<ArrowLeft size={14} />}>
          Workspace Hub
        </Button>

        <Button variant="ghost" size="xs" onClick={() => { setAuthWorkspace('personal'); navigate('/dashboard'); }}
          className="text-[11px] font-bold text-brand-400 hover:text-brand-300 bg-brand-500/10 px-2 py-1 rounded-md border border-brand-500/20">
          Personal App →
        </Button>
      </div>

      <div className="p-3 border-b border-surface-800/80 relative">
        <button onClick={() => setShowWsDropdown(!showWsDropdown)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface-850/70 hover:bg-surface-850 border border-surface-700/60 transition-all text-left group">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-lg shadow-md shrink-0">
              {activeWs.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-surface-100 truncate group-hover:text-brand-300 transition-colors">
                {activeWs.name}
              </p>
              <p className="text-[10px] text-surface-400 capitalize">{activeWs.type} · {activeWs.membersCount} members</p>
            </div>
          </div>
          <ChevronDown size={14} className={`text-surface-500 transition-transform shrink-0 ${showWsDropdown ? 'rotate-180' : ''}`} />
        </button>

        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          {[
            { label: 'Members', value: wsMembers.length },
            { label: 'Projects', value: wsProjects.length },
            { label: 'Active', value: activeSprintCount },
            { label: 'Tasks', value: wsTasks.length },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-surface-850/60 border border-surface-800 py-1.5">
              <p className="text-xs font-bold text-surface-100 leading-none">{s.value}</p>
              <p className="text-[9px] text-surface-500 mt-1 font-semibold uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {showWsDropdown && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="absolute left-3 right-3 top-full mt-1 rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl p-2 z-50 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-surface-500">
                Switch Workspace
              </div>
              {workspaces.map((ws) => (
                <button key={ws.id}
                  onClick={() => {
                    setActiveWorkspace(ws.id);
                    setShowWsDropdown(false);
                    navigate(`/w/${ws.id}/overview`);
                  }}
                  className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                    ws.id === activeWs.id ? 'bg-brand-500/15 text-surface-50 border border-brand-500/30' : 'hover:bg-surface-800 text-surface-300'
                  }`}>
                  <span className="text-lg">{ws.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{ws.name}</p>
                    <p className="text-[10px] text-surface-400">{ws.type}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto no-scrollbar space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-surface-600">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isActive ? 'bg-brand-500/15 text-surface-50 border border-brand-500/30 shadow-sm' : 'text-surface-400 hover:text-surface-100 hover:bg-surface-850/50'
                    }`
                  }>
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5">
                        <item.icon size={16} className={isActive ? item.color : 'text-surface-400'} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-800 text-surface-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-surface-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-surface-100 truncate">{user?.name}</p>
            <span className="text-[10px] text-surface-400 capitalize">Developer</span>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-surface-950 text-surface-50 overflow-hidden">
      {!wsSidebarCollapsed && (
        <div className="hidden lg:flex flex-shrink-0 relative">
          {renderWorkspaceSidebar()}
          <button onClick={() => setWsSidebarCollapsed(true)}
            className="absolute -right-3 top-20 z-30 w-6 h-6 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-300 hover:text-surface-50 hover:bg-surface-700 transition-all"
            aria-label="Close workspace sidebar">
            <ChevronLeft size={12} />
          </button>
        </div>
      )}

      {wsSidebarCollapsed && (
        <div className="hidden lg:flex flex-col items-center pt-5 w-11 flex-shrink-0 bg-surface-900 border-r border-surface-800">
          <button onClick={() => setWsSidebarCollapsed(false)}
            className="w-8 h-8 rounded-xl bg-surface-850 border border-surface-700/60 flex items-center justify-center text-surface-400 hover:text-surface-50 hover:bg-surface-700 transition-all"
            aria-label="Open workspace sidebar">
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <div key="sidebar-backdrop" className="lg:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileSidebarOpen(false)} />
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-64"
            >
              {renderWorkspaceSidebar()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="min-h-14 py-2 border-b border-surface-800 px-3 sm:px-6 flex items-center justify-between gap-2 flex-wrap bg-surface-900/60 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-surface-850 border border-surface-700/60 text-surface-400 hover:text-surface-200 transition-all"
              aria-label="Open sidebar">
              <Menu size={18} />
            </button>
            <button onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-850 border border-surface-700/70 text-xs text-surface-400 hover:text-surface-200 transition-all">
              <Search size={14} />
              <span>Search Workspace...</span>
              <kbd className="text-[10px] font-mono bg-surface-800 px-1.5 py-0.5 rounded border border-surface-700">Cmd+K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {openBlockers.length > 0 && (
              <Badge tone="danger" icon={<AlertOctagon size={14} />} className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20 animate-pulse">
                {openBlockers.length} Open Blocker{openBlockers.length > 1 ? 's' : ''}
              </Badge>
            )}

            <div className="relative">
              <Button variant="outline" size="icon-sm" onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Notifications"
                className="p-2 rounded-xl bg-surface-850 hover:bg-surface-800 border border-surface-700/60 text-surface-300 relative transition-colors">
                <Bell size={16} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-white font-bold text-[9px] flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                )}
              </Button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl p-4 z-50 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-800">
                      <span className="text-xs font-bold text-surface-200">Notifications</span>
                      <Button variant="ghost" size="xs" onClick={markAllNotificationsRead} className="text-[10px] text-brand-400 hover:underline">
                        Mark all as read
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {notifications.map((n) => (
                        <div key={n.id} className={`p-2.5 rounded-xl text-xs space-y-1 ${n.read ? 'bg-surface-850/40 text-surface-400' : 'bg-brand-500/10 text-surface-100 border border-brand-500/20'}`}>
                          <p className="font-bold">{n.title}</p>
                          <p className="text-[11px] text-surface-300">{n.body}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <GlobalCommandPalette isOpen={showSearch} onClose={() => setShowSearch(false)} />
      <ToastContainer />
    </div>
  );
}

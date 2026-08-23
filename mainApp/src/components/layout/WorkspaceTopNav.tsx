import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Search, Bell, Settings, Check, LayoutGrid } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { FocusFlowLogo } from '../ui/FocusFlowLogo';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { GlobalCommandPalette } from '../collaboration/GlobalCommandPalette';

// Engineering Workspace top bar: product identity + breadcrumb (left), global
// search (center), and account/notifications/settings/workspace-switcher
// (right). No sidebar, no personal navigation — the workspace owns the screen.
export function WorkspaceTopNav() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    workspaces, activeWorkspaceId, setActiveWorkspace,
    notifications, markAllNotificationsRead,
  } = useCollaborationStore();

  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const activeWs = workspaces.find((w) => w.id === (workspaceId || activeWorkspaceId)) || workspaces[0];
  const unreadNotifications = notifications.filter((n) => !n.read);

  const switchWorkspace = (id: string) => {
    setActiveWorkspace(id);
    setShowSwitcher(false);
    navigate(`/w/${id}`);
  };

  return (
    <header className="h-14 flex-shrink-0 border-b border-surface-800 bg-surface-900/80 backdrop-blur-md flex items-center gap-3 sm:gap-5 px-3 sm:px-6 z-20">
      {/* LEFT — logo + product + breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0 flex-shrink">
        <Link to="/hub" aria-label="FocusFlow home" className="flex items-center shrink-0">
          <FocusFlowLogo size="sm" showText={false} />
        </Link>
        <span className="hidden lg:inline text-sm font-display font-bold text-surface-50 whitespace-nowrap">
          FocusFlow
        </span>
        <ChevronRight size={14} className="text-surface-600 hidden lg:block" aria-hidden="true" />
        <Link
          to="/hub"
          className="hidden lg:inline text-xs font-semibold text-surface-400 hover:text-surface-100 transition-colors whitespace-nowrap"
        >
          Workspace Hub
        </Link>
        <ChevronRight size={14} className="text-surface-600" aria-hidden="true" />
        <button
          type="button"
          onClick={() => switchWorkspace(activeWs?.id ?? '')}
          className="text-xs font-semibold text-surface-100 hover:text-brand-300 transition-colors truncate max-w-40"
          title="Switch workspace"
        >
          {activeWs?.name ?? 'Workspace'}
        </button>
      </div>

      {/* CENTER — global search (opens the command palette) */}
      <div className="flex-1 flex justify-center min-w-0">
        <button
          onClick={() => setShowSearch(true)}
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-850 border border-surface-700/70 text-xs text-surface-400 hover:text-surface-200 transition-all w-full max-w-md min-w-0"
          aria-label="Search workspace"
        >
          <Search size={14} className="flex-shrink-0" />
          <span className="truncate">Search workspace, projects, tasks…</span>
          <kbd className="text-[10px] font-mono bg-surface-800 px-1.5 py-0.5 rounded border border-surface-700 ml-auto flex-shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* RIGHT — avatar / notifications / settings / workspace switcher */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        <div className="hidden md:flex items-center gap-2.5 mr-1">
          <Avatar name={user?.name} src={user?.avatar} size="sm" />
          <span className="text-xs font-bold text-surface-100 truncate max-w-32">{user?.name}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setShowNotifications((v) => !v)}
            aria-label="Notifications"
            className="relative text-surface-300 border-surface-700/70 hover:border-surface-600"
          >
            <Bell size={15} />
            {unreadNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-white font-bold text-[9px] flex items-center justify-center">
                {unreadNotifications.length}
              </span>
            )}
          </Button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl p-4 z-50 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-surface-800">
                  <span className="text-xs font-bold text-surface-200">Notifications</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={markAllNotificationsRead}
                    className="text-[10px] text-brand-400 hover:underline"
                  >
                    Mark all as read
                  </Button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="text-xs text-surface-500 py-4 text-center">No notifications yet.</p>
                  )}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-xl text-xs space-y-1 ${n.read ? 'bg-surface-850/40 text-surface-400' : 'bg-brand-500/10 text-surface-100 border border-brand-500/20'}`}
                    >
                      <p className="font-bold">{n.title}</p>
                      <p className="text-[11px] text-surface-300">{n.body}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => navigate(`/w/${activeWs?.id ?? ''}/settings`)}
          aria-label="Workspace settings"
          className="text-surface-300 border-surface-700/70 hover:border-surface-600"
        >
          <Settings size={15} />
        </Button>

        {/* Workspace switcher */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSwitcher((v) => !v)}
            aria-label="Switch workspace"
            aria-expanded={showSwitcher}
            className="text-surface-200 border-surface-700/70 hover:border-surface-600 max-w-44"
            leftIcon={<LayoutGrid size={14} className="text-brand-400" />}
            rightIcon={<ChevronDown size={13} className={showSwitcher ? 'rotate-180 transition-transform' : 'transition-transform'} />}
          >
            <span className="truncate">{activeWs?.name ?? 'Workspace'}</span>
          </Button>
          <AnimatePresence>
            {showSwitcher && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl p-2 z-50 space-y-1"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-surface-500">
                  Switch Workspace
                </div>
                {workspaces.length === 0 && (
                  <p className="px-3 py-2 text-xs text-surface-500">No workspaces yet.</p>
                )}
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                      ws.id === activeWs?.id ? 'bg-brand-500/15 text-surface-50 border border-brand-500/30' : 'hover:bg-surface-800 text-surface-300'
                    }`}
                  >
                    <span className="text-lg">{ws.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{ws.name}</p>
                      <p className="text-[10px] text-surface-500">{ws.type}</p>
                    </div>
                    {ws.id === activeWs?.id && <Check size={13} className="text-brand-400 flex-shrink-0" />}
                  </button>
                ))}
                <Link
                  to="/team"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mt-1 rounded-xl text-[11px] font-bold text-brand-400 hover:bg-brand-500/10 transition-colors"
                >
                  Manage Workspaces
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <GlobalCommandPalette isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  );
}

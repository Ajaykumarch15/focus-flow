import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Settings, User, ChevronDown, Menu, MessageSquare, BriefcaseBusiness } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useWorkspaceStore } from '@shared/services/useWorkspaceStore';
import { useStore } from '@worklog/services/useStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { NowIndicator } from '@worklog/components/NowIndicator';
import { FocusFlowLogo } from './FocusFlowLogo';
import { NotificationCenter } from '@collab/components/NotificationCenter';
import { GlobalCommandPalette } from '@collab/components/GlobalCommandPalette';
import { api } from '@shared/utils/api';

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function GlobalHeader() {
  const { user, logout } = useAuthStore();
  const { activeWorkspace } = useWorkspaceStore();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setWsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [officeTime, setOfficeTime] = useState<{ totalMs: number; activeSince: number | null } | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [officeBusy, setOfficeBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); setWsOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  useEffect(() => {
    if (!user) { setOfficeTime(null); return; }
    let alive = true;
    const load = () => api.officeWorkTime.today(localDateKey()).then((data) => {
      if (alive) setOfficeTime({ totalMs: data.totalMs || 0, activeSince: data.activeSince || null });
    }).catch(() => {});
    void load();
    const ticker = window.setInterval(() => setClockNow(Date.now()), 1000);
    const poll = window.setInterval(() => { void load(); }, 30000);
    return () => { alive = false; window.clearInterval(ticker); window.clearInterval(poll); };
  }, [user?._id]);

  const toggleOfficeTime = async () => {
    if (officeBusy) return;
    setOfficeBusy(true);
    try {
      const data = await api.officeWorkTime.toggle(localDateKey());
      setOfficeTime({ totalMs: data.totalMs || 0, activeSince: data.activeSince || null });
      setClockNow(Date.now());
    } catch { /* Keep the current clock state; the next poll will resync. */ }
    finally { setOfficeBusy(false); }
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-surface-800/60 bg-surface-950/80 backdrop-blur-xl flex items-center px-4 lg:px-6 gap-4">
      {/* Left: Hamburger (mobile only) + Logo + Workspace Badge */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="lg:hidden p-2 -ml-2 rounded-xl text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors"
          aria-label="Toggle navigation menu" aria-expanded={mobileSidebarOpen} type="button">
          <Menu size={18} />
        </button>
        <button onClick={() => navigate(activeWorkspace === 'work' ? '/worklog/dashboard' : activeWorkspace === 'collab' ? `/collab/${workspaceId || 'default'}/dashboard` : '/personal/today')}
          className="flex-shrink-0 cursor-pointer" aria-label="Go to dashboard">
          <FocusFlowLogo size="sm" showText={false} />
        </button>

        {/* Branding — mobile only (desktop keeps breadcrumbs) */}
        <div className="lg:hidden leading-none">
          <p className="text-sm font-bold text-surface-50">FocusFlow</p>
          <p className="mt-0.5 text-[10px] font-medium text-surface-400">Developer Operating System</p>
        </div>

        {/* Workspace Switcher */}
        {/*}
        <div className="relative" ref={wsRef}>
          <button
            onClick={() => setWsOpen(!wsOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-800/60 hover:bg-surface-800 border border-surface-800 transition-colors text-xs"
            aria-label="Switch workspace"
            aria-expanded={wsOpen}
          >
            <WsIcon size={13} style={{ color: wsConfig.color }} />
            <span className="text-surface-300 font-medium hidden sm:inline">{wsConfig.title}</span>
            <ChevronDown size={12} className={`text-surface-500 transition-transform duration-150 ${wsOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {wsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWsOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 p-1.5"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                    Switch Workspace
                  </div>
                  {WORKSPACE_LIST.map((ws) => {
                    const Ic = ws.icon;
                    const isActive = ws.id === activeWorkspace;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => handleSwitch(ws.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                          isActive ? 'bg-surface-700 text-surface-50' : 'text-surface-300 hover:bg-surface-700/50 hover:text-surface-100'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ws.color}15`, color: ws.color }}>
                          <Ic size={12} />
                        </div>
                        <span className="text-xs font-semibold truncate">{ws.title}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>*/}
      </div>

      {/* Center: Breadcrumbs (flex spacer always; breadcrumb content on lg+) */}
      <div className="flex-1 min-w-0">
        <div className="hidden lg:block"><Breadcrumbs /></div>
      </div>

      {/* Right: Search + Theme + Notifications + User */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Search — opens the global command palette (Ctrl/Cmd+K) */}
        {/*<button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace (Ctrl+K)"
          aria-keyshortcuts="Control+K"
          title="Search workspace (Ctrl+K)"
          className="h-9 px-3 rounded-xl bg-surface-800/60 border border-surface-800 text-xs text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all flex items-center gap-2"
        >
          <Search size={15} />
          <span className="hidden lg:inline">Search</span>
          <kbd className="hidden lg:inline text-[10px] text-surface-500 bg-surface-800 border border-surface-700 px-1.5 py-0.5 rounded font-mono">
            Ctrl K
          </kbd>
        </button>*/}
        <GlobalCommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        <div className="hidden lg:block"><NowIndicator /></div>
        {user && <div className="inline-flex flex-none items-center gap-2 px-1.5" title="Office work time today">
          <BriefcaseBusiness size={14} className={officeTime?.activeSince ? 'text-emerald-400' : 'text-surface-400'} />
          <span className="text-[11px] font-medium text-surface-400 hidden sm:inline">Office</span>
          <button type="button" role="switch" aria-checked={Boolean(officeTime?.activeSince)}
            aria-label="Track office work time" onClick={toggleOfficeTime} disabled={officeBusy}
            className={`relative box-border flex-none appearance-none overflow-hidden rounded-full border-0 p-0 transition-colors disabled:opacity-60 ${officeTime?.activeSince ? 'bg-emerald-500' : 'bg-surface-700'}`}
            style={{ width: 36, minWidth: 36, maxWidth: 36, height: 20, minHeight: 20 }}>
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
              style={{ left: 2, transform: officeTime?.activeSince ? 'translateX(16px)' : 'translateX(0)' }} />
          </button>
          <span className={`min-w-[4.5rem] flex-none font-mono text-xs tabular-nums ${officeTime?.activeSince ? 'text-emerald-300' : 'text-surface-300'}`}>
            {formatDuration((officeTime?.totalMs || 0) + (officeTime?.activeSince ? Math.max(0, clockNow - officeTime.activeSince) : 0))}
          </span>
        </div>}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationCenter />

        {/* Chat */}
        <button
          onClick={() => navigate(`/collab/${workspaceId || 'default'}/chat`)}
          className="hidden lg:block p-2 rounded-xl text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors"
          aria-label="Open chat"
          title="Messages"
        >
          <MessageSquare size={17} />
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-xl hover:bg-surface-800 transition-all">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-400 flex items-center justify-center text-[11px] font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="text-xs font-medium text-surface-300 hidden lg:block max-w-[100px] truncate">{user?.name}</span>
            <ChevronDown size={12} className={`text-surface-500 hidden lg:block transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-surface-800 bg-surface-900 shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2.5 border-b border-surface-800">
                  <p className="text-sm font-medium text-surface-100 truncate">{user?.name}</p>
                  <p className="text-[11px] text-surface-400 truncate">{user?.email}</p>
                  {user?.roleId?.name && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/20">
                      {user.roleId.name}
                    </span>
                  )}
                </div>
                <div className="p-1">
                  <button onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-all">
                    <Settings size={14} /> Settings
                  </button>
                  <button onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-all">
                    <User size={14} /> Profile
                  </button>
                  <button onClick={() => { setMenuOpen(false); navigate(activeWorkspace === 'personal' ? '/personal/office-time' : '/worklog/office-time'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-all">
                    <BriefcaseBusiness size={14} /> Office Time Analytics
                  </button>
                  <div className="my-1 border-t border-surface-800" />
                  <button onClick={() => { setMenuOpen(false); logout(); navigate('/login'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all">
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

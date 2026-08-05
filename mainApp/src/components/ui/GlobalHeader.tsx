import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LogOut, Settings, User, ChevronDown, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { WorkspaceBadge } from './WorkspaceBadge';
import { FocusFlowLogo } from './FocusFlowLogo';
import { NotificationCenter } from '../collaboration/NotificationCenter';
import { GlobalCommandPalette } from '../collaboration/GlobalCommandPalette';

export function GlobalHeader() {
  const { user, logout, workspace } = useAuthStore();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-surface-800/60 bg-surface-950/80 backdrop-blur-xl flex items-center px-4 lg:px-6 gap-4">
      {/* Left: Hamburger (mobile only) + Logo + Workspace Badge */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="lg:hidden p-2 -ml-2 rounded-xl text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors"
          aria-label="Toggle navigation menu" aria-expanded={mobileSidebarOpen} type="button">
          <Menu size={18} />
        </button>
        <button onClick={() => navigate(workspace === 'admin' ? '/admin/audit' : '/dashboard')}
          className="flex-shrink-0 cursor-pointer" aria-label="Go to dashboard">
          <FocusFlowLogo size="sm" showText={false} />
        </button>
        <WorkspaceBadge />
      </div>

      {/* Center: Breadcrumbs */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <Breadcrumbs />
      </div>

      {/* Right: Search + Theme + Notifications + User */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Search — opens the global command palette (Ctrl/Cmd+K) */}
        <button
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
        </button>
        <GlobalCommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        <ThemeToggle />

        {/* Notifications */}
        <NotificationCenter />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-xl hover:bg-surface-800 transition-all">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-400 flex items-center justify-center text-[11px] font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="text-xs font-medium text-surface-300 hidden md:block max-w-[100px] truncate">{user?.name}</span>
            <ChevronDown size={12} className={`text-surface-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-surface-800 bg-surface-900 shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2.5 border-b border-surface-800">
                  <p className="text-sm font-medium text-surface-100 truncate">{user?.name}</p>
                  <p className="text-[11px] text-surface-500 truncate">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-all">
                    <Settings size={14} /> Settings
                  </button>
                  <button onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-all">
                    <User size={14} /> Profile
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

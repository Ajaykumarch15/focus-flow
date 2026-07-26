import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, LogOut, Settings, User, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { WorkspaceBadge } from './WorkspaceBadge';
import { FocusFlowLogo } from './FocusFlowLogo';

export function GlobalHeader() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-surface-800/60 bg-surface-950/80 backdrop-blur-xl flex items-center px-4 lg:px-6 gap-4">
      {/* Left: Logo + Workspace Badge */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <FocusFlowLogo size="sm" showText={false} />
        <WorkspaceBadge />
      </div>

      {/* Center: Breadcrumbs */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <Breadcrumbs />
      </div>

      {/* Right: Search + Theme + Notifications + User */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Search */}
        <div className={`relative transition-all duration-200 ${searchFocused ? 'w-56' : 'w-9'}`}>
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface-800/60 border border-surface-800 text-xs text-surface-200 placeholder-surface-500 focus:outline-none focus:border-surface-600 focus:bg-surface-800 transition-all"
          />
          {!searchFocused && (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-500 bg-surface-800 border border-surface-700 px-1.5 py-0.5 rounded font-mono pointer-events-none">
              /
            </kbd>
          )}
        </div>

        <ThemeToggle />

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
          aria-label="Notifications">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)}
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

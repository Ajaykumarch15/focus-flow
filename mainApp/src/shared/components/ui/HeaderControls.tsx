import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Settings, User, ChevronDown, BriefcaseBusiness, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useWorkspaceStore } from '@shared/services/useWorkspaceStore';
import { ThemeToggle } from './ThemeToggle';
import { api } from '@shared/utils/api';

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Office-time toggle, theme switch and profile menu shared by all top headers. */
export function HeaderControls() {
  const { user, logout } = useAuthStore();
  const { activeWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [officeTime, setOfficeTime] = useState<{ totalMs: number; activeSince: number | null } | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [officeBusy, setOfficeBusy] = useState(false);
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
    <div className="flex flex-shrink-0 items-center gap-0.5 sm:gap-1">
      {user && <div className="inline-flex flex-none items-center gap-1.5 px-1 sm:gap-2 sm:px-1.5" title="Office work time today">
        <BriefcaseBusiness size={14} className={officeTime?.activeSince ? 'text-emerald-400' : 'text-surface-400'} />
        <span className="text-[11px] font-medium text-surface-400 hidden sm:inline">Office</span>
        <button type="button" role="switch" aria-checked={Boolean(officeTime?.activeSince)}
          aria-label="Track office work time" onClick={toggleOfficeTime} disabled={officeBusy}
          className={`relative box-border flex-none appearance-none overflow-hidden rounded-full border-0 p-0 transition-colors disabled:opacity-60 ${officeTime?.activeSince ? 'bg-emerald-500' : 'bg-surface-700'}`}
          style={{ width: 36, minWidth: 36, maxWidth: 36, height: 20, minHeight: 20 }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ left: 2, transform: officeTime?.activeSince ? 'translateX(16px)' : 'translateX(0)' }} />
        </button>
        <span className={`hidden sm:inline min-w-[4.5rem] flex-none font-mono text-xs tabular-nums ${officeTime?.activeSince ? 'text-emerald-300' : 'text-surface-300'}`}>
          {formatDuration((officeTime?.totalMs || 0) + (officeTime?.activeSince ? Math.max(0, clockNow - officeTime.activeSince) : 0))}
        </span>
      </div>}
      <ThemeToggle />

      <div className="relative" ref={menuRef}>
        <button onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 h-9 pl-1 pr-1 sm:pr-2 rounded-xl hover:bg-surface-800 transition-all">
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
                <button onClick={() => { setMenuOpen(false); navigate(activeWorkspace === 'work' ? '/worklog/reports' : '/personal/analytics'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-all">
                  <BarChart3 size={14} /> {activeWorkspace === 'work' ? 'Reports' : 'Analytics'}
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
  );
}

import { Menu } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useStore } from '@worklog/services/useStore';
import { cn } from '@shared/utils/cn';
import { FocusFlowLogo } from '@shared/components/ui/FocusFlowLogo';
import { HeaderControls } from '@shared/components/ui/HeaderControls';
import { PERSONAL_NAV, WORKLOG_NAV } from './Sidebar';

/**
 * The single top header: primary navigation plus the office toggle, theme
 * switch and profile menu. Replaces the old left rail + second island header.
 */
export function TopNav() {
  const workspace = useAuthStore((s) => s.workspace);
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();
  const navigate = useNavigate();
  const items = workspace === 'personal' ? PERSONAL_NAV : WORKLOG_NAV;

  return (
    <header className="mx-3 mt-3 flex h-14 items-center gap-2 bg-transparent px-3 sm:mx-4 sm:gap-3 sm:px-4">
      {/* Left: mobile menu + logo */}
      <div className="flex min-w-0 flex-shrink-0 items-center gap-2 sm:gap-3">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="lg:hidden flex-shrink-0 rounded-xl p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-50"
          aria-label="Toggle navigation menu" aria-expanded={mobileSidebarOpen} type="button">
          <Menu size={18} />
        </button>
        <button onClick={() => navigate('/home')}
          className="flex-shrink-0 cursor-pointer" aria-label="Go to homepage">
          <FocusFlowLogo size="sm" />
        </button>
      </div>

      {/* Center: primary navigation */}
      <nav aria-label="Primary navigation" className="hidden min-w-0 flex-1 justify-center lg:flex">
        <div className="flex items-center gap-1 p-1">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors xl:px-3',
                isActive
                  ? 'bg-brand-500/15 text-brand-300'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100',
              )}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Right: office toggle, theme toggle, profile */}
      <div className="ml-auto flex flex-shrink-0 items-center sm:ml-0">
        <HeaderControls />
      </div>
    </header>
  );
}

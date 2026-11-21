import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@worklog/services/useStore';
import { FocusFlowLogo } from './FocusFlowLogo';
import { HeaderControls } from './HeaderControls';

/** Island header used by the admin layout (no primary nav rail). */
export function GlobalHeader() {
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();
  const navigate = useNavigate();

  return (
    <header className="relative z-30 flex h-14 items-center bg-transparent px-3 sm:px-4 lg:px-5 gap-2 sm:gap-3 lg:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="lg:hidden flex-shrink-0 p-2 -ml-1 sm:-ml-2 rounded-xl text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-colors"
          aria-label="Toggle navigation menu" aria-expanded={mobileSidebarOpen} type="button">
          <Menu size={18} />
        </button>
        <button onClick={() => navigate('/home')}
          className="flex-shrink-0 cursor-pointer" aria-label="Go to homepage">
          <FocusFlowLogo size="sm" />
        </button>
      </div>

      <div className="flex-1 min-w-0" />
      <HeaderControls />
    </header>
  );
}

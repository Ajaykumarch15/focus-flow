import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar }        from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';
import { GlobalHeader }   from '../ui/GlobalHeader';
import { NowStrip }       from '../now/NowStrip';
import { useStore }       from '../../store/useStore';

export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();

  useEffect(() => {
    setMobileSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, setMobileSidebarOpen]);

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Sidebar is always visible on large screens */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <GlobalHeader />
        <NowStrip />
        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Main content outlet */}
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar drawer – simple conditional without animation */}
      {mobileSidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-surface-900 shadow-lg">
            <Sidebar />
          </aside>
        </>
      )}

      <ToastContainer />
    </div>
  );
}

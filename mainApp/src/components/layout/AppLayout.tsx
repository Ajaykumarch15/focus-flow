import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar }        from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';
import { GlobalHeader }   from '../ui/GlobalHeader';
import { NotificationPermissionBanner } from '../ui/NotificationPermissionBanner';
import { useNotifications } from '../../hooks/useNotifications';
import { useStore }       from '../../store/useStore';

export function AppLayout() {
  useNotifications();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();

  useEffect(() => {
    setMobileSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, setMobileSidebarOpen]);

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <GlobalHeader />
        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <NotificationPermissionBanner />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

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
              <Sidebar />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ToastContainer />
    </div>
  );
}

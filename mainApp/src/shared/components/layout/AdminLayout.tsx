import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminSidebar } from './AdminSidebar';
import { ToastContainer } from '@shared/components/ui/ToastContainer';
import { GlobalHeader } from '@shared/components/ui/GlobalHeader';
import { useStore } from '@worklog/services/useStore';

export function AdminLayout() {
  const location = useLocation();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useStore();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <div className="hidden lg:block flex-shrink-0">
        <AdminSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-y-auto">
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
              className="lg:hidden fixed inset-y-0 left-0 z-50 bg-surface-900 shadow-2xl overflow-hidden border-r border-surface-800"
            >
              <AdminSidebar expanded />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ToastContainer />
    </div>
  );
}

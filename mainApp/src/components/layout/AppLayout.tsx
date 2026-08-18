import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar }        from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';
import { ScheduleNotificationPanel } from '../schedule/ScheduleNotificationPanel';
import { GlobalHeader }   from '../ui/GlobalHeader';
import { NowStrip }       from '../now/NowStrip';
import { useStore }       from '../../store/useStore';
import { useScheduleEvaluator } from '../../hooks/useScheduleEvaluator';

export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { mobileSidebarOpen, setMobileSidebarOpen, theme } = useStore();
  const isReducedMotion = theme?.reducedMotion;

  // Global schedule evaluator for notifications
  useScheduleEvaluator();

  useEffect(() => {
    setMobileSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, setMobileSidebarOpen]);

  // Handle body overflow lock & Escape key when mobile drawer is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMobileSidebarOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const backdropTransition = isReducedMotion ? { duration: 0 } : { duration: 0.18 };
  const drawerTransition = isReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] };

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Desktop Sidebar */}
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

      {/* Mobile Sidebar Animated Drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={backdropTransition}
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Sliding Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={drawerTransition}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Navigation Menu"
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-surface-900 shadow-2xl overflow-hidden border-r border-surface-800"
            >
              <Sidebar />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ToastContainer />
      <ScheduleNotificationPanel />
    </div>
  );
}

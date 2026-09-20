import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar }        from './Sidebar';
import { ToastContainer } from '@shared/components/ui/ToastContainer';
import { ScheduleNotificationPanel } from '@personal/components/schedule/ScheduleNotificationPanel';
import { GlobalHeader }   from '@shared/components/ui/GlobalHeader';
import { useStore }       from '@worklog/services/useStore';
import { useScheduleEvaluator } from '@shared/hooks/useScheduleEvaluator';

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
        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-thin relative">
          {/* ── Ambient decorative spots — global ── */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 left-[8%] w-56 h-56 rounded-full
              bg-brand-400/[0.14] dark:bg-brand-400/[0.06] blur-3xl" />
            <div className="absolute top-[18%] -right-16 w-48 h-48 rounded-[2rem]
              bg-info-400/[0.12] dark:bg-info-300/[0.06] rotate-12 blur-3xl" />
            <div className="absolute top-[40%] left-[30%] w-40 h-40 rounded-full
              bg-brand-300/[0.10] dark:bg-brand-300/[0.05] blur-3xl" />
            <div className="absolute top-[55%] right-[12%] w-36 h-36 rounded-full
              bg-success-400/[0.10] dark:bg-success-300/[0.05] blur-2xl" />
            <div className="absolute top-[70%] left-[5%] w-44 h-44 rounded-full
              bg-info-300/[0.10] dark:bg-info-400/[0.05] blur-3xl" />
            <div className="absolute top-[85%] left-[50%] w-52 h-32 rounded-full
              bg-brand-400/[0.08] dark:bg-brand-500/[0.05] blur-3xl" />
            <div className="absolute top-[30%] left-[60%] w-28 h-28 rounded-xl rotate-45
              bg-success-300/[0.08] dark:bg-success-400/[0.04] blur-2xl" />
            <div className="absolute top-[95%] right-[25%] w-32 h-32 rounded-full
              bg-brand-500/[0.08] dark:bg-brand-400/[0.05] blur-2xl" />
          </div>
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
              className="lg:hidden fixed inset-y-0 left-0 z-50 bg-surface-900 shadow-2xl overflow-hidden border-r border-surface-800"
            >
              <Sidebar expanded />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ToastContainer />
      <ScheduleNotificationPanel />
    </div>
  );
}

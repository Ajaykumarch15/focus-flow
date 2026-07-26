import { Outlet } from 'react-router-dom';
import { motion }  from 'framer-motion';
import { Sidebar }        from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';
import { GlobalHeader }   from '../ui/GlobalHeader';
import { NotificationPermissionBanner } from '../ui/NotificationPermissionBanner';
import { useTimer }       from '../../hooks/useTimer';
import { useNotifications } from '../../hooks/useNotifications';

export function AppLayout() {
  useTimer();
  useNotifications();

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-y-auto">
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

      <ToastContainer />
    </div>
  );
}

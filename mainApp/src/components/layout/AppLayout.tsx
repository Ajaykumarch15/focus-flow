import { Outlet } from 'react-router-dom';
import { motion }  from 'framer-motion';
import { Sidebar }        from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';   // ← import
import { useTimer }       from '../../hooks/useTimer';

export function AppLayout() {
  useTimer();

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <Sidebar />

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

      {/* ↓ One line — renders the floating toast stack */}
      <ToastContainer />
    </div>
  );
}

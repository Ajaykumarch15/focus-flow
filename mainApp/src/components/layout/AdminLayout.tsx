import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AdminSidebar } from './AdminSidebar';
import { ToastContainer } from '../ui/ToastContainer';

export function AdminLayout() {
  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <AdminSidebar />
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
      <ToastContainer />
    </div>
  );
}

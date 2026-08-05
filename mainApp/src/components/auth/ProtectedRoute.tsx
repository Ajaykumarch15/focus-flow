import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { resolveDefaultLanding } from '../../lib/navigation';
import { motion } from 'framer-motion';

/**
 * Wraps all authenticated routes.
 * - If loading (restoring session) → show spinner
 * - If no user → redirect to /login
 * - Otherwise → render children via <Outlet />
 */
export function ProtectedRoute() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full"
          />
          <p className="text-surface-400 text-sm">Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

/**
 * Wraps admin-only routes.
 * Redirects non-admin users to /dashboard.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full"
          />
          <p className="text-surface-400 text-sm">Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') return <Navigate to={resolveDefaultLanding(user?.role)} replace />;

  return <>{children}</>;
}

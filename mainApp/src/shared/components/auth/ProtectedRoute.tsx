import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useStore } from '@worklog/services/useStore';
import { resolveDefaultLanding } from '@shared/utils/navigation';
import { motion } from 'framer-motion';
import { Skeleton, SkeletonStatCard, SkeletonTaskCard } from '@shared/components/ui/Skeleton';

/**
 * Wraps all authenticated routes.
 * - If loading (restoring session) → show spinner
 * - If no user → redirect to /login
 * - If user but data not loaded yet → show skeleton (prevents flash of empty state)
 * - Otherwise → render children via <Outlet />
 */
export function ProtectedRoute() {
  const { user, loading } = useAuthStore();
  const dataLoaded = useStore((s) => s.dataLoaded);

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

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-surface-950 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </div>
          <div className="space-y-4">
            <SkeletonTaskCard />
            <SkeletonTaskCard />
            <SkeletonTaskCard />
          </div>
        </div>
      </div>
    );
  }

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

  if (!user || !user.roleId || user.roleId.level < 60) return <Navigate to={resolveDefaultLanding(user?.roleId?.level)} replace />;

  return <>{children}</>;
}

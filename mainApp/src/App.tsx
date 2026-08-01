import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore }    from './store/useAuthStore';
import { useStore }        from './store/useStore';
import { clearTimer }      from './utils/timerPersist';

import { AppLayout }       from './components/layout/AppLayout';
import { AdminLayout }     from './components/layout/AdminLayout';
import { ProtectedRoute, AdminRoute } from './components/auth/ProtectedRoute';

const Landing         = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const Login           = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register        = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Dashboard       = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Tasks           = lazy(() => import('./pages/Tasks').then(module => ({ default: module.Tasks })));
const TaskDetail      = lazy(() => import('./pages/TaskDetail').then(module => ({ default: module.TaskDetail })));
const Analytics       = lazy(() => import('./pages/Analytics').then(module => ({ default: module.Analytics })));
const Journal         = lazy(() => import('./pages/Journal').then(module => ({ default: module.Journal })));
const FocusMode       = lazy(() => import('./pages/FocusMode').then(module => ({ default: module.FocusMode })));
const Settings        = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Habits          = lazy(() => import('./pages/Habits').then(module => ({ default: module.Habits })));
const WorkLogPage     = lazy(() => import('./pages/WorkLog').then(module => ({ default: module.WorkLogPage })));
const WorkLogDetailPage = lazy(() => import('./pages/WorkLogDetail').then(module => ({ default: module.WorkLogDetail })));
const ReportsPage     = lazy(() => import('./pages/Reports').then(module => ({ default: module.ReportsPage })));
const Leaderboard     = lazy(() => import('./pages/Leaderboard').then(module => ({ default: module.Leaderboard })));
const ShareReportPage = lazy(() => import('./pages/ShareReport').then(module => ({ default: module.ShareReportPage })));
const WorkspaceSelector = lazy(() => import('./pages/WorkspaceSelector').then(module => ({ default: module.WorkspaceSelector })));
const TeamWorkspace     = lazy(() => import('./pages/collaboration/TeamWorkspace').then(module => ({ default: module.TeamWorkspace })));

// Admin workspace pages
const AdminOverview   = lazy(() => import('./pages/admin/AdminOverview').then(module => ({ default: module.AdminOverview })));
const AdminPeople     = lazy(() => import('./pages/admin/AdminPeople').then(module => ({ default: module.AdminPeople })));
const AdminTeams      = lazy(() => import('./pages/admin/AdminTeams').then(module => ({ default: module.AdminTeams })));
const AdminAnalytics  = lazy(() => import('./pages/admin/AdminAnalytics').then(module => ({ default: module.AdminAnalytics })));
const AdminActivity   = lazy(() => import('./pages/admin/AdminActivity').then(module => ({ default: module.AdminActivity })));
const AdminSettings   = lazy(() => import('./pages/admin/AdminSettings').then(module => ({ default: module.AdminSettings })));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" aria-label="Loading" />
    </div>
  );
}

function AdminWorkspaceRouter() {
  const { workspace } = useAuthStore();
  if (workspace !== 'admin') return <Navigate to="/workspace" replace />;
  return <AdminLayout />;
}

function PersonalWorkspaceRouter() {
  const { workspace, user } = useAuthStore();
  if (user?.role === 'admin' && workspace !== 'personal') return <Navigate to="/workspace" replace />;
  return <AppLayout />;
}

export default function App() {
  const { user, token, loading, restoreSession } = useAuthStore();
  const { loadAll }                              = useStore();

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (user) {
      loadAll();
    } else if (!loading && !token) {
      clearTimer();
    }
  }, [user?._id, token, loading]);

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/"                            element={<Landing />} />
          <Route path="/login"                       element={<Login />} />
          <Route path="/register"                    element={<Register />} />
          <Route path="/reports/share/token/:token"  element={<ShareReportPage />} />
          <Route path="/reports/share/:userId/:date" element={<ShareReportPage />} />

          {/* Workspace Selector (admin users only) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/workspace" element={
              user?.role === 'admin' ? <WorkspaceSelector /> : <Navigate to="/dashboard" replace />
            } />
          </Route>

          {/* Personal Workspace */}
          <Route element={<ProtectedRoute />}>
            <Route element={<PersonalWorkspaceRouter />}>
              <Route path="/dashboard"  element={<Dashboard />} />
              <Route path="/team"       element={<TeamWorkspace />} />
              <Route path="/worklog"    element={<WorkLogPage />} />
              <Route path="/worklog/:id" element={<WorkLogDetailPage />} />
              <Route path="/reports"    element={<ReportsPage />} />
              <Route path="/tasks"      element={<Tasks />} />
              <Route path="/tasks/:id"  element={<TaskDetail />} />
              <Route path="/analytics"  element={<Analytics />} />
              <Route path="/journal"    element={<Journal />} />
              <Route path="/habits"     element={<Habits />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/focus"      element={<FocusMode />} />
              <Route path="/settings"   element={<Settings />} />
            </Route>
          </Route>

          {/* Admin Workspace */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminRoute><AdminWorkspaceRouter /></AdminRoute>}>
              <Route path="/admin/overview"  element={<AdminOverview />} />
              <Route path="/admin/people"    element={<AdminPeople />} />
              <Route path="/admin/teams"     element={<AdminTeams />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/activity"  element={<AdminActivity />} />
              <Route path="/admin/settings"  element={<AdminSettings />} />
              <Route path="/admin"           element={<Navigate to="/admin/overview" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

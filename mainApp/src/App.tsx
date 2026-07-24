import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore }    from './store/useAuthStore';
import { useStore }        from './store/useStore';
import { clearTimer }      from './utils/timerPersist';   // clear after auth is known

import { AppLayout }       from './components/layout/AppLayout';
import { ProtectedRoute }  from './components/auth/ProtectedRoute';

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
const ReportsPage     = lazy(() => import('./pages/Reports').then(module => ({ default: module.ReportsPage })));
const Leaderboard     = lazy(() => import('./pages/Leaderboard').then(module => ({ default: module.Leaderboard })));
const AdminPage       = lazy(() => import('./pages/Admin').then(module => ({ default: module.AdminDashboard })));
const ShareReportPage = lazy(() => import('./pages/ShareReport').then(module => ({ default: module.ShareReportPage })));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-cyan-300/30 border-t-cyan-300 animate-spin" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  const { user, token, loading, restoreSession } = useAuthStore();
  const { loadAll }                              = useStore();

  // Step 1: restore JWT session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  // Step 2: once user is confirmed, load all their data from Atlas
  useEffect(() => {
    if (user) {
      loadAll();
    } else if (!loading && !token) {
      // Auth restore is finished and there is no signed-in user.
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

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard"  element={<Dashboard />} />
              <Route path="/worklog"    element={<WorkLogPage />} />
              <Route path="/reports"    element={<ReportsPage />} />
              <Route path="/tasks"      element={<Tasks />} />
              <Route path="/tasks/:id"  element={<TaskDetail />} />
              <Route path="/analytics"  element={<Analytics />} />
              <Route path="/journal"    element={<Journal />} />
              <Route path="/habits"     element={<Habits />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/focus"      element={<FocusMode />} />
              <Route path="/settings"   element={<Settings />} />
              <Route path="/admin"      element={<AdminPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

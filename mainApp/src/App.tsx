import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore }    from './store/useAuthStore';
import { useStore }        from './store/useStore';
import { clearTimer }      from './utils/timerPersist';   // ← clear on logout

import { AppLayout }       from './components/layout/AppLayout';
import { ProtectedRoute }  from './components/auth/ProtectedRoute';

import { Landing }         from './pages/Landing';
import { Login }           from './pages/Login';
import { Register }        from './pages/Register';
import { Dashboard }       from './pages/Dashboard';
import { Tasks }           from './pages/Tasks';
import { TaskDetail }      from './pages/TaskDetail';
import { Analytics }       from './pages/Analytics';
import { Journal }         from './pages/Journal';
import { FocusMode }       from './pages/FocusMode';
import { Settings }        from './pages/Settings';
import { WorkLogPage }     from './pages/WorkLog';
import { ReportsPage }     from './pages/Reports';
import { ShareReportPage } from './pages/ShareReport';

export default function App() {
  const { user, restoreSession, logout } = useAuthStore();
  const { loadAll }                      = useStore();

  // Step 1: restore JWT session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  // Step 2: once user is confirmed, load all their data from Atlas
  useEffect(() => {
    if (user) {
      loadAll();
    } else {
      // User logged out — clear timer backup so it doesn't bleed into next session
      clearTimer();
    }
  }, [user?._id]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                            element={<Landing />} />
        <Route path="/login"                       element={<Login />} />
        <Route path="/register"                    element={<Register />} />
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
            <Route path="/focus"      element={<FocusMode />} />
            <Route path="/settings"   element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

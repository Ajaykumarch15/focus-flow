// ── src/App.tsx ───────────────────────────────────────────────────────────────
// Replace your existing App.tsx with this

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore }    from './store/useAuthStore';
import { useStore }        from './store/useStore';

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
import { ShareReportPage } from './pages/ShareReport';  // public — no auth

export default function App() {
  const { user, restoreSession } = useAuthStore();
  const { loadAll }              = useStore();

  useEffect(() => { restoreSession(); }, []);
  useEffect(() => { if (user) loadAll(); }, [user?._id]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"                             element={<Landing />} />
        <Route path="/login"                        element={<Login />} />
        <Route path="/register"                     element={<Register />} />
        {/* ↓ Public share page — lead views this without logging in */}
        <Route path="/reports/share/:userId/:date"  element={<ShareReportPage />} />

        {/* Protected */}
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

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useStore } from './store/useStore';

// Layout & guards
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Pages
import { Landing }    from './pages/Landing';
import { Login }      from './pages/Login';
import { Register }   from './pages/Register';
import { Dashboard }  from './pages/Dashboard';
import { Tasks }      from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { Analytics }  from './pages/Analytics';
import { Journal }    from './pages/Journal';
import { FocusMode }  from './pages/FocusMode';
import { Settings }   from './pages/Settings';

export default function App() {
  const { user, restoreSession } = useAuthStore();
  const { loadAll } = useStore();

  // ── On mount: restore JWT session ──────────────────────────────────────────
  useEffect(() => {
    restoreSession();
  }, []);

  // ── Once user is confirmed: load all their data from MongoDB ───────────────
  useEffect(() => {
    if (user) loadAll();
  }, [user?._id]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected app — requires auth */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/tasks"       element={<Tasks />} />
            <Route path="/tasks/:id"   element={<TaskDetail />} />
            <Route path="/analytics"   element={<Analytics />} />
            <Route path="/journal"     element={<Journal />} />
            <Route path="/focus"       element={<FocusMode />} />
            <Route path="/settings"    element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

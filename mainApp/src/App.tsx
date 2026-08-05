import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useAuthStore }    from './store/useAuthStore';
import { useStore }        from './store/useStore';
import { clearTimer }      from './utils/timerPersist';
import { ErrorBoundary }  from './components/ui/ErrorBoundary';

import { AppLayout }       from './components/layout/AppLayout';
import { AdminLayout }     from './components/layout/AdminLayout';
import { ProtectedRoute, AdminRoute } from './components/auth/ProtectedRoute';
import { Card }            from './components/ui/Card';
import { Button }          from './components/ui/Button';
import { Spinner }         from './components/ui/Spinner';

const Landing         = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const Login           = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register        = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const WorkspaceHub    = lazy(() => import('./pages/WorkspaceHub').then(module => ({ default: module.WorkspaceHub })));
const TeamProjects    = lazy(() => import('./pages/TeamProjects').then(module => ({ default: module.TeamProjects })));
const WorkspaceLayout = lazy(() => import('./components/layout/WorkspaceLayout').then(module => ({ default: module.WorkspaceLayout })));

// Personal Workspace Pages
const TodayPage       = lazy(() => import('./pages/TodayPage').then(module => ({ default: module.TodayPage })));
const Tasks           = lazy(() => import('./pages/Tasks').then(module => ({ default: module.Tasks })));
const TaskDetail      = lazy(() => import('./pages/TaskDetail').then(module => ({ default: module.TaskDetail })));
const Journal         = lazy(() => import('./pages/Journal').then(module => ({ default: module.Journal })));
const FocusMode       = lazy(() => import('./pages/FocusMode').then(module => ({ default: module.FocusMode })));
const PersonalActivityPage = lazy(() => import('./pages/PersonalActivityPage').then(module => ({ default: module.PersonalActivityPage })));
const Settings        = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Habits          = lazy(() => import('./pages/Habits').then(module => ({ default: module.Habits })));
const WorkLogPage     = lazy(() => import('./pages/WorkLog').then(module => ({ default: module.WorkLogPage })));
const KnowledgePage   = lazy(() => import('./pages/Knowledge').then(module => ({ default: module.KnowledgePage })));
const ReportsPage     = lazy(() => import('./pages/Reports').then(module => ({ default: module.ReportsPage })));
const Leaderboard     = lazy(() => import('./pages/Leaderboard').then(module => ({ default: module.Leaderboard })));
const ShareReportPage = lazy(() => import('./pages/ShareReport').then(module => ({ default: module.ShareReportPage })));
const WorkspaceSelector = lazy(() => import('./pages/WorkspaceSelector').then(module => ({ default: module.WorkspaceSelector })));
const SearchResultsPage = lazy(() => import('./pages/SearchResults').then(module => ({ default: module.SearchResultsPage })));

// Developer Collaboration Workspace Pages
const TeamWorkspace     = lazy(() => import('./pages/collaboration/TeamWorkspace').then(module => ({ default: module.TeamWorkspace })));
const FeaturesPage      = lazy(() => import('./pages/collaboration/FeaturesPage').then(module => ({ default: module.FeaturesPage })));
const QADashboardPage    = lazy(() => import('./pages/collaboration/QADashboardPage').then(module => ({ default: module.QADashboardPage })));
const ActivityFeedPage  = lazy(() => import('./pages/collaboration/ActivityFeedPage').then(module => ({ default: module.ActivityFeedPage })));
const ReportsAnalyticsPage = lazy(() => import('./pages/collaboration/ReportsAnalyticsPage').then(module => ({ default: module.ReportsAnalyticsPage })));
const MemberProfilePage = lazy(() => import('./pages/collaboration/MemberProfilePage').then(module => ({ default: module.MemberProfilePage })));
const WorkspaceSettingsPage = lazy(() => import('./pages/collaboration/WorkspaceSettingsPage').then(module => ({ default: module.WorkspaceSettingsPage })));
const TeamKnowledgePage = lazy(() => import('./pages/collaboration/TeamKnowledgePage').then(module => ({ default: module.TeamKnowledgePage })));
const SprintBoardPage = lazy(() => import('./pages/collaboration/SprintBoardPage').then(module => ({ default: module.SprintBoardPage })));
const BacklogPage = lazy(() => import('./pages/collaboration/BacklogPage').then(module => ({ default: module.BacklogPage })));
const BlockersPage = lazy(() => import('./pages/collaboration/BlockersPage').then(module => ({ default: module.BlockersPage })));
const WorkspaceProjectsPage = lazy(() => import('./pages/collaboration/WorkspaceProjectsPage').then(module => ({ default: module.WorkspaceProjectsPage })));
const ProjectOverviewPage = lazy(() => import('./pages/collaboration/ProjectOverviewPage').then(module => ({ default: module.ProjectOverviewPage })));
const ProjectTimelinePage = lazy(() => import('./pages/collaboration/ProjectTimelinePage').then(module => ({ default: module.ProjectTimelinePage })));
const WorkspaceTeamsPage = lazy(() => import('./pages/collaboration/WorkspaceTeamsPage').then(module => ({ default: module.WorkspaceTeamsPage })));
const WorkspaceMembersPage = lazy(() => import('./pages/collaboration/WorkspaceMembersPage').then(module => ({ default: module.WorkspaceMembersPage })));

// Admin workspace pages
const AdminAudit      = lazy(() => import('./pages/admin/AdminAudit').then(module => ({ default: module.AdminAudit })));
const AdminPeople     = lazy(() => import('./pages/admin/AdminPeople').then(module => ({ default: module.AdminPeople })));
const AdminTeams      = lazy(() => import('./pages/admin/AdminTeams').then(module => ({ default: module.AdminTeams })));
const AdminSettings   = lazy(() => import('./pages/admin/AdminSettings').then(module => ({ default: module.AdminSettings })));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 flex items-center justify-center">
      <Spinner size={40} className="text-brand-500" />
    </div>
  );
}

// IES-P0-24: dedicated fallback when a lazy chunk fails to load.
function ChunkLoadFallback() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <h1 className="text-lg font-semibold mb-2">This page failed to load</h1>
        <p className="text-sm text-surface-400 mb-6">A chunk failed to download. Try reloading.</p>
        <Button onClick={() => window.location.reload()} type="button">
          Reload
        </Button>
      </Card>
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
  const { user, loading, restoreSession } = useAuthStore();
  const { loadAll }                              = useStore();

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (user) {
      loadAll();
    } else if (!loading) {
      clearTimer();
    }
  }, [user?._id, loading]);

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <ErrorBoundary fallback={<ChunkLoadFallback />}>
            <Routes>
            <Route path="/"                            element={<Landing />} />
            <Route path="/login"                       element={<Login />} />
            <Route path="/register"                    element={<Register />} />
            <Route path="/reports/share/token/:token"  element={<ShareReportPage />} />

            {/* Post-Login Workspace Hub */}
            <Route element={<ProtectedRoute />}>
              <Route path="/hub" element={<WorkspaceHub />} />
              <Route path="/team" element={<TeamProjects />} />
            </Route>

            {/* Dedicated Engineering Workspace Architecture */}
            <Route element={<ProtectedRoute />}>
              <Route path="/w/:workspaceId" element={<WorkspaceLayout />}>
                <Route path="overview" element={<TeamWorkspace />} />
                <Route path="projects" element={<WorkspaceProjectsPage />} />
                <Route path="projects/:projectId" element={<ProjectOverviewPage />} />
                <Route path="projects/:projectId/timeline" element={<ProjectTimelinePage />} />
                <Route path="sprints" element={<SprintBoardPage />} />
                <Route path="backlog" element={<BacklogPage />} />
                <Route path="blockers" element={<BlockersPage />} />
                <Route path="teams" element={<WorkspaceTeamsPage />} />
                <Route path="members" element={<WorkspaceMembersPage />} />
                <Route path="members/:memberId" element={<MemberProfilePage />} />
                <Route path="features" element={<FeaturesPage />} />
                <Route path="qa" element={<QADashboardPage />} />
                <Route path="activity" element={<ActivityFeedPage />} />
                <Route path="reports" element={<ReportsAnalyticsPage />} />
                <Route path="analytics" element={<Navigate to="reports" replace />} />
                <Route path="knowledge" element={<TeamKnowledgePage />} />
                <Route path="calendar" element={<TeamWorkspace />} />
                <Route path="settings" element={<WorkspaceSettingsPage />} />
                <Route path="" element={<Navigate to="overview" replace />} />
              </Route>
            </Route>

            {/* Workspace Selector (admin users only) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/workspace" element={
                user?.role === 'admin' ? <WorkspaceSelector /> : <Navigate to="/hub" replace />
              } />
            </Route>

            {/* Personal Workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<PersonalWorkspaceRouter />}>
                <Route path="/dashboard"   element={<TodayPage />} />
                <Route path="/worklog"     element={<WorkLogPage />} />
                <Route path="/worklog/:id" element={<WorkLogPage />} />
                <Route path="/knowledge"  element={<KnowledgePage />} />
                <Route path="/search"      element={<SearchResultsPage />} />
                <Route path="/reports"     element={<ReportsPage />} />
                <Route path="/analytics"   element={<Navigate to="/reports" replace />} />
                <Route path="/tasks"       element={<Tasks />} />
                <Route path="/tasks/:id"   element={<TaskDetail />} />
                <Route path="/journal"     element={<Journal />} />
                <Route path="/habits"      element={<Habits />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/focus"       element={<FocusMode />} />
                <Route path="/activity"    element={<PersonalActivityPage />} />
                <Route path="/settings"    element={<Settings />} />
              </Route>
            </Route>

            {/* Admin Workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminRoute><AdminWorkspaceRouter /></AdminRoute>}>
                <Route path="/admin/audit"     element={<AdminAudit />} />
                <Route path="/admin/people"    element={<AdminPeople />} />
                <Route path="/admin/teams"     element={<AdminTeams />} />
                <Route path="/admin/settings"  element={<AdminSettings />} />
                <Route path="/admin/overview"  element={<Navigate to="/admin/audit" replace />} />
                <Route path="/admin/analytics" element={<Navigate to="/admin/audit" replace />} />
                <Route path="/admin/activity"  element={<Navigate to="/admin/audit" replace />} />
                <Route path="/admin"           element={<Navigate to="/admin/audit" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  );
}

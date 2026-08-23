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
import SwarmCursor         from './components/ui/SwarmCursor';

const Landing         = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const Login           = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register        = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
// TEMP (Phase 3): isolated rich-text-editor test page — remove before release.
const RteTestPage     = lazy(() => import('./pages/RteTestPage').then(module => ({ default: module.RteTestPage })));
const WorkspaceHub    = lazy(() => import('./pages/WorkspaceHub').then(module => ({ default: module.WorkspaceHub })));
const TeamProjects    = lazy(() => import('./pages/TeamProjects').then(module => ({ default: module.TeamProjects })));
const WorkspaceLayout = lazy(() => import('./components/layout/WorkspaceLayout').then(module => ({ default: module.WorkspaceLayout })));
const ProjectLayout   = lazy(() => import('./components/layout/ProjectLayout').then(module => ({ default: module.ProjectLayout })));
const WorkspaceHomePage = lazy(() => import('./pages/collaboration/WorkspaceHomePage').then(module => ({ default: module.WorkspaceHomePage })));

// Personal Workspace Pages
const TodayPage       = lazy(() => import('./pages/TodayPage').then(module => ({ default: module.TodayPage })));
const Tasks           = lazy(() => import('./pages/Tasks').then(module => ({ default: module.Tasks })));
const TaskDetail      = lazy(() => import('./pages/TaskDetail').then(module => ({ default: module.TaskDetail })));
const SchedulePage    = lazy(() => import('./pages/SchedulePage').then(module => ({ default: module.SchedulePage })));
const Journal         = lazy(() => import('./pages/Journal').then(module => ({ default: module.Journal })));

const PersonalPage     = lazy(() => import('./pages/PersonalPage').then(module => ({ default: module.PersonalPage })));
const FocusMode       = lazy(() => import('./pages/FocusMode').then(module => ({ default: module.FocusMode })));
const PersonalActivityPage = lazy(() => import('./pages/PersonalActivityPage').then(module => ({ default: module.PersonalActivityPage })));
const Settings        = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Habits          = lazy(() => import('./pages/Habits').then(module => ({ default: module.Habits })));
const WorkLogPage     = lazy(() => import('./pages/WorkLog').then(module => ({ default: module.WorkLogPage })));
const KnowledgePage   = lazy(() => import('./pages/Knowledge').then(module => ({ default: module.KnowledgePage })));
const ReportsPage     = lazy(() => import('./pages/Reports').then(module => ({ default: module.ReportsPage })));
const InsightsPage    = lazy(() => import('./pages/InsightsPage').then(module => ({ default: module.InsightsPage })));
const Leaderboard     = lazy(() => import('./pages/Leaderboard').then(module => ({ default: module.Leaderboard })));
const ShareReportPage = lazy(() => import('./pages/ShareReport').then(module => ({ default: module.ShareReportPage })));
const WorkspaceSelector = lazy(() => import('./pages/WorkspaceSelector').then(module => ({ default: module.WorkspaceSelector })));
const SearchResultsPage = lazy(() => import('./pages/SearchResults').then(module => ({ default: module.SearchResultsPage })));
const RoadmapsPage    = lazy(() => import('./pages/RoadmapsPage').then(module => ({ default: module.RoadmapsPage })));
const RoadmapDetailPage = lazy(() => import('./pages/RoadmapDetailPage').then(module => ({ default: module.RoadmapDetailPage })));
const RoadmapPhaseDetail = lazy(() => import('./pages/PhaseDetailPage').then(module => ({ default: module.PhaseDetailPage })));
const RoadmapMilestoneDetail = lazy(() => import('./pages/MilestoneDetailPage').then(module => ({ default: module.MilestoneDetailPage })));
const PersonalAnalyticsPage = lazy(() => import('./pages/PersonalAnalyticsPage').then(module => ({ default: module.PersonalAnalyticsPage })));
const WorkLogDashboard = lazy(() => import('./pages/WorkLogDashboard').then(module => ({ default: module.WorkLogDashboard })));
const CollabDashboard  = lazy(() => import('./pages/CollabDashboard').then(module => ({ default: module.CollabDashboard })));

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
const SprintPlanningPage = lazy(() => import('./pages/collaboration/SprintPlanningPage').then(module => ({ default: module.SprintPlanningPage })));
const BacklogPage = lazy(() => import('./pages/collaboration/BacklogPage').then(module => ({ default: module.BacklogPage })));
const BlockersPage = lazy(() => import('./pages/collaboration/BlockersPage').then(module => ({ default: module.BlockersPage })));
const WorkspaceProjectsPage = lazy(() => import('./pages/collaboration/WorkspaceProjectsPage').then(module => ({ default: module.WorkspaceProjectsPage })));
const ProjectOverviewPage = lazy(() => import('./pages/collaboration/ProjectOverviewPage').then(module => ({ default: module.ProjectOverviewPage })));
const ProjectTimelinePage = lazy(() => import('./pages/collaboration/ProjectTimelinePage').then(module => ({ default: module.ProjectTimelinePage })));
const WorkspaceTeamsPage = lazy(() => import('./pages/collaboration/WorkspaceTeamsPage').then(module => ({ default: module.WorkspaceTeamsPage })));
const WorkspaceMembersPage = lazy(() => import('./pages/collaboration/WorkspaceMembersPage').then(module => ({ default: module.WorkspaceMembersPage })));

// EEP2-P3.4.2/P3.4.3: Roadmap spine pages (hosted by ProjectLayout).
const RoadmapPage = lazy(() => import('./pages/collaboration/RoadmapPage').then(module => ({ default: module.RoadmapPage })));
const MilestoneDetailPage = lazy(() => import('./pages/collaboration/MilestoneDetailPage').then(module => ({ default: module.MilestoneDetailPage })));
const PhaseDetailPage = lazy(() => import('./pages/collaboration/PhaseDetailPage').then(module => ({ default: module.PhaseDetailPage })));
const ModuleDetailPage = lazy(() => import('./pages/collaboration/ModuleDetailPage').then(module => ({ default: module.ModuleDetailPage })));

// Admin workspace pages
const AdminAudit      = lazy(() => import('./pages/admin/AdminAudit').then(module => ({ default: module.AdminAudit })));
const AdminPeople     = lazy(() => import('./pages/admin/AdminPeople').then(module => ({ default: module.AdminPeople })));
const AdminTeams      = lazy(() => import('./pages/admin/AdminTeams').then(module => ({ default: module.AdminTeams })));
const AdminSettings   = lazy(() => import('./pages/admin/AdminSettings').then(module => ({ default: module.AdminSettings })));

function RouteFallback() {
  const accent = useStore(s => s.theme.accentColor) || '#0ea5e9';
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50" role="status" aria-label="Loading">
      <SwarmCursor color={accent} accentColor="#ffffff" count={14} size={9} speed={2.5} spread={90} />
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
  return <AppLayout />;
}

export default function App() {
  const { user, loading, restoreSession } = useAuthStore();
  const { loadAll }                              = useStore();

  // FocusFlow pre-React loader handoff: signal readiness after first commit.
  useEffect(() => {
    window.dispatchEvent(new Event('focusflow:app-ready'));
  }, []);

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

            {/* TEMP (Phase 3): isolated rich-text-editor test page (public, no auth) */}
            <Route path="/rte-test"                    element={<RteTestPage />} />

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
                {/* EEP2-P3.3.2: project route tree (DDS §8.3) hosted by ProjectLayout.
                    Additive — deep links to project pages keep working. */}
                <Route path="projects/:projectId" element={<ProjectLayout />}>
                  <Route index element={<ProjectOverviewPage />} />
                  <Route path="timeline" element={<ProjectTimelinePage />} />
                  <Route path="roadmap" element={<RoadmapPage />} />
                  <Route path="roadmap/:milestoneId" element={<MilestoneDetailPage />} />
                  <Route path="phases/:phaseId" element={<PhaseDetailPage />} />
                  <Route path="modules/:moduleId" element={<ModuleDetailPage />} />
                </Route>
                <Route path="sprints" element={<SprintBoardPage />} />
                <Route path="sprints/plan" element={<SprintPlanningPage />} />
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
                <Route path="" element={<WorkspaceHomePage />} />
              </Route>
            </Route>

            {/* Workspace Selector */}
            <Route element={<ProtectedRoute />}>
              <Route path="/workspace" element={<WorkspaceSelector />} />
            </Route>

            {/* WorkLog Workspace Dashboard */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/worklog/dashboard" element={<WorkLogDashboard />} />
                <Route path="/collab/dashboard" element={<CollabDashboard />} />
              </Route>
            </Route>

            {/* Personal Workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<PersonalWorkspaceRouter />}>
                <Route path="/dashboard"   element={<TodayPage />} />
                <Route path="/personal"   element={<PersonalPage />} />
                <Route path="/worklog"     element={<WorkLogPage />} />
                <Route path="/worklog/:id" element={<WorkLogPage />} />
                <Route path="/knowledge"  element={<KnowledgePage />} />
                <Route path="/search"      element={<SearchResultsPage />} />
                <Route path="/reports"     element={<ReportsPage />} />
                <Route path="/insights"    element={<InsightsPage />} />
                <Route path="/analytics"   element={<PersonalAnalyticsPage />} />
                <Route path="/tasks"       element={<Tasks />} />
                <Route path="/tasks/:id"   element={<TaskDetail />} />
                <Route path="/schedule"    element={<SchedulePage />} />
                <Route path="/roadmaps"    element={<RoadmapsPage />} />
                <Route path="/roadmaps/:id" element={<RoadmapDetailPage />} />
                <Route path="/roadmaps/:id/phases/:phaseId" element={<RoadmapPhaseDetail />} />
                <Route path="/roadmaps/:id/phases/:phaseId/milestones/:milestoneId" element={<RoadmapMilestoneDetail />} />
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

import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useAuthStore }    from '@shared/services/useAuthStore';
import { useStore }        from '@worklog/services/useStore';
import { useWorkspaceStore } from '@shared/services/useWorkspaceStore';
import { deriveWorkspaceFromPath } from '@collab/services/workspaceRouting';
import { clearTimer }      from '@worklog/services/timerPersist';
import { ErrorBoundary }  from '@shared/components/ui/ErrorBoundary';

import { AppLayout }       from '@shared/components/layout/AppLayout';
import { AdminLayout }     from '@shared/components/layout/AdminLayout';
import { ProtectedRoute, AdminRoute } from '@shared/components/auth/ProtectedRoute';
import { Card }            from '@shared/components/ui/Card';
import { Button }          from '@shared/components/ui/Button';
import SwarmCursor         from '@shared/components/ui/SwarmCursor';

const Landing         = lazy(() => import('@shared/pages/Landing').then(module => ({ default: module.Landing })));
const Login           = lazy(() => import('@shared/pages/Login').then(module => ({ default: module.Login })));
const Register        = lazy(() => import('@shared/pages/Register').then(module => ({ default: module.Register })));
// TEMP (Phase 3): isolated rich-text-editor test page — remove before release.
const RteTestPage     = lazy(() => import('@shared/pages/RteTestPage').then(module => ({ default: module.RteTestPage })));
const HomePage         = lazy(() => import('@shared/pages/WorkspaceHub').then(module => ({ default: module.HomePage })));
const ProjectsPage    = lazy(() => import('@collab/pages/ProjectsPage').then(module => ({ default: module.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('@collab/pages/ProjectDetailPage').then(module => ({ default: module.ProjectDetailPage })));
const ProjectKanbanPage = lazy(() => import('@collab/pages/ProjectKanbanPage').then(module => ({ default: module.ProjectKanbanPage })));
const WorkspaceLayout = lazy(() => import('@shared/components/layout/WorkspaceLayout').then(module => ({ default: module.WorkspaceLayout })));
const ProjectLayout   = lazy(() => import('@shared/components/layout/ProjectLayout').then(module => ({ default: module.ProjectLayout })));
const WorkspaceHomePage = lazy(() => import('@collab/pages/collaboration/WorkspaceHomePage').then(module => ({ default: module.WorkspaceHomePage })));

// Personal Workspace Pages
const TodayPage       = lazy(() => import('@worklog/pages/TodayPage').then(module => ({ default: module.TodayPage })));
const NotFoundPage    = lazy(() => import('@shared/pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));
const Tasks           = lazy(() => import('@worklog/pages/Tasks').then(module => ({ default: module.Tasks })));
const TaskDetail      = lazy(() => import('@worklog/pages/TaskDetail').then(module => ({ default: module.TaskDetail })));
const SchedulePage    = lazy(() => import('@worklog/pages/SchedulePage').then(module => ({ default: module.SchedulePage })));
const Journal         = lazy(() => import('@personal/pages/Journal').then(module => ({ default: module.Journal })));

const PersonalPage     = lazy(() => import('@personal/pages/PersonalPage').then(module => ({ default: module.PersonalPage })));
const PersonalActivityPage = lazy(() => import('@personal/pages/PersonalActivityPage').then(module => ({ default: module.PersonalActivityPage })));
const Settings        = lazy(() => import('@shared/pages/Settings').then(module => ({ default: module.Settings })));
const Habits          = lazy(() => import('@worklog/pages/Habits').then(module => ({ default: module.Habits })));
const WorkLogPage     = lazy(() => import('@worklog/pages/WorkLog').then(module => ({ default: module.WorkLogPage })));
const KnowledgePage   = lazy(() => import('@worklog/pages/Knowledge').then(module => ({ default: module.KnowledgePage })));
const ReportsPage     = lazy(() => import('@worklog/pages/Reports').then(module => ({ default: module.ReportsPage })));
const InsightsPage    = lazy(() => import('@worklog/pages/InsightsPage').then(module => ({ default: module.InsightsPage })));
const CalendarPage    = lazy(() => import('@worklog/pages/CalendarPage').then(module => ({ default: module.CalendarPage })));
const Leaderboard     = lazy(() => import('@collab/pages/Leaderboard').then(module => ({ default: module.Leaderboard })));
const ShareReportPage = lazy(() => import('@shared/pages/ShareReport').then(module => ({ default: module.ShareReportPage })));
const WorkspaceSelector = lazy(() => import('@shared/pages/WorkspaceSelector').then(module => ({ default: module.WorkspaceSelector })));
const SearchResultsPage = lazy(() => import('@shared/pages/SearchResults').then(module => ({ default: module.SearchResultsPage })));
const RoadmapsPage    = lazy(() => import('@personal/pages/RoadmapsPage').then(module => ({ default: module.RoadmapsPage })));
const RoadmapDetailPage = lazy(() => import('@personal/pages/RoadmapDetailPage').then(module => ({ default: module.RoadmapDetailPage })));
const RoadmapPhaseDetail = lazy(() => import('@personal/pages/PhaseDetailPage').then(module => ({ default: module.PhaseDetailPage })));
const RoadmapMilestoneDetail = lazy(() => import('@personal/pages/MilestoneDetailPage').then(module => ({ default: module.MilestoneDetailPage })));
const PersonalAnalyticsPage = lazy(() => import('@personal/pages/PersonalAnalyticsPage').then(module => ({ default: module.PersonalAnalyticsPage })));
const PersonalTasks      = lazy(() => import('@personal/pages/PersonalTasks').then(module => ({ default: module.PersonalTasks })));
const PersonalTodayPage  = lazy(() => import('@personal/pages/PersonalTodayPage').then(module => ({ default: module.PersonalTodayPage })));
const PersonalTaskDetail = lazy(() => import('@personal/pages/PersonalTaskDetail').then(module => ({ default: module.PersonalTaskDetail })));
const PersonalSchedule   = lazy(() => import('@personal/pages/PersonalSchedule').then(module => ({ default: module.PersonalSchedule })));
const WorkLogDashboard = lazy(() => import('@worklog/pages/WorkLogDashboard').then(module => ({ default: module.WorkLogDashboard })));
const CollabDashboard  = lazy(() => import('@collab/pages/CollabDashboard').then(module => ({ default: module.CollabDashboard })));
const PeoplePage       = lazy(() => import('@collab/pages/PeoplePage').then(module => ({ default: module.PeoplePage })));

// Developer Collaboration Workspace Pages
const TeamWorkspace     = lazy(() => import('@collab/pages/collaboration/TeamWorkspace').then(module => ({ default: module.TeamWorkspace })));
const FeaturesPage      = lazy(() => import('@collab/pages/collaboration/FeaturesPage').then(module => ({ default: module.FeaturesPage })));
const QADashboardPage    = lazy(() => import('@collab/pages/collaboration/QADashboardPage').then(module => ({ default: module.QADashboardPage })));
const ActivityFeedPage  = lazy(() => import('@collab/pages/collaboration/ActivityFeedPage').then(module => ({ default: module.ActivityFeedPage })));
const ReportsAnalyticsPage = lazy(() => import('@collab/pages/collaboration/ReportsAnalyticsPage').then(module => ({ default: module.ReportsAnalyticsPage })));
const MemberProfilePage = lazy(() => import('@collab/pages/collaboration/MemberProfilePage').then(module => ({ default: module.MemberProfilePage })));
const WorkspaceSettingsPage = lazy(() => import('@collab/pages/collaboration/WorkspaceSettingsPage').then(module => ({ default: module.WorkspaceSettingsPage })));
const TeamKnowledgePage = lazy(() => import('@collab/pages/collaboration/TeamKnowledgePage').then(module => ({ default: module.TeamKnowledgePage })));
const SprintBoardPage = lazy(() => import('@collab/pages/collaboration/SprintBoardPage').then(module => ({ default: module.SprintBoardPage })));
const SprintPlanningPage = lazy(() => import('@collab/pages/collaboration/SprintPlanningPage').then(module => ({ default: module.SprintPlanningPage })));
const BacklogPage = lazy(() => import('@collab/pages/collaboration/BacklogPage').then(module => ({ default: module.BacklogPage })));
const BlockersPage = lazy(() => import('@collab/pages/collaboration/BlockersPage').then(module => ({ default: module.BlockersPage })));
const WorkspaceProjectsPage = lazy(() => import('@collab/pages/collaboration/WorkspaceProjectsPage').then(module => ({ default: module.WorkspaceProjectsPage })));
const ProjectOverviewPage = lazy(() => import('@collab/pages/collaboration/ProjectOverviewPage').then(module => ({ default: module.ProjectOverviewPage })));
const ProjectTimelinePage = lazy(() => import('@collab/pages/collaboration/ProjectTimelinePage').then(module => ({ default: module.ProjectTimelinePage })));
const WorkspaceTeamsPage = lazy(() => import('@collab/pages/collaboration/WorkspaceTeamsPage').then(module => ({ default: module.WorkspaceTeamsPage })));
const WorkspaceMembersPage = lazy(() => import('@collab/pages/collaboration/WorkspaceMembersPage').then(module => ({ default: module.WorkspaceMembersPage })));

// EEP2-P3.4.2/P3.4.3: Roadmap spine pages (hosted by ProjectLayout).
const RoadmapPage = lazy(() => import('@collab/pages/collaboration/RoadmapPage').then(module => ({ default: module.RoadmapPage })));
const MilestoneDetailPage = lazy(() => import('@collab/pages/collaboration/MilestoneDetailPage').then(module => ({ default: module.MilestoneDetailPage })));
const PhaseDetailPage = lazy(() => import('@collab/pages/collaboration/PhaseDetailPage').then(module => ({ default: module.PhaseDetailPage })));
const ModuleDetailPage = lazy(() => import('@collab/pages/collaboration/ModuleDetailPage').then(module => ({ default: module.ModuleDetailPage })));

// Admin workspace pages
const AdminAudit      = lazy(() => import('@shared/pages/admin/AdminAudit').then(module => ({ default: module.AdminAudit })));
const AdminPeople     = lazy(() => import('@shared/pages/admin/AdminPeople').then(module => ({ default: module.AdminPeople })));
const AdminTeams      = lazy(() => import('@shared/pages/admin/AdminTeams').then(module => ({ default: module.AdminTeams })));
const AdminSettings   = lazy(() => import('@shared/pages/admin/AdminSettings').then(module => ({ default: module.AdminSettings })));

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

/**
 * Syncs the active workspace context to the current URL. The sidebar branches on
 * `useAuthStore.workspace`; deriving it from the route keeps the nav consistent
 * with the page the user is on and — because BrowserRouter preserves the URL —
 * makes the choice survive a refresh (it's also persisted to `ff-workspace`).
 */
function WorkspaceSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const ws = deriveWorkspaceFromPath(pathname);
    // null means the route is workspace-agnostic (e.g. /home) — skip the update
    // to keep the sidebar in its previous state.
    if (ws === null) return;
    // useWorkspaceStore's WorkspaceType omits 'admin' (admin uses its own layout);
    // persist it as 'collab' there, but keep the full value on useAuthStore which
    // drives the sidebar/admin routing.
    useWorkspaceStore.getState().setWorkspace(ws === 'admin' ? 'collab' : ws);
    useAuthStore.getState().setWorkspace(ws);
  }, [pathname]);
  return null;
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
      // Rehydrate a personal workspace session on refresh so a running personal
      // timer survives and isn't reaped by the server. It must run even if
      // loadAll() fails (profile/tasks error), so rehydrate on settle, not only
      // on resolve.
      const rehydrate = () =>
        import('@personal/services/usePersonalTaskStore').then((m) =>
          m.usePersonalTaskStore.getState().rehydratePersonalTimer(),
        );
      loadAll().then(rehydrate, rehydrate);
    } else if (!loading) {
      clearTimer();
    }
  }, [user?._id, loading]);

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <WorkspaceSync />
        <Suspense fallback={<RouteFallback />}>
          <ErrorBoundary fallback={<ChunkLoadFallback />}>
            <Routes>
            <Route path="/"                            element={<Landing />} />
            <Route path="/login"                       element={<Login />} />
            <Route path="/register"                    element={<Register />} />
            <Route path="/reports/share/token/:token"  element={<ShareReportPage />} />

            {/* TEMP (Phase 3): isolated rich-text-editor test page (public, no auth) */}
            <Route path="/rte-test"                    element={<RteTestPage />} />

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

            {/* WorkLog Workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<PersonalWorkspaceRouter />}>
                <Route path="/worklog/dashboard" element={<TodayPage />} />
                <Route path="/worklog/tasks" element={<Tasks />} />
                <Route path="/worklog/tasks/:id" element={<TaskDetail />} />
                <Route path="/worklog/schedule" element={<SchedulePage />} />
                <Route path="/worklog/calendar" element={<CalendarPage />} />
                <Route path="/worklog/logs" element={<WorkLogPage />} />
                <Route path="/worklog/logs/:id" element={<WorkLogPage />} />
                <Route path="/worklog/knowledge" element={<KnowledgePage />} />
                <Route path="/worklog/search" element={<SearchResultsPage />} />
                <Route path="/worklog/reports" element={<ReportsPage />} />
                <Route path="/worklog/insights" element={<InsightsPage />} />
                <Route path="/worklog/habits" element={<Habits />} />
                <Route path="/worklog/worklog-dashboard" element={<WorkLogDashboard />} />
              </Route>
            </Route>

            {/* Personal Workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<PersonalWorkspaceRouter />}>
                <Route path="/personal" element={<PersonalPage />} />
                <Route path="/personal/today" element={<PersonalTodayPage />} />
                <Route path="/personal/tasks" element={<PersonalTasks />} />
                <Route path="/personal/tasks/:id" element={<PersonalTaskDetail />} />
                <Route path="/personal/schedule" element={<PersonalSchedule />} />
                <Route path="/personal/activity" element={<PersonalActivityPage />} />
                <Route path="/personal/analytics" element={<PersonalAnalyticsPage />} />
                <Route path="/personal/roadmaps" element={<RoadmapsPage />} />
                <Route path="/personal/roadmaps/:id" element={<RoadmapDetailPage />} />
                <Route path="/personal/roadmaps/:id/phases/:phaseId" element={<RoadmapPhaseDetail />} />
                <Route path="/personal/roadmaps/:id/phases/:phaseId/milestones/:milestoneId" element={<RoadmapMilestoneDetail />} />
                <Route path="/personal/journal" element={<Journal />} />
                <Route path="/personal/search" element={<SearchResultsPage />} />
              </Route>
            </Route>

            {/* Collab Workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<PersonalWorkspaceRouter />}>
                <Route path="/collab/dashboard" element={<CollabDashboard />} />
                <Route path="/collab/team" element={<ProjectsPage />} />
                <Route path="/collab/team/:projectId" element={<ProjectDetailPage />} />
                <Route path="/collab/team/:projectId/kanban" element={<ProjectKanbanPage />} />
                <Route path="/collab/people" element={<PeoplePage />} />
                <Route path="/collab/leaderboard" element={<Leaderboard />} />
                <Route path="/collab/activity" element={<ActivityFeedPage />} />
                <Route path="/collab/search" element={<SearchResultsPage />} />
              </Route>
            </Route>

            {/* Homepage (workspace switcher) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<HomePage />} />
            </Route>

            {/* Settings (shared) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<PersonalWorkspaceRouter />}>
                <Route path="/settings" element={<Settings />} />
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

            <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  );
}

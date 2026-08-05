import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]*)"/g)].map((m) => m[1]);

describe('route table', () => {
  it('contains no paths with whitespace', () => {
    const spaced = routePaths.filter((p) => /\s/.test(p));
    expect(spaced).toEqual([]);
  });

  it('contains the canonical workspace routes', () => {
    const expected = [
      '/',
      '/login',
      '/register',
      '/hub',
      '/team',
      '/w/:workspaceId',
      'overview',
      'projects',
      'sprints',
      'backlog',
      'blockers',
      'teams',
      'members',
      'activity',
      'reports',
      'analytics',
      'knowledge',
      'calendar',
      'settings',
      '/dashboard',
      '/worklog',
      '/worklog/:id',
      '/reports',
      '/tasks',
      '/tasks/:id',
      '/journal',
      '/habits',
      '/leaderboard',
      '/focus',
      '/activity',
      '/admin/audit',
      '/admin/people',
      '/admin/teams',
      '/admin/settings',
    ];
    for (const p of expected) {
      expect(routePaths).toContain(p);
    }
  });

  it('contains no typo duplicates', () => {
    const typos = ['overview hover', '/team text', '/worklog text', '/analytics text', '/analytics font', '/settings text'];
    for (const p of typos) {
      expect(routePaths).not.toContain(p);
    }
  });
});

describe('S4-T3 regression: deep-link pages, never daily mega-tabs', () => {
  it('routes projects/teams/members to dedicated pages, not TeamWorkspace', () => {
    const lines = appSource.split('\n');
    const projectsLine = lines.find((l) => l.includes('path="projects"'));
    const teamsLine = lines.find((l) => l.includes('path="teams"'));
    const membersLine = lines.find((l) => l.includes('path="members"'));
    expect(projectsLine).toContain('WorkspaceProjectsPage');
    expect(teamsLine).toContain('WorkspaceTeamsPage');
    expect(membersLine).toContain('WorkspaceMembersPage');
    expect(projectsLine).not.toContain('TeamWorkspace');
    expect(teamsLine).not.toContain('TeamWorkspace');
    expect(membersLine).not.toContain('TeamWorkspace');
  });

  it('TeamWorkspace no longer declares projects or admin tabs', () => {
    const teamWorkspace = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/TeamWorkspace.tsx'), 'utf8');
    expect(teamWorkspace).toContain("type TeamTab = 'dashboard' | 'docs' | 'calendar';");
    expect(teamWorkspace).not.toMatch(/'projects'|'admin'/);
  });

  it('retired admin routes redirect to the Audit deep link', () => {
    const lines = appSource.split('\n');
    for (const p of ['/admin/overview', '/admin/analytics', '/admin/activity']) {
      const line = lines.find((l) => l.includes(`path="${p}"`));
      expect(line).toContain('Navigate to="/admin/audit" replace');
    }
    expect(routePaths).toContain('/admin/audit');
  });

  it('admin sidebar navigation no longer points at retired routes', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/AdminSidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/\/admin\/(overview|analytics|activity)/);
    expect(sidebar).toContain("to: '/admin/audit'");
  });
});

describe('S4-T4 regression: role-aware defaults + /team collision cleanup', () => {
  it('/team is declared once, backed by TeamProjects', () => {
    const teamRoutes = appSource.match(/<Route\s+path="\/team"/g) ?? [];
    expect(teamRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="\/team"\s+element={<TeamProjects \/>}/);
  });

  it('removes the dead personal /team → TeamWorkspace route', () => {
    expect(appSource).not.toMatch(/<Route\s+path="\/team"\s+element={<TeamWorkspace \/>}/);
    expect(appSource).toMatch(/<Route\s+path="overview"\s+element={<TeamWorkspace \/>}/);
  });

  it('role-aware landings use the default-view helper', () => {
    const login = readFileSync(resolve(process.cwd(), 'src/pages/Login.tsx'), 'utf8');
    const register = readFileSync(resolve(process.cwd(), 'src/pages/Register.tsx'), 'utf8');
    const protectedRoute = readFileSync(resolve(process.cwd(), 'src/components/auth/ProtectedRoute.tsx'), 'utf8');
    for (const source of [login, register, protectedRoute]) {
      expect(source).toContain('resolveDefaultLanding');
    }
    expect(login).toContain('useAuthStore.getState().user?.role');
    expect(register).toContain('useAuthStore.getState().user?.role');
    expect(protectedRoute).toContain('resolveDefaultLanding(user?.role)');
    expect(protectedRoute).not.toMatch(/to="\/dashboard"/);
  });

  it('personal sidebar no longer links /team; exposes the hub switcher', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/to: '\/team'/);
    expect(sidebar).toMatch(/to: '\/hub'/);
    expect(sidebar).toContain("label: 'Workspace Hub'");
  });
});

describe('P1-T1 regression: actionable project overview', () => {
  it('declares the project detail route once, backed by ProjectOverviewPage', () => {
    const projectRoutes = appSource.match(/<Route\s+path="projects\/:projectId"/g) ?? [];
    expect(projectRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="projects\/:projectId"\s+element={<ProjectOverviewPage \/>}/);
    expect(routePaths).toContain('projects/:projectId');
  });

  it('lazy-loads ProjectOverviewPage alongside the other workspace pages', () => {
    expect(appSource).toMatch(/const ProjectOverviewPage = lazy\(\(\) => import\('\.\/pages\/collaboration\/ProjectOverviewPage'\)/);
  });

  it('page layout is responsive (mobile stacks, desktop splits 2fr/1fr, KPIs 4-up)', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/ProjectOverviewPage.tsx'), 'utf8');
    expect(page).toMatch(/grid-cols-1\s+lg:grid-cols-\[2fr_1fr\]/);
    expect(page).toMatch(/grid-cols-2\s+lg:grid-cols-4/);
    expect(page).toContain('Current Sprint');
    expect(page).toContain('Active Features');
    expect(page).toContain('Team Progress');
    expect(page).toContain('Recent Work');
    expect(page).toContain('Blockers');
    expect(page).toContain('Releases & Milestones');
  });

  it('project cards on WorkspaceProjectsPage link to the detail overview', () => {
    const projectsPage = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/WorkspaceProjectsPage.tsx'), 'utf8');
    expect(projectsPage).toContain(`to={\`/w/\${activeWorkspaceId}/projects/\${proj.id}\`}`);
    expect(projectsPage).toContain('Open Project Overview');
  });

  it('Breadcrumbs already label the project detail param', () => {
    const breadcrumbs = readFileSync(resolve(process.cwd(), 'src/components/ui/Breadcrumbs.tsx'), 'utf8');
    expect(breadcrumbs).toContain('/w/:workspaceId/projects/:projectId');
    expect(breadcrumbs).toMatch(/projectId:\s*'Project'/);
  });
});

describe('P1-T2 regression: project timeline deep-link', () => {
  it('declares the timeline route once, backed by ProjectTimelinePage', () => {
    const timelineRoutes = appSource.match(/<Route\s+path="projects\/:projectId\/timeline"/g) ?? [];
    expect(timelineRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="projects\/:projectId\/timeline"\s+element={<ProjectTimelinePage \/>}/);
    expect(routePaths).toContain('projects/:projectId/timeline');
  });

  it('lazy-loads ProjectTimelinePage', () => {
    expect(appSource).toMatch(/const ProjectTimelinePage = lazy\(\(\) => import\('\.\/pages\/collaboration\/ProjectTimelinePage'\)/);
  });

  it('Breadcrumbs label the timeline segment', () => {
    const breadcrumbs = readFileSync(resolve(process.cwd(), 'src/components/ui/Breadcrumbs.tsx'), 'utf8');
    expect(breadcrumbs).toContain('/w/:workspaceId/projects/:projectId/timeline');
    expect(breadcrumbs).toMatch(/timeline:\s*'Timeline'/);
  });

  it('the project overview page links to the timeline', () => {
    const overview = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/ProjectOverviewPage.tsx'), 'utf8');
    expect(overview).toContain('View Timeline');
    expect(overview).toContain('navigate(`${projectsUrl}/${overview.project.id}/timeline`)');
  });

  it('timeline page is responsive and filter state lives in the URL', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/collaboration/ProjectTimelinePage.tsx'), 'utf8');
    expect(page).toMatch(/p-6\s+lg:p-8\s+max-w-\[1600px\]/);
    expect(page).toContain('useSearchParams');
    expect(page).toMatch(/flex\s+flex-wrap\s+items-center\s+gap-2/);
    expect(page).toContain('aria-pressed');
    expect(page).toContain('groupTimelineEventsByDay');
  });
});

describe('PI-1.1 regression: personal insights deep-link', () => {
  it('declares the /insights route once, backed by InsightsPage', () => {
    const insightRoutes = appSource.match(/<Route\s+path="\/insights"/g) ?? [];
    expect(insightRoutes).toHaveLength(1);
    expect(appSource).toMatch(/<Route\s+path="\/insights"\s+element={<InsightsPage \/>}/);
    expect(routePaths).toContain('/insights');
  });

  it('lazy-loads InsightsPage alongside the personal pages', () => {
    expect(appSource).toMatch(/const InsightsPage\s*=\s*lazy\(\(\) => import\('\.\/pages\/InsightsPage'\)/);
  });

  it('personal sidebar links to /insights next to Reports', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
    expect(sidebar).toContain("to: '/reports'");
    expect(sidebar).toContain("to: '/insights'");
    expect(sidebar).toContain("label: 'Insights'");
  });

  it('insights page is responsive and a Reports companion, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toMatch(/p-6\s+lg:p-8\s+max-w-\[1400px\]/);
    expect(page).toMatch(/grid-cols-1\s+md:grid-cols-2\s+xl:grid-cols-3/);
    expect(page).toContain('Most Important');
    expect(page).toContain("Today's Insights");
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('insights are generated by the pure daily selector with honest empty rules', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectDailyInsights');
    expect(selectors).toContain('computeRangeStats');
    expect(selectors).toContain('confidence');
    expect(selectors).toContain('mostImportant');
    expect(selectors).toContain('period');
  });
});

describe('PI-1.2 regression: weekly insights on the same page', () => {
  it('insights page renders the weekly section as a Today companion, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toContain("This Week's Insights");
    expect(page).toContain('selectWeeklyInsights');
    expect(page).toContain('Weekly Focus');
    expect(page).toMatch(/grid-cols-1\s+md:grid-cols-2\s+xl:grid-cols-3/);
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('weekly insights come from a pure ISO-week selector with an honest baseline rule', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectWeeklyInsights');
    expect(selectors).toContain('startOfIsoWeekInTz');
    expect(selectors).toContain('getComparisonDelta');
    expect(selectors).toContain('prevStats');
    expect(selectors).toContain('weekly-trend');
  });

  it('the ISO week is bounded in src/utils/time.ts, not inlined in the selector', () => {
    const time = readFileSync(resolve(process.cwd(), 'src/utils/time.ts'), 'utf8');
    expect(time).toContain('export function startOfIsoWeekInTz');
    expect(time).toContain('export function endOfIsoWeekInTz');
    expect(time).toContain('export function formatDateShortInTz');
  });
});

describe('PI-1.3 regression: work-pattern insights on the same page', () => {
  it('insights page renders the Work Pattern section below the weekly section, not a KPI clone', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/InsightsPage.tsx'), 'utf8');
    expect(page).toContain('Work Pattern Insights');
    expect(page).toContain('selectWorkPatternInsights');
    expect(page).toContain('Pattern Focus');
    expect(page).toMatch(/grid-cols-1\s+md:grid-cols-2\s+xl:grid-cols-3/);
    expect(page).not.toMatch(/AnalyticsSection|recharts|BarChart|PieChart/);
  });

  it('work-pattern insights come from a pure selector over a trailing 4-week window', () => {
    const selectors = readFileSync(resolve(process.cwd(), 'src/lib/insightsSelectors.ts'), 'utf8');
    expect(selectors).toContain('export function selectWorkPatternInsights');
    expect(selectors).toContain('hourOfDayInTz');
    expect(selectors).toContain('weekdayInTz');
    expect(selectors).toContain('PATTERN_WINDOW_WEEKS');
    expect(selectors).toContain('pattern-time-of-day');
    expect(selectors).toContain('pattern-weekday');
    expect(selectors).toContain('pattern-session-length');
  });

  it('the wall-clock hour and weekday helpers live in src/utils/time.ts', () => {
    const time = readFileSync(resolve(process.cwd(), 'src/utils/time.ts'), 'utf8');
    expect(time).toContain('export function hourOfDayInTz');
    expect(time).toContain('export function weekdayInTz');
  });
});
